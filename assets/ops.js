import { kmDistance, pick, shuffleInPlace } from './utils.js';

function nearestAirports(pool, target, n=6, maxKm=350){
  if(!Number.isFinite(target?.lat) || !Number.isFinite(target?.lon)) return [];
  const scored=[];
  for(const a of pool){
    if(a===target) continue;
    if(!Number.isFinite(a?.lat) || !Number.isFinite(a?.lon)) continue;
    const d = kmDistance(target.lat, target.lon, a.lat, a.lon);
    if(d>maxKm) continue;
    scored.push({a, d});
  }
  scored.sort((x,y)=>x.d-y.d);
  return scored.slice(0,n).map(x=>x.a);
}

function label(a){
  const c = a.city || a.country || '';
  return `${a.iata||a.icao||'—'} — ${a.name||'Airport'}${c?` (${c})`:''}`;
}

export class Ops {
  constructor(ctx){
    this.ctx = ctx;
    this.qEl = document.getElementById('ops-q');
    this.subEl = document.getElementById('ops-sub');
    this.optsEl = document.getElementById('ops-options');
    this.startBtn = document.getElementById('ops-start');
    this.modeSel = document.getElementById('ops-mode');
    this.scoreEl = document.getElementById('ops-score');

    this.startBtn?.addEventListener('click', ()=> this.start());

    this.running = false;
    this.score = 0;
    this.current = null;
    this.correctSet = new Set();
    this.selected = new Set();
  }

  start(){
    const pool = this.ctx?.currentPool || [];
    if(pool.length < 15){
      this.qEl.textContent = 'Not enough airports in this pack.';
      this.subEl.textContent = 'Use a bigger pack (e.g. Wizz Network).';
      return;
    }
    this.running = true;
    this.score = 0;
    this.updateScore();
    this.next();
  }

  updateScore(){
    if(this.scoreEl) this.scoreEl.textContent = String(this.score);
  }

  next(){
    const pool = (this.ctx?.currentPool || []).filter(a=>Number.isFinite(a.lat) && Number.isFinite(a.lon));
    if(pool.length < 20){
      this.qEl.textContent = 'This pack has too few airports with coordinates.';
      this.subEl.textContent = 'Run the data build workflow if needed.';
      return;
    }

    const dest = pick(pool);
    const near = nearestAirports(pool, dest, 10, 450);
    if(near.length < 4){
      return this.next();
    }

    // Define “correct alternates” as the 2 nearest airports (simple heuristic)
    const correct = near.slice(0,2);
    this.correctSet = new Set(correct.map(a=> (a.icao||'')+'|'+(a.iata||'')));

    // Build options: include those two + 4 other nearby candidates
    const options = correct.concat(near.slice(2,6));
    shuffleInPlace(options);

    this.current = { dest, options };
    this.selected = new Set();

    const baseHint = this.pickBaseHint();
    this.qEl.textContent = `Route drill: ${baseHint} → ${dest.iata||dest.icao||dest.city||'DEST'}`;
    this.subEl.textContent = 'Pick TWO plausible alternates near destination (closest airports).';

    this.renderOptions();
  }

  pickBaseHint(){
    const bases = this.ctx?.wizzBases || [];
    if(bases.length){
      const b = pick(bases);
      return b.iata || b.icao || b.city || 'BASE';
    }
    return 'BASE';
  }

  renderOptions(){
    if(!this.optsEl) return;
    this.optsEl.innerHTML = '';
    for(const a of (this.current?.options||[])){
      const key = (a.icao||'')+'|'+(a.iata||'');
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = label(a);
      btn.addEventListener('click', ()=> this.pick(key, btn));
      this.optsEl.appendChild(btn);
    }
  }

  pick(key, btn){
    if(this.selected.has(key)) return;
    this.selected.add(key);
    btn.classList.add('picked');
    if(this.selected.size >= 2){
      this.grade();
    }
  }

  grade(){
    const picked = Array.from(this.selected);
    let delta = 0;
    for(const k of picked){
      if(this.correctSet.has(k)) delta += 1;
      else delta -= 1;
    }
    this.score += delta;
    this.updateScore();

    // Paint feedback
    for(const el of Array.from(this.optsEl?.children||[])){
      const t = el.textContent || '';
      // no reliable reverse lookup; keep minimal: just lock buttons
      el.disabled = true;
    }
    this.subEl.textContent = delta > 0 ? `✅ +${delta} points — next in 1s` : `❌ ${delta} points — next in 1s`;
    setTimeout(()=> this.next(), 1000);
  }
}
