import { loadDataset, getPackFilter, makeAirportPool } from './data.js';
import { SRS } from './srs.js';
import { RapidFire } from './rapid.js';
import { MapQuiz } from './mapquiz.js';
import { Drill } from './drill.js';
import { Stats } from './stats.js';
import { storage } from './storage.js';
import { Leaderboard } from './leaderboard.js';
import { History } from './history.js';

const $ = (sel)=> document.querySelector(sel);

const state = {
  dataset: null,
  pack: 'global',
  pool: [],
  stats: null,
  history: null,
  leaderboard: null,
  srs: null,
  rapid: null,
  map: null,
  drill: null
};

function setStatus(msg){
  const el = $('#status');
  if (el) el.textContent = msg;
}

function setMode(mode){
  document.querySelectorAll('[data-view]').forEach(el=>{
    el.style.display = (el.getAttribute('data-view') === mode) ? '' : 'none';
  });
}

function setPack(pack){
  state.pack = pack;
  storage.set('pack', pack);
  const filter = getPackFilter(state.dataset, pack);
  state.pool = makeAirportPool(state.dataset, filter);
  setStatus(`Pack: ${pack} • ${state.pool.length} items`);
  // notify modules
  state.srs?.setPool(state.pool);
  state.rapid?.setPool(state.pool);
  state.map?.setPool(state.pool);
  state.drill?.setPool(state.pool);
}

function renderKPIs(){
  const s = state.stats.snapshot();
  $('#kpi-total').textContent = s.total;
  $('#kpi-ok').textContent = s.correct;
  $('#kpi-bad').textContent = s.wrong;
  $('#kpi-acc').textContent = `${Math.round(s.accuracy*100)}%`;
}

async function boot(){
  setStatus('Loading dataset…');
  state.dataset = await loadDataset();
  state.stats = new Stats(storage);
  state.stats.onChange(renderKPIs);

  state.history = new History();
  state.leaderboard = new Leaderboard(storage);
  state.leaderboard.refresh();

  state.srs = new SRS(storage, state.stats, state.history);
  state.rapid = new RapidFire(storage, state.stats, state.history);
  state.map = new MapQuiz(storage, state.stats, state.history);
  state.drill = new Drill(storage, state.stats);

  $('#packSelect').addEventListener('change', (e)=> setPack(e.target.value));

  $('#btn-home').addEventListener('click', ()=> setMode('home'));
  $('#btn-srs').addEventListener('click', ()=> { state.history.startRun('LEARN'); setMode('srs'); state.srs.start(); });
  $('#btn-rapid').addEventListener('click', ()=> { state.history.startRun('RAPID'); setMode('rapid'); state.rapid.start(); });
  $('#btn-map').addEventListener('click', ()=> { state.history.startRun('MAP'); setMode('map'); state.map.start(); });
  $('#btn-drill').addEventListener('click', ()=> { setMode('drill'); state.drill.render(); });

  $('#btn-reset').addEventListener('click', ()=>{
    if (!confirm('Reset stats and local progress?')) return;
    state.stats.reset();
    state.history.clear();
    setStatus('Reset done.');
  });

  // init pack
  const savedPack = storage.get('pack', 'global');
  $('#packSelect').value = savedPack;
  setPack(savedPack);

  renderKPIs();
  setMode('home');
}

boot().catch(err=>{
  console.error(err);
  setStatus('App failed. Open console for details.');
});
