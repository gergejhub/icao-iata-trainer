import { storage } from './storage.js';
import { perf } from './perf.js';
import { buildChoices, nameMatch, pick, prettyAirport, speak, normalize } from './utils.js';
import { progress } from './progress.js';

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function cardKey(a){
  const i = (a?.icao||'').toString().toUpperCase();
  const t = (a?.iata||'').toString().toUpperCase();
  return `icao:${i}|iata:${t}`;
}

function now(){ return Date.now(); }

export class SRS{
  constructor(ctx, stats, history){
    this.ctx=ctx;
    this.stats=stats;
    this.history=history;

    this.pool=[];
    this.current=null;
    this.expectedType='icao';
    this.revealed=false;

    this.qEl = document.getElementById('srs-q');
    this.subEl = document.getElementById('srs-sub');
    this.inEl = document.getElementById('srs-input');
    this.showBtn = document.getElementById('srs-show');
    this.voiceEl = document.getElementById('srs-voice');
    this.mcqEl = document.getElementById('srs-mcq');
    this.choicesEl = document.getElementById('srs-choices');
    this.revealEl = document.getElementById('srs-reveal');
    this.ansEl = document.getElementById('srs-answer');
    this.gradesEl = document.getElementById('srs-grades');
    this.dueEl = document.getElementById('srs-due');

    this.showBtn?.addEventListener('click', ()=> this.reveal());
    this.inEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        if(!this.revealed) this.reveal();
      }
    });
    for(const btn of document.querySelectorAll('[data-srs-grade]')){
      btn.addEventListener('click', ()=> this.grade(btn.getAttribute('data-srs-grade')));
    }
    this.mcqEl?.addEventListener('change', ()=> this.renderQuestion());
  }

  setPool(pool){ this.pool = Array.isArray(pool)? pool.slice(): []; }

  start(){
    this.nextCard(true);
  }

  dueCount(){
    const n = now();
    let due=0;
    const sample = this.pool.slice(0, Math.min(800, this.pool.length));
    for(const a of sample){
      const ck = 'srs:' + cardKey(a);
      const c = storage.get(ck, null);
      if(!c || (c.dueAt||0) <= n) due += 1;
    }
    return due;
  }

  nextCard(resetSub=false){
    if(!this.pool.length){
      this.qEl.textContent = 'No airports in this pack.';
      this.subEl.textContent = 'Pick a different pack or build full dataset.';
      return;
    }
    const n = now();
    const sample = this.pool.slice(0, Math.min(800, this.pool.length));
    const due = [];
    for(const a of sample){
      const ck = 'srs:' + cardKey(a);
      const c = storage.get(ck, null);
      if(!c || (c.dueAt||0) <= n) due.push(a);
    }
    this.current = (due.length ? pick(due) : pick(sample));
    this.expectedType = this.pickExpectedType(this.current);
    this.revealed=false;
    this.renderQuestion(resetSub);
    try{
      if(this.dueEl) this.dueEl.textContent = `${this.dueCount()} due`;
    }catch(e){}
  }

  pickExpectedType(a){
    const opts = [];
    if(a.icao) opts.push('icao');
    if(a.iata) opts.push('iata');
    if(a.city) opts.push('city');
    if(a.name) opts.push('name');
    return pick(opts.length?opts:['icao']);
  }

  clueLabel(a){
    const options=[];
    if(this.expectedType!=='icao' && a.icao) options.push(`ICAO: ${a.icao}`);
    if(this.expectedType!=='iata' && a.iata) options.push(`IATA: ${a.iata}`);
    if(this.expectedType!=='city' && a.city) options.push(`CITY: ${a.city}`);
    if(this.expectedType!=='name' && a.name) options.push(`NAME: ${a.name}`);
    return options.length ? pick(options) : `AIRPORT: ${a.name||a.iata||a.icao||'—'}`;
  }

  renderQuestion(resetSub=false){
    if(!this.current) return;
    const a = this.current;
    this.qEl.textContent = `${this.expectedType.toUpperCase()} ← ${this.clueLabel(a)}`;
    if(resetSub) this.subEl.textContent = 'Type answer, then Show/Enter to reveal.';
    this.inEl.value='';

    const voice = !!this.voiceEl?.checked;
    if(voice){ speak(this.qEl.textContent, {lang:'en-US', rate:1}); }

    const mcq = !!this.mcqEl?.checked;
    this.choicesEl.style.display = mcq ? '' : 'none';
    this.inEl.style.display = mcq ? 'none' : '';

    this.revealEl.style.display='none';
    this.gradesEl.style.display='none';

    if(mcq){
      const pool = this.ctx?.currentPool || this.pool;
      const expected = this.getExpected(a, this.expectedType);
      const prefer = this.preferDistractors(this.expectedType, expected);
      const choices = buildChoices({
        pool,
        correct: expected,
        getter: (x)=> this.getExpected(x, this.expectedType),
        n: 4,
        prefer
      });
      this.renderChoices(choices, expected);
    } else {
      this.choicesEl.innerHTML='';
    }
  }

  renderChoices(choices, expected){
    this.choicesEl.innerHTML='';
    for(const c of choices){
      const b=document.createElement('button');
      b.className='choice';
      b.textContent=c;
      b.addEventListener('click', ()=>{
        this.inEl.value=c;
        this.reveal();
      });
      this.choicesEl.appendChild(b);
    }
  }

  preferDistractors(type, expected){
    const out=[];
    const kind = (type==='icao') ? 'ICAO' : (type==='iata' ? 'IATA' : null);
    if(!kind) return out;
    const e = (expected||'').toString().toUpperCase();
    try{
      const conf = perf.getConfusions(storage);
      for(const [k,v] of Object.entries(conf||{})){
        const m = k.match(/^(IATA|ICAO):([^>]+)>(.+)$/);
        if(!m) continue;
        if(m[1]!==kind) continue;
        if(m[2].toUpperCase()===e) out.push(m[3].toUpperCase());
      }
    }catch(e){}
    return out.slice(0,3);
  }

  getExpected(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }

  check(user, expected, t){
    if(t==='name') return nameMatch(user, expected);
    return normalize(user) === normalize(expected) && normalize(user).length>0;
  }

  reveal(){
    if(!this.current || this.revealed) return;
    const a = this.current;
    const expected = this.getExpected(a, this.expectedType);
    const user = this.inEl.value || '';
    const ok = this.check(user, expected, this.expectedType);

    this.revealed=true;
    this.revealEl.style.display='';
    this.gradesEl.style.display='grid';
    this.ansEl.innerHTML = `<div class="pill ${ok?'good':'bad'}">${ok?'Correct':'Not quite'}</div>`
      + `<div style="margin-top:8px;font-weight:900;">Answer: ${escapeHtml(expected||'—')}</div>`
      + `<div class="smallmuted" style="margin-top:6px;">${escapeHtml(prettyAirport(a))}</div>`;

    this.stats?.record(ok);
    progress.record(this.ctx?.currentPack?.id, ok);
    this.history?.add({
      ok,
      title: `SRS | ${this.expectedType.toUpperCase()} ← ${this.clueLabel(a)}`,
      detail: ok ? `OK: ${expected}` : `Your: ${user||'—'} • Correct: ${expected}`
    });

    if(!ok){
      perf.recordMistake(storage, a);
      const kind = (this.expectedType==='icao') ? 'ICAO' : (this.expectedType==='iata' ? 'IATA' : null);
      if(kind) perf.recordConfusion(storage, kind, expected, user);
    }
  }

  grade(level){
    if(!this.current) return;
    const a = this.current;
    const ck = 'srs:' + cardKey(a);
    const c = storage.get(ck, {intervalDays:0, ease:2.3, dueAt:0, reps:0});
    const grade = {again:0, hard:1, good:2, easy:3}[level] ?? 2;

    if(grade===0){
      c.intervalDays = 0;
      c.reps = 0;
      c.ease = clamp(c.ease, 1.3, 2.7);
    }else{
      c.reps += 1;
      if(grade===1) c.ease = Math.max(1.3, c.ease - 0.15);
      if(grade===3) c.ease = Math.min(2.7, c.ease + 0.10);
      const base = (c.intervalDays===0) ? 1 : c.intervalDays;
      const mult = [0, 1.2, 1.7, 2.3][grade];
      c.intervalDays = clamp(Math.round(base * c.ease * mult), 1, 365);
    }
    c.dueAt = now() + c.intervalDays*24*3600*1000;
    storage.set(ck, c);
    this.nextCard();
  }
}

function escapeHtml(s){
  return (s||'').toString().replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
