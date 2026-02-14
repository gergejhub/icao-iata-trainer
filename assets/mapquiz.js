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
    this.promptType = this.storage.get('mapPromptType') || 'mixed'; // mixed|icao|iata|city|name
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
        this.promptType = this.promptTypeEl.value || 'mixed';
        this.storage.set('mapPromptType', this.promptType);
        // Re-render current prompt if any
        if (this.target) this.renderPrompt();
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
      if (this.noteEl) this.noteEl.textContent = 'Press Start to begin.';
      if (this.qEl) this.qEl.textContent = '—';
      if (this.subEl) this.subEl.textContent = '';
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
      if (this.noteEl) this.noteEl.textContent = 'Leaflet failed to load.';
      return;
    }
    if (!this.map){
      // IMPORTANT: do NOT auto-pan/auto-jump; keep view stable.
      this.map = L.map('map', { worldCopyJump:false, zoomControl:false }).setView([20,0], 2);

      // Blind map: no labels
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        attribution: '© OpenStreetMap contributors • © CARTO'
      }).addTo(this.map);

      this.map.on('click', (e)=> this.onClick(e));

      this.markerGuess = L.circleMarker([0,0], { radius:8, weight:2 }).addTo(this.map).setStyle({ opacity:0, fillOpacity:0 });
      this.markerTrue  = L.circleMarker([0,0], { radius:8, weight:2 }).addTo(this.map).setStyle({ opacity:0, fillOpacity:0 });
      this.line = L.polyline([[0,0],[0,0]], { weight:3 }).addTo(this.map).setStyle({ opacity:0 });
    }

    this.updateControls();

    // Auto-start only in practice
    if (this.mode === 'practice'){
      this.startPractice();
    } else {
      if (this.noteEl) this.noteEl.textContent = 'Press Start to begin.';
      if (this.qEl) this.qEl.textContent = '—';
      if (this.subEl) this.subEl.textContent = '';
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
    if (this.noteEl) this.noteEl.textContent = '';
    if (this.qEl) this.qEl.textContent = '—';
    if (this.subEl) this.subEl.textContent = '';
    this.clearMarkers();
    this.next();
  }

  startSession(){
    const geoPool = this.pool.filter(hasGeo);
    if (!geoPool.length){
      if (this.noteEl) this.noteEl.textContent = 'No coordinates available in current dataset. Run the GitHub Action to build the global dataset first.';
      if (this.qEl) this.qEl.textContent = 'Map Quiz disabled';
      if (this.subEl) this.subEl.textContent = '';
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

    if (this.noteEl) this.noteEl.textContent = '';
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
            const name = a.name ? ` — ${a.name}` : '';
            return `• ${escapeHtml(code)}${escapeHtml(name)}: ~${Math.round(r.km)} km`;
          }).join('<br>')}
        </div></div>`
      : '';

    if (this.summaryEl){
      this.summaryEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:900;">Session finished</div>
            <div class="smallmuted" style="margin-top:4px;">
              Answered: <b>${total}</b> • Accuracy: <b>${acc}%</b> • Avg error: <b>~${Math.round(avgErr)} km</b>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <button class="ghost" id="map-close-summary">Close</button>
          </div>
        </div>
        ${list}
      `;
      this.summaryEl.style.display = 'block';

      const closeBtn = this.summaryEl.querySelector('#map-close-summary');
      if (closeBtn) closeBtn.addEventListener('click', ()=> { this.summaryEl.style.display = 'none'; });
    }

    // Keep the summary visible until user closes; do not auto-clear
    if (this.noteEl) this.noteEl.innerHTML = '';
    if (this.qEl) this.qEl.textContent = '—';
    if (this.subEl) this.subEl.textContent = '';
  }

  // ---------- Question generation ----------
  makePrompt(airport){
    const a = airport;
    let t = (this.promptType || 'mixed').toLowerCase();
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
    if (!this.target || !this.qEl) return;
    const p = this.makePrompt(this.target);
    // Highlight what the prompt is (ICAO/IATA/CITY/NAME)
    this.qEl.innerHTML = `<span class="pill" style="margin-right:8px;">${escapeHtml(p.badge)}</span>${escapeHtml(p.text)}`;
    if (this.subEl){
      const city = this.target.city ? this.target.city : '';
      const ctry = this.target.country ? this.target.country : '';
      const extra = [city, ctry].filter(Boolean).join(', ');
      this.subEl.textContent = extra;
    }
  }

  next(){
    const geoPool = this.pool.filter(hasGeo);
    if (!geoPool.length){
      if (this.noteEl) this.noteEl.textContent = 'No coordinates available in current dataset. Run the GitHub Action to build the global dataset first.';
      if (this.qEl) this.qEl.textContent = 'Map Quiz disabled';
      if (this.subEl) this.subEl.textContent = '';
      return;
    }

    // Session completion logic
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
    this.renderPrompt();

    if (this.noteEl){
      this.noteEl.innerHTML = '<span class="smallmuted">Answer:</span> click the correct location on the map.';
    }

    if (this.mode === 'set30' && this.timerEl){
      this.timerEl.textContent = `Q ${Math.min(this.answered+1, this.totalQ)}/${this.totalQ}`;
    }
  }

  onClick(e){
    if (!this.target) return;
    if (this.mode === 'sprint60' && this.remainingSec <= 0) return;
    if (this.mode === 'set30' && this.answered >= this.totalQ) return;

    // Preserve current view; do not let anything pan/zoom the map
    const center = this.map ? this.map.getCenter() : null;
    const zoom = this.map ? this.map.getZoom() : null;

    const g = e.latlng;
    const dkm = kmDistance(g.lat, g.lng, this.target.lat, this.target.lon);
    const ok = dkm < 120;

    // Markers + line
    this.markerGuess.setLatLng([g.lat,g.lng]).setStyle({ opacity:1, fillOpacity:0.6, color: ok ? 'var(--good)' : 'var(--bad)' });
    this.markerTrue .setLatLng([this.target.lat,this.target.lon]).setStyle({ opacity:1, fillOpacity:0.6, color:'var(--accent)' });
    this.line.setLatLngs([[g.lat,g.lng],[this.target.lat,this.target.lon]]).setStyle({ opacity:0.85, color: ok ? 'var(--good)' : 'var(--bad)' });

    // Restore view (guard against any accidental jump)
    if (this.map && center && typeof zoom === 'number'){
      this.map.setView(center, zoom, { animate:false });
    }

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

    // Feedback (much longer, user-friendly)
    const dur = ok ? 3000 : 9000;
    if (this.noteEl){
      this.noteEl.innerHTML = ok
        ? `<span style="color:var(--good);font-weight:900;">Correct!</span> Error: <b>~${Math.round(dkm)} km</b>`
        : this.buildMissHtml(dkm);
    }

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
  return (s||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
