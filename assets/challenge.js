import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { pickMixedType, renderQuestion, pick, shuffleInPlace, buildChoices, speak, showPopup } from './utils.js';

function now(){ return Date.now(); }

export class Challenge {
  constructor(ctx, stats, history, leaderboard){
    this.ctx = ctx;
    this.stats = stats;
    this.history = history;
    this.leaderboard = leaderboard;

    this.pool = [];
    this.running = false;
    this.timer = null;
    this.deadline = null;
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this.expectedType = 'mixed';
    this.current = null;
    this.currentClue = null;
    this.baseCtx = null;

    this.durSel = document.getElementById('ch-dur');
    this.voiceEl = document.getElementById('ch-voice');
    this.startBtn = document.getElementById('ch-start');
    this.timeEl = document.getElementById('ch-time');
    this.scoreEl = document.getElementById('ch-score');
    this.qEl = document.getElementById('ch-q');
    this.subEl = document.getElementById('ch-sub');
    this.optsEl = document.getElementById('ch-options');

    this.startBtn?.addEventListener('click', ()=> this.toggle());
  }

  t(key, vars=null, fallback=''){ return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key); }
  voiceLang(){ return this.ctx?.voiceLang ? this.ctx.voiceLang() : 'en-US'; }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
  }

  refreshIdle(){
    if(!this.subEl) return;
    this.subEl.textContent = this.t('challenge.sub.mcq', null, 'Multiple choice. Click the correct answer.');
  }

  start(){
    this.refreshIdle();
    this.qEl.textContent = '—';
  }

  toggle(){
    if(this.running) this.stop(); else this.run();
  }

  run(){
    if(this.pool.length < 8){
      this.qEl.textContent = '—';
      this.subEl.textContent = this.t('challenge.need_pool', null, 'Not enough airports in the dataset.');
      return;
    }
    this.running = true;
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;

    const mins = Math.max(5, Math.min(30, Number(this.durSel?.value||5)));
    this.deadline = now() + mins*60_000;

    this.tick();
    this.next();
    this.timer = setInterval(()=> this.tick(), 250);
  }

  stop(){
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer=null; }

    this.qEl.textContent = this.t('challenge.finished', {score:this.score}, `Finished. Score=${this.score}. Submit from Scoreboard if you want.`);
    this.subEl.textContent = '';
    this.optsEl.innerHTML = '';

    this.leaderboard?.setLastRun?.({
      mode: 'CHALLENGE',
      score: this.score,
      correct: this.correct,
      wrong: this.wrong,
      timestamp: Date.now()
    });

    const title = this.t('popup.run_end.title', null, 'Vége a játéknak');
    const msg = this.t('popup.challenge_end.msg', {
      correct: this.correct,
      wrong: this.wrong,
      score: this.score
    }, `Mód: CHALLENGE\nHelyes: ${this.correct}\nHibás: ${this.wrong}\nPont: ${this.score}`);
    showPopup({ title, message: msg, okText: this.t('popup.ok', null, 'OK') });
  }

  tick(){
    if(!this.running) return;
    const left = Math.max(0, this.deadline - now());
    const sec = Math.ceil(left/1000);
    if(this.timeEl) this.timeEl.textContent = `${sec}s`;
    if(this.scoreEl) this.scoreEl.textContent = String(this.score);
    if(left<=0) this.stop();
  }

  pickExpectedType(){
    // Always mixed in challenge (weighted, city is rarer)
    const opts = ['icao','iata','city'].filter(t=> this.answerFor(this.current||{}, t));
    return pickMixedType(opts.length?opts:['icao']);
  }

  badge(t){
    if(t==='icao') return this.t('label.icao_code', null, 'ICAO CODE');
    if(t==='iata') return this.t('label.iata_code', null, 'IATA CODE');
    if(t==='city') return this.t('label.city', null, 'CITY');
    return this.t('label.answer', null, 'ANSWER');
  }

  pickClue(a, expectedType){
    const exp = (expectedType||'').toLowerCase();
    const opts=[];
    if(exp !== 'icao' && a.icao) opts.push({ type:'icao', label:this.t('clue.icao', null, 'ICAO'), value:a.icao });
    if(exp !== 'iata' && a.iata) opts.push({ type:'iata', label:this.t('clue.iata', null, 'IATA'), value:a.iata });
    // CITY as clue only when expected is a code. If expected is CITY, clues are codes only.
    if((exp === 'icao' || exp === 'iata') && a.city) opts.push({ type:'city', label:this.t('clue.city', null, 'CITY'), value:a.city });
    return opts.length ? pick(opts) : { type:'icao', label:this.t('clue.icao', null, 'ICAO'), value:(a.icao||'—') };
  }

  answerFor(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    return '';
  }

  next(){
    if(!this.running) return;
    const ap = (this.ctx?.pickAirport ? this.ctx.pickAirport(this.pool) : pick(this.pool));
    this.current = ap;
    this.expectedType = this.pickExpectedType();
    this.baseCtx = this.ctx?.pickBaseContext ? this.ctx.pickBaseContext() : null;

    const clue = this.pickClue(ap, this.expectedType);
    this.currentClue = clue;
    renderQuestion(this.qEl, {
      clueType: clue.type,
      clueLabel: clue.label,
      clueValue: clue.value,
      expectedType: this.expectedType,
      expectedLabel: this.badge(this.expectedType)
    });

    const hint = (this.ctx?.proMode && this.baseCtx)
      ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
      : '';
    this.subEl.textContent = hint || this.t('challenge.sub.mcq', null, 'Multiple choice. Click the correct answer.');

    if(this.voiceEl?.checked){
      try{ speak((this.qEl?.dataset?.clueValue||'').toString() || (clue.value||''), { lang: this.voiceLang(), rate: 1}); }catch(e){}
    }

    const expected = this.answerFor(ap, this.expectedType);
    const choices = buildChoices({
      pool: this.pool,
      correct: expected,
      getter: (a)=> this.answerFor(a, this.expectedType),
      n: 4
    });

    this.optsEl.innerHTML = '';
    for(const c of choices){
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = c;
      b.addEventListener('click', ()=> this.submit(c));
      this.optsEl.appendChild(b);
    }
  }

  submit(choice){
    if(!this.running || !this.current) return;
    const expected = this.answerFor(this.current, this.expectedType);
    const ok = String(choice||'').trim().toUpperCase() === String(expected||'').trim().toUpperCase();

    this.stats.record(ok);
    progress.record(this.ctx?.currentPack?.id, ok);

    if(ok){
      this.score += 1;
      this.correct += 1;
    }else{
      this.score = Math.max(0, this.score - 1);
      this.wrong += 1;
      perf.recordMistake(storage, this.current);
      const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
      if(kind) perf.recordConfusion(storage, kind, expected, choice);
    }

    const qPlain = (this.qEl?.dataset?.plain || this.qEl.textContent || '').trim();
    const title = `${ok?'✅':'❌'} ${qPlain}`;
    const detail = ok ? this.t('detail.ok', {expected}, `OK: ${expected}`)
                      : this.t('detail.wrong', {user: choice||'—', expected}, `Your: ${choice||'—'} • Correct: ${expected}`);
    this.history.add({ok, title, detail});

    // next
    this.next();
  }
}
