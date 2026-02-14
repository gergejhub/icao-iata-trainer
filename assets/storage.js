export const storage = {
  get(key, fallback=null){
    try{
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    }catch(_){
      return fallback;
    }
  },
  set(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  },
  del(key){ localStorage.removeItem(key); },
  clearPrefix(prefix){
    const keys=[];
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  }
};
