import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { eqAnswer, eqAirportNameOrCity, pick, shuffleInPlace, buildChoices, speak } from './utils.js';

export class Learn {
  constructor(stats, history, ctx){
    this.stats = stats;
    this.history = history;
    this.ctx = ctx;
    this.pool = [];
    this.mode = 'mixed';
    this.awaitNext = false;
    this.current = null;
    this.expectedType = null;
    this.baseCtx = null;

    this.promptSel = document.getElementById('learn-prompt');
    this.qEl = document.getElementById('learn-q');
    this.subEl = document.getElementById('learn-sub');
    this.inputEl = document.getElementById('learn-input');
    this.mcqEl = document.getElementById('learn-mcq');
    this.voiceEl = document.getElementById('learn-voice');
    this.choicesEl = document.getElementById('learn-choices');

    this.promptSel?.addEventListener('change', ()=> { this.mode=this.promptSel.value; this.nextQuestion(true); });
    this.mcqEl?.addEventListener('change', ()=> this.nextQuestion(true));

    this.inputEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        this.onEnter();
      }
    });
  }

  t(key, vars=null, fallback=null){
    return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback ?? key);
  }

  voiceLang(){
    return this.ctx?.voiceLang ? this.ctx.voiceLang() : 'en-US';
  }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
  }

  start(){
    this.awaitNext = false;
    if(this.inputEl) this.inputEl.value = '';
    this.nextQuestion(true);
    this.inputEl?.focus?.();
  }

  onEnter(){
    if(!this.current) return;

    if(!this.awaitNext){
      const user = this.inputEl?.value || '';
      const expected = this.getExpectedAnswer(this.current, this.expectedType);
      const ok = (this.expectedType==='name')
        ? eqAirportNameOrCity(user, this.current)
        : eqAnswer(user, expected);

      this.stats.record(ok);
      progress.record(this.ctx?.currentPack?.id, ok);

      if(!ok){
        perf.recordMistake(storage, this.current);
        const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
        if(kind) perf.recordConfusion(storage, kind, expected, user);
      }

      const title = `${this.badge()} | ${this.clueLabel(this.current)}`;
      const detail = ok
        ? this.t('detail.ok', { expected }, `OK: ${expected}`)
        : this.t('detail.wrong', { user: user||'—', expected }, `Your: ${user||'—'} • Correct: ${expected}`);
      this.history.add({ ok, title, detail, airport: this.current });

      this.subEl.textContent = ok
        ? this.t('learn.sub.correct_next', null, '✅ Correct — press Enter for next')
        : this.t('learn.sub.wrong_next', null, '❌ Wrong — press Enter for next');
      this.awaitNext = true;

      // MCQ: auto-advance
      if(this.mcqEl?.checked){
        setTimeout(()=>{
          if(!this.awaitNext) return;
          this.awaitNext=false;
          if(this.inputEl) this.inputEl.value='';
          this.nextQuestion(true);
        }, 650);
      }

      return;
    }

    // next
    this.awaitNext = false;
    if(this.inputEl) this.inputEl.value = '';
    this.nextQuestion();
  }

  badge(){
    const t = this.expectedType;
    if(t==='icao') return this.t('label.icao_code', null, 'ICAO CODE');
    if(t==='iata') return this.t('label.iata_code', null, 'IATA CODE');
    if(t==='city') return this.t('label.city', null, 'CITY');
    if(t==='name') return this.t('label.airport_name', null, 'AIRPORT NAME');
    return this.t('label.answer', null, 'ANSWER');
  }

  nextQuestion(resetSub=false){
    if(!this.pool.length){
      this.qEl.textContent = '—';
      this.subEl.textContent = this.t('srs.sub.no_airports', null, 'No airports in dataset.');
      return;
    }

    this.baseCtx = this.ctx?.pickBase ? this.ctx.pickBase() : null;
    this.current = this.ctx?.pickAirport ? this.ctx.pickAirport(this.pool) : pick(this.pool);
    this.expectedType = this.pickExpectedType();

    const clue = this.clueLabel(this.current);
    this.qEl.textContent = `${clue} → ${this.badge()}`;

    if(resetSub){
      const baseLine = (this.ctx?.proMode && this.baseCtx)
        ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
        : '';
      const main = this.t('learn.sub.ready', null, 'Type answer and press Enter');
      this.subEl.textContent = baseLine ? `${main} • ${baseLine}` : main;
    }

    if(this.voiceEl?.checked){
      try{ speak(this.qEl.textContent, { lang: this.voiceLang(), rate: 1 }); }catch(e){}
    }

    const mcq = !!this.mcqEl?.checked;
    if(mcq){
      if(this.inputEl) this.inputEl.style.display='none';
      if(this.choicesEl) this.choicesEl.style.display='grid';
      const expected = this.getExpectedAnswer(this.current, this.expectedType);
      const choices = buildChoices({
        pool: this.pool,
        correct: expected,
        getter: (a)=> this.getExpectedAnswer(a, this.expectedType),
        n: 4
      });
      this.renderChoices(choices);
    } else {
      if(this.inputEl) this.inputEl.style.display='';
      if(this.choicesEl){
        this.choicesEl.style.display='none';
        this.choicesEl.innerHTML='';
      }
    }
  }

  renderChoices(choices){
    if(!this.choicesEl) return;
    this.choicesEl.innerHTML='';
    for(const c of choices){
      const b=document.createElement('button');
      b.className='choice';
      b.textContent=c;
      b.addEventListener('click', ()=>{
        if(this.inputEl) this.inputEl.value=c;
        this.onEnter();
      });
      this.choicesEl.appendChild(b);
    }
  }

  pickExpectedType(){
    const m = this.mode || 'mixed';
    if(m!=='mixed') return m;
    const opts = ['icao','iata','city','name'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pick(opts.length?opts:['icao']);
  }

  clueLabel(a){
    const options = [];
    if(this.expectedType!=='icao' && a.icao) options.push(`${this.t('clue.icao', null, 'ICAO')}: ${a.icao}`);
    if(this.expectedType!=='iata' && a.iata) options.push(`${this.t('clue.iata', null, 'IATA')}: ${a.iata}`);
    if(this.expectedType!=='city' && a.city) options.push(`${this.t('clue.city', null, 'CITY')}: ${a.city}`);
    if(this.expectedType!=='name' && a.name) options.push(`${this.t('clue.name', null, 'NAME')}: ${a.name}`);
    if(options.length) return pick(options);
    if(a.name) return `${this.t('clue.name', null, 'NAME')}: ${a.name}`;
    if(a.city) return `${this.t('clue.city', null, 'CITY')}: ${a.city}`;
    if(a.iata) return `${this.t('clue.iata', null, 'IATA')}: ${a.iata}`;
    return `${this.t('clue.icao', null, 'ICAO')}: ${a.icao||'—'}`;
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }
}
