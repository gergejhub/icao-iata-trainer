export const storage = {
  get(key, fallback=null){
    try{
      const v = localStorage.getItem(key);
      if(v===null||v===undefined) return fallback;
      return JSON.parse(v);
    }catch(e){ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
  },
  del(key){ try{ localStorage.removeItem(key);}catch(e){} }
};
