import { norm, pick, prettyAirport } from './utils.js';

export class RapidFire{
  constructor(storage, stats){
    this.storage = storage;
    this.stats = stats;
    this.pool = [];
    this.timer = null;
    this.timeLeft = 60;
    this.score = 0;
    this.current = null;
    this.qType = null;
    this.bindUI();
  }
  setPool(pool){ this.pool = pool; }
  reset(){}

  bindUI(){
    this.qEl = document.querySelector('#rapid-q');
    this.subEl = document.querySelector('#rapid-sub');
    this.inEl = document.querySelector('#rapid-input');
    this.metaEl = document.querySelector('#rapid-meta');
    this.btnStart = document.querySelector('#rapid-start');
    this.btnStop = document.querySelector('#rapid-stop');
    this.btnStart.addEventListener('click', ()=> this.start());
    this.btnStop.addEventListener('click', ()=> this.stop());
    this.inEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') this.submit(); });
    document.querySelector('#rapid-submit').addEventListener('click', ()=> this.submit());
  }

  start(){
    this.stop();
    this.timeLeft = 60;
    this.score = 0;
    this.inEl.value='';
    this.next();
    this.tick();
    this.timer = setInterval(()=>this.tick(), 1000);
    this.btnStart.disabled = true;
    this.btnStop.disabled = false;
  }

  stop(){
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.btnStart.disabled = false;
    this.btnStop.disabled = true;
    this.metaEl.textContent = `Score: ${this.score}`;
  }

  tick(){
    this.metaEl.textContent = `Time: ${this.timeLeft}s • Score: ${this.score}`;
    this.timeLeft -= 1;
    if (this.timeLeft < 0){
      this.stop();
      alert(`Time! Score: ${this.score}`);
    }
  }

  next(){
    const a = pick(this.pool);
    this.current = a;
    this.qType = this.pickType(a);
    const label = (this.qType === 'icao->iata') ? 'IATA?' :
                  (this.qType === 'iata->icao') ? 'ICAO?' :
                  (this.qType === 'code->name') ? 'Name (type 4+ chars)' :
                  (this.qType === 'name->code') ? 'Code?' : 'Answer';
    let q='';
    if (this.qType === 'icao->iata') q = a.icao;
    if (this.qType === 'iata->icao') q = a.iata;
    if (this.qType === 'code->name') q = (a.icao || a.iata);
    if (this.qType === 'name->code') q = a.name || '(name not yet available)';
    this.qEl.textContent = q;
    this.subEl.textContent = label;
    this.inEl.value='';
    this.inEl.focus();
  }

  pickType(a){
    const types=[];
    if (a.icao && a.iata) types.push('icao->iata','iata->icao');
    if (a.icao || a.iata) types.push('code->name');
    if (a.name && (a.icao || a.iata)) types.push('name->code');
    return pick(types);
  }

  submit(){
    if (!this.timer) return;
    const a = this.current;
    const guess = norm(this.inEl.value);
    let correctRaw='';
    let ok=false;

    if (this.qType === 'icao->iata'){ correctRaw = a.iata || ''; ok = guess === norm(correctRaw); }
    if (this.qType === 'iata->icao'){ correctRaw = a.icao || ''; ok = guess === norm(correctRaw); }
    if (this.qType === 'code->name'){
      correctRaw = a.name || '';
      ok = !!correctRaw && guess.length>=4 && correctRaw.toUpperCase().includes(guess);
    }
    if (this.qType === 'name->code'){
      correctRaw = a.icao || a.iata || '';
      ok = guess === norm(correctRaw);
    }

    this.stats.answer(ok);
    if (ok){
      this.score += 1;
      this.next();
    } else {
      this.score = Math.max(0, this.score-1);
      this.metaEl.textContent = `❌ ${a.icao||'—'}/${a.iata||'—'} • ${prettyAirport(a)}`;
      this.next();
    }
  }
}
