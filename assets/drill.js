import { storage } from './storage.js';
import { perf } from './perf.js';

function esc(s){
  return String(s||'').replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export class Drill {
  constructor(ctx){
    this.ctx = ctx;
    this.root = document.getElementById('drill-root');
  }

  t(key, vars=null, fallback=''){ return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key); }

  render(){
    if(!this.root) return;

    const hasMistakes = perf.getMistakes(storage).length>0;

    this.root.innerHTML = `
      <div class="row" style="flex-wrap:wrap; gap:10px;">
        <button class="ghost" id="dr-act-review">${esc(this.t('drill.review', null, '🔁 Review mistakes'))}</button>
        <button class="ghost" id="dr-act-daily">${esc(this.t('pro.daily_btn', null, 'Daily Top20 drill'))}</button>
        <button class="ghost" id="dr-act-boss-iata">${esc(this.t('drill.boss_iata', null, '🧊 Boss IATA'))}</button>
        <button class="ghost" id="dr-act-boss-icao">${esc(this.t('drill.boss_icao', null, '🧊 Boss ICAO'))}</button>
        <button class="ghost" id="dr-act-heatmap">${esc(this.t('drill.errors_map', null, '🗺️ Errors map'))}</button>
        <button class="ghost" id="dr-act-brief">${esc(this.t('drill.brief', null, '🧾 Brief'))}</button>
      </div>
      <div class="smallmuted" style="margin-top:10px;">${esc(this.t('drill.quick_actions', null, 'Quick actions'))}</div>

      <div style="margin-top:14px;" id="dr-stats"></div>
    `;

    const statsEl = this.root.querySelector('#dr-stats');
    if(statsEl){
      const mistakes = perf.topMistakes(storage, 12);
      const conf = perf.getTopConfusions(storage, 12);

      if(!hasMistakes){
        statsEl.innerHTML = `<div class="smallmuted">${esc(this.t('drill.no_mistakes', null, 'No mistakes recorded yet.'))}</div>`;
      } else {
        const mRows = mistakes.map(m=>`<div class="lbrow"><div>${esc(m.label)}</div><div class="lbscore">${m.count}</div></div>`).join('');
        const cRows = conf.map(c=>`<div class="lbrow"><div>${esc(c.kind)}: ${esc(c.expected)} → ${esc(c.given)}</div><div class="lbscore">${c.count}</div></div>`).join('');
        statsEl.innerHTML = `
          <div class="card" style="margin-top:10px;">
            <div class="card-h"><h3 style="margin:0; font-size:14px;">${esc(this.t('drill.most_missed', null, 'Most missed airports'))}</h3></div>
            <div class="card-b"><div class="list">${mRows || `<div class="smallmuted">—</div>`}</div></div>
          </div>
          <div class="card" style="margin-top:10px;">
            <div class="card-h"><h3 style="margin:0; font-size:14px;">${esc(this.t('drill.top_confusions', null, 'Top confusions'))}</h3></div>
            <div class="card-b"><div class="list">${cRows || `<div class="smallmuted">—</div>`}</div></div>
          </div>
        `;
      }
    }

    const bind = (id, fn)=>{ const el=this.root.querySelector(id); if(el) el.addEventListener('click', fn); };

    bind('#dr-act-review', ()=> this.startPack('review-mistakes'));
    bind('#dr-act-daily', ()=> this.startDaily());
    bind('#dr-act-boss-iata', ()=> this.startPack('boss-iata'));
    bind('#dr-act-boss-icao', ()=> this.startPack('boss-icao'));
    bind('#dr-act-heatmap', ()=> this.ctx?.showView?.('heatmap'));
    bind('#dr-act-brief', ()=> this.ctx?.showView?.('brief'));
  }

  startPack(packId){
    try{ this.ctx?.setPack?.(packId); }catch(e){}
    // Jump into Rapid set for drills
    this.ctx?.history?.startRun?.('RAPID');
    this.ctx?.showView?.('rapid');
    try{
      if(this.ctx?.rapid?.setPreset){
        (function(){try{const modeSel=document.getElementById('rapid-mode');const promptSel=document.getElementById('rapid-prompt');const mcq=document.getElementById('rapid-mcq');const voice=document.getElementById('rapid-voice');if(modeSel) modeSel.value='set30';if(promptSel) promptSel.value='mixed';if(mcq) mcq.checked=true;if(voice) voice.checked=false;}catch(e){}})();
      }
      this.ctx?.rapid?.startRun?.();
    }catch(e){}
  }

  startDaily(){
    this.startPack('daily-top20');
  }
}
