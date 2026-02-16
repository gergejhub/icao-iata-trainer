import { storage } from './storage.js';
import { perf } from './perf.js';
import { prettyAirport } from './utils.js';

function topMistakes(mistakesObj, n=10){
  const entries = Object.entries(mistakesObj||{}).map(([k,v])=>({k, count:(v?.count||0), last:(v?.last||0)}));
  entries.sort((a,b)=> (b.count-a.count) || (b.last-a.last));
  return entries.slice(0,n);
}

function topConfusions(confObj, kind, n=6){
  const entries = Object.entries(confObj||{}).map(([k,v])=>({k, count:Number(v||0)}));
  entries.sort((a,b)=>b.count-a.count);
  const out=[];
  for(const it of entries){
    const m = it.k.match(/^(IATA|ICAO):([^>]+)>(.+)$/);
    if(!m) continue;
    if(m[1]!==kind) continue;
    out.push({expected:m[2], given:m[3], count:it.count});
    if(out.length>=n) break;
  }
  return out;
}

function resolveKey(indexes, key){
  if(!indexes || !key) return null;
  if(key.startsWith('icao:')) return indexes.byICAO?.[key.slice(5).toUpperCase()] || null;
  if(key.startsWith('iata:')) return indexes.byIATA?.[key.slice(5).toUpperCase()] || null;
  return null;
}

export class Brief {
  constructor(ctx){
    this.ctx = ctx;
    this.outEl = document.getElementById('brief-out');
    this.langSel = document.getElementById('brief-lang');
    this.lenSel = document.getElementById('brief-len');
    this.btn = document.getElementById('brief-gen');
    this.copyBtn = document.getElementById('brief-copy');
    this.btn?.addEventListener('click', ()=> this.generate());
    this.copyBtn?.addEventListener('click', ()=> this.copy());
  }

  generate(){
    const db = this.ctx?.db;
    const pack = this.ctx?.currentPack;
    const pool = this.ctx?.currentPool || [];
    const indexes = db?.indexes || {byICAO:{}, byIATA:{}};

    const lang = (this.langSel?.value || 'en');
    const len = (this.lenSel?.value || '40');

    const mistakes = perf.getMistakes(storage);
    const conf = perf.getConfusions(storage);

    const mTop = topMistakes(mistakes, len==='20' ? 4 : (len==='60' ? 10 : 7))
      .map(it=> ({...it, a: resolveKey(indexes, it.k)}))
      .filter(x=>x.a);

    const iTop = topConfusions(conf, 'IATA', len==='20' ? 2 : 3);
    const oTop = topConfusions(conf, 'ICAO', len==='20' ? 2 : 3);

    const poolInfo = `${pack?.name || 'Pack'} (${pool.length} airports)`;

    let text = '';
    if(lang === 'hu'){
      text += `Rövid OCC tréning-brief: jelenleg ${poolInfo}. `;
      if(mTop.length){
        text += `A leggyakoribb hibapontok: `;
        text += mTop.map(x=> `${x.a.iata||x.a.icao} (${x.a.city||x.a.country})`).join(', ');
        text += `. `;
      }
      if(iTop.length){
        text += `IATA keverések: ` + iTop.map(x=> `${x.expected}↔${x.given}`).join(', ') + `. `;
      }
      if(oTop.length){
        text += `ICAO keverések: ` + oTop.map(x=> `${x.expected}↔${x.given}`).join(', ') + `. `;
      }
      text += `Javaslat: indíts egy “Review (your mistakes)” kört, majd egy rövid Boss Fight-ot.`;
    } else {
      text += `Quick OCC training brief: you are on ${poolInfo}. `;
      if(mTop.length){
        text += `Top pain points: `;
        text += mTop.map(x=> `${x.a.iata||x.a.icao} (${x.a.city||x.a.country})`).join(', ');
        text += `. `;
      }
      if(iTop.length){
        text += `IATA confusions: ` + iTop.map(x=> `${x.expected}↔${x.given}`).join(', ') + `. `;
      }
      if(oTop.length){
        text += `ICAO confusions: ` + oTop.map(x=> `${x.expected}↔${x.given}`).join(', ') + `. `;
      }
      text += `Recommendation: run “Review (your mistakes)”, then a short Boss Fight.`;
    }

    if(this.outEl) this.outEl.value = text;
  }

  copy(){
    try{
      const v = (this.outEl?.value || '').toString();
      if(!v) return;
      navigator.clipboard?.writeText(v);
      this.copyBtn.textContent = 'Copied';
      setTimeout(()=>{ this.copyBtn.textContent = 'Copy'; }, 900);
    }catch(e){}
  }
}
