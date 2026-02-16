import { storage } from './storage.js';

function repoFromPages(){
  const host = location.hostname;
  const parts = location.pathname.split('/').filter(Boolean);
  if(!host.endsWith('github.io') || parts.length<1) return null;
  return { user: host.split('.')[0], repo: parts[0] };
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"]|'/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function parseIssueBody(body){
  const out = {};
  (body||'').split(/\r?\n/).forEach(line=>{
    const m = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
    if(m) out[m[1].toLowerCase()] = (m[2]||'').trim();
  });
  return out;
}

export class Leaderboard {
  constructor(i18n=null){
    this.i18n = i18n;
    this.refreshBtn = document.getElementById('lb-refresh');
    this.submitBtn = document.getElementById('lb-submit');
    this.statusEl = document.getElementById('lb-status');
    this.listEl = document.getElementById('lb-list');
    this.nickEl = document.getElementById('nickname');

    const savedNick = storage.get('nickname','');
    if(this.nickEl && savedNick) this.nickEl.value = savedNick;
    this.nickEl?.addEventListener('input', ()=> storage.set('nickname', (this.nickEl.value||'').trim().slice(0,24)));

    this.refreshBtn?.addEventListener('click', ()=> this.refresh());
    this.submitBtn?.addEventListener('click', ()=> this.submitLastRun());

    if(this.i18n && typeof this.i18n.onChange === 'function'){
      this.i18n.onChange(()=> this.refresh());
    }
  }

  t(key, vars=null, fallback=''){
    const fn = this.i18n?.t;
    if(typeof fn==='function') return fn.call(this.i18n, key, vars, fallback);
    return fallback || key;
  }

  setLastRun(run){
    storage.set('lastRun', run);
    if(this.statusEl) this.statusEl.textContent = this.t('scoreboard.last_run', { mode: run.mode, score: run.score }, `Last run: ${run.mode} score ${run.score}`);
  }

  submitLastRun(){
    const rr = repoFromPages();
    if(!rr){
      alert(this.t('scoreboard.alert_pages', null, 'Scoreboard needs GitHub Pages URL like user.github.io/repo'));
      return;
    }
    const last = storage.get('lastRun', null);
    if(!last){
      alert(this.t('scoreboard.alert_no_run', null, 'No last run yet. Play a Sprint/Set first.'));
      return;
    }
    const nick = (storage.get('nickname','') || this.t('scoreboard.anonymous', null, 'anonymous')).trim() || this.t('scoreboard.anonymous', null, 'anonymous');
    const title = `Score: ${last.mode} ${last.score} ${nick}`;
    const body =
`nickname: ${nick}
mode: ${last.mode}
score: ${last.score}
correct: ${last.correct}
wrong: ${last.wrong}
timestamp: ${new Date(last.timestamp || Date.now()).toISOString()}
`;

    const u = new URL(`https://github.com/${rr.user}/${rr.repo}/issues/new`);
    u.searchParams.set('title', title);
    u.searchParams.set('labels','score');
    u.searchParams.set('body', body);
    window.open(u.toString(), '_blank', 'noopener');
  }

  async refresh(){
    const rr = repoFromPages();
    if(!rr){
      if(this.statusEl) this.statusEl.textContent = this.t('scoreboard.not_pages', null, 'Not on GitHub Pages');
      return;
    }
    try{
      if(this.statusEl) this.statusEl.textContent = this.t('scoreboard.loading', null, 'Loading…');
      const url = `https://api.github.com/repos/${rr.user}/${rr.repo}/issues?state=open&labels=score&per_page=100`;
      const res = await fetch(url, { headers: { 'Accept':'application/vnd.github+json' }});
      if(!res.ok) throw new Error(`GitHub API ${res.status}`);
      const issues = await res.json();
      const rows = [];
      for(const it of issues){
        const meta = parseIssueBody(it.body||'');
        const nickname = meta.nickname || this.t('scoreboard.anonymous', null, 'anonymous');
        const mode = meta.mode || '';
        const score = Number(meta.score||0);
        const correct = Number(meta.correct||0);
        const wrong = Number(meta.wrong||0);
        if(!Number.isFinite(score)) continue;
        rows.push({nickname, mode, score, correct, wrong});
      }
      rows.sort((a,b)=> b.score - a.score);
      const top = rows.slice(0,10);
      if(this.listEl){
        this.listEl.innerHTML = top.length ? top.map(r=>`
          <div class="lbrow">
            <b>${escapeHtml(r.nickname)}</b>
            <span class="smallmuted">${escapeHtml(r.mode)}</span>
            <span class="lbscore">${r.score}</span>
            <span class="smallmuted">✅${r.correct} ❌${r.wrong}</span>
          </div>
        `).join('') : `<div class="smallmuted">${escapeHtml(this.t('scoreboard.no_scores', null, 'No scores yet.'))}</div>`;
      }
      if(this.statusEl) this.statusEl.textContent = this.t('scoreboard.top_n', { n: top.length }, `Top ${top.length}`);
    }catch(e){
      console.warn(e);
      if(this.statusEl) this.statusEl.textContent = this.t('scoreboard.failed', null, 'Failed (API limit?)');
    }
  }
}
