import fs from 'node:fs';
import https from 'node:https';
import { createInterface } from 'node:readline';

const SRC = process.env.AIRPORTS_CSV_URL || 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUT = 'data/airports.min.json';

function download(url, dest){
  return new Promise((resolve, reject)=>{
    const file = fs.createWriteStream(dest);
    https.get(url, (res)=>{
      if(res.statusCode !== 200){
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', ()=> file.close(resolve));
    }).on('error', (err)=> reject(err));
  });
}

function parseCsvLine(line){
  // basic CSV parser for ourairports (quoted fields)
  const out = [];
  let cur = '';
  let inQ = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQ && line[i+1]==='"'){ cur += '"'; i++; }
      else inQ = !inQ;
    } else if(ch===',' && !inQ){
      out.push(cur); cur='';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main(){
  console.log('Downloading', SRC);
  await download(SRC, 'airports.csv');

  const rl = createInterface({ input: fs.createReadStream('airports.csv', {encoding:'utf8'})});
  let header = null;
  const rows = [];
  for await (const line of rl){
    if(!header){
      header = parseCsvLine(line);
      continue;
    }
    const cols = parseCsvLine(line);
    const rec = Object.fromEntries(header.map((h,idx)=>[h, cols[idx] ?? '']));
    const ident = (rec.ident||'').trim().toUpperCase();
    const iata = (rec.iata_code||'').trim().toUpperCase();
    const name = (rec.name||'').trim();
    const city = (rec.municipality||'').trim();
    const country = (rec.iso_country||'').trim().toUpperCase();
    const lat = Number(rec.latitude_deg);
    const lon = Number(rec.longitude_deg);
    const type = (rec.type||'').trim();

    if(!ident || ident.length!==4) continue;
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if(!['large_airport','medium_airport','small_airport'].includes(type)) continue;

    rows.push({ icao: ident, iata: (iata && iata!=='\\N')? iata : '', name, city, country, lat, lon });
  }
  fs.writeFileSync(OUT, JSON.stringify(rows));
  console.log('Wrote', OUT, rows.length, 'airports');
}
main().catch(e=>{ console.error(e); process.exit(1);});
