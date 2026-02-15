import { eqAnswer, pick, shuffleInPlace } from './utils.js';

export class Learn {
  constructor(stats, history){
    this.stats = stats;
    this.history = history;
    this.pool = [];
    this.mode = 'mixed';
    this.awaitNext = false;
    this.current = null;
    this.expectedType = null;

    this.promptSel = document.getElementById('learn-prompt');
    this.qEl = document.getElementById('learn-q');
    this.subEl = document.getElementById('learn-sub');
    this.inputEl = document.getElementById('learn-input');

    this.promptSel?.addEventListener('change', ()=> { this.mode=this.promptSel.value; this.nextQuestion(true); });

    this.inputEl?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        this.onEnter();
      }
    });
  }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
    shuffleInPlace(this.pool);
  }

  start(){
    this.awaitNext = false;
    this.inputEl.value = '';
    this.nextQuestion(true);
    this.inputEl.focus();
  }

  onEnter(){
    if(!this.current) return;
    if(!this.awaitNext){
      const user = this.inputEl.value;
      const expected = this.getExpectedAnswer(this.current, this.expectedType);
      const ok = eqAnswer(user, expected);

      this.stats.record(ok);
      const title = `${this.badge()} | ${this.clueLabel(this.current)}`;
      const detail = ok ? `OK: ${expected}` : `Your: ${user||'—'} • Correct: ${expected}`;
      this.history.add({ok, title, detail});

      this.subEl.textContent = ok ? '✅ Correct — press Enter for next' : '❌ Wrong — press Enter for next';
      this.awaitNext = true;
    }else{
      this.awaitNext = false;
      this.inputEl.value = '';
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

  nextQuestion(resetSub=false){
    if(!this.pool.length){
      this.qEl.textContent = 'No airports in this pack (sample DB).';
      this.subEl.textContent = 'Run the GitHub Action to build full dataset.';
      return;
    }
    this.current = pick(this.pool);
    this.expectedType = this.pickExpectedType();
    const clue = this.clueLabel(this.current);
    this.qEl.textContent = `${this.badge()} ← ${clue}`;
    if(resetSub) this.subEl.textContent = 'Type answer and press Enter';
  }

  pickExpectedType(){
    const m = this.mode || 'mixed';
    if(m!=='mixed') return m;
    const opts = ['icao','iata','city','name'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pick(opts.length?opts:['icao']);
  }

  clueLabel(a){
    // Choose a clue that is NOT the expected answer type
    const options = [];
    if(this.expectedType!=='icao' && a.icao) options.push(`ICAO: ${a.icao}`);
    if(this.expectedType!=='iata' && a.iata) options.push(`IATA: ${a.iata}`);
    if(this.expectedType!=='city' && a.city) options.push(`CITY: ${a.city}`);
    if(this.expectedType!=='name' && a.name) options.push(`NAME: ${a.name}`);
    if(options.length) return pick(options);
    // fallback
    if(a.name) return `NAME: ${a.name}`;
    if(a.city) return `CITY: ${a.city}`;
    if(a.iata) return `IATA: ${a.iata}`;
    return `ICAO: ${a.icao||'—'}`;
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }
}
