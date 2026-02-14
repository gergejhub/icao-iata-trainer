import { hasGeo, kmDistance, pick, prettyAirport } from './utils.js';
import { perf } from './perf.js';

export class MapQuiz{
  constructor(storage, stats){
    this.storage = storage;
    this.stats = stats;
    this.pool = [];
    this.map = null;
    this.target = null;

    // Session state
    this.mode = this.storage.get('mapMode') || 'practice'; // practice | sprint60 | set30
    this.promptType = this.storage.get('mapPromptType') || 'mixed'; // icao|iata|city|name|mixed
    this.running = false;
    this.remainingSec = 0;
    this.totalQ = 0;
    this.answered = 0;
    this.correct = 0;
    this.wrong = 0;
    this.sumErrKm = 0;
    this.results = []; // {ok, km, target, guess:{lat,lon}}

    this.timerId = null;
    this.nextId = null;

    this.bindUI();
  }

  setPool(pool){ this.pool = pool || []; }
  reset(){ this.stopSession(); this.target = null; this.clearMarkers(); this.clearFeedback(); }

  bindUI(){
    this.qEl = document.querySelector('#map-q');
    this.subEl = document.querySelector('#map-sub');
    this.noteEl = document.querySelector('#map-note');

    this.mapModeEl = document.querySelector('#map-mode');
    this.promptTypeEl = document.querySelector('#map-prompt-type');
    this.promptBadgeEl = document.querySelector('#map-prompt-badge');
    this.promptTextEl = document.querySelector('#map-prompt-text');
    this.mapHintEl = document.querySelector('#map-hint');
    this.startBtn = document.querySelector('#map-start');
    this.timerEl = document.querySelector('#map-timer');
    this.summaryEl = document.querySelector('#map-summary');

    this.nextBtn = document.querySelector('#map-next');

    if (this.mapModeEl){
      this.mapModeEl.value = this.mode;
      this.mapModeEl.addEventListener('change', ()=> this.setMode(this.mapModeEl.value));
    }
    if (this.promptTypeEl){
      this.promptTypeEl.value = this.promptType;
      this.promptTypeEl.addEventListener('change', ()=>{
        this.promptType = this.promptTypeEl.value;
        this.storage.set('mapPromptType', this.promptType);
        if (this.running){ this.newTarget(); }
        else { this.renderPrompt(); }
      });
    }
    if (this.startBtn){
      this.startBtn.addEventListener('click', ()=> this.startSession());
    }
    if (this.nextBtn){
      this.nextBtn.addEventListener('click', ()=> {
        if (this.mode === 'practice'){
          this.clearPendingNext();
          this.next();
        }
      });
    }
  }

  setMode(mode){
    this.mode = mode || 'practice';
    this.storage.set('mapMode', this.mode);
    this.stopSession();
    this.clearFeedback();
    this.updateControls();

    if (this.mode === 'practice' && this.map){
      this.startPractice();
    } else {
      this.noteEl.textContent = 'Press Start to begin.';
      this.qEl.textContent = '—';
      this.subEl.textContent = '';
    }
  }

  updateControls(){
    const isPractice = this.mode === 'practice';
    if (this.nextBtn) this.nextBtn.style.display = isPractice ? 'inline-flex' : 'none';
    if (this.timerEl) this.timerEl.style.display = (this.mode === 'sprint60' || this.mode === 'set30') ? 'inline-flex' : 'none';
    if (this.startBtn) this.startBtn.textContent = isPractice ? 'Restart' : 'Start';
    if (this.timerEl && isPractice) this.timerEl.style.display = 'none';
  }

  start(){
    if (!window.L){
      this.noteEl.textContent = 'Leaflet failed to load.';
      return;
    }
    if (!this.map){
      this.map = L.map('map', { worldCopyJump:false, zoomControl:false }).setView([20,0], 2);

      // Blind map: no labels
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        attribution: '© OpenStreetMap contributors • © CARTO'
      }).addTo(this.map);

      this.map.on('click', (e)=> this.

makePrompt(){
  const a = this.target;
  if (!a) return { badge:'', text:'' };
  let t = this.promptType || 'mixed';
  if (t === 'mixed'){
    const opts = [];
    if (a.icao) opts.push('icao');
    if (a.iata) opts.push('iata');
    if (a.city) opts.push('city');
    if (a.name) opts.push('name');
    t = opts.length ? opts[Math.floor(Math.random()*opts.length)] : 'name';
  }
  const badge = t.toUpperCase();
  let text = '';
  if (t === 'icao') text = a.icao || '';
  else if (t === 'iata') text = a.iata || '';
  else if (t === 'city') text = a.city || '';
  else text = a.name || a.city || a.icao || a.iata || '';
  return { badge, text };
}

renderPrompt(){
  if (!this.target) return;
  const p = this.makePrompt();
  if (this.promptBadgeEl) this.promptBadgeEl.textContent = p.badge;
  if (this.promptTextEl) this.promptTextEl.textContent = p.text;
  if (this.mapHintEl) this.mapHintEl.textContent = 'Click the map where this airport is located.';
}

onClick(e));

      this.markerGuess = L.circleMarker([0,0], { radius:8, weight:2 }).addTo(this.map).setStyle({ opacity:0, fillOpacity:0 });
      this.markerTrue  = L.circleMarker([0,0], { radius:8, weight:2 }).addTo(this.map).setStyle({ opacity:0, fillOpacity:0 });
      this.line = L.polyline([[0,0],[0,0]], { weight:3 }).addTo(this.map).setStyle({ opacity:0 });
    }

    this.updateControls();

    // Auto-start only in practice
    if (this.mode === 'practice'){
      this.startPractice();
    } else {
      this.noteEl.textContent = 'Press Start to begin.';
      this.qEl.textContent = '—';
      this.subEl.textContent = '';
    }
  }

  // ---------- Session control ----------
  stopSession(){
    this.running = false;
    this.clearPendingNext();
    if (this.timerId){ clearInterval(this.timerId); this.timerId = null; }
  }

  clearPendingNext(){
    if (this.nextId){ clearTimeout(this.nextId); this.nextId = null; }
  }

  startPractice(){
    this.stopSession();
    if (this.summaryEl) this.summaryEl.style.display = 'none';
    this.noteEl.textContent = '';
    this.qEl.textContent = '—';
    this.subEl.textContent = '';
    this.clearMarkers();
    this.next();
  }

  startSession(){
    const geoPool = this.pool.filter(hasGeo);
    if (!geoPool.length){
      this.noteEl.textContent = 'No coordinates available in current dataset. Run the GitHub Action to build the global dataset first.';
      this.qEl.textContent = 'Map Quiz disabled';
      this.subEl.textContent = '';
      return;
    }

    // Practice uses immediate restart
    if (this.mode === 'practice'){
      this.startPractice();
      return;
    }

    this.stopSession();
    this.clearPendingNext();
    this.clearFeedback();
    if (this.summaryEl) this.summaryEl.style.display = 'none';

    // Reset counters
    this.running = true;
    this.answered = 0;
    this.correct = 0;
    this.wrong = 0;
    this.sumErrKm = 0;
    this.results = [];

    if (this.mode === 'sprint60'){
      this.remainingSec = 60;
      this.totalQ = 0;
      if (this.timerEl){
        this.timerEl.style.display = 'inline-flex';
        this.timerEl.textContent = '60s';
      }
      this.timerId = setInterval(()=>{
        this.remainingSec -= 1;
        if (this.timerEl) this.timerEl.textContent = `${Math.max(0,this.remainingSec)}s`;
        if (this.remainingSec <= 0){
          this.finishSession();
        }
      }, 1000);
    } else if (this.mode === 'set30'){
      this.totalQ = 30;
      if (this.timerEl){
        this.timerEl.style.display = 'inline-flex';
        this.timerEl.textContent = 'Q 1/30';
      }
    }

    this.noteEl.textContent = '';
    this.next();
  }

  finishSession(){
    this.stopSession();
    this.clearMarkers();

    const total = this.answered;
    const acc = total ? Math.round((this.correct/total)*100) : 0;
    const avgErr = total ? (this.sumErrKm/total) : 0;

    const topMisses = this.results
      .filter(r=>!r.ok)
      .sort((a,b)=>b.km-a.km)
      .slice(0, 8);

    const list = topMisses.length
      ? `<div style="margin-top:8px;"><b>Biggest misses</b><div class="smallmuted" style="margin-top:6px;">
          ${topMisses.map(r=>{
            const a = r.target;
            const code = a.icao || a.iata || '';
            const name = a.name ? ` — ${escapeHtml(a.name)}` : '';
            return `• ${escapeHtml(code)}${name}: ~${Math.round(r.km)} km`;
          }).join('<br>')}
        </div></div>`
      : '';

    if (this.summaryEl){
      this.summaryEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:900;">Session complete</div>
            <div class="smallmuted" style="margin-top:4px;">
              Answered: <b>${total}</b> • Correct: <b style="color:var(--good);">${this.correct}</b> • Wrong: <b style="color:var(--bad);">${this.wrong}</b><br>
              Accuracy: <b>${acc}%</b> • Avg error: <b>~${Math.round(avgErr)} km</b>
            </div>
          </div>
          <button class="ghost" id="map-close-summary">Close</button>
        </div>
        ${list}
        <div class="smallmuted" style="margin-top:10px;">Tip: switch Mode and press Start to run another session.</div>
      `;
      this.summaryEl.style.display = 'block';
      const btn = document.querySelector('#map-close-summary');
      if (btn){
        btn.addEventListener('click', ()=>{ this.summaryEl.style.display = 'none'; }, { once:true });
      }
    }

    this.noteEl.innerHTML = '';
    this.qEl.textContent = '—';
    this.subEl.textContent = '';
    if (this.timerEl) this.timerEl.textContent = '—';
  }

  // ---------- Question flow ----------
  next(){
    const geoPool = this.pool.filter(hasGeo);
    if (!geoPool.length){
      this.noteEl.textContent = 'No coordinates available in current dataset. Run the GitHub Action to build the global dataset first.';
      this.qEl.textContent = 'Map Quiz disabled';
      this.subEl.textContent = '';
      return;
    }

    if (this.mode === 'sprint60' && this.remainingSec <= 0){
      this.finishSession();
      return;
    }
    if (this.mode === 'set30' && this.answered >= this.totalQ){
      this.finishSession();
      return;
    }

    this.clearMarkers();
    this.target = pick(geoPool);

    const label = this.target.icao || this.target.iata || '';
    const name = this.target.name ? ` — ${this.target.name}` : '';
    this.qEl.textContent = label + name;

    const city = this.target.city ? this.target.city : '';
    const ctry = this.target.country ? this.target.country : '';
    this.subEl.textContent = [city, ctry].filter(Boolean).join(', ');

    if (this.mode === 'set30' && this.timerEl){
      this.timerEl.textContent = `Q ${Math.min(this.answered+1, this.totalQ)}/${this.totalQ}`;
    }
  }

  onClick(e){
    const viewCenter = this.map ? this.map.getCenter() : null;
    const viewZoom = this.map ? this.map.getZoom() : null;
    if (!this.target) return;
    if (this.mode === 'sprint60' && this.remainingSec <= 0) return;
    if (this.mode === 'set30' && this.answered >= this.totalQ) return;

    const g = e.latlng;
    const dkm = kmDistance(g.lat, g.lng, this.target.lat, this.target.lon);
    const ok = dkm < 120;

    // Markers + line
    this.markerGuess.setLatLng([g.lat,g.lng]).setStyle({ opacity:1, fillOpacity:0.6, color: ok ? 'var(--good)' : 'var(--bad)' });
    this.markerTrue .setLatLng([this.target.lat,this.target.lon]).setStyle({ opacity:1, fillOpacity:0.6, color:'var(--accent)' });
    this.line.setLatLngs([[g.lat,g.lng],[this.target.lat,this.target.lon]]).setStyle({ opacity:0.85, color: ok ? 'var(--good)' : 'var(--bad)' });

    // Global stats (persisted)
    this.stats.answer(ok);
    if (!ok){ perf.recordMistake(this.storage, this.target); }

    // Session stats (if in a session)
    if (this.mode === 'sprint60' || this.mode === 'set30'){
      this.answered += 1;
      if (ok) this.correct += 1; else this.wrong += 1;
      this.sumErrKm += dkm;
      this.results.push({ ok, km: dkm, target: this.target, guess:{ lat:g.lat, lon:g.lng } });
    }

    // Feedback (longer + explicit)
    const dur = ok ? 2400 : 6500;
    this.noteEl.innerHTML = ok
      ? `<span style="color:var(--good);font-weight:900;">Correct!</span> Error: <b>~${Math.round(dkm)} km</b>`
      : this.buildMissHtml(dkm);

    this.clearPendingNext();
    this.nextId = setTimeout(()=>{
      if (this.mode === 'sprint60'){
        if (this.remainingSec <= 0){ this.finishSession(); return; }
        this.next();
      } else if (this.mode === 'set30'){
        if (this.answered >= this.totalQ){ this.finishSession(); return; }
        this.next();
      } else {
        // practice
        this.next();
      }
    }, dur);
  }

  buildMissHtml(dkm){
    const pills = [];
    if ((this.target.tags||[]).includes('wizz-base')) pills.push(`<span class="pill">WIZZ BASE</span>`);
    if ((this.target.tags||[]).includes('wizz-network')) pills.push(`<span class="pill">WIZZ NET</span>`);
    const meta = escapeHtml(prettyAirport(this.target));
    return `<span style="color:var(--bad);font-weight:900;">Missed</span> by <b>~${Math.round(dkm)} km</b><br>
            <span class="smallmuted">Correct:</span> <b>${meta}</b> ${pills.join(' ')}`;
  }

  clearMarkers(){
    if (this.markerGuess) this.markerGuess.setStyle({ opacity:0, fillOpacity:0 });
    if (this.markerTrue)  this.markerTrue.setStyle({ opacity:0, fillOpacity:0 });
    if (this.line) this.line.setStyle({ opacity:0 });
  }

  clearFeedback(){
    if (this.noteEl) this.noteEl.innerHTML = '';
    if (this.summaryEl) this.summaryEl.style.display = 'none';
  }
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
