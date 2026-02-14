export class History {
  constructor(){
    this.listEl = document.querySelector('#history-list');
    this.metaEl = document.querySelector('#history-meta');
    this.btnClear = document.querySelector('#history-clear');
    this.items = [];
    this.mode = '';
    this.btnClear?.addEventListener('click', ()=> this.clear());
  }

  startRun(modeLabel){
    this.mode = modeLabel || '';
    this.items = [];
    this.render();
  }

  clear(){
    this.items = [];
    this.render();
  }

  add({ ok, title, detail }){
    this.items.unshift({ ok: !!ok, title: title||'', detail: detail||'', ts: Date.now() });
    if (this.items.length > 250) this.items.pop();
    this.render();
  }

  render(){
    if (this.metaEl) this.metaEl.textContent = `${this.mode} • ${this.items.length} entries`;
    if (!this.listEl) return;
    if (!this.items.length){
      this.listEl.innerHTML = `<div class="smallmuted">No answers yet.</div>`;
      return;
    }
    this.listEl.innerHTML = this.items.map(it=>`
      <div class="hrow ${it.ok?'ok':'bad'}">
        <div class="t">${it.ok?'✅':'❌'} ${esc(it.title)}</div>
        ${it.detail ? `<div class="m">${esc(it.detail)}</div>` : ``}
      </div>
    `).join('');
  }
}

function esc(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
