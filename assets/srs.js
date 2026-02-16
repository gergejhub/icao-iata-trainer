import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { eqAnswer, pick, shuffleInPlace, speak } from './utils.js';

// Simple SRS using SM-2-like intervals.
// Stores per-airport card state in localStorage.

function cardKey(a){
  return `srs:${(a.icao||'').toUpperCase()}|${(a.iata||'').toUpperCase()}`;
}

function now(){ return Date.now(); }

function defaultCard(){
  return { ease: 2.3, intervalMin: 1, due: now(), streak: 0, lapses: 0, last: now() };
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

export class SRS {
  constructor(ctx, stats, history){
    this.ctx = ctx;
    this.stats = stats;
    this.history = history;

    this.pool = [];
    this.due = [];
    this.current = null;
    this.expectedType = 'mixed';
    this.awaitReveal = false;
    this.baseCtx = null;

    this.promptSel = document.getElementById('srs-prompt');
    this.qEl = document.getElementById('srs-q');
    this.subEl = document.getElementById('srs-sub');
    this.inputEl = document.getElementById('srs-input');
    this.showBtn = document.getElementById('srs-show');
    this.gradeRow = document.getElementById('srs-grades');
    this.dueEl = document.getElementById('srs-due');
    this.voiceEl = document.getElementById('srs-voice');

    this.promptSel?.addEventListener('change', ()=> this.start());
    this.showBtn?.addEventListener('click', ()=> this.reveal());

    // Persist voice preference for SRS (default OFF)
    if(this.voiceEl){
      this.voiceEl.checked = storage.get('srsVoice', false) === true;
      this.voiceEl.addEventListener('change', ()=> storage.set('srsVoice', this.voiceEl.checked === true));
    }

    this.inputEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        // Enter: reveal, then advance with implicit "good" grade
        if(!this.awaitReveal) this.reveal();
        else this.grade('good');
      }
    });

    this.gradeRow?.querySelectorAll('button[data-srs-grade]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const g = btn.getAttribute('data-srs-grade');
        this.grade(g);
      });
    });
  }

  t(key, vars=null, fallback=''){
    return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key);
  }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
  }

  start(){
    if(!this.pool.length){
      this.qEl.textContent = '—';
      this.subEl.textContent = this.t('srs.sub.no_airports', null, 'No airports in dataset.');
      return;
    }
    this.expectedType = this.promptSel?.value || 'mixed';
    this.awaitReveal = false;
    this.inputEl.value='';
    this.gradeRow.style.display='none';
    this.pickDue();
    this.next();
  }

  pickExpectedType(a){
    const m = this.expectedType || 'mixed';
    if(m!=='mixed') return m;
    const opts = ['icao','iata','city','name'].filter(t=> (a?.[t]||'').toString().trim().length);
    return pick(opts.length?opts:['icao']);
  }

  pickDue(){
    const ts = now();
    const due = [];
    for(const a of this.pool){
      const key = cardKey(a);
      const card = storage.get(key, null) || defaultCard();
      if((card.due||0) <= ts) due.push(a);
    }
    this.due = due;
    if(this.dueEl) this.dueEl.textContent = this.t('srs.due', { n: due.length }, `${due.length} due`);
  }

  labelFor(t){
    if(t==='icao') return this.t('label.icao_code', null, 'ICAO CODE');
    if(t==='iata') return this.t('label.iata_code', null, 'IATA CODE');
    if(t==='city') return this.t('label.city', null, 'CITY');
    if(t==='name') return this.t('label.airport_name', null, 'AIRPORT NAME');
    return this.t('label.answer', null, 'ANSWER');
  }

  clueFor(a, expectedType){
    const options = [];
    if(expectedType!=='icao' && a.icao) options.push({k:'clue.icao', v:`${a.icao}`});
    if(expectedType!=='iata' && a.iata) options.push({k:'clue.iata', v:`${a.iata}`});
    if(expectedType!=='city' && a.city) options.push({k:'clue.city', v:`${a.city}`});
    if(expectedType!=='name' && a.name) options.push({k:'clue.name', v:`${a.name}`});
    const chosen = options.length ? pick(options) : {k:'clue.icao', v:(a.icao||'—')};
    return `${this.t(chosen.k, null, chosen.k.split('.').pop().toUpperCase())}: ${chosen.v}`;
  }

  expectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }

  next(){
    this.pickDue();
    const list = this.due.length ? this.due : this.pool;
    this.current = this.ctx?.pickAirport ? this.ctx.pickAirport(list) : pick(list);
    this.baseCtx = this.ctx?.pickBaseContext ? this.ctx.pickBaseContext() : null;

    const expType = this.pickExpectedType(this.current);
    this.current._expectedType = expType;

    const q = `${this.clueFor(this.current, expType)} → ${this.labelFor(expType)}`;
    this.qEl.textContent = q;

    const baseHint = (this.ctx?.proMode && this.baseCtx)
      ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
      : '';

    this.subEl.textContent = this.t('srs.sub.type_then_show', null, 'Type answer, then Show/Enter to reveal.') + (baseHint?` • ${baseHint}`:'');

    this.inputEl.value='';
    this.inputEl.focus();
    this.awaitReveal = false;
    this.gradeRow.style.display='none';
  }

  reveal(){
    if(!this.current) return;
    if(this.awaitReveal) return;
    const expType = this.current._expectedType || 'icao';
    const expected = this.expectedAnswer(this.current, expType);
    const user = this.inputEl.value;
    const ok = eqAnswer(user, expected);

    // record for stats & analytics (does not grade SRS yet)
    this.stats.record(ok);
    progress.record(this.ctx?.currentPack?.id, ok);
    if(!ok){
      perf.recordMistake(storage, this.current);
      const kind = (expType==='iata') ? 'IATA' : (expType==='icao' ? 'ICAO' : null);
      if(kind) perf.recordConfusion(storage, kind, expected, user);
    }

    const title = `${this.labelFor(expType)} | ${this.clueFor(this.current, expType)}`;
    const detail = ok
      ? this.t('detail.ok', { expected }, `OK: ${expected}`)
      : this.t('detail.wrong', { user: user||'—', expected }, `Your: ${user||'—'} • Correct: ${expected}`);
    this.history.add({ ok, title, detail });

    this.awaitReveal = true;
    this.gradeRow.style.display='flex';
    this.subEl.textContent = `${this.t('ui.expected', null, 'Expected:')} ${expected}  ${this.t('srs.enter_reveals', null, '(Enter: reveal / next)')}`;

    try{
      if(this.voiceEl?.checked && this.ctx?.voiceLang) speak(expected, { lang: this.ctx.voiceLang() });
    }catch(e){}
  }

  grade(g){
    if(!this.current) return;
    const key = cardKey(this.current);
    const card = storage.get(key, null) || defaultCard();

    const grade = String(g||'good');
    // map grade to q (0..5)
    const q = grade==='again' ? 1 : grade==='hard' ? 3 : grade==='easy' ? 5 : 4;

    if(q <= 2){
      card.lapses += 1;
      card.streak = 0;
      card.intervalMin = 1;
      card.ease = clamp(card.ease - 0.2, 1.3, 3.0);
    } else {
      card.streak += 1;
      const mult = (q===3) ? 1.2 : (q===4) ? card.ease : (card.ease + 0.3);
      card.intervalMin = clamp(Math.round(card.intervalMin * mult), 2, 60*24*30);
      card.ease = clamp(card.ease + (q===5 ? 0.08 : q===3 ? -0.05 : 0.02), 1.3, 3.0);
    }

    card.last = now();
    card.due = now() + card.intervalMin*60*1000;
    storage.set(key, card);

    this.awaitReveal = false;
    this.gradeRow.style.display='none';
    this.next();
  }
}
