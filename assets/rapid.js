import { norm, pick, prettyAirport, nameMatch } from './utils.js';
import { perf } from './perf.js';

export class RapidFire{
  constructor(storage, stats){
    this.customTitle = null;
    this.storage = storage;
    this.stats = stats;
    this.pool = [];
    this.timer = null;
    this.timeLeft = 60;
    this.score = 0;
    this.current = null;
    this.qType = null;
    this.bindUI();
  }
  setPool(pool){ this.pool = pool; }
  setCustomTitle(t){ this.customTitle = t; }
  reset(){}

  bindUI(){
    this.qEl = document.querySelector('#rapid-q');
    this.subEl = document.querySelector('#rapid-sub');
    this.inEl = document.querySelector('#rapid-input');
    this.metaEl = document.querySelector('#rapid-meta');
    this.feedbackEl = document.querySelector('#rapid-feedback');
    this.btnStart = document.querySelector('#rapid-start');
    this.btnStop = document.querySelector('#rapid-stop');
    this.btnStart.addEventListener('click', ()=> this.start());
    this.btnStop.addEventListener('click', ()=> this.stop());
    this.inEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') this.submit(); });
    document.querySelector('#rapid-submit').addEventListener('click', ()=> this.submit());
  }

  start(){
    this.stop();
    this.timeLeft = 60;
    this.score = 0;
    this.inEl.value='';
    this.next();
    this.tick();
    this.timer = setInterval(()=>this.tick(), 1000);
    this.btnStart.disabled = true;
    this.btnStop.disabled = false;
  }

  stop(){
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.btnStart.disabled = false;
    this.btnStop.disabled = true;
    this.metaEl.textContent = `Score: ${this.score}`;
    if (this.feedbackEl){ this.feedbackEl.style.display='none'; this.feedbackEl.textContent=''; }
  }

  tick(){
    this.metaEl.textContent = `Time: ${this.timeLeft}s • Score: ${this.score}`;
    this.timeLeft -= 1;
    if (this.timeLeft < 0){
      this.stop();
      alert(`Time! Score: ${this.score}`);
    }
  }

  next(){
    const a = pick(this.pool);
    this.current = a;
    this.qType = this.pickType(a);
    const label = (this.qType === 'icao->iata') ? 'IATA?' :
                  (this.qType === 'iata->icao') ? 'ICAO?' :
                  (this.qType === 'code->name') ? 'Name (type 4+ chars)' :
                  (this.qType === 'name->code') ? 'Code?' : 'Answer';
    let q='';
    if (this.qType === 'icao->iata') q = a.icao;
    if (this.qType === 'iata->icao') q = a.iata;
    if (this.qType === 'code->name') q = (a.icao || a.iata);
    if (this.qType === 'name->code') q = a.name || '(name not yet available)';
    this.qEl.textContent = q;
    this.subEl.textContent = label;
    this.inEl.value='';
    this.inEl.focus();
  }

  pickType(a){
    const types=[];
    if (a.icao && a.iata) types.push('icao->iata','iata->icao');
    if (a.icao || a.iata) types.push('code->name');
    if (a.name && (a.icao || a.iata)) types.push('name->code');
    return pick(types);
  }

  submit(){
    if (!this.timer) return;
    const a = this.current;
    const guess = norm(this.inEl.value);
    let correctRaw='';
    let ok=false;

    if (this.qType === 'icao->iata'){ correctRaw = a.iata || ''; ok = guess === norm(correctRaw); }
    if (this.qType === 'iata->icao'){ correctRaw = a.icao || ''; ok = guess === norm(correctRaw); }
    if (this.qType === 'code->name'){
      correctRaw = a.name || '';
      ok = !!correctRaw && nameMatch(this.inEl.value, correctRaw);
    }
    if (this.qType === 'name->code'){
      correctRaw = a.icao || a.iata || '';
      ok = guess === norm(correctRaw);
    }

    this.stats.answer(ok);
    if (!ok){
      perf.recordMistake(this.storage, a);
      if (this.qType === 'icao->iata') perf.recordConfusion(this.storage, 'IATA', correctRaw, guess);
      if (this.qType === 'iata->icao') perf.recordConfusion(this.storage, 'ICAO', correctRaw, guess);
    }
    if (ok){
      this.score += 1;
      this.showFeedback(true, a, correctRaw, guess);
      setTimeout(()=> this.next(), 900);
    } else {
      this.score = Math.max(0, this.score-1);
      this.showFeedback(false, a, correctRaw, guess);
      setTimeout(()=> this.next(), 1800);
    }
  }

  showFeedback(isOk, a, correctRaw, guess){
    if (!this.feedbackEl) return;
    const pills = [];
    if ((a.tags||[]).includes('wizz-base')) pills.push('<span class="pill good">WIZZ BASE</span>');
    if ((a.tags||[]).includes('wizz-network')) pills.push('<span class="pill">WIZZ NET</span>');
    const lead = isOk ? '✅' : '❌';
    const title = isOk ? 'Correct' : 'Not correct';
    const correctTxt = correctRaw ? escapeHtml(correctRaw) : '—';
    const guessTxt = escapeHtml((this.inEl.value||'').trim() || '—');
    this.feedbackEl.style.display = 'block';
    this.feedbackEl.innerHTML = `
      <div class="pills" style="margin-bottom:8px;">
        <span class="pill ${isOk?'good':'bad'}">${title}</span>
        <span class="pill">${escapeHtml(a.icao || '—')} / ${escapeHtml(a.iata || '—')}</span>
        ${pills.join(' ')}
      </div>
      <div style="font-weight:900;font-size:18px;line-height:1.2;">${lead} Correct: <span class="mono">${correctTxt}</span></div>
      <div class="smallmuted" style="margin-top:6px;">Your input: <span class="mono">${guessTxt}</span> • ${escapeHtml(prettyAirport(a))}</div>
    `;
  }
}


function escapeHtml(s){
  return (s||'').toString().replace(/[&<>\"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
