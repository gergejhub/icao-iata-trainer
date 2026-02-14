import { norm } from './utils.js';

function now(){ return Date.now(); }

function keyAirport(a){
  if (a?.icao) return `icao:${a.icao}`;
  if (a?.iata) return `iata:${a.iata}`;
  // fallback: name-based
  const n = (a?.name||'').toString().trim().toLowerCase();
  return `name:${hash(n)}`;
}

function hash(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0).toString(16);
}

function loadObj(storage, key){
  return storage.get(key, {});
}
function saveObj(storage, key, obj){
  storage.set(key, obj);
}

export const perf = {
  keyAirport,

  recordMistake(storage, airport){
    const k = keyAirport(airport);
    const obj = loadObj(storage, 'perf:mistakes');
    const cur = obj[k] || {count:0, last:0};
    cur.count += 1;
    cur.last = now();
    obj[k] = cur;
    saveObj(storage, 'perf:mistakes', obj);
  },

  recordConfusion(storage, kind, expected, given){
    const e = norm(expected);
    const g = norm(given);
    if (!e || !g || e === g) return;
    // only codes
    if (kind === 'IATA' && (e.length !== 3 || g.length !== 3)) return;
    if (kind === 'ICAO' && (e.length !== 4 || g.length !== 4)) return;
    const obj = loadObj(storage, 'perf:confusions');
    const key = `${kind}:${e}>${g}`;
    obj[key] = (obj[key] || 0) + 1;
    saveObj(storage, 'perf:confusions', obj);
  },

  getMistakes(storage){
    return loadObj(storage, 'perf:mistakes');
  },

  getConfusions(storage){
    return loadObj(storage, 'perf:confusions');
  },

  topConfusions(storage, limit=10){
    const obj = perf.getConfusions(storage);
    const entries = Object.entries(obj).map(([k,v])=>({k,v}));
    entries.sort((a,b)=>b.v-a.v);
    return entries.slice(0, limit);
  },

  reset(storage){
    storage.del('perf:mistakes');
    storage.del('perf:confusions');
  },

  exportCSV(storage, dataset){
    const mistakes = perf.getMistakes(storage);
    const rows1 = [['key','icao','iata','name','city','country','tags','mistakes_count','last_mistake_ts']];
    for (const [k, v] of Object.entries(mistakes)){
      const a = resolveKey(dataset, k);
      rows1.push([
        k,
        a?.icao||'',
        a?.iata||'',
        a?.name||'',
        a?.city||'',
        a?.country||'',
        (a?.tags||[]).join('|'),
        String(v.count||0),
        String(v.last||0),
      ]);
    }
    const conf = perf.getConfusions(storage);
    const rows2 = [['kind','expected','given','count']];
    for (const [k,v] of Object.entries(conf)){
      const m = k.match(/^(IATA|ICAO):([^>]+)>(.+)$/);
      if (!m) continue;
      rows2.push([m[1], m[2], m[3], String(v)]);
    }
    return {
      mistakesCSV: toCSV(rows1),
      confusionsCSV: toCSV(rows2),
    };
  }
};

function resolveKey(dataset, key){
  if (!dataset) return null;
  if (key.startsWith('icao:')) return dataset.byICAO?.[key.slice(5)] || null;
  if (key.startsWith('iata:')) return dataset.byIATA?.[key.slice(5)] || null;
  return null;
}

function toCSV(rows){
  return rows.map(r=>r.map(cell=>{
    const s = (cell ?? '').toString();
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }).join(',')).join('\n');
}
