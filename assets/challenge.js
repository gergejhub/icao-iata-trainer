import { storage } from './storage.js';
import { perf } from './perf.js';
import { buildChoices, pick, shuffleInPlace, speak } from './utils.js';
import { progress } from './progress.js';

function keyAirport(a){
  return (a?.icao||'')+'|'+(a?.iata||'');
}

function clueLabel(a, expectedType){
  const opts=[];
  if(expectedType!=='icao' && a.icao) opts.push(`ICAO: ${a.icao}`);
  if(expectedType!=='iata' && a.iata) opts.push(`IATA: ${a.iata}`);
  if(expectedType!=='city' && a.city) opts.push(`CITY: ${a.city}`);
  if(expectedType!=='name' && a.name) opts.push(`NAME: ${a.name}`);
  return opts.length ? pick(opts) : `AIRPORT: ${a.name||a.iata||a.icao||'—'}`;
}

export class Challenge{
  constructor(ctx, stats, history, leaderboard){
    this.ctx=ctx;
    this.stats=stats;
    this.history=history;
    this.leaderboard=leaderboard;

    this.durSel = document.getElementById('ch-dur');
    this.voiceEl = document.getElementById('ch-voice');
    this.startBtn = document.getElementById('ch-start');
    this.timeEl = document.getElementById('ch-time');
    this.scoreEl = document.getElementById('ch-score');
    this.qEl = document.getElementById('ch-q');
    this.subEl = document.getElementById('ch-sub');
    this.optsEl = document.getElementById('ch-options');

    this.startBtn?.addEventListener('click', ()=> this.start());

    this.running=false;
    this.tLeft=0;
    this.timer=null;
    this.score=0;
    this.asked=0;
    this.correct=0;
    this.wrong=0;
    this.current=null;
  }

  start(){
    const pool = this.ctx?.currentPool || [];
    if(pool.length < 20){
      this.qEl.textContent = 'Pick a bigger pack first (Wizz Network).';
      this.subEl.textContent = '';
      return;
    }
    this.running=true;
    this.score=0;
    this.asked=0;
    this.correct=0;
    this.wrong=0;
    const durMin = Number(this.durSel?.value||5);
    this.tLeft = Math.max(60, Math.round(durMin*60));
    this.updateHUD();
    clearInterval(this.timer);
    this.timer = setInterval(()=>{
      this.tLeft -= 1;
      this.updateHUD();
      if(this.tLeft<=0) this.finish();
    }, 1000);
    this.next();
  }

  finish(){
    if(!this.running) return;
    this.running=false;
    if(this.timer){ clearInterval(this.timer); this.timer=null; }
    this.subEl.textContent = `Finished. Score=${this.score}. Submit from Scoreboard if you want.`;
    const durMin = Number(this.durSel?.value||5);
    const modeLabel = `SHIFT_CHALLENGE_${durMin}M`;
    this.leaderboard?.setLastRun({ mode: modeLabel, score: this.score, correct: this.correct, wrong: this.wrong, timestamp: Date.now() });
  }

  updateHUD(){
    if(this.timeEl) this.timeEl.textContent = this.running ? String(this.tLeft) : '—';
    if(this.scoreEl) this.scoreEl.textContent = String(this.score);
  }

  next(){
    if(!this.running) return;
    const pool = this.ctx?.currentPool || [];
    const a = pick(pool);

    // Mix in “boss” items if available.
    const conf = perf.topConfusions(storage, 8);
    const useBoss = conf.length && Math.random() < 0.20;
    const expectedType = useBoss ? (conf[0].k.startsWith('ICAO') ? 'icao' : 'iata') : pick(['icao','iata','city','name']);

    const expected = this.getExpectedAnswer(a, expectedType);
    if(!expected){ return this.next(); }

    const q = `${expectedType.toUpperCase()} ← ${clueLabel(a, expectedType)}`;
    this.current = { a, expectedType, expected, q };
    this.qEl.textContent = q;
    this.subEl.textContent = 'Multiple choice. Click the correct answer.';

    const voice = !!this.voiceEl?.checked;
    if(voice){ speak(q.replace(/\|/g,' '), {lang:'en-US', rate:1}); }

    const prefer = this.preferDistractors(expectedType, expected);
    const choices = buildChoices({
      pool,
      correct: expected,
      getter: (x)=> this.getExpectedAnswer(x, expectedType),
      n: 4,
      prefer
    });
    this.renderChoices(choices, expected);
  }

  preferDistractors(expectedType, expected){
    const out=[];
    try{
      const conf = perf.getConfusions(storage);
      const kind = expectedType==='icao' ? 'ICAO' : (expectedType==='iata' ? 'IATA' : null);
      if(!kind) return out;
      const e = (expected||'').toString().toUpperCase();
      for(const [k,v] of Object.entries(conf||{})){
        const m = k.match(/^(IATA|ICAO):([^>]+)>(.+)$/);
        if(!m) continue;
        if(m[1]!==kind) continue;
        if(m[2].toUpperCase()===e) out.push(m[3].toUpperCase());
      }
    }catch(e){}
    return out.slice(0,3);
  }

  renderChoices(choices, correct){
    if(!this.optsEl) return;
    this.optsEl.innerHTML='';
    for(const c of choices){
      const b = document.createElement('button');
      b.className='choice';
      b.textContent = c;
      b.addEventListener('click', ()=> this.answer(c, correct, b));
      this.optsEl.appendChild(b);
    }
  }

  answer(choice, correct, btn){
    if(!this.running || !this.current) return;
    const ok = (choice||'').toString().toUpperCase() === (correct||'').toString().toUpperCase();
    this.asked += 1;
    if(ok) this.correct += 1; else this.wrong += 1;
    if(ok) this.score += 1; else this.score -= 1;
    this.updateHUD();
    this.stats?.record(ok);
    progress.record(this.ctx?.currentPack?.id, ok);

    if(!ok){
      perf.recordMistake(storage, this.current.a);
      const kind = this.current.expectedType==='icao' ? 'ICAO' : (this.current.expectedType==='iata' ? 'IATA' : null);
      if(kind) perf.recordConfusion(storage, kind, correct, choice);
    }

    const title = `CHALLENGE | ${this.current.q}`;
    const detail = ok ? `OK: ${correct}` : `Your: ${choice} • Correct: ${correct}`;
    this.history?.add({ok, title, detail});

    // flash feedback
    try{
      btn.classList.add(ok ? 'good' : 'bad');
    }catch(e){}
    setTimeout(()=> this.next(), 500);
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }
}
