import { storage } from './storage.js';

function normalizeFilter(filter){
  // Supports both object-based and legacy string formats.
  // Legacy examples: "all", "tag:wizz-network", "tag:wizz-base".
  if(!filter) return { type:'all' };

  if(typeof filter === 'string'){
    const f = filter.trim();
    if(!f || f === 'all' || f === 'global' || f === '*') return { type:'all' };

    // Allow explicit list format: "icao_list:<file>" / "iata_list:<file>"
    if(f.startsWith('icao_list:')) return { type:'icao_list', file: f.slice('icao_list:'.length).trim() };
    if(f.startsWith('iata_list:')) return { type:'iata_list', file: f.slice('iata_list:'.length).trim() };

    // Backward-compat tag format.
    if(f.startsWith('tag:')){
      const tag = f.slice(4).trim();
      if(tag === 'wizz-network') return { type:'icao_list', file:'wizz_network_icao.txt' };
      if(tag === 'wizz-base' || tag === 'wizz-bases') return { type:'iata_list', file:'wizz_bases_iata.txt' };
      return { type:'tag', tag };
    }

    // Unknown string filter -> safe fallback.
    return { type:'all' };
  }

  if(typeof filter === 'object'){
    // Ensure at least a type.
    if(filter.type) return filter;
    if(filter.file && filter.kind){
      // tolerate {kind:'icao_list', file:'...'}
      return { type: String(filter.kind), file: filter.file };
    }
    return { type:'all' };
  }

  return { type:'all' };
}

async function fetchText(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  return await r.text();
}

async function fetchJson(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  return await r.json();
}

export async function loadAllData(){
  const packs = await fetchJson('./data/packs.json');

  // Prefer the full dataset if Actions generated it.
  let dbAirports;
  let dbSource = 'unknown';
  try{
    dbAirports = await fetchJson('./data/airports.min.json');
    dbSource = 'full';
  }catch(e){
    dbAirports = await fetchJson('./data/airports.sample.json');
    dbSource = 'sample';
  }

  const lists = {};
  for(const p of packs.packs){
    const f = normalizeFilter(p.filter);
    if(f?.file){
      const file = String(f.file);
      if(!lists[file]){
        const txt = await fetchText(`./data/${file}`);
        lists[file] = txt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      }
    }
  }

  return { packs: packs.packs, airports: dbAirports, lists, meta: { dbSource } };
}

export function buildPool(db, packId){
  const pack = db.packs.find(p=>p.id===packId) || db.packs[0];
  const f = normalizeFilter(pack.filter);
  let pool = db.airports;

  if(f.type==='icao_list'){
    const icaos = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    pool = db.airports.filter(a=>a.icao && icaos.has(a.icao.toUpperCase()));
  }else if(f.type==='iata_list'){
    const iatas = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    pool = db.airports.filter(a=>a.iata && iatas.has(a.iata.toUpperCase()));
  }else if(f.type==='tag'){
    // Dataset currently has no tags; keep safe fallback (all).
    // This branch exists for forward-compat.
    pool = db.airports;
  }

  storage.set('packId', pack.id);
  return { pack, pool };
}
