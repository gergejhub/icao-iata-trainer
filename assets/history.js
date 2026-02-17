import { storage } from './storage.js';

export class History {
  constructor(i18n=null){
    this.i18n = i18n;
    this.metaEl = document.getElementById('history-meta');
    this.listEl = document.getElementById('history-list');
    this.clearBtn = document.getElementById('history-clear');
    this.items = [];
    this.mode = '';
    this.clearBtn?.addEventListener('click', ()=> this.clear());

    if(this.i18n && typeof this.i18n.onChange === 'function'){
      this.i18n.onChange(()=> this.render());
    }
    this.render();
  }

  t(key, vars=null, fallback=''){
    const fn = this.i18n?.t;
    if(typeof fn === 'function') return fn.call(this.i18n, key, vars, fallback);
    return fallback || key;
  }

  modeLabel(){
    const m = (this.mode||'').toUpperCase();
    if(!m || m==='—') return '—';
    const key = `history.mode.${m.toLowerCase()}`;
    const out = this.t(key, null, null);
    return (out && out !== key) ? out : m;
  }

  startRun(mode){
    this.mode = mode || '';
    this.items = [];
    this.render();
  }

  renderMeta(){
    if(!this.metaEl) return;
    const itemsLabel = this.t('history.items', null, 'items');
    this.metaEl.textContent = `${this.modeLabel()} • ${this.items.length} ${itemsLabel}`;
  }

  clear(){
    this.items = [];
    this.render();
  }

  // Keep only minimal airport info in history to avoid storing the full DB record.
  compactAirport(a){
    if(!a) return null;
    return {
      icao: a.icao || '',
      iata: a.iata || '',
      city: a.city || '',
      name: a.name || ''
    };
  }

  keyForAirport(a){
    const icao = String(a?.icao||'').toUpperCase();
    const iata = String(a?.iata||'').toUpperCase();
    if(!icao && !iata) return null;
    return `${icao}|${iata}`;
  }

  add({ok, title, detail, airport=null}){
    const a = this.compactAirport(airport);
    const k = a ? this.keyForAirport(a) : null;
    this.items.unshift({ok: !!ok, title: title||'', detail: detail||'', airport: a, k});
    if(this.items.length>300) this.items.pop();
    this.render();
  }

  getNotes(){
    return storage.get('notes', {}) || {};
  }

  setNote(key, text){
    const notes = this.getNotes();
    const t = String(text||'').trim();
    if(!t) delete notes[key];
    else notes[key] = t;
    storage.set('notes', notes);
  }

  render(){
    this.renderMeta();
    if(!this.listEl) return;
    if(!this.items.length){
      this.listEl.innerHTML = `<div class="smallmuted">${escapeHtml(this.t('history.empty', null, 'No answers yet.'))}</div>`;
      return;
    }

    const notes = this.getNotes();

    this.listEl.innerHTML = this.items.map((it, idx)=>{
      const k = it.k;
      const note = k ? (notes[k] || '') : '';
      const code = it.airport ? `${(it.airport.iata||it.airport.icao||'').toString()}` : '';
      const btnLabel = note ? this.t('note.btn.edit', null, 'Edit note') : this.t('note.btn.add', null, 'Add note');
      const btn = k ? `<button class="noteBtn" data-note-key="${escapeHtml(k)}" title="${escapeHtml(btnLabel)}">📝</button>` : '';
      const noteHtml = (note && k) ? `<div class="note">${escapeHtml(note)}</div>` : ``;

      return `
        <div class="hrow ${it.ok?'ok':'bad'}">
          <div class="t">
            <span>${it.ok?'✅':'❌'} ${escapeHtml(it.title)}</span>
            ${btn}
          </div>
          ${it.detail ? `<div class="m">${escapeHtml(it.detail)}</div>` : ``}
          ${noteHtml}
        </div>
      `;
    }).join('');

    // Bind note buttons (event delegation would also work, but this is small)
    this.listEl.querySelectorAll('button[data-note-key]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-note-key');
        if(!key) return;
        const notesNow = this.getNotes();
        const cur = notesNow[key] || '';
        const meta = this.items.find(x=>x.k===key)?.airport || null;
        const code = meta ? ((meta.iata||meta.icao||'').toString().toUpperCase()) : key;
        const city = meta ? (meta.city ? (' ('+meta.city+')') : '') : '';
        const promptTxt = this.t('note.prompt', { code, city }, `Mnemonic / note for ${code}${city?(' ('+city+')'):''} (empty = delete):`);
        const v = window.prompt(promptTxt, cur);
        if(v===null) return; // cancelled
        this.setNote(key, v);
        this.render();
      });
    });
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
