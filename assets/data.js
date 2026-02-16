import { storage } from './storage.js';
import { perf } from './perf.js';

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

  const byICAO = {};
  const byIATA = {};
  for(const a of dbAirports){
    if(a?.icao) byICAO[String(a.icao).toUpperCase()] = a;
    if(a?.iata) byIATA[String(a.iata).toUpperCase()] = a;
  }

  return { packs: packs.packs, airports: dbAirports, lists, indexes: { byICAO, byIATA }, meta: { dbSource } };
}

function applyFilter(db, airports, f){
  if(!f || f.type==='all') return airports;

  if(f.type==='icao_list'){
    const icaos = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    return airports.filter(a=>a.icao && icaos.has(String(a.icao).toUpperCase()));
  }

  if(f.type==='iata_list'){
    const iatas = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    return airports.filter(a=>a.iata && iatas.has(String(a.iata).toUpperCase()));
  }

  if(f.type==='countries'){
    const c = new Set((f.countries||[]).map(x=>String(x).toUpperCase()));
    return airports.filter(a=>a.country && c.has(String(a.country).toUpperCase()));
  }

  if(f.type==='and'){
    let cur = airports;
    for(const sub of (f.filters||[])){
      cur = applyFilter(db, cur, normalizeFilter(sub));
    }
    return cur;
  }

  if(f.type==='review_mistakes'){
    const limit = Math.max(10, Math.min(400, Number(f.limit||200)));
    const mistakes = perf.getMistakes(storage);
    const entries = Object.entries(mistakes).map(([k,v])=>({k, count:(v?.count||0)}));
    entries.sort((a,b)=>b.count-a.count);
    const picked=[];
    for(const it of entries){
      if(picked.length>=limit) break;
      const key = it.k;
      let a=null;
      if(key.startsWith('icao:')) a = db.indexes?.byICAO?.[key.slice(5).toUpperCase()]||null;
      if(key.startsWith('iata:')) a = db.indexes?.byIATA?.[key.slice(5).toUpperCase()]||null;
      if(a) picked.push(a);
    }
    return picked.length ? picked : airports;
  }

  if(f.type==='review_confusions'){
    const limit = Math.max(10, Math.min(400, Number(f.limit||200)));
    const kind = String(f.kind||'IATA').toUpperCase();
    const conf = perf.getConfusions(storage);
    const entries = Object.entries(conf).map(([k,v])=>({k, count:Number(v||0)}));
    entries.sort((a,b)=>b.count-a.count);
    const set=new Set();
    const picked=[];
    for(const it of entries){
      if(picked.length>=limit) break;
      const m = it.k.match(/^(IATA|ICAO):([^>]+)>(.+)$/);
      if(!m) continue;
      if(m[1]!==kind) continue;
      const expected = m[2].toUpperCase();
      const given = m[3].toUpperCase();
      const a1 = (kind==='IATA') ? (db.indexes?.byIATA?.[expected]||null) : (db.indexes?.byICAO?.[expected]||null);
      const a2 = (kind==='IATA') ? (db.indexes?.byIATA?.[given]||null) : (db.indexes?.byICAO?.[given]||null);
      for(const a of [a1,a2]){
        if(!a) continue;
        const key = (a.icao||'')+'|'+(a.iata||'');
        if(set.has(key)) continue;
        set.add(key);
        picked.push(a);
        if(picked.length>=limit) break;
      }
    }
    return picked.length ? picked : airports;
  }

  if(f.type==='tag'){
    // Dataset currently has no tags; keep safe fallback (all).
    return airports;
  }

  return airports;
}

export function buildPool(db, packId){
  const pack = db.packs.find(p=>p.id===packId) || db.packs[0];
  const f = normalizeFilter(pack.filter);

  let pool = applyFilter(db, db.airports, f);

  storage.set('packId', pack.id);
  return { pack, pool };
}
