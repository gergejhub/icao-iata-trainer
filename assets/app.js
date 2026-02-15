import { storage } from './storage.js';
import { loadAllData, buildPool } from './data.js';
import { Stats } from './stats.js';
import { History } from './history.js';
import { Leaderboard } from './leaderboard.js';
import { Learn } from './learn.js';
import { Rapid } from './rapid.js';
import { MapQuiz } from './mapquiz.js';
import { Drill } from './drill.js';

const $ = (sel)=> document.querySelector(sel);

function showView(id){
  document.querySelectorAll('[data-view]').forEach(el=>{
    el.style.display = (el.getAttribute('data-view')===id) ? '' : 'none';
  });
}

function setKpis(stats){
  const s = stats.snapshot();
  $('#kpi-total').textContent = String(s.total);
  $('#kpi-ok').textContent = String(s.correct);
  $('#kpi-bad').textContent = String(s.wrong);
  $('#kpi-acc').textContent = `${Math.round(s.accuracy*100)}%`;
}

async function boot(){
  const status = $('#status');
  status.textContent = 'Loading…';
  const db = await loadAllData();

  const stats = new Stats();
  stats.onChange(()=> setKpis(stats));
  setKpis(stats);

  const history = new History();
  const leaderboard = new Leaderboard();
  leaderboard.refresh();

  // Pack select
  const packSel = $('#packSelect');
  packSel.innerHTML = db.packs.map(p=> `<option value="${p.id}">${p.name}</option>`).join('');
  const savedPack = storage.get('packId', db.packs[0].id);
  packSel.value = savedPack;

  const setPack = (packId)=>{
    const { pack, pool } = buildPool(db, packId);
    status.textContent = `${pack.name} • ${pool.length} airports (sample DB)`;
    learn.setPool(pool);
    rapid.setPool(pool);
    mapquiz.setPool(pool);
    drill.setPool(pool);
  };

  const learn = new Learn(stats, history);
  const rapid = new Rapid(stats, history, leaderboard);
  const mapquiz = new MapQuiz(stats, history, leaderboard);
  const drill = new Drill(stats);

  packSel.addEventListener('change', ()=> setPack(packSel.value));
  setPack(packSel.value);

  // Buttons
  $('#btn-home').addEventListener('click', ()=> showView('home'));
  $('#btn-learn').addEventListener('click', ()=> { history.startRun('LEARN'); showView('learn'); learn.start(); });
  $('#btn-rapid').addEventListener('click', ()=> { history.startRun('RAPID'); showView('rapid'); rapid.start(); });
  $('#btn-map').addEventListener('click', ()=> { history.startRun('MAP'); showView('map'); mapquiz.start(); });
  $('#btn-drill').addEventListener('click', ()=> { showView('drill'); drill.render(); });
  $('#btn-reset').addEventListener('click', ()=>{
    if(confirm('Reset overall stats?')){
      stats.reset();
      history.clear();
    }
  });

  showView('home');
  status.textContent = `${db.packs.find(p=>p.id===packSel.value)?.name||'Pack'} • ready`;
}

boot().catch(err=>{
  console.error(err);
  const status = document.getElementById('status');
  if(status) status.textContent = 'App failed. Open console.';
});
