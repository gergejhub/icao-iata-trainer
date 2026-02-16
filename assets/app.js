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
import { i18n } from './i18n.js';
import { pick } from './utils.js';

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

function markActiveLangButtons(){
  const hu = document.getElementById('lang-hu');
  const en = document.getElementById('lang-en');
  if(!hu || !en) return;
  hu.classList.toggle('active', i18n.lang==='hu');
  en.classList.toggle('active', i18n.lang==='en');
}

async function boot(){
  i18n.init();
  i18n.apply();

  // Language flags
  const btnHU = document.getElementById('lang-hu');
  const btnEN = document.getElementById('lang-en');
  btnHU?.addEventListener('click', ()=> i18n.setLang('hu'));
  btnEN?.addEventListener('click', ()=> i18n.setLang('en'));
  markActiveLangButtons();
  i18n.onChange(()=> markActiveLangButtons());

  const status = $('#status');
  status.textContent = i18n.t('status.loading');

  const db = await loadAllData();

  const stats = new Stats();
  stats.onChange(()=> setKpis(stats));
  setKpis(stats);

  const history = new History(i18n);
  const leaderboard = new Leaderboard(i18n);
  leaderboard.refresh();

  const defaultPackId = (db.packs.find(p=>p.id==='wizz-network') ? 'wizz-network' : (db.packs[0]?.id || 'wizz-network'));

  const ctx = {
    db,
    i18n,
    t: (key, vars=null, fallback=null)=> i18n.t(key, vars, fallback),
    packName: (packId, fallback='')=> i18n.packName(packId, fallback),
    voiceLang: ()=> (i18n.lang==='hu' ? 'hu-HU' : 'en-US'),

    stats,
    history,
    leaderboard,

    showView,

    // dataset scope
    currentPack: null,
    currentPool: [],
    currentPoolKeySet: null,
    wizzBases: [],

    // pro mode
    proMode: storage.get('proMode', false) === true,
    pickAirport: null,
    pickBase: null,

    // will be assigned
    learn: null,
    rapid: null,
    mapquiz: null,
    srs: null,
    drill: null,
    heatmap: null,
    brief: null,
    ops: null,
    challenge: null,

    setPack: null,
    resetToDefaultPack: null,
    defaultPackId,
  };

  // Resolve Wizz base airports
  try{
    const iatas = new Set((db.lists['wizz_bases_iata.txt']||[]).map(x=>x.toUpperCase()));
    ctx.wizzBases = Array.from(iatas).map(i=>db.indexes.byIATA[i]).filter(Boolean);
  }catch(e){ ctx.wizzBases = []; }

  // Helpers used by quiz modules
  ctx.pickBase = ()=>{
    if(!ctx.wizzBases.length) return null;
    return pick(ctx.wizzBases);
  };

  ctx.pickAirport = (pool)=>{
    const p = Array.isArray(pool) ? pool : [];
    if(!p.length) return null;

    if(!ctx.proMode || !ctx.wizzBases.length) return pick(p);

    // Pro logic: favor outstations (typical BASE->outstation) but still include bases.
    const baseSet = new Set(ctx.wizzBases.map(a=>(a.icao||'')+'|'+(a.iata||'')));
    const bases = p.filter(a=> baseSet.has((a.icao||'')+'|'+(a.iata||'')));
    const outs = p.filter(a=> !baseSet.has((a.icao||'')+'|'+(a.iata||'')));

    const r = Math.random();
    if(outs.length && r < 0.70) return pick(outs);
    if(bases.length) return pick(bases);
    return pick(p);
  };

  // Pro mode toggle on Home
  const proEl = document.getElementById('proMode');
  if(proEl){
    proEl.checked = !!ctx.proMode;
    proEl.addEventListener('change', ()=>{
      ctx.proMode = !!proEl.checked;
      storage.set('proMode', ctx.proMode);
    });
  }

  // Modules
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
  ctx.drill = drill;
  ctx.heatmap = heatmap;
  ctx.brief = brief;
  ctx.ops = ops;
  ctx.challenge = challenge;

  const setPack = (packId)=>{
    const { pack, pool } = buildPool(db, packId);
    ctx.currentPack = pack;
    ctx.currentPool = pool;
    ctx.currentPoolKeySet = new Set(pool.map(a=>(a.icao||'')+'|'+(a.iata||'')));

    const packLabel = ctx.packName(pack.id, pack.name);
    status.textContent = i18n.t('status.dataset', { name: packLabel, n: pool.length });

    learn.setPool(pool);
    rapid.setPool(pool);
    mapquiz.setPool(pool);
    srs.setPool(pool);
  };

  ctx.setPack = setPack;
  ctx.resetToDefaultPack = ()=> setPack(defaultPackId);

  // Default pack
  setPack(defaultPackId);

  // Daily drill button on Home
  const dailyBtn = document.getElementById('home-daily');
  dailyBtn?.addEventListener('click', ()=>{
    // If user has no confusions yet, fall back to review-mistakes to bootstrap.
    const conf = JSON.stringify(storage.get('confusions', {}));
    const has = conf && conf !== '{}' && conf.length>2;
    ctx.setPack(has ? 'daily-top20' : 'review-mistakes');
    showView('rapid');
    // configure rapid for short drill
    try{
      const modeSel = document.getElementById('rapid-mode');
      const promptSel = document.getElementById('rapid-prompt');
      const mcq = document.getElementById('rapid-mcq');
      if(modeSel) modeSel.value = 'set30';
      if(promptSel) promptSel.value = 'mixed';
      if(mcq) mcq.checked = true;
    }catch(e){}
    history.startRun('RAPID');
    rapid.startRun();
  });

  // Language change: re-apply texts + refresh key UI
  i18n.onChange(()=>{
    i18n.apply();
    setKpis(stats);
    if(ctx.currentPack){
      const packLabel = ctx.packName(ctx.currentPack.id, ctx.currentPack.name);
      status.textContent = i18n.t('status.dataset', { name: packLabel, n: ctx.currentPool.length });
    }
    history.render();
    leaderboard.refreshLabels?.();
    learn.renderIdle?.();
    rapid.renderIdle?.();
    mapquiz.renderIdle?.();
    srs.renderIdle?.();
    challenge.renderIdle?.();
    ops.renderIdle?.();
    brief.renderIdle?.();
    if(document.querySelector('[data-view="drill"]')?.style.display !== 'none'){
      drill.render();
    }
  });

  // Nav buttons
  $('#btn-home').addEventListener('click', ()=>{ ctx.resetToDefaultPack(); showView('home'); });

  $('#btn-learn').addEventListener('click', ()=>{
    ctx.resetToDefaultPack();
    history.startRun('LEARN');
    showView('learn');
    learn.start();
  });

  $('#btn-rapid').addEventListener('click', ()=>{
    ctx.resetToDefaultPack();
    history.startRun('RAPID');
    showView('rapid');
    rapid.start();
  });

  $('#btn-map').addEventListener('click', ()=>{
    ctx.resetToDefaultPack();
    history.startRun('MAP');
    showView('map');
    mapquiz.start();
  });

  $('#btn-drill').addEventListener('click', ()=>{ showView('drill'); drill.render(); });

  $('#btn-srs').addEventListener('click', ()=>{
    ctx.resetToDefaultPack();
    history.startRun('SRS');
    showView('srs');
    srs.start();
  });

  $('#btn-brief').addEventListener('click', ()=>{ showView('brief'); brief.generate(); });

  $('#btn-heatmap').addEventListener('click', ()=>{ showView('heatmap'); heatmap.start(); });

  $('#btn-ops').addEventListener('click', ()=>{ ctx.resetToDefaultPack(); showView('ops'); ops.start(); });

  $('#btn-challenge').addEventListener('click', ()=>{ ctx.resetToDefaultPack(); history.startRun('CHALLENGE'); showView('challenge'); challenge.start(); });

  $('#btn-reset').addEventListener('click', ()=>{
    if(confirm(i18n.t('confirm.reset'))){
      stats.reset();
      history.clear();
    }
  });

  showView('home');
  status.textContent = i18n.t('status.ready');
}

boot().catch(err=>{
  console.error(err);
  const status = document.getElementById('status');
  if(status) status.textContent = i18n.t('status.failed');
});
