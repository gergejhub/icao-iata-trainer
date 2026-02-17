import { storage } from './storage.js';
import { perf } from './perf.js';
import { progress } from './progress.js';
import { kmDistance, pick, shuffleInPlace, speak } from './utils.js';

export class MapQuiz {
  constructor(stats, history, leaderboard, ctx){
    this.stats = stats;
    this.history = history;
    this.leaderboard = leaderboard;
    this.ctx = ctx;

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
    this.voiceEl = document.getElementById('map-voice');

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
    this.autoNextMs = 2000;
    this.baseCtx = null;
  }

  t(key, vars=null, fallback=''){ return this.ctx?.t ? this.ctx.t(key, vars, fallback) : (fallback||key); }
  voiceLang(){ return this.ctx?.voiceLang ? this.ctx.voiceLang() : 'en-US'; }

  setPool(pool){
    const p = Array.isArray(pool)? pool.slice(): [];
    this.pool = p.filter(a=> Number.isFinite(a.lat) && Number.isFinite(a.lon));
    shuffleInPlace(this.pool);
  }

  start(){
    this.initMapOnce();
    this.qEl.textContent = this.t('map.sub.ready', null, 'Pick mode + prompt, press Start');
    this.subEl.textContent = this.t('status.dataset', { name: this.ctx?.packName?.(this.ctx?.currentPack?.id, this.ctx?.currentPack?.name)||'', n: this.pool.length }, `Available airports with coordinates: ${this.pool.length}`);
  }

  initMapOnce(){
    if(this.map) return;
    this.map = L.map('map', { worldCopyJump:false, zoomControl:true, attributionControl:true }).setView([30,0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, attribution: '&copy; OpenStreetMap' }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);

    this.map.on('click', (e)=>{
      if(!this.running || !this.current) return;
      this.onAnswer(e.latlng.lat, e.latlng.lng);
    });
  }

  startRun(){
    if(this.pool.length < 5){
      this.qEl.textContent = this.t('challenge.need_pool', null, 'Not enough airports in the dataset.');
      return;
    }
    this.running = true;
    this.asked = 0;
    this.correct = 0;
    this.wrong = 0;
    this.current = null;
    this.expectedType = null;

    // timed modes could be added later; for now practice.
    this.askNext();
  }

  pickExpectedType(){
    const p = this.prompt || 'mixed';
    if(p!=='mixed') return p;
    return pick(['icao','iata','city','name']);
  }

  badge(){
    const t = this.expectedType;
    if(t==='icao') return this.t('label.icao_code', null, 'ICAO CODE');
    if(t==='iata') return this.t('label.iata_code', null, 'IATA CODE');
    if(t==='city') return this.t('label.city', null, 'CITY');
    if(t==='name') return this.t('label.airport_name', null, 'AIRPORT NAME');
    return this.t('label.answer', null, 'ANSWER');
  }

  clueLabel(a){
    const opts=[];
    if(this.expectedType!=='icao' && a.icao) opts.push(`${this.t('clue.icao',null,'ICAO')}: ${a.icao}`);
    if(this.expectedType!=='iata' && a.iata) opts.push(`${this.t('clue.iata',null,'IATA')}: ${a.iata}`);
    if(this.expectedType!=='city' && a.city) opts.push(`${this.t('clue.city',null,'CITY')}: ${a.city}`);
    if(this.expectedType!=='name' && a.name) opts.push(`${this.t('clue.name',null,'NAME')}: ${a.name}`);
    return opts.length ? pick(opts) : `${this.t('clue.icao',null,'ICAO')}: ${a.icao||'—'}`;
  }

  getExpectedAnswer(a, t){
    if(t==='icao') return a.icao||'';
    if(t==='iata') return a.iata||'';
    if(t==='city') return a.city||'';
    if(t==='name') return a.name||'';
    return '';
  }

  askNext(){
    this.layer?.clearLayers();
    this.current = (this.ctx?.pickAirport ? this.ctx.pickAirport(this.pool) : pick(this.pool));
    this.expectedType = this.pickExpectedType();
    this.baseCtx = this.ctx?.pickBaseContext ? this.ctx.pickBaseContext() : null;

    const q = `${this.clueLabel(this.current)} → ${this.badge()}`;
    this.qEl.textContent = q;

    const baseTxt = (this.baseCtx && this.ctx?.proMode)
      ? this.t('pro.base_context', { base: `${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}` }, `BASE: ${this.baseCtx.iata||'—'}/${this.baseCtx.icao||'—'}`)
      : '';
    this.subEl.textContent = baseTxt ? `${this.t('map.sub.click', null, 'Click on the map (no Next button)')} • ${baseTxt}` : this.t('map.sub.click', null, 'Click on the map (no Next button)');

    if(this.voiceEl?.checked){
      speak((this.clueLabel(this.current)||'').toString(), { lang: this.voiceLang() });
    }

    this.asked += 1;
    // marker for the answer location (hidden until click)
    // nothing else
  }

  onAnswer(lat, lon){
    if(!this.current) return;

    const dKm = kmDistance(lat, lon, this.current.lat, this.current.lon);
    const hit = dKm <= 120; // generous hit radius for training
    this.stats.record(hit);
    progress.record(this.ctx?.currentPack?.id, hit);

    const expected = this.getExpectedAnswer(this.current, this.expectedType);
    if(!hit){
      perf.recordMistake(storage, this.current);
    }

    // show markers & line
    const click = L.circleMarker([lat,lon], { radius:8 });
    const ans = L.circleMarker([this.current.lat, this.current.lon], { radius:8 });
    click.addTo(this.layer);
    ans.addTo(this.layer);
    L.polyline([[lat,lon],[this.current.lat,this.current.lon]]).addTo(this.layer);

    const title = `${this.badge()} | ${this.clueLabel(this.current)}`;
    const detail = hit
      ? this.t('detail.hit', { km: Math.round(dKm) }, `Hit (≈${Math.round(dKm)} km)`)
      : this.t('detail.miss', { km: Math.round(dKm), correct: expected }, `Miss (≈${Math.round(dKm)} km) • Correct: ${expected}`);
    this.history.add({ ok: hit, title, detail, airport: this.current });

    // auto-next
    setTimeout(()=>{
      if(!this.running) return;
      this.askNext();
    }, this.autoNextMs);
  }

  refreshIdle(){}
}
