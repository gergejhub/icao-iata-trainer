export function normalize(s){
  if(s===null||s===undefined) return '';
  return String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu,'')
    .replace(/[^a-zA-Z0-9 ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

export function eqAnswer(user, expected){
  const a = normalize(user);
  const b = normalize(expected);
  return a.length>0 && a===b;
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
