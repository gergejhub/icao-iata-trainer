import { norm, prettyAirport, pick, nameMatch } from './utils.js';
import { perf } from './perf.js';

export class SRS{
  constructor(storage, stats){
    this.storage = storage;
    this.stats = stats;
    this.pool = [];
    this.current = null;
    this.questionType = null;
    this.bindUI();
  }
  setPool(pool){ this.pool = pool; }
  reset(){}

  bindUI(){
    this.qEl = document.querySelector('#srs-q');
    this.subEl = document.querySelector('#srs-sub');
    this.inEl = document.querySelector('#srs-input');
    this.revealEl = document.querySelector('#srs-reveal');
    this.ansEl = document.querySelector('#srs-answer');
    this.gradeEl = document.querySelector('#srs-grades');
    document.querySelector('#srs-show').addEventListener('click', ()=> this.reveal());
    this.inEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') this.reveal(); });
    for (const btn of document.querySelectorAll('[data-grade]')){
      btn.addEventListener('click', ()=> this.grade(btn.getAttribute('data-grade')));
    }
  }

  start(){ this.nextCard(); }

  nextCard(){
    const now = Date.now();
    const due = [];
    const sample = this.pool.slice(0, Math.min(500, this.pool.length));
    for (const a of sample){
      const key = this.key(a);
      const card = this.storage.get('srs:'+key, null);
      if (!card || (card.dueAt ?? 0) <= now) due.push(a);
    }
    const a = due.length ? pick(due) : pick(sample);
    this.current = a;
    this.questionType = this.pickQuestionType(a);
    this.renderQuestion();
  }

  pickQuestionType(a){
    const types=[];
    if (a.icao) types.push('icao->iata','icao->name','name->icao');
    if (a.iata) types.push('iata->icao','iata->name','name->iata');
    return pick(types.filter(t=>{
      if (t.endsWith('->iata')) return !!a.iata;
      if (t.endsWith('->icao')) return !!a.icao;
      return true;
    }));
  }

  renderQuestion(){
    this.inEl.value = '';
    this.revealEl.style.display = 'none';
    this.gradeEl.style.display = 'none';
    const a = this.current;
    const t = this.questionType;

    let q='', sub='';
    if (t === 'icao->iata'){ q = a.icao; sub = 'Type the IATA code'; }
    if (t === 'iata->icao'){ q = a.iata; sub = 'Type the ICAO code'; }
    if (t === 'icao->name'){ q = a.icao; sub = 'Type the airport name (or a part of it)'; }
    if (t === 'iata->name'){ q = a.iata; sub = 'Type the airport name (or a part of it)'; }
    if (t === 'name->icao'){ q = a.name || '(name not yet available)'; sub = 'Type the ICAO code'; }
    if (t === 'name->iata'){ q = a.name || '(name not yet available)'; sub = 'Type the IATA code'; }

    this.qEl.textContent = q;
    this.subEl.textContent = sub + ((!a.name && (t.includes('name'))) ? ' — (names appear after dataset build)' : '');
  }

  reveal(){
    const a = this.current;
    const t = this.questionType;
    const inputRaw = (this.inEl.value||'');
    const input = norm(inputRaw);
    const correct = this.getCorrectAnswer(a, t);
    const isCorrect = this.checkAnswer(input, correct, a, t);

    this.revealEl.style.display = 'block';
    this.gradeEl.style.display = 'grid';

    this.ansEl.innerHTML = `
      <div class="pills" style="margin-bottom:8px;">
        <span class="pill ${isCorrect?'good':'bad'}">${isCorrect?'Correct':'Not quite'}</span>
        <span class="pill">${a.icao || '—'} / ${a.iata || '—'}</span>
        ${(a.tags||[]).includes('wizz-base') ? '<span class="pill good">WIZZ BASE</span>' : ''}
        ${(a.tags||[]).includes('wizz-network') ? '<span class="pill">WIZZ NET</span>' : ''}
      </div>
      <div style="font-weight:900;font-size:18px;margin-bottom:6px;">Answer: ${escapeHtml(correct.display)}</div>
      <div class="smallmuted">${escapeHtml(prettyAirport(a))}</div>
    `;
    this.stats.answer(isCorrect);
    if (!isCorrect){
      perf.recordMistake(this.storage, a);
      if (t === 'icao->iata' || t === 'name->iata') perf.recordConfusion(this.storage, 'IATA', correct.raw, given.raw);
      if (t === 'iata->icao' || t === 'name->icao') perf.recordConfusion(this.storage, 'ICAO', correct.raw, given.raw);
    }
  }

  grade(level){
    const a = this.current;
    const key = this.key(a);
    const now = Date.now();
    const cardKey = 'srs:'+key;
    const card = this.storage.get(cardKey, {intervalDays:0, ease:2.3, dueAt:0, reps:0});
    const grade = {again:0, hard:1, good:2, easy:3}[level] ?? 2;

    if (grade === 0){
      card.intervalDays = 0;
      card.reps = 0;
    } else {
      card.reps += 1;
      if (grade === 1) card.ease = Math.max(1.3, card.ease - 0.15);
      if (grade === 3) card.ease = Math.min(2.7, card.ease + 0.10);
      const base = (card.intervalDays === 0) ? 1 : card.intervalDays;
      const mult = [0, 1.2, 1.7, 2.3][grade];
      card.intervalDays = Math.min(365, Math.round(base * card.ease * mult));
    }
    card.dueAt = now + card.intervalDays*24*3600*1000;
    this.storage.set(cardKey, card);
    this.nextCard();
  }

  getCorrectAnswer(a, t){
    if (t.endsWith('->iata')) return {raw:(a.iata||''), display:(a.iata||'—')};
    if (t.endsWith('->icao')) return {raw:(a.icao||''), display:(a.icao||'—')};
    const disp = a.name ? a.name : '(name not yet available)';
    return {raw: disp, display: disp};
  }

  checkAnswer(input, correct, a, t){
    if (t.endsWith('->iata') || t.endsWith('->icao')){
      return input === norm(correct.raw);
    }
    // name questions: diacritics-insensitive partial match (min 4 chars)
    return nameMatch(this.inEl.value, a.name || '');
  }

  key(a){
    return (a.icao ? 'icao:'+a.icao : '') + '|' + (a.iata ? 'iata:'+a.iata : '');
  }
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
