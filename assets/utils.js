export function normalize(s){
  if(s===null||s===undefined) return '';
  return String(s)
    .normalize('NFD')
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

// Special matcher for AIRPORT NAME questions: allow typing just the city name.
// - case-insensitive
// - accent-insensitive
// - accepts:
//   1) exact airport name
//   2) exact city name
//   3) (optional) partial airport name match (>=4 chars)
export function eqAirportNameOrCity(userRaw, airport){
  const u = normalize(userRaw);
  if(!u) return false;
  const name = normalize(airport?.name||'');
  const city = normalize(airport?.city||'');
  if(name && u===name) return true;
  if(city && u===city) return true;

  // Allow partial match for convenience when users type a distinctive fragment.
  // Guard with length to avoid trivial 1-2 letter matches.
  if(name && u.length>=4 && name.includes(u)) return true;
  if(city && u.length>=3 && city.includes(u)) return true;

  return false;
}

export function nameMatch(userRaw, nameRaw){
  const u = normalize(userRaw);
  const n = normalize(nameRaw);
  if(!u || !n) return false;
  if(u.length < 4) return false;
  return n.includes(u);
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

// Render a question line with a highlighted category chip.
// Uses DOM construction (no innerHTML) to avoid injection issues.
// expectedType: 'icao' | 'iata' | 'city' | 'name' | ...
export function setQuestion(el, clue, expectedType, label){
  if(!el) return;
  // Reset
  el.textContent = '';
  const t = (expectedType||'').toString().trim().toLowerCase() || 'other';
  el.setAttribute('data-qtype', t);

  const clueSpan = document.createElement('span');
  clueSpan.className = 'qclue';
  clueSpan.textContent = (clue??'').toString();

  const arrow = document.createElement('span');
  arrow.className = 'qarrow';
  arrow.textContent = ' \u2192 ';

  const chip = document.createElement('span');
  chip.className = `qchip qchip-${t}`;
  chip.textContent = (label??'').toString();

  el.appendChild(clueSpan);
  el.appendChild(arrow);
  el.appendChild(chip);
}

export function setQuestionText(el, text){
  if(!el) return;
  el.textContent = (text??'').toString();
  el.removeAttribute('data-qtype');
}
