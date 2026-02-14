export class Leaderboard{
  constructor(){
    this.el = document.querySelector('#leaderboard');
    this.listEl = document.querySelector('#lb-list');
    this.statusEl = document.querySelector('#lb-status');
    this.btnRefresh = document.querySelector('#lb-refresh');
    this.btnSubmit = document.querySelector('#lb-submit');
    this.btnRefresh?.addEventListener('click', ()=> this.refresh());
    this.btnSubmit?.addEventListener('click', ()=> this.openSubmit());
  }

  repoInfo(){
    const host = location.hostname;
    const owner = host.endsWith('.github.io') ? host.replace('.github.io','') : null;
    const parts = location.pathname.split('/').filter(Boolean);
    const repo = parts.length ? parts[0] : null;
    return { owner, repo };
  }

  parseScoreIssue(issue){
    const body = issue.body || '';
    const kv = {};
    for (const line of body.split(/\r?\n/)){
      const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*[:=]\s*(.+?)\s*$/);
      if (m) kv[m[1].toLowerCase()] = m[2];
    }
    const score = Number(kv.score ?? kv.points ?? NaN);
    if (!Number.isFinite(score)) return null;
    const mode = (kv.mode ?? 'unknown').trim();
    const correct = Number(kv.correct ?? NaN);
    const wrong = Number(kv.wrong ?? NaN);
    const name = (kv.name ?? kv.nick ?? issue.user?.login ?? 'anon').toString().slice(0,24);
    const ts = issue.created_at || '';
    return { name, score, mode, correct, wrong, ts, url: issue.html_url };
  }

  status(t){ if (this.statusEl) this.statusEl.textContent = t; }

  render(items){
    if (!this.listEl) return;
    if (!items.length){
      this.listEl.innerHTML = '<div class="muted">No scores yet. Submit one!</div>';
      return;
    }
    this.listEl.innerHTML = items.map((s,i)=>(
      `<div class="lb-row">
         <div class="lb-rank">#${i+1}</div>
         <div class="lb-name">${escapeHtml(s.name)}</div>
         <div class="lb-score">${s.score}</div>
         <div class="lb-mode">${escapeHtml(String(s.mode))}</div>
       </div>`
    )).join('');
  }

  async refresh(){
    if (!this.el) return;
    const { owner, repo } = this.repoInfo();
    if (!owner || !repo){
      this.status('Leaderboard works only on <owner>.github.io/<repo>/ URLs.');
      return;
    }
    this.status('Loading…');
    try{
      const api = `https://api.github.com/repos/${owner}/${repo}/issues?labels=score&state=open&per_page=100`;
      const r = await fetch(api, { headers: { 'Accept':'application/vnd.github+json' }});
      if (!r.ok) throw new Error(`GitHub API ${r.status}`);
      const issues = await r.json();
      const scores = [];
      for (const it of issues){
        const s = this.parseScoreIssue(it);
        if (s) scores.push(s);
      }
      scores.sort((a,b)=> b.score - a.score);
      this.render(scores.slice(0,10));
      this.status('Top 10 (shared via GitHub Issues).');
    }catch(err){
      console.error(err);
      this.status('Failed to load leaderboard (rate limit?). Click Refresh later.');
    }
  }

  openSubmit(prefill){
    const { owner, repo } = this.repoInfo();
    if (!owner || !repo){ alert('Cannot detect repo info for submit.'); return; }
    const title = encodeURIComponent(`Score: ${prefill?.score ?? ''} ${prefill?.mode ?? ''}`.trim() || 'Score submission');
    const bodyLines = [
      `name: ${prefill?.name ?? ''}`,
      `mode: ${prefill?.mode ?? ''}`,
      `score: ${prefill?.score ?? ''}`,
      `correct: ${prefill?.correct ?? ''}`,
      `wrong: ${prefill?.wrong ?? ''}`,
      `timestamp: ${new Date().toISOString()}`
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    const url = `https://github.com/${owner}/${repo}/issues/new?title=${title}&labels=score&body=${body}`;
    window.open(url, '_blank');
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
