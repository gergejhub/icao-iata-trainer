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

  t(key, vars=null, fallback=null){
    const fn = this.i18n?.t;
    if(typeof fn === 'function') return fn.call(this.i18n, key, vars, fallback);
    return fallback!==null ? fallback : key;
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

  clear(){
    this.items = [];
    this.render();
  }

  add({ok, title, detail}){
    this.items.unshift({ok: !!ok, title: title||'', detail: detail||''});
    if(this.items.length>300) this.items.pop();
    this.render();
  }

  render(){
    if(this.metaEl){
      const itemsLabel = this.t('history.items', null, 'items');
      this.metaEl.textContent = `${this.modeLabel()} • ${this.items.length} ${itemsLabel}`;
    }
    if(!this.listEl) return;
    if(!this.items.length){
      this.listEl.innerHTML = `<div class="smallmuted">${escapeHtml(this.t('history.empty', null, 'No answers yet.'))}</div>`;
      return;
    }
    this.listEl.innerHTML = this.items.map(it=>`
      <div class="hrow ${it.ok?'ok':'bad'}">
        <div class="t">${it.ok?'✅':'❌'} ${escapeHtml(it.title)}</div>
        ${it.detail ? `<div class="m">${escapeHtml(it.detail)}</div>` : ``}
      </div>
    `).join('');
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
