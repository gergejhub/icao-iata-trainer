import { perf } from './perf.js';
import { prettyAirport } from './utils.js';

export class Drill{
  constructor(storage, stats, onStartRapid){
    this.storage = storage;
    this.stats = stats;
    this.onStartRapid = onStartRapid;
    this.dataset = null;
    this.bindUI();
  }

  setDataset(ds){ this.dataset = ds; this.render(); }

  bindUI(){
    this.listEl = document.querySelector('#drill-topconf');
    this.mistEl = document.querySelector('#drill-mistakes');
    this.btnStartMist = document.querySelector('#btn-drill-mistakes');
    this.btnExport = document.querySelector('#btn-export');
    this.btnClear = document.querySelector('#btn-clear-perf');

    this.btnStartMist.addEventListener('click', ()=> this.startMistakesRapid());
    this.btnExport.addEventListener('click', ()=> this.export());
    this.btnClear.addEventListener('click', ()=>{
      perf.reset(this.storage);
      this.render();
    });
  }

  render(){
    // Top confusions
    const top = perf.topConfusions(this.storage, 12);
    if (!top.length){
      this.listEl.innerHTML = '<div class="smallmuted">No confusions yet. Do a few rounds in Learn/Rapid and come back.</div>';
    } else {
      this.listEl.innerHTML = top.map(({k,v})=>{
        const [kind, rest] = k.split(':');
        const [exp, giv] = rest.split('>');
        return `<div class="rowline">
          <div><span class="pill">${kind}</span> <span class="mono">${exp}</span> → <span class="mono">${giv}</span></div>
          <div class="pill bad">×${v}</div>
        </div>`;
      }).join('');
    }

    // Mistakes list
    const mistakes = perf.getMistakes(this.storage);
    const entries = Object.entries(mistakes).map(([k,v])=>({k, ...v}));
    entries.sort((a,b)=>(b.count||0)-(a.count||0));
    const topMist = entries.slice(0, 20);

    if (!topMist.length){
      this.mistEl.innerHTML = '<div class="smallmuted">No mistakes recorded yet.</div>';
    } else {
      this.mistEl.innerHTML = topMist.map(x=>{
        const a = this.resolve(x.k);
        const title = a ? prettyAirport(a) : x.k;
        const codes = a ? `${a.icao||'—'} / ${a.iata||'—'}` : '';
        return `<div class="rowline">
          <div>
            <div style="font-weight:800">${escapeHtml(title)}</div>
            <div class="smallmuted mono">${escapeHtml(codes)}</div>
          </div>
          <div class="pill bad">×${x.count||0}</div>
        </div>`;
      }).join('');
    }
  }

  resolve(k){
    if (!this.dataset) return null;
    if (k.startsWith('icao:')) return this.dataset.byICAO?.[k.slice(5)] || null;
    if (k.startsWith('iata:')) return this.dataset.byIATA?.[k.slice(5)] || null;
    return null;
  }

  startMistakesRapid(){
    const mistakes = perf.getMistakes(this.storage);
    const keys = Object.keys(mistakes);
    const pool = [];
    for (const k of keys){
      const a = this.resolve(k);
      if (a) pool.push(a);
    }
    if (!pool.length){
      alert('No mistakes to drill yet.');
      return;
    }
    this.onStartRapid(pool, {title:'Mistakes Drill'});
  }

  export(){
    const out = perf.exportCSV(this.storage, this.dataset);
    downloadText(out.mistakesCSV, 'mistakes.csv');
    downloadText(out.confusionsCSV, 'confusions.csv');
  }
}

function downloadText(text, filename){
  const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s){
  return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
