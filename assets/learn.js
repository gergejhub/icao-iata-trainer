import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { gradeAnswer, pickMixedType, renderQuestion, pick, shuffleInPlace, buildChoices, speak } from './utils.js';

export class Learn {
  constructor(stats, history, ctx){
    this.stats = stats;
    this.history = history;
    this.ctx = ctx;
    this.pool = [];
    this.mode = 'mixed';
    this.awaitNext = false;
    this.current = null;
    this.currentClue = null;
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
      const g = gradeAnswer(user, expected, this.expectedType, this.current);
      const ok = g.ok;
      const partial = g.partial;

      this.stats.record(ok);
      progress.record(this.ctx?.currentPack?.id, ok);

      if(!ok){
        perf.recordMistake(storage, this.current);
        const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
        if(kind) perf.recordConfusion(storage, kind, expected, user);
      }

      const clue = this.currentClue || this.pickClue(this.current);
      const title = `${this.badge()} | ${clue.label}: ${clue.value}`;
      const detail = ok
        ? (partial
            ? this.t('detail.partial', { user: user||'—', expected }, `Partial (½): ${user||'—'} • Correct: ${expected}`)
            : this.t('detail.ok', { expected }, `OK: ${expected}`))
        : this.t('detail.wrong', { user: user||'—', expected }, `Your: ${user||'—'} • Correct: ${expected}`);
      this.history.add({ ok, title, detail });

      this.subEl.textContent = ok
        ? (partial
            ? this.t('learn.sub.partial_next', null, '🟡 Partial (½) — press Enter for next')
            : this.t('learn.sub.correct_next', null, '✅ Correct — press Enter for next'))
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

    const clue = this.pickClue(this.current);
    this.currentClue = clue;
    renderQuestion(this.qEl, {
      clueType: clue.type,
      clueLabel: clue.label,
      clueValue: clue.value,
      expectedType: this.expectedType,
      expectedLabel: this.badge()
    });

    if(resetSub){
      const baseLine = (this.ctx?.proMode && this.baseCtx)
        ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
        : '';
      const main = this.t('learn.sub.ready', null, 'Type answer and press Enter');
      this.subEl.textContent = baseLine ? `${main} • ${baseLine}` : main;
    }

    if(this.voiceEl?.checked){
      try{ speak((this.qEl?.dataset?.clueValue||'').toString() || (clue.value||''), { lang: this.voiceLang(), rate: 1 }); }catch(e){}
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
    if(m!=='mixed'){
      return (m==='name') ? 'mixed' : m;
    }
    const opts = ['icao','iata','city'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pickMixedType(opts);
  }

  pickClue(a){
    const options = [];
    const exp = (this.expectedType||'').toLowerCase();

    // Never use the SAME type as the expected answer.
    if(exp !== 'icao' && a.icao) options.push({ type:'icao', label:this.t('clue.icao', null, 'ICAO'), value: a.icao });
    if(exp !== 'iata' && a.iata) options.push({ type:'iata', label:this.t('clue.iata', null, 'IATA'), value: a.iata });

    // CITY as clue only when expected is a code. If expected is CITY, clues are codes only.
    if((exp === 'icao' || exp === 'iata') && a.city) options.push({ type:'city', label:this.t('clue.city', null, 'CITY'), value: a.city });

    return options.length ? pick(options) : { type:'icao', label:this.t('clue.icao', null, 'ICAO'), value: (a.icao||'—') };
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    return '';
  }
}
