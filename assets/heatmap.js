import { storage } from './storage.js';
import { perf } from './perf.js';
import { prettyAirport } from './utils.js';

function resolveKey(indexes, key){
  if(!indexes || !key) return null;
  if(key.startsWith('icao:')) return indexes.byICAO?.[key.slice(5).toUpperCase()] || null;
  if(key.startsWith('iata:')) return indexes.byIATA?.[key.slice(5).toUpperCase()] || null;
  return null;
}

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

export class Heatmap {
  constructor(ctx){
    this.ctx = ctx;
    this.map = null;
    this.layers = [];
    this.minEl = document.getElementById('hm-min');
    this.onlyEl = document.getElementById('hm-onlypack');
    this.refreshBtn = document.getElementById('hm-refresh');
    this.exportBtn = document.getElementById('hm-export');
    this.exportBtn2 = document.getElementById('hm-export2');

    this.refreshBtn?.addEventListener('click', ()=> this.render());
    this.minEl?.addEventListener('input', ()=> this.render());
    this.onlyEl?.addEventListener('change', ()=> this.render());
    this.exportBtn?.addEventListener('click', ()=> this.export('mistakes'));
    this.exportBtn2?.addEventListener('click', ()=> this.export('confusions'));
  }

  start(){
    this.initOnce();
    this.render();
  }

  initOnce(){
    if(this.map) return;
    this.map = L.map('heatmap', { worldCopyJump:false, zoomControl:true, attributionControl:true }).setView([35, 10], 3);
    const tiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tiles, { maxZoom: 10, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(this.map);
  }

  clearLayers(){
    for(const l of this.layers){ try{ this.map.removeLayer(l);}catch(e){} }
    this.layers = [];
  }

  render(){
    if(!this.map) return;
    this.clearLayers();

    const indexes = this.ctx?.db?.indexes || {byICAO:{}, byIATA:{}};
    const mistakes = perf.getMistakes(storage);
    const onlyPack = !!this.onlyEl?.checked;
    const poolSet = this.ctx?.currentPoolKeySet || null;
    const minN = clamp(Number(this.minEl?.value||1), 1, 50);

    const pts = [];
    let maxCount = 1;
    for(const [k,v] of Object.entries(mistakes||{})){
      const count = Number(v?.count||0);
      if(count < minN) continue;
      const a = resolveKey(indexes, k);
      if(!a) continue;
      if(!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
      if(onlyPack && poolSet && !poolSet.has((a.icao||'')+'|'+(a.iata||''))) continue;
      pts.push({a, count, last:Number(v?.last||0)});
      if(count > maxCount) maxCount = count;
    }

    if(!pts.length){
      // nothing to show
      return;
    }

    // Draw circles scaled by count
    for(const p of pts){
      const intensity = p.count / maxCount;
      const radius = 4 + Math.round(intensity * 12);
      const color = intensity >= 0.66 ? '#ff2aa1' : (intensity >= 0.33 ? '#ffd166' : '#74c0fc');
      const layer = L.circleMarker([p.a.lat, p.a.lon], {
        radius,
        color,
        weight: 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.35
      }).addTo(this.map);
      layer.bindTooltip(`${p.count}× • ${prettyAirport(p.a)}`);
      this.layers.push(layer);
    }

    // Fit bounds (but don't zoom in too aggressively)
    try{
      const g = L.featureGroup(this.layers);
      this.map.fitBounds(g.getBounds().pad(0.2), { maxZoom: 6 });
    }catch(e){}
  }

  export(kind){
    try{
      const indexes = this.ctx?.db?.indexes || {byICAO:{}, byIATA:{}};
      const dataset = { byICAO: indexes.byICAO, byIATA: indexes.byIATA };
      const csvs = perf.exportCSV(storage, dataset);
      const csv = (kind==='confusions') ? csvs.confusionsCSV : csvs.mistakesCSV;
      const filename = kind==='confusions' ? 'confusions.csv' : 'mistakes.csv';
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }catch(e){
      console.error(e);
    }
  }
}
