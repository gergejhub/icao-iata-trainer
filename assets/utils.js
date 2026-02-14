export function norm(s){
  return (s||'').toString().trim().toUpperCase();
}

/**
 * Normalize free-text (airport names/cities) so the user doesn't need to type diacritics
 * or punctuation exactly (e.g. Łódź == Lodz, José == Jose).
 */
export function normLoose(s){
  const raw = (s||'').toString().trim();
  if (!raw) return '';
  // Common special letters that don't always decompose nicely with NFD
  const pre = raw
    .replace(/ß/g, 'ss')
    .replace(/Æ/g, 'AE').replace(/æ/g, 'ae')
    .replace(/Œ/g, 'OE').replace(/œ/g, 'oe')
    .replace(/Ø/g, 'O').replace(/ø/g, 'o')
    .replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .replace(/Ł/g, 'L').replace(/ł/g, 'l')
    .replace(/Þ/g, 'TH').replace(/þ/g, 'th');
  const noDia = pre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDia
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameMatch(guessRaw, targetRaw){
  const guess = normLoose(guessRaw);
  const target = normLoose(targetRaw);
  if (!guess || !target) return false;
  return guess.length >= 4 && target.includes(guess);
}

export function prettyAirport(a){
  const parts=[];
  if (a.name) parts.push(a.name);
  const loc = [a.city,a.country].filter(Boolean).join(', ');
  if (loc) parts.push(loc);
  return parts.join(' — ') || '(name not yet available)';
}
export function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}
export function hasGeo(a){
  return typeof a.lat === 'number' && typeof a.lon === 'number';
}
export function kmDistance(lat1,lon1,lat2,lon2){
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const sa = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(sa)));
}
