import { loadDataset, getPackFilter, makeAirportPool } from './data.js';
import { SRS } from './srs.js';
import { RapidFire } from './rapid.js';
import { MapQuiz } from './mapquiz.js';
import { Stats } from './stats.js';
import { storage } from './storage.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  dataset: null,
  packId: 'wizz-network',
  mode: 'home',
  pool: [],
  srs: null,
  rapid: null,
  map: null,
  stats: null,
};

function setStatus(text){ $('#status').textContent = text; }

function renderKPIs(){
  const s = state.stats.snapshot();
  $('#kpi-streak').textContent = String(s.streak || 0);
  $('#kpi-acc').textContent = (s.accuracyPct ?? 0) + '%';
  $('#kpi-seen').textContent = String(s.totalAnswered || 0);
}

function showView(id){
  for (const el of document.querySelectorAll('[data-view]')){
    el.style.display = (el.getAttribute('data-view') === id) ? 'block' : 'none';
  }
}

function setMode(mode){
  state.mode = mode;
  showView(mode);
  const map = {home:'HOME', srs:'LEARN (SRS)', rapid:'RAPID-FIRE', map:'MAP QUIZ'};
  $('#mode-badge').textContent = map[mode] ?? 'HOME';
}

function setPack(packId){
  state.packId = packId;
  storage.set('packId', packId);
  const filter = getPackFilter(packId, state.dataset);
  state.pool = makeAirportPool(state.dataset, filter);
  $('#packName').textContent = state.dataset.packs?.find(p=>p.id===packId)?.name || packId;
  $('#poolCount').textContent = String(state.pool.length);
  state.srs.setPool(state.pool);
  state.rapid.setPool(state.pool);
  state.map.setPool(state.pool);
}

async function boot(){
  setStatus('Loading dataset…');
  state.dataset = await loadDataset();
  state.stats = new Stats(storage);
  state.srs = new SRS(storage, state.stats);
  state.rapid = new RapidFire(storage, state.stats);
  state.map = new MapQuiz(storage, state.stats);

  const packSel = $('#packSelect');
  packSel.innerHTML = '';
  for (const p of state.dataset.packs){
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    packSel.appendChild(opt);
  }

  const savedPack = storage.get('packId') || 'wizz-network';
  packSel.value = savedPack;
  setPack(savedPack);

  const missingGeo = state.dataset.airports.filter(a => !a.lat || !a.lon).length;
  const note = $('#datasetNote');
  if (missingGeo === state.dataset.airports.length){
    note.style.display = 'block';
    note.innerHTML = `
      <div class="notice">
        <div style="font-weight:800;margin-bottom:6px;">Global dataset isn’t built yet (names/coords missing).</div>
        <div>In GitHub: go to <b>Actions → Build OurAirports dataset</b> and run it once. After that, Map Quiz + full global learning will be enabled.</div>
      </div>`;
  } else {
    note.style.display = 'none';
  }

  $('#packSelect').addEventListener('change', (e)=> setPack(e.target.value));
  $('#btn-home').addEventListener('click', ()=> setMode('home'));
  $('#btn-srs').addEventListener('click', ()=> { setMode('srs'); state.srs.start(); });
  $('#btn-rapid').addEventListener('click', ()=> { setMode('rapid'); state.rapid.start(); });
  $('#btn-map').addEventListener('click', ()=> { setMode('map'); state.map.start(); });

  $('#btn-reset').addEventListener('click', ()=>{
    if (!confirm('Reset progress (SRS + stats)?')) return;
    storage.clearPrefix('srs:');
    storage.clearPrefix('stats:');
    storage.clearPrefix('rapid:');
    storage.clearPrefix('map:');
    state.stats.reset();
    state.srs.reset();
    state.rapid.reset();
    state.map.reset();
    renderKPIs();
    alert('Progress reset.');
  });

  state.stats.onChange(renderKPIs);
  renderKPIs();
  setStatus('Ready.');
  setMode('home');
}

boot().catch(err=>{
  console.error(err);
  setStatus('Failed to load dataset. Open console for details.');
});
