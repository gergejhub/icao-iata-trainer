import { eqAnswer, pick, shuffleInPlace } from './utils.js';

export class Rapid {
  constructor(stats, history, leaderboard){
    this.stats = stats;
    this.history = history;
    this.leaderboard = leaderboard;

    this.pool = [];
    this.mode = 'sprint60';
    this.prompt = 'mixed';
    this.awaitNext = false;
    this.current = null;
    this.expectedType = null;

    this.modeSel = document.getElementById('rapid-mode');
    this.promptSel = document.getElementById('rapid-prompt');
    this.startBtn = document.getElementById('rapid-start');
    this.qEl = document.getElementById('rapid-q');
    this.subEl = document.getElementById('rapid-sub');
    this.inputEl = document.getElementById('rapid-input');
    this.timeEl = document.getElementById('rapid-time');
    this.okEl = document.getElementById('rapid-ok');
    this.badEl = document.getElementById('rapid-bad');

    this.startBtn?.addEventListener('click', ()=> this.startRun());
    this.modeSel?.addEventListener('change', ()=> this.mode=this.modeSel.value);
    this.promptSel?.addEventListener('change', ()=> this.prompt=this.promptSel.value);

    this.inputEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        this.onEnter();
      }
    });

    this.timer = null;
    this.running = false;
    this.tLeft = 0;
    this.targetN = 30;
    this.asked = 0;
    this.correct = 0;
    this.wrong = 0;
  }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
  }

  start(){
    this.running = false;
    this.qEl.textContent = 'Pick mode + prompt, press Start';
    this.subEl.textContent = '';
    this.inputEl.value = '';
    this.timeEl.textContent = '—';
  }

  startRun(){
    if(!this.pool.length){
      this.qEl.textContent = 'No airports in this pack (sample DB).';
      this.subEl.textContent = 'Run the GitHub Action to build full dataset.';
      return;
    }
    this.running = true;
    this.awaitNext = false;
    this.asked = 0;
    this.correct = 0;
    this.wrong = 0;
    this.okEl.textContent = '0';
    this.badEl.textContent = '0';
    this.inputEl.value = '';
    this.inputEl.focus();

    if(this.mode==='sprint60' || this.mode==='sprint30'){
      const dur = (this.mode==='sprint30') ? 30 : 60;
      this.tLeft = dur;
      this.timeEl.textContent = String(this.tLeft);
      clearInterval(this.timer);
      this.timer = setInterval(()=>{
        this.tLeft -= 1;
        this.timeEl.textContent = String(this.tLeft);
        if(this.tLeft<=0){
          this.finishRun();
        }
      }, 1000);
    }else{
      this.timeEl.textContent = '—';
      clearInterval(this.timer);
      this.timer = null;
      this.targetN = 30;
    }

    this.nextQuestion(true);
  }

  finishRun(){
    if(!this.running) return;
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer=null; }
    const score = this.correct;
    const modeLabel = (this.mode==='sprint60') ? 'RAPID_SPRINT60_CITY'
      : (this.mode==='sprint30') ? 'RAPID_SPRINT30_CITY'
      : 'RAPID_SET30_CITY';
    const lastRun = { mode: modeLabel, score, correct: this.correct, wrong: this.wrong, timestamp: Date.now() };
    this.leaderboard?.setLastRun(lastRun);
    this.subEl.textContent = `Run finished. Score=${score}. Use Scoreboard → Submit last run.`;
  }

  onEnter(){
    if(!this.running) return;
    if(!this.current) return;

    if(!this.awaitNext){
      // Evaluate
      const user = this.inputEl.value;
      const expected = this.getExpectedAnswer(this.current, this.expectedType);
      const ok = eqAnswer(user, expected);

      this.stats.record(ok);
      this.asked += 1;
      if(ok) this.correct += 1; else this.wrong += 1;
      this.okEl.textContent = String(this.correct);
      this.badEl.textContent = String(this.wrong);

      const title = `${this.badge()} | ${this.clueLabel(this.current)}`;
      const detail = ok ? `OK: ${expected}` : `Your: ${user||'—'} • Correct: ${expected}`;
      this.history.add({ok, title, detail});

      this.subEl.textContent = ok ? '✅ Correct — press Enter for next' : '❌ Wrong — press Enter for next';
      this.awaitNext = true;
    }else{
      // Next
      this.awaitNext = false;
      this.inputEl.value = '';
      if(this.mode==='set30' && this.asked>=30){
        this.finishRun();
        return;
      }
      if((this.mode==='sprint60' || this.mode==='sprint30') && this.tLeft<=0){
        this.finishRun();
        return;
      }
      this.nextQuestion();
    }
  }

  badge(){
    const t = this.expectedType;
    if(t==='icao') return 'ICAO CODE';
    if(t==='iata') return 'IATA CODE';
    if(t==='city') return 'CITY';
    if(t==='name') return 'AIRPORT NAME';
    return 'ANSWER';
  }

  pickExpectedType(){
    const m = this.prompt || 'mixed';
    if(m!=='mixed') return m;
    const opts = ['icao','iata','city','name'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pick(opts.length?opts:['icao']);
  }

  clueLabel(a){
    const options = [];
    if(this.expectedType!=='icao' && a.icao) options.push(`ICAO: ${a.icao}`);
    if(this.expectedType!=='iata' && a.iata) options.push(`IATA: ${a.iata}`);
    if(this.expectedType!=='city' && a.city) options.push(`CITY: ${a.city}`);
    if(this.expectedType!=='name' && a.name) options.push(`NAME: ${a.name}`);
    if(options.length) return pick(options);
    if(a.name) return `NAME: ${a.name}`;
    if(a.city) return `CITY: ${a.city}`;
    if(a.iata) return `IATA: ${a.iata}`;
    return `ICAO: ${a.icao||'—'}`;
  }

  nextQuestion(resetSub=false){
    this.current = pick(this.pool);
    this.expectedType = this.pickExpectedType();
    this.qEl.textContent = `${this.badge()} ← ${this.clueLabel(this.current)}`;
    if(resetSub) this.subEl.textContent = 'Type answer and press Enter';
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }
}
