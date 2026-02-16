import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { eqAnswer, pick, shuffleInPlace, buildChoices, speak } from './utils.js';

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
      progress.record(this.ctx?.currentPack?.id, ok);

      if(!ok){
        perf.recordMistake(storage, this.current);
        const kind = (this.expectedType==='iata') ? 'IATA' : (this.expectedType==='icao' ? 'ICAO' : null);
        if(kind) perf.recordConfusion(storage, kind, expected, user);
      }
      const title = `${this.badge()} | ${this.clueLabel(this.current)}`;
      const detail = ok ? `OK: ${expected}` : `Your: ${user||'—'} • Correct: ${expected}`;
      this.history.add({ok, title, detail});

      this.subEl.textContent = ok ? '✅ Correct — press Enter for next' : '❌ Wrong — press Enter for next';
      this.awaitNext = true;

      // MCQ mode: auto-advance
      if(this.mcqEl?.checked){
        setTimeout(()=>{
          if(!this.awaitNext) return;
          this.awaitNext=false;
          this.inputEl.value='';
          this.nextQuestion(true);
        }, 650);
      }
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

    const voice = !!this.voiceEl?.checked;
    if(voice){
      try{ speak(this.qEl.textContent, {lang:'en-US', rate:1}); }catch(e){}
    }

    const mcq = !!this.mcqEl?.checked;
    if(mcq){
      this.inputEl.style.display='none';
      this.choicesEl.style.display='grid';
      const expected = this.getExpectedAnswer(this.current, this.expectedType);
      const choices = buildChoices({
        pool: this.pool,
        correct: expected,
        getter: (a)=> this.getExpectedAnswer(a, this.expectedType),
        n: 4
      });
      this.renderChoices(choices);
    }else{
      this.inputEl.style.display='';
      this.choicesEl.style.display='none';
      this.choicesEl.innerHTML='';
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
        this.inputEl.value=c;
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
