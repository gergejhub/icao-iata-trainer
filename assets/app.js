import { storage } from './storage.js';
import { loadAllData, buildPool } from './data.js';
import { Stats } from './stats.js';
import { History } from './history.js';
import { Leaderboard } from './leaderboard.js';
import { Learn } from './learn.js';
import { Rapid } from './rapid.js';
import { MapQuiz } from './mapquiz.js';
import { Drill } from './drill.js';
import { SRS } from './srs.js';
import { Heatmap } from './heatmap.js';
import { Brief } from './brief.js';
import { Ops } from './ops.js';
import { Challenge } from './challenge.js';
import { progress, learningPath } from './progress.js';

const $ = (sel)=> document.querySelector(sel);

function escapeHtml(s){
  return (s||'').toString().replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

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
  const fallbackPack = (db.packs.find(p=>p.id==='wizz-network') || db.packs[0]).id;
  let savedPack = storage.get('packId', fallbackPack);
  // migrate old 'global' to network-only
  if(savedPack==='global') { savedPack='wizz-network'; storage.set('packId', savedPack); }

  // Learning-path lock toggle
  const pathLockEl = document.getElementById('pathLock');
  if(pathLockEl){
    pathLockEl.checked = progress.isPathLockEnabled();
    pathLockEl.addEventListener('change', ()=>{
      progress.setPathLockEnabled(pathLockEl.checked);
      rebuildPackOptions();
      // If current pack became locked, fall back
      if(packSel.selectedOptions?.[0]?.disabled){
        const first = Array.from(packSel.options).find(o=>!o.disabled);
        if(first){ packSel.value = first.value; setPack(first.value); }
      }
      renderPathStatus();
    });
  }

  function rebuildPackOptions(){
    packSel.innerHTML = db.packs.map(p=>{
      const locked = !learningPath.unlocked(p.id);
      const label = locked ? `${p.name} \ud83d\udd12` : p.name;
      const title = locked ? learningPath.explain(p.id) : (p.description||'');
      return `<option value="${escapeHtml(p.id)}" ${locked?'disabled':''} title="${escapeHtml(title)}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  rebuildPackOptions();
  // Restore selection if possible
  packSel.value = savedPack;
  if(packSel.selectedOptions?.[0]?.disabled){
    const first = Array.from(packSel.options).find(o=>!o.disabled);
    if(first) packSel.value = first.value;
  }

  const ctx = {
    db,
    currentPack: null,
    currentPool: [],
    currentPoolKeySet: null,
    wizzBases: [],
    showView,
    setPack: (id)=> setPack(id),
    // modules will be attached after init
    learn: null,
    rapid: null,
    mapquiz: null,
    srs: null
  };

  // Resolve Wizz base airports for Ops mode
  try{
    const iatas = new Set((db.lists['wizz_bases_iata.txt']||[]).map(x=>x.toUpperCase()));
    ctx.wizzBases = Array.from(iatas).map(i=>db.indexes.byIATA[i]).filter(Boolean);
  }catch(e){ ctx.wizzBases = []; }

  const learn = new Learn(stats, history, ctx);
  const rapid = new Rapid(stats, history, leaderboard, ctx);
  const mapquiz = new MapQuiz(stats, history, leaderboard, ctx);
  const srs = new SRS(ctx, stats, history);
  const drill = new Drill(ctx);
  const heatmap = new Heatmap(ctx);
  const brief = new Brief(ctx);
  const ops = new Ops(ctx);
  const challenge = new Challenge(ctx, stats, history, leaderboard);

  ctx.learn = learn;
  ctx.rapid = rapid;
  ctx.mapquiz = mapquiz;
  ctx.srs = srs;

  const setPack = (packId)=>{
    const { pack, pool } = buildPool(db, packId);
    ctx.currentPack = pack;
    ctx.currentPool = pool;
    ctx.currentPoolKeySet = new Set(pool.map(a=>(a.icao||'')+'|'+(a.iata||'')));

    const src = db?.meta?.dbSource === 'full' ? 'full DB' : (db?.meta?.dbSource === 'sample' ? 'sample DB' : 'DB');
    status.textContent = `${pack.name} • ${pool.length} airports (${src})`;
    learn.setPool(pool);
    rapid.setPool(pool);
    mapquiz.setPool(pool);
    srs.setPool(pool);
    // drill / heatmap / brief use ctx directly
    renderPathStatus();
  };

  function renderPathStatus(){
    const el = document.getElementById('pathStatus');
    if(!el) return;
    const base = progress.get('wizz-bases');
    const net = progress.get('wizz-network');
        el.innerHTML = `
      <div class="smallmuted">Learning path: Bases \u2192 Network \u2192 Regions. (based on recent accuracy)</div>
      <div class="list" style="margin-top:8px;">
        <div class="lbrow"><div>Wizz Bases</div><div class="lbscore">${Math.round(base.recentAcc*100)}% / ${base.recentN}</div></div>
        <div class="lbrow"><div>Wizz Network</div><div class="lbscore">${Math.round(net.recentAcc*100)}% / ${net.recentN}</div></div>
      </div>
    `;
  }

  packSel.addEventListener('change', ()=>{
    if(packSel.selectedOptions?.[0]?.disabled){
      const first = Array.from(packSel.options).find(o=>!o.disabled);
      if(first) packSel.value = first.value;
    }
    setPack(packSel.value);
  });
  setPack(packSel.value);

  // Buttons
  $('#btn-home').addEventListener('click', ()=> showView('home'));
  $('#btn-learn').addEventListener('click', ()=> { history.startRun('LEARN'); showView('learn'); learn.start(); });
  $('#btn-rapid').addEventListener('click', ()=> { history.startRun('RAPID'); showView('rapid'); rapid.start(); });
  $('#btn-map').addEventListener('click', ()=> { history.startRun('MAP'); showView('map'); mapquiz.start(); });
  $('#btn-drill').addEventListener('click', ()=> { showView('drill'); drill.render(); });
  $('#btn-srs').addEventListener('click', ()=> { history.startRun('SRS'); showView('srs'); srs.start(); });
  $('#btn-brief').addEventListener('click', ()=> { showView('brief'); brief.generate(); });
  $('#btn-heatmap').addEventListener('click', ()=> { showView('heatmap'); heatmap.start(); });
  $('#btn-ops').addEventListener('click', ()=> { showView('ops'); ops.start(); });
  $('#btn-challenge').addEventListener('click', ()=> { history.startRun('CHALLENGE'); showView('challenge'); });
  $('#btn-reset').addEventListener('click', ()=>{
    if(confirm('Reset overall stats?')){
      stats.reset();
      history.clear();
    }
  });

  showView('home');
  renderPathStatus();
  status.textContent = `${db.packs.find(p=>p.id===packSel.value)?.name||'Pack'} • ready`;
}

boot().catch(err=>{
  console.error(err);
  const status = document.getElementById('status');
  if(status) status.textContent = 'App failed. Open console.';
});
