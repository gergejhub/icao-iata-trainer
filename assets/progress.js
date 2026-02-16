import { storage } from './storage.js';

// Rolling-window per-pack performance to support “base-first” unlocking.
// Stored per browser.

const KEY_PREFIX = 'packperf:';

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

export const progress = {
  record(packId, ok){
    if(!packId) return;
    const k = KEY_PREFIX + packId;
    const cur = storage.get(k, {window:[], total:0, correct:0});
    cur.total += 1;
    if(ok) cur.correct += 1;
    cur.window = Array.isArray(cur.window) ? cur.window : [];
    cur.window.push(ok ? 1 : 0);
    // keep a moderate rolling window
    if(cur.window.length > 200) cur.window = cur.window.slice(cur.window.length-200);
    storage.set(k, cur);
  },

  get(packId){
    const k = KEY_PREFIX + packId;
    const cur = storage.get(k, {window:[], total:0, correct:0});
    const w = Array.isArray(cur.window) ? cur.window : [];
    const total = Number(cur.total||0);
    const correct = Number(cur.correct||0);
    const wrong = Math.max(0, total - correct);
    const acc = total ? (correct/total) : 0;
    const lastN = 50;
    const recent = w.slice(Math.max(0, w.length-lastN));
    const recentN = recent.length;
    const recentAcc = recentN ? (recent.reduce((a,b)=>a+b,0)/recentN) : 0;
    return { total, correct, wrong, accuracy: acc, recentN, recentAcc };
  },

  reset(packId){
    if(!packId) return;
    storage.del(KEY_PREFIX + packId);
  },

  isPathLockEnabled(){
    return !!storage.get('pathLock', true);
  },
  setPathLockEnabled(v){
    storage.set('pathLock', !!v);
  }
};

// Default learning path rules.
// Note: IDs must match data/packs.json.
export const learningPath = {
  // For each packId: prerequisites & target accuracy.
  rules: {
    'wizz-bases':   { prereq: null,           recentN: 30, acc: 0.80 },
    'wizz-network': { prereq: 'wizz-bases',   recentN: 50, acc: 0.85 },
    // Regions unlock after Wizz Network
    'region-cee':   { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-balkans': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-baltics': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-nordics': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-iberia': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-uk-ie': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-benelux': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-dach': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-italy': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
    'region-fr': { prereq: 'wizz-network', recentN: 40, acc: 0.80 },
  },

  // Packs that should always remain selectable even when locked (e.g. review packs)
  alwaysUnlocked: new Set(['review-mistakes','boss-iata','boss-icao']),

  unlocked(packId){
    if(!packId) return true;
    if(learningPath.alwaysUnlocked.has(packId)) return true;
    if(!progress.isPathLockEnabled()) return true;

    const rule = learningPath.rules[packId];
    if(!rule) return true; // not in path => free
    if(!rule.prereq) return true;

    const pre = progress.get(rule.prereq);
    return pre.recentN >= rule.recentN && pre.recentAcc >= rule.acc;
  },

  explain(packId){
    const rule = learningPath.rules[packId];
    if(!rule || !rule.prereq) return '';
    const pre = progress.get(rule.prereq);
    const needN = rule.recentN;
    const needAcc = Math.round(rule.acc*100);
    const haveN = pre.recentN;
    const haveAcc = Math.round(pre.recentAcc*100);
    return `Unlock: ${rule.prereq} needs ≥${needAcc}% over last ${needN} (now ${haveAcc}% / ${haveN})`;
  }
};
