export function normalize(s){
  if(s===null||s===undefined) return '';
  return String(s)
    .normalize('NFD')
    // Strip combining diacritics (broader browser support than Unicode property escapes)
    .replace(/[\u0300-\u036f]+/g,'')
    .replace(/[^a-zA-Z0-9 ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

// Backward/compat alias used by older modules.
export const norm = normalize;

export function eqAnswer(user, expected){
  const a = normalize(user);
  const b = normalize(expected);
  return a.length>0 && a===b;
}

// ------------------------------------------------------------
// Mixed-mode weighting (ICAO/IATA dominant; CITY still present)
// ------------------------------------------------------------
const MIXED_WEIGHTS = { icao: 0.45, iata: 0.45, city: 0.10 };

export function pickMixedType(availableTypes){
  const types = (availableTypes||[]).filter(t=> t in MIXED_WEIGHTS);
  if(!types.length) return 'icao';
  // renormalize weights to only available types
  let sum = 0;
  for(const t of types) sum += MIXED_WEIGHTS[t] || 0;
  if(sum <= 0) return pick(types);
  let r = Math.random() * sum;
  for(const t of types){
    r -= (MIXED_WEIGHTS[t] || 0);
    if(r <= 0) return t;
  }
  return types[types.length-1];
}

// ------------------------------------------------------------
// Question rendering with category highlight chips
// ------------------------------------------------------------
export function renderQuestion(el, { clueType, clueLabel, clueValue, expectedType, expectedLabel } = {}){
  if(!el) return;
  // clear
  while(el.firstChild) el.removeChild(el.firstChild);

  const wrap = document.createElement('div');
  wrap.className = `qwrap q-exp-${(expectedType||'').toLowerCase()}`;

  const accent = document.createElement('span');
  accent.className = `qaccent q-${(expectedType||'').toLowerCase()}`;

  const clue = document.createElement('span');
  clue.className = 'qclue';

  const chip = document.createElement('span');
  chip.className = `qchip q-${(clueType||'').toLowerCase()} qchip-clue`;
  chip.textContent = (clueLabel||'').toString();

  const val = document.createElement('span');
  val.className = 'qval';
  val.textContent = (clueValue||'—').toString();

  clue.appendChild(chip);
  clue.appendChild(document.createTextNode(' '));
  clue.appendChild(val);

  const arrow = document.createElement('span');
  arrow.className = 'qarrow';
  arrow.textContent = ' → ';

  const exp = document.createElement('span');
  exp.className = `qchip q-${(expectedType||'').toLowerCase()} qchip-exp`;
  exp.textContent = (expectedLabel||'').toString();

  wrap.appendChild(accent);
  wrap.appendChild(clue);
  wrap.appendChild(arrow);
  wrap.appendChild(exp);
  el.appendChild(wrap);

  // Useful for voice/history
  try{
    el.dataset.plain = `${(clueLabel||'').toString()}: ${(clueValue||'').toString()} → ${(expectedLabel||'').toString()}`;
    el.dataset.clueValue = (clueValue||'').toString();
  }catch(e){}
}

// ------------------------------------------------------------
// CITY grading with partial credit for metro/alias cases
// ------------------------------------------------------------

// Hand-picked overrides for “marketed as metro” airports.
// Keys can be IATA or ICAO.
const CITY_ALIAS_OVERRIDES = {
  // Milan–Bergamo (BGY/LIME) marketed/associated with Milan & Bergamo
  BGY: ['Bergamo', 'Milan', 'Milano'],
  LIME: ['Bergamo', 'Milan', 'Milano'],
  // Stockholm Skavsta (NYO/ESKN) often answered as Stockholm / Skavsta
  NYO: ['Stockholm', 'Skavsta'],
  ESKN: ['Stockholm', 'Skavsta'],
  // London Luton (LTN/EGGW) often answered as London
  LTN: ['London'],
  EGGW: ['London']
};

const CITY_STOPWORDS = new Set([
  'airport','international','intl','aeropuerto','aeroporto','aeroport','aéroport','flughafen',
  'airfield','field','aerodrome','aerodrom','terminal','regional','municipal','county',
  'saint','st','santa','san','de','del','la','le','el','di','da','do','dos','das','of','the'
]);

export function parseCityParts(cityRaw){
  const s = String(cityRaw||'').trim();
  if(!s) return { primary: '', aliases: [] };

  // Primary: before parentheses if present
  const pm = s.match(/^(.+?)\s*\((.+)\)\s*$/);
  let primary = s;
  let inner = '';
  if(pm){
    primary = (pm[1]||'').trim();
    inner = (pm[2]||'').trim();
  }

  // If comma-separated locality/region, treat first as primary.
  if(!pm && primary.includes(',')){
    const parts = primary.split(',').map(x=>x.trim()).filter(Boolean);
    if(parts.length){
      primary = parts[0];
      inner = parts.slice(1).join(', ');
    }
  }

  const aliases = [];
  if(inner){
    // Split aliases by common separators
    inner.split(/\s*[,;/]\s*|\s+\/\s+|\s+\+\s+/g)
      .map(x=>x.trim())
      .filter(Boolean)
      .forEach(x=> aliases.push(x));
  }

  return { primary, aliases };
}

function aliasesFromAirportName(airport, primaryCity){
  const name = String(airport?.name||'').trim();
  if(!name) return [];
  const primaryNorm = normalize(primaryCity);
  const primaryTokens = new Set(primaryNorm ? primaryNorm.split(' ') : []);

  const tokens = normalize(name).split(' ').filter(Boolean);
  const out = [];
  for(const t of tokens){
    if(t.length < 3) continue;
    if(primaryTokens.has(t)) continue;
    if(CITY_STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return unique(out);
}

function overridesForAirport(airport){
  const out = [];
  const keys = [String(airport?.iata||'').toUpperCase(), String(airport?.icao||'').toUpperCase()].filter(Boolean);
  for(const k of keys){
    const arr = CITY_ALIAS_OVERRIDES[k];
    if(Array.isArray(arr)) out.push(...arr);
  }
  return unique(out);
}

export function cityAliasesForAirport(airport){
  const cityRaw = String(airport?.city||'').trim();
  const parts = parseCityParts(cityRaw);
  const aliases = [];
  aliases.push(...(parts.aliases||[]));
  aliases.push(...aliasesFromAirportName(airport, parts.primary||cityRaw));
  aliases.push(...overridesForAirport(airport));

  // Remove empties + duplicates (by normalized form)
  const seen = new Set();
  const out = [];
  for(const a of aliases){
    const n = normalize(a);
    if(!n) continue;
    if(seen.has(n)) continue;
    seen.add(n);
    out.push(a);
  }
  return out;
}

export function gradeCityAnswer(userRaw, airport){
  const u = normalize(userRaw);
  if(!u) return { credit: 0, matched: null };

  const cityRaw = String(airport?.city||'').trim();
  const { primary } = parseCityParts(cityRaw);
  const primaryNorm = normalize(primary||cityRaw);

  // Full credit if user matches the primary city, or clearly contains it.
  if(primaryNorm){
    if(u === primaryNorm) return { credit: 1, matched: 'primary' };
    if(u.length >= 4 && (primaryNorm.startsWith(u) || primaryNorm.includes(u))) return { credit: 1, matched: 'primary_partial' };
    if(u.length >= 4 && u.includes(primaryNorm)) return { credit: 1, matched: 'primary_included' };
  }

  // Partial credit for aliases (parentheses, airport-name locality, metro marketing overrides)
  const aliases = cityAliasesForAirport(airport);
  for(const a of aliases){
    const an = normalize(a);
    if(!an || an === primaryNorm) continue;
    if(u === an) return { credit: 0.5, matched: a };
    if(u.length >= 4 && (an.includes(u) || u.includes(an))) return { credit: 0.5, matched: a };
  }

  return { credit: 0, matched: null };
}

export function gradeAnswer(userRaw, expectedRaw, expectedType, airport=null){
  const t = (expectedType||'').toLowerCase();
  if(t === 'city'){
    const res = gradeCityAnswer(userRaw, airport||{city: expectedRaw});
    return { ...res, ok: res.credit > 0, partial: res.credit > 0 && res.credit < 1 };
  }
  const ok = eqAnswer(userRaw, expectedRaw);
  return { credit: ok ? 1 : 0, ok, partial: false, matched: ok ? 'exact' : null };
}

export function formatPoints(n){
  const x = Number(n||0);
  if(!Number.isFinite(x)) return '0';
  return (Math.round(x*10)%10===0) ? String(Math.round(x)) : x.toFixed(1);
}

export function prettyAirport(a){
  if(!a) return '';
  const code = `${a.icao||'—'}/${a.iata||'—'}`;
  const city = a.city ? `${a.city}` : '';
  const name = a.name ? `${a.name}` : '';
  const ctry = a.country ? `(${a.country})` : '';
  return [code, city, name, ctry].filter(Boolean).join(' • ');
}

// Simple modal popup (no dependencies). Useful for end-of-run summaries.
export function showPopup({ title='Info', message='', okText='OK' } = {}){
  try{
    // Remove any previous popup
    const prev = document.getElementById('app-popup-backdrop');
    if(prev) prev.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'app-popup-backdrop';
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const h = document.createElement('div');
    h.className = 'modal-h';
    h.textContent = title;

    const b = document.createElement('div');
    b.className = 'modal-b';
    // Preserve line breaks
    const pre = document.createElement('pre');
    pre.className = 'modal-pre';
    pre.textContent = message;
    b.appendChild(pre);

    const f = document.createElement('div');
    f.className = 'modal-f';
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = okText;
    btn.addEventListener('click', ()=> backdrop.remove());
    f.appendChild(btn);

    modal.appendChild(h);
    modal.appendChild(b);
    modal.appendChild(f);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
    return ()=> backdrop.remove();
  }catch(e){
    // Fallback
    alert(`${title}\n\n${message}`);
    return ()=>{};
  }
}

export function unique(arr){
  return Array.from(new Set(arr));
}

export function sampleDistinct(arr, n){
  const out=[];
  const seen=new Set();
  for(let i=0;i<Math.min(arr.length*3, 5000) && out.length<n;i++){
    const x = pick(arr);
    const k = (x===null||x===undefined) ? '' : String(x);
    if(!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// Build multiple-choice options with the correct one included.
// getter(item) should return the candidate string.
export function buildChoices({pool, correct, getter, n=4, prefer=[]}){
  const opts = [];
  const seen = new Set();
  const add = (v)=>{
    const s = (v||'').toString();
    if(!s) return;
    if(seen.has(s)) return;
    seen.add(s);
    opts.push(s);
  };
  add(correct);
  // Prefer list first (e.g. confusion distractors)
  for(const p of prefer){
    if(opts.length>=n) break;
    add(p);
  }
  // Then random from pool
  const guard = Math.min(5000, (pool?.length||0)*4 + 200);
  for(let i=0;i<guard && opts.length<n;i++){
    const item = pick(pool);
    add(getter(item));
  }
  // In the worst case, return fewer than n.
  shuffleInPlace(opts);
  return opts;
}

// Basic client-side TTS (voice mode). Safe no-op if not supported.
export function speak(text, {lang='en-US', rate=1, pitch=1, volume=1} = {}){
  try{
    if(!('speechSynthesis' in window)) return;
    const t = (text||'').toString().trim();
    if(!t) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    // Cancel previous queue to keep it “radio-like”.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){
    // ignore
  }
}

export function kmDistance(lat1, lon1, lat2, lon2){
  const R = 6371;
  const toRad = d => d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const s1 = Math.sin(dLat/2);
  const s2 = Math.sin(dLon/2);
  const aa = s1*s1 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*s2*s2;
  const c = 2*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R*c;
}

export function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

export function shuffleInPlace(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
