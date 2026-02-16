import { storage } from './storage.js';
import { perf } from './perf.js';
import { prettyAirport } from './utils.js';

function resolveKey(indexes, key){
  if(!indexes || !key) return null;
  if(key.startsWith('icao:')) return indexes.byICAO?.[key.slice(5).toUpperCase()] || null;
  if(key.startsWith('iata:')) return indexes.byIATA?.[key.slice(5).toUpperCase()] || null;
  return null;
}

function topMistakes(mistakesObj, n=12){
  const entries = Object.entries(mistakesObj||{}).map(([k,v])=>({k, count:(v?.count||0), last:(v?.last||0)}));
  entries.sort((a,b)=> (b.count-a.count) || (b.last-a.last));
  return entries.slice(0,n);
}

function topConfusions(confObj, kind, n=10){
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

export class Drill {
  constructor(ctx){
    this.ctx = ctx;
    this.root = document.getElementById('drill-root');
  }

  render(){
    if(!this.root) return;
    const indexes = this.ctx?.db?.indexes || {byICAO:{}, byIATA:{}};
    const mistakes = perf.getMistakes(storage);
    const conf = perf.getConfusions(storage);
    const mTop = topMistakes(mistakes, 12).map(x=>({ ...x, a: resolveKey(indexes, x.k) })).filter(x=>x.a);
    const iTop = topConfusions(conf, 'IATA', 10);
    const oTop = topConfusions(conf, 'ICAO', 10);

    const btn = (id, label)=> `<button class="ghost" data-drill-action="${id}">${label}</button>`;

    this.root.innerHTML = `
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);">
        <div class="kpi"><div class="k">Quick actions</div><div class="v" style="font-size:14px; font-weight:800; margin-top:6px; display:flex; flex-wrap:wrap; gap:8px;">
          ${btn('review', '🔁 Review mistakes')}
          ${btn('boss-iata', '🧊 Boss IATA')}
          ${btn('boss-icao', '🧊 Boss ICAO')}
          ${btn('heatmap', '🗺️ Errors map')}
          ${btn('brief', '🧾 Brief')}
        </div></div>
        <div class="kpi"><div class="k">Most missed airports</div><div class="v">${mTop.length}</div></div>
        <div class="kpi"><div class="k">Top confusions</div><div class="v">${iTop.length + oTop.length}</div></div>
      </div>

      <div class="grid" style="grid-template-columns:1fr; gap:12px; margin-top:12px;">
        <div class="card" style="background:rgba(255,255,255,.04)">
          <div class="card-h"><div class="title">Mistakes leaderboard</div><div class="badge">local browser</div></div>
          <div class="card-b">
            ${mTop.length ? `<div class="list">${mTop.map(x=>`<div class="lbrow"><div>${escapeHtml(prettyAirport(x.a))}</div><div class="lbscore">${x.count}×</div></div>`).join('')}</div>` : `<div class="smallmuted">No mistakes recorded yet. Do a Rapid or SRS session first.</div>`}
          </div>
        </div>

        <div class="card" style="background:rgba(255,255,255,.04)">
          <div class="card-h"><div class="title">Confusion pairs</div><div class="badge">IATA + ICAO</div></div>
          <div class="card-b">
            <div class="smallmuted">Target these with the Boss Fight packs.</div>
            <div class="grid" style="grid-template-columns:1fr; gap:10px; margin-top:10px;">
              <div>
                <div class="badge">IATA</div>
                ${iTop.length ? iTop.map(x=>`<div class="lbrow"><div>${escapeHtml(x.expected)} → ${escapeHtml(x.given)}</div><div class="lbscore">${x.count}</div></div>`).join('') : `<div class="smallmuted" style="margin-top:8px;">No IATA confusions yet.</div>`}
              </div>
              <div style="margin-top:10px;">
                <div class="badge">ICAO</div>
                ${oTop.length ? oTop.map(x=>`<div class="lbrow"><div>${escapeHtml(x.expected)} → ${escapeHtml(x.given)}</div><div class="lbscore">${x.count}</div></div>`).join('') : `<div class="smallmuted" style="margin-top:8px;">No ICAO confusions yet.</div>`}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    for(const b of this.root.querySelectorAll('[data-drill-action]')){
      b.addEventListener('click', ()=> this.onAction(b.getAttribute('data-drill-action')));
    }
  }

  onAction(id){
    if(!id) return;
    if(id==='heatmap') return this.ctx?.showView?.('heatmap');
    if(id==='brief') return this.ctx?.showView?.('brief');
    if(id==='review'){
      this.ctx?.setPack?.('review-mistakes');
      this.ctx?.showView?.('srs');
      this.ctx?.srs?.start?.();
      return;
    }
    if(id==='boss-iata' || id==='boss-icao'){
      this.ctx?.setPack?.(id);
      this.ctx?.showView?.('rapid');
      // try to force MCQ for speed
      try{
        const mcq = document.getElementById('rapid-mcq');
        if(mcq) mcq.checked = true;
      }catch(e){}
      this.ctx?.rapid?.startRun?.();
      return;
    }
  }
}

function escapeHtml(s){
  return (s||'').toString().replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
