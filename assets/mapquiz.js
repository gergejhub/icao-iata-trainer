import { hasGeo, kmDistance, pick, prettyAirport } from './utils.js';

export class MapQuiz{
  constructor(storage, stats){
    this.storage = storage;
    this.stats = stats;
    this.pool = [];
    this.map = null;
    this.target = null;
    this.bindUI();
  }
  setPool(pool){ this.pool = pool; }
  reset(){}

  bindUI(){
    this.qEl = document.querySelector('#map-q');
    this.subEl = document.querySelector('#map-sub');
    this.noteEl = document.querySelector('#map-note');
    document.querySelector('#map-next').addEventListener('click', ()=> this.next());
  }

  start(){
    if (!window.L){
      this.noteEl.textContent = 'Leaflet failed to load.';
      return;
    }
    if (!this.map){
      this.map = L.map('map', {worldCopyJump:true}).setView([20,0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 10,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      this.map.on('click', (e)=> this.onClick(e));
      this.markerGuess = L.circleMarker([0,0], {radius:8}).addTo(this.map).setStyle({opacity:0, fillOpacity:0});
      this.markerTrue = L.circleMarker([0,0], {radius:8}).addTo(this.map).setStyle({opacity:0, fillOpacity:0});
      this.line = L.polyline([[0,0],[0,0]]).addTo(this.map).setStyle({opacity:0});
    }
    this.next();
  }

  next(){
    const geoPool = this.pool.filter(hasGeo);
    if (!geoPool.length){
      this.noteEl.textContent = 'No coordinates available in current dataset. Run the GitHub Action to build the global dataset first.';
      this.qEl.textContent = 'Map Quiz disabled';
      this.subEl.textContent = '';
      return;
    }
    this.noteEl.textContent = '';
    this.target = pick(geoPool);

    const label = this.target.icao || this.target.iata || '';
    const name = this.target.name ? ` — ${this.target.name}` : '';
    this.qEl.textContent = label + name;
    this.subEl.textContent = 'Click on the map where this airport is located (within ~80 km).';

    this.markerGuess.setStyle({opacity:0, fillOpacity:0});
    this.markerTrue.setStyle({opacity:0, fillOpacity:0});
    this.line.setStyle({opacity:0});

    this.map.setView([this.target.lat, this.target.lon], 4, {animate:true});
  }

  onClick(e){
    if (!this.target || !hasGeo(this.target)) return;
    const g = e.latlng;
    const dkm = kmDistance(g.lat, g.lng, this.target.lat, this.target.lon);
    const ok = dkm <= 80;

    this.markerGuess.setLatLng([g.lat, g.lng]).setStyle({opacity:1, fillOpacity:0.7});
    this.markerTrue.setLatLng([this.target.lat, this.target.lon]).setStyle({opacity:1, fillOpacity:0.7});
    this.line.setLatLngs([[g.lat,g.lng],[this.target.lat,this.target.lon]]).setStyle({opacity:0.8});

    this.stats.answer(ok);
    this.noteEl.innerHTML = ok
      ? `<span style="color:var(--good);font-weight:900;">Correct!</span> ~${Math.round(dkm)} km`
      : `<span style="color:var(--bad);font-weight:900;">Miss</span> ~${Math.round(dkm)} km • ${escapeHtml(prettyAirport(this.target))}`;

    setTimeout(()=>this.next(), 900);
  }
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
