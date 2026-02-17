import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { gradeAnswer, pickMixedType, renderQuestion, formatPoints, pick, shuffleInPlace, buildChoices, speak, showPopup } from './utils.js';

export class Rapid {
  constructor(stats, history, leaderboard, ctx){
    this.stats = stats;
    this.history = history;
    this.leaderboard = leaderboard;
    this.ctx = ctx;

    this.pool = [];
    this.running = false;
    this.timer = null;
    this.deadline = null;
    this.maxQ = Infinity;
    this.asked = 0;
    this.points = 0;
    this.wrong = 0;
    this.current = null;
    this.currentClue = null;
    this.expectedType = null;
    this.baseCtx = null;

    this.modeSel = document.getElementById('rapid-mode');
    this.promptSel = document.getElementById('rapid-prompt');
    this.startBtn = document.getElementById('rapid-start');
    this.qEl = document.getElementById('rapid-q');
    this.subEl = document.getElementById('rapid-sub');
    this.inputEl = document.getElementById('rapid-input');
    this.mcqEl = document.getElementById('rapid-mcq');
    this.voiceEl = document.getElementById('rapid-voice');
    this.choicesEl = document.getElementById('rapid-choices');
    this.timeEl = document.getElementById('rapid-time');
    this.okEl = document.getElementById('rapid-ok');
    this.badEl = document.getElementById('rapid-bad');

    this.startBtn?.addEventListener('click', ()=> this.toggle());
    this.modeSel?.addEventListener('change', ()=> this.renderIdle());
    this.promptSel?.addEventListener('change', ()=> this.renderIdle());
    this.mcqEl?.addEventListener('change', ()=> this.renderChoices());

    this.inputEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        if(this.running) this.submit();
      }
    });
  }

  t(key, vars=null, fallback=''){
    return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key);
  }

  voiceLang(){
    return this.ctx?.voiceLang ? this.ctx.voiceLang() : 'en-US';
  }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
    this.renderIdle();
  }

  refreshIdle(){ this.renderIdle(); }

  start(){
    this.renderIdle();
  }

  renderIdle(){
    if(!this.qEl) return;
    this.qEl.textContent = this.t('rapid.sub.ready', null, 'Pick mode + prompt, press Start');
    this.subEl.textContent = `${this.pool.length} ${this.t('history.items', null, 'items')}`;
    if(this.okEl) this.okEl.textContent = '0';
    if(this.badEl) this.badEl.textContent = '0';
    if(this.timeEl) this.timeEl.textContent = '—';
    this.choicesEl.innerHTML='';
  }

  toggle(){
    if(this.running) this.stop();
    else this.startRun();
  }

  startRun(){
    if(!this.pool.length){
      this.qEl.textContent = this.t('status.no_airports', null, 'No airports in this dataset.');
      return;
    }

    this.running = true;
    this.asked = 0;
    this.points = 0;
    this.wrong = 0;

    const mode = this.modeSel?.value || 'sprint60';
    const now = Date.now();
    if(mode==='sprint30') this.deadline = now + 30_000;
    else if(mode==='sprint60') this.deadline = now + 60_000;
    else if(mode==='set30') { this.deadline = now + 9999_000; this.maxQ = 30; }
    else { this.deadline = now + 60_000; }

    this.maxQ = (mode==='set30') ? 30 : Infinity;

    this.startBtn.textContent = this.t('ui.start', null, 'Start');
    this.startBtn.classList.add('danger');

    this.tick();
    this.nextQuestion(true);
    this.timer = setInterval(()=> this.tick(), 250);
  }

  stop(){
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer=null; }
    if(this.startBtn){
      this.startBtn.textContent = this.t('ui.start', null, 'Start');
      this.startBtn.classList.remove('danger');
    }

    const score = (this.points*10) - (this.wrong*2);
    const pts = formatPoints(this.points);
    this.subEl.textContent = this.t('rapid.run_finished', { score }, `Run finished. Score=${score}. Use Scoreboard → Submit last run.`) + ` (${pts} pts)`;
    this.leaderboard?.setLastRun?.({
      mode: this.modeSel?.value||'rapid',
      score,
      correct: this.points,
      wrong: this.wrong,
      timestamp: Date.now()
    });

    // Popup end-of-run summary
    const mode = (this.modeSel?.value||'rapid').toUpperCase();
    const title = this.t('popup.run_end.title', null, 'Vége a játéknak');
    const msg = this.t('popup.run_end.msg', {
      mode,
      correct: this.points,
      wrong: this.wrong,
      asked: this.asked,
      score
    }, `Mód: ${mode}\nKérdések: ${this.asked}\nPontok: ${formatPoints(this.points)}\nHibás: ${this.wrong}\nPont: ${score}`);
    showPopup({
      title,
      message: msg,
      okText: this.t('popup.ok', null, 'OK')
    });
  }

  tick(){
    if(!this.running) return;
    const left = Math.max(0, this.deadline - Date.now());
    if(this.timeEl) this.timeEl.textContent = (this.maxQ!==Infinity)
      ? `${this.asked}/${this.maxQ}`
      : `${Math.ceil(left/1000)}s`;
    if(left<=0 || this.asked>=this.maxQ){
      this.stop();
    }
  }

  pickExpectedType(){
    const m = this.promptSel?.value || 'mixed';
    if(m!=='mixed') return (m==='name') ? 'mixed' : m;
    const opts = ['icao','iata','city'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pickMixedType(opts.length?opts:['icao']);
  }

  badge(){
    const t = this.expectedType;
    if(t==='icao') return this.t('label.icao_code', null, 'ICAO CODE');
    if(t==='iata') return this.t('label.iata_code', null, 'IATA CODE');
    if(t==='city') return this.t('label.city', null, 'CITY');
    return this.t('label.answer', null, 'ANSWER');
  }

  pickClue(a){
    const exp = (this.expectedType||'').toLowerCase();
    const opts=[];
    if(exp !== 'icao' && a.icao) opts.push({ type:'icao', label:this.t('clue.icao', null, 'ICAO'), value:a.icao });
    if(exp !== 'iata' && a.iata) opts.push({ type:'iata', label:this.t('clue.iata', null, 'IATA'), value:a.iata });
    // CITY as clue only when expected is a code. If expected is CITY, clues are codes only.
    if((exp === 'icao' || exp === 'iata') && a.city) opts.push({ type:'city', label:this.t('clue.city', null, 'CITY'), value:a.city });
    return opts.length ? pick(opts) : { type:'icao', label:this.t('clue.icao', null, 'ICAO'), value:(a.icao||'—') };
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    return '';
  }

  nextQuestion(resetSub=false){
    if(!this.running) return;
    this.baseCtx = (this.ctx?.proMode && this.ctx?.pickBase) ? this.ctx.pickBase() : null;
    this.current = (this.ctx?.pickAirport) ? this.ctx.pickAirport(this.pool) : pick(this.pool);
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
      const baseHint = this.baseCtx
        ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
        : '';
      this.subEl.textContent = baseHint ? `${this.t('rapid.sub.type_enter', null, 'Type answer and press Enter')} • ${baseHint}` : this.t('rapid.sub.type_enter', null, 'Type answer and press Enter');
    }

    if(this.voiceEl?.checked){
      // Read only the clue value; codes are OK with any voice.
      const spoken = (this.qEl?.dataset?.clueValue||'').toString() || (clue.value||'');
      speak(spoken, { lang: this.voiceLang(), rate: 1 });
    }

    this.renderChoices();
    this.inputEl.value='';
    this.inputEl.focus();
  }

  renderChoices(){
    if(!this.choicesEl) return;
    const mcq = !!this.mcqEl?.checked;
    this.choicesEl.innerHTML='';
    if(!mcq){
      this.inputEl.style.display='';
      this.choicesEl.style.display='none';
      return;
    }

    this.inputEl.style.display='none';
    this.choicesEl.style.display='grid';

    const expected = this.getExpectedAnswer(this.current, this.expectedType);
    const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
    const prefer = kind ? perf.getPreferredConfusionDistractors(storage, kind, expected) : [];

    const choices = buildChoices({
      pool: this.pool,
      correct: expected,
      getter: (a)=> this.getExpectedAnswer(a, this.expectedType),
      n: 4,
      prefer
    });

    for(const c of choices){
      const b = document.createElement('button');
      b.className='choice';
      b.textContent=c;
      b.addEventListener('click', ()=>{ this.inputEl.value=c; this.submit(); });
      this.choicesEl.appendChild(b);
    }
  }

  submit(){
    if(!this.running || !this.current) return;

    const user = this.inputEl.value;
    const expected = this.getExpectedAnswer(this.current, this.expectedType);
    const g = gradeAnswer(user, expected, this.expectedType, this.current);
    const ok = g.ok;
    const partial = g.partial;

    this.stats.record(ok);
    progress.record(this.ctx?.currentPack?.id, ok);

    this.asked += 1;
    if(ok) this.points += (g.credit||0); else this.wrong += 1;

    if(this.okEl) this.okEl.textContent = formatPoints(this.points);
    if(this.badEl) this.badEl.textContent = String(this.wrong);

    if(!ok){
      perf.recordMistake(storage, this.current);
      const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
      if(kind) perf.recordConfusion(storage, kind, expected, user);
    }

    const clue = this.currentClue || this.pickClue(this.current);
    const title = `${this.badge()} | ${clue.label}: ${clue.value}`;
    const detail = ok
      ? (partial
          ? this.t('detail.partial', { user: (user||'—'), expected }, `Partial (½): ${user||'—'} • Correct: ${expected}`)
          : this.t('detail.ok', { expected }, `OK: ${expected}`))
      : this.t('detail.wrong', { user: (user||'—'), expected }, `Your: ${user||'—'} • Correct: ${expected}`);
    this.history.add({ok, title, detail});

    this.tick();
    if(this.running) this.nextQuestion();
  }
}
