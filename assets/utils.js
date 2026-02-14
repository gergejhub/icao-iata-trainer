export function norm(s){
  return (s||'').toString().trim().toUpperCase();
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
