export async function loadDataset(){
  const enriched = await tryFetchJson('./data/airports.min.json');
  const sample = await tryFetchJson('./data/airports.sample.json');

  let ds = enriched || sample;
  if (!ds) throw new Error('No dataset found (airports.min.json nor airports.sample.json).');

  const packs = await tryFetchJson('./data/packs.json');
  ds.packs = packs?.packs || [
    {id:'global', name:'Global', description:'All airports', filter:'all'},
    {id:'wizz-network', name:'Wizz Network', description:'ICAO list', filter:'tag:wizz-network'},
    {id:'wizz-bases', name:'Wizz Bases', description:'IATA list', filter:'tag:wizz-base'},
  ];

  ds.byICAO = {};
  ds.byIATA = {};
  for (const a of ds.airports){
    if (a.icao) ds.byICAO[a.icao] = a;
    if (a.iata) ds.byIATA[a.iata] = a;
  }
  return ds;
}

async function tryFetchJson(url){
  try{
    const r = await fetch(url, {cache:'no-store'});
    if (!r.ok) return null;
    return await r.json();
  }catch(_){
    return null;
  }
}

export function getPackFilter(packId, dataset){
  const p = dataset.packs.find(x=>x.id===packId);
  const f = p?.filter || 'all';
  if (f === 'all') return ()=>true;
  if (f.startsWith('tag:')){
    const tag = f.slice(4);
    return (a)=> Array.isArray(a.tags) && a.tags.includes(tag);
  }
  return ()=>true;
}

export function makeAirportPool(dataset, filterFn){
  const pool = dataset.airports.filter(a => (a.icao || a.iata) && filterFn(a));
  const seed = new Date().toISOString().slice(0,10);
  return shuffle(pool, hash(seed));
}

function shuffle(arr, seed){
  const out = arr.slice();
  let x = seed >>> 0;
  function rnd(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  }
  for (let i=out.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function hash(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
