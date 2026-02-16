import { pick, shuffleInPlace, kmDistance, buildChoices } from './utils.js';

export class Ops {
  constructor(ctx){
    this.ctx = ctx;
    this.pool = [];

    this.modeSel = document.getElementById('ops-mode');
    this.startBtn = document.getElementById('ops-start');
    this.qEl = document.getElementById('ops-q');
    this.subEl = document.getElementById('ops-sub');
    this.optEl = document.getElementById('ops-options');

    this.startBtn?.addEventListener('click', ()=> this.start());
  }

  t(key, vars=null, fallback=''){ return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key); }

  setPool(pool){
    this.pool = Array.isArray(pool)? pool.slice(): [];
  }

  refreshIdle(){
    if(!this.qEl || !this.subEl) return;
    this.qEl.textContent = '—';
    this.subEl.textContent = this.t('ops.sub.pick_two');
  }

  start(){
    // Use airports with coordinates
    const pool = (this.pool||[]).filter(a=> Number.isFinite(a.lat) && Number.isFinite(a.lon));
    if(pool.length < 10){
      this.qEl.textContent = this.t('ops.not_enough');
      this.subEl.textContent = '';
      this.optEl.innerHTML = '';
      return;
    }

    // pick a destination from pool; pro mode should prefer outstations
    const dest = this.ctx?.pickAirport ? this.ctx.pickAirport(pool) : pick(pool);

    const candidates = pool
      .filter(a=> a!==dest)
      .map(a=> ({ a, km: kmDistance(dest.lat, dest.lon, a.lat, a.lon) }))
      .sort((x,y)=> x.km - y.km)
      .slice(0, 12)
      .map(x=> x.a);

    const correct = candidates.slice(0,2);

    const options = buildChoices({
      pool: candidates,
      correct: correct[0]?.iata || correct[0]?.icao || '',
      getter: (a)=> a.iata || a.icao || '',
      n: 6,
      prefer: [correct[1]?.iata || correct[1]?.icao || '']
    });

    shuffleInPlace(options);

    const destLabel = `${dest.iata||'—'}/${dest.icao||'—'} — ${dest.city||dest.name||''}`.trim();
    this.qEl.textContent = `DEST: ${destLabel}`;
    this.subEl.textContent = this.t('ops.sub.pick_two');

    const picked = new Set();
    this.optEl.innerHTML = '';
    for(const o of options){
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = o;
      b.addEventListener('click', ()=>{
        if(picked.has(o)) return;
        picked.add(o);
        b.classList.add('selected');

        if(picked.size>=2){
          const ok = correct.every(c=> picked.has(c.iata||c.icao||''));
          // show feedback on buttons
          for(const child of Array.from(this.optEl.children)){
            const val = child.textContent;
            const isCorrect = correct.some(c=> (c.iata||c.icao||'')===val);
            child.classList.toggle('ok', isCorrect);
            child.classList.toggle('bad', !isCorrect && picked.has(val));
          }
        }
      });
      this.optEl.appendChild(b);
    }
  }
}
