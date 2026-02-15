export class Drill {
  constructor(stats){
    this.stats = stats;
    this.root = document.getElementById('drill-root');
    this.pool = [];
  }
  setPool(pool){ this.pool = pool || []; }
  render(){
    if(!this.root) return;
    this.root.innerHTML = `<div class="smallmuted">Drill is a placeholder in this rewrite.</div>`;
  }
}
