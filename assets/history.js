export class History {
  constructor(){
    this.metaEl = document.getElementById('history-meta');
    this.listEl = document.getElementById('history-list');
    this.clearBtn = document.getElementById('history-clear');
    this.items = [];
    this.mode = '';
    this.clearBtn?.addEventListener('click', ()=> this.clear());
    this.render();
  }
  startRun(mode){
    this.mode = mode;
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
    if(this.metaEl) this.metaEl.textContent = `${this.mode || '—'} • ${this.items.length} items`;
    if(!this.listEl) return;
    if(!this.items.length){
      this.listEl.innerHTML = `<div class="smallmuted">No answers yet.</div>`;
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
