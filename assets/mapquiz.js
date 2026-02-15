import { kmDistance, pick, shuffleInPlace } from './utils.js';

export class MapQuiz {
  constructor(stats, history, leaderboard){
    this.stats = stats;
    this.history = history;
    this.leaderboard = leaderboard;

    this.pool = [];
    this.map = null;
    this.layer = null;
    this.line = null;
    this.markerClick = null;
    this.markerAns = null;

    this.modeSel = document.getElementById('map-mode');
    this.promptSel = document.getElementById('map-prompt');
    this.startBtn = document.getElementById('map-start');
    this.qEl = document.getElementById('map-q');
    this.subEl = document.getElementById('map-sub');

    this.mode = 'practice';
    this.prompt = 'mixed';

    this.modeSel?.addEventListener('change', ()=> this.mode=this.modeSel.value);
    this.promptSel?.addEventListener('change', ()=> this.prompt=this.promptSel.value);
    this.startBtn?.addEventListener('click', ()=> this.startRun());

    this.running = false;
    this.tLeft = 0;
    this.timer = null;
    this.asked = 0;
    this.correct = 0;
    this.wrong = 0;
    this.expectedType = null;
    this.current = null;
    this.autoNextMs = 2000; // as requested
  }

  setPool(pool){
    // map needs coordinates
    const p = Array.isArray(pool)? pool.slice(): [];
    this.pool = p.filter(a=> Number.isFinite(a.lat) && Number.isFinite(a.lon));
    shuffleInPlace(this.pool);
  }

  start(){
    this.initMapOnce();
    this.qEl.textContent = 'Pick mode + prompt, press Start';
    this.subEl.textContent = `Available airports with coordinates: ${this.pool.length}`;
  }

  initMapOnce(){
    if(this.map) return;
    this.map = L.map('map', { worldCopyJump:false, zoomControl:true, attributionControl:true }).setView([30,0], 2);

    // label-free-ish tiles (CartoDB Positron No Labels)
    const tiles = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
    L.tileLayer(tiles, {
      maxZoom: 10,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(this.map);

    // Click handler
    this.map.on('click', (e)=> this.onClick(e));
  }

  startRun(){
    if(!this.pool.length){
      this.qEl.textContent = 'No airports with coordinates in this pack.';
      this.subEl.textContent = 'Use Global (sample) or run GitHub Action to build full dataset.';
      return;
    }
    this.running = true;
    this.asked = 0;
    this.correct = 0;
    this.wrong = 0;

    if(this.mode==='sprint60'){
      this.tLeft = 60;
      clearInterval(this.timer);
      this.timer = setInterval(()=>{
        this.tLeft -= 1;
        if(this.tLeft<=0) this.finishRun();
      }, 1000);
    }else{
      clearInterval(this.timer);
      this.timer = null;
    }
    this.nextQuestion(true);
  }

  finishRun(){
    if(!this.running) return;
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer=null; }
    const score = this.correct;
    const modeLabel = this.mode==='sprint60' ? 'MAP_SPRINT60' : (this.mode==='set30' ? 'MAP_SET30' : 'MAP_PRACTICE');
    const lastRun = { mode: modeLabel, score, correct: this.correct, wrong: this.wrong, timestamp: Date.now() };
    this.leaderboard?.setLastRun(lastRun);
    this.subEl.textContent = `Run finished. Score=${score}. Use Scoreboard → Submit last run.`;
  }

  onClick(e){
    if(!this.running || !this.current) return;

    const clickLat = e.latlng.lat;
    const clickLon = e.latlng.lng;
    const a = this.current;
    const dist = kmDistance(clickLat, clickLon, a.lat, a.lon);

    // simple correctness threshold
    const ok = dist <= 80; // km

    this.stats.record(ok);
    this.asked += 1;
    if(ok) this.correct += 1; else this.wrong += 1;

    // Draw feedback (markers + line) without changing map view
    this.clearFeedback();
    this.markerClick = L.circleMarker([clickLat, clickLon], {radius:6}).addTo(this.map);
    this.markerAns = L.circleMarker([a.lat, a.lon], {radius:6}).addTo(this.map);
    this.line = L.polyline([[clickLat, clickLon],[a.lat,a.lon]]).addTo(this.map);

    const title = `${this.badge()} | ${this.clueLabel(a)}`;
    const detail = ok ? `Hit (≈${dist.toFixed(1)} km)` : `Miss (≈${dist.toFixed(1)} km) • Correct: ${this.answerLabel(a)}`;
    this.history.add({ok, title, detail});
    this.subEl.textContent = ok ? `✅ Hit (≈${dist.toFixed(1)} km) — next in 2s` : `❌ Miss (≈${dist.toFixed(1)} km) — next in 2s`;

    setTimeout(()=>{
      if(!this.running) return;
      if(this.mode==='set30' && this.asked>=30){
        this.finishRun();
        return;
      }
      if(this.mode==='sprint60' && this.tLeft<=0){
        this.finishRun();
        return;
      }
      this.clearFeedback();
      this.nextQuestion();
    }, this.autoNextMs);
  }

  clearFeedback(){
    try{ if(this.markerClick) this.map.removeLayer(this.markerClick); }catch(e){}
    try{ if(this.markerAns) this.map.removeLayer(this.markerAns); }catch(e){}
    try{ if(this.line) this.map.removeLayer(this.line); }catch(e){}
    this.markerClick=null; this.markerAns=null; this.line=null;
  }

  badge(){
    const t = this.expectedType;
    if(t==='icao') return 'FIND ON MAP';
    if(t==='iata') return 'FIND ON MAP';
    if(t==='city') return 'FIND ON MAP';
    if(t==='name') return 'FIND ON MAP';
    return 'FIND ON MAP';
  }

  pickExpectedType(){
    const m = this.prompt || 'mixed';
    if(m!=='mixed') return m;
    const opts = ['icao','iata','city','name'].filter(t=> this.getExpectedAnswer(this.current||{}, t));
    return pick(opts.length?opts:['icao']);
  }

  clueLabel(a){
    // Here expectedType is "what clue we show", map answer is always click location of airport described by clue
    if(this.expectedType==='icao') return `ICAO CODE: ${a.icao||'—'}`;
    if(this.expectedType==='iata') return `IATA CODE: ${a.iata||'—'}`;
    if(this.expectedType==='city') return `CITY: ${a.city||'—'}`;
    if(this.expectedType==='name') return `AIRPORT NAME: ${a.name||'—'}`;
    return `AIRPORT: ${a.name||a.icao||a.iata||'—'}`;
  }

  answerLabel(a){
    return `${a.name||'Airport'} (${a.icao||'—'}/${a.iata||'—'}) • ${a.city||''}`;
  }

  nextQuestion(resetSub=false){
    this.current = pick(this.pool);
    this.expectedType = this.pickExpectedType();
    this.qEl.textContent = this.clueLabel(this.current);
    if(resetSub) this.subEl.textContent = 'Click on the map (no Next button)';
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }
}
