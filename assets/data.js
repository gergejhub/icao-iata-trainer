import { storage } from './storage.js';

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
  try{
    dbAirports = await fetchJson('./data/airports.min.json');
  }catch(e){
    dbAirports = await fetchJson('./data/airports.sample.json');
  }

  const lists = {};
  for(const p of packs.packs){
    if(p.filter?.file){
      const txt = await fetchText(`./data/${p.filter.file}`);
      lists[p.filter.file] = txt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    }
  }

  return { packs: packs.packs, airports: dbAirports, lists };
}

export function buildPool(db, packId){
  const pack = db.packs.find(p=>p.id===packId) || db.packs[0];
  const f = pack.filter || {type:'all'};
  let pool = db.airports;

  if(f.type==='icao_list'){
    const icaos = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    pool = db.airports.filter(a=>a.icao && icaos.has(a.icao.toUpperCase()));
  }else if(f.type==='iata_list'){
    const iatas = new Set((db.lists[f.file]||[]).map(x=>x.toUpperCase()));
    pool = db.airports.filter(a=>a.iata && iatas.has(a.iata.toUpperCase()));
  }

  storage.set('packId', pack.id);
  return { pack, pool };
}
