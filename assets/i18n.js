import { storage } from './storage.js';

function format(str, vars){
  if(!vars) return String(str);
  return String(str).replace(/\{([a-zA-Z0-9_]+)\}/g, (_,k)=>{
    const v = vars[k];
    return (v===undefined || v===null) ? '' : String(v);
  });
}

const DICT = {
  en: {
    // App shell
    'app.title': 'icao-iata-trainer',
    'app.subtitle': 'Wizz network • ICAO/IATA training for dispatchers',

    'ui.language_label': 'UI',
    'ui.language_title': 'Interface language',

    // Navigation
    'nav.home': 'Home',
    'nav.learn': 'Learn',
    'nav.rapid': 'Rapid',
    'nav.map': 'Map',
    'nav.drill': 'Drill',
    'nav.srs': 'SRS',
    'nav.ops': 'Ops',
    'nav.challenge': 'Challenge',
    'nav.brief': 'Brief',
    'nav.heatmap': 'Heatmap',
    'nav.reset': 'Reset',

    // Progress
    'progress.title': 'Progress',
    'kpi.total': 'Total',
    'kpi.correct': 'Correct',
    'kpi.wrong': 'Wrong',
    'kpi.accuracy': 'Accuracy',

    // Home
    'home.title': 'Home',
    'home.badge': 'Pick a mode',
    'home.tip': 'Tip: Scoreboard is on the right. Nickname is stored in your browser.',

    // Generic UI
    'ui.expected': 'Expected:',
    'ui.start': 'Start',
    'ui.time': 'Time:',
    'ui.score': 'Score:',
    'ui.clear': 'Clear',
    'ui.refresh': 'Refresh',
    'ui.submit_last': 'Submit last run',
    'ui.copy': 'Copy',
    'ui.copied': 'Copied',
    'ui.generate': 'Generate',
    'ui.export_mistakes': 'Export mistakes CSV',
    'ui.export_confusions': 'Export confusions CSV',
    'ui.only_scope': 'Only current scope',
    'ui.min_mistakes': 'Min mistakes:',
    'ui.voice': 'Voice',
    'ui.mcq': 'MCQ',
    'ui.nickname_ph': 'Nickname (for submit)',

    // Labels used in questions
    'label.icao_code': 'ICAO CODE',
    'label.iata_code': 'IATA CODE',
    'label.city': 'CITY',
    'label.airport_name': 'AIRPORT NAME',
    'label.answer': 'ANSWER',

    'clue.icao': 'ICAO',
    'clue.iata': 'IATA',
    'clue.city': 'CITY',
    'clue.name': 'NAME',

    // Badges / hints
    'badge.enter_next': 'Enter: check • Enter: next',
    'badge.map_hint': 'Click map • auto-next in 2s',
    'badge.optional': 'optional',
    'badge.len_20_60': '20–60s',
    'badge.leaflet': 'Leaflet',
    'badge.routes_alts': 'Routes & alternates',
    'badge.mixed': 'mixed',
    'badge.this_run': 'this run',

    // Views
    'learn.title': 'Learn',
    'learn.placeholder': 'Type answer… then press Enter',
    'learn.sub.ready': 'Type answer and press Enter',
    'learn.sub.correct_next': '✅ Correct — press Enter for next',
    'learn.sub.wrong_next': '❌ Wrong — press Enter for next',

    'rapid.title': 'Rapid',
    'rapid.sub.ready': 'Pick mode + prompt, press Start',
    'rapid.sub.mcq_pick': 'Pick answer (MCQ)',
    'rapid.sub.type_enter': 'Type answer and press Enter',
    'rapid.run_finished': 'Run finished. Score={score}. Use Scoreboard → Submit last run.',

    'map.title': 'Map',
    'map.sub.ready': 'Pick mode + prompt, press Start',
    'map.sub.click': 'Click on the map (no Next button)',

    'drill.title': 'Drill',
    'drill.quick_actions': 'Quick actions',
    'drill.review': '🔁 Review mistakes',
    'drill.boss_iata': '🧊 Boss IATA',
    'drill.boss_icao': '🧊 Boss ICAO',
    'drill.errors_map': '🗺️ Errors map',
    'drill.brief': '🧾 Brief',
    'drill.most_missed': 'Most missed airports',
    'drill.top_confusions': 'Top confusions',
    'drill.mistakes_lb': 'Mistakes leaderboard',
    'drill.local_browser': 'local browser',
    'drill.no_mistakes': 'No mistakes recorded yet. Do a Rapid or SRS session first.',
    'drill.conf_pairs': 'Confusion pairs',
    'drill.target_boss': 'Target these with the Boss Fight modes.',
    'drill.no_iata_conf': 'No IATA confusions yet.',
    'drill.no_icao_conf': 'No ICAO confusions yet.',

    'srs.title': 'SRS',
    'srs.sub.no_airports': 'No airports in dataset.',
    'srs.sub.type_then_show': 'Type answer, then Show/Enter to reveal.',

    'brief.title': 'Brief generator',
    'brief.copy': 'Copy',

    'heatmap.title': 'Error heatmap',

    'ops.title': 'Ops drill',
    'ops.sub.pick_two': 'Pick TWO plausible alternates near destination (closest airports).',
    'ops.not_enough': 'Not enough airports in dataset.',

    'challenge.title': 'Shift Challenge',
    'challenge.sub.mcq': 'Multiple choice. Click the correct answer.',

    // History / Scoreboard
    'history.title': 'History',
    'history.meta': '{mode} • {n} items',
    'history.empty': 'No answers yet.',

    'scoreboard.title': 'Scoreboard',
    'scoreboard.badge': 'GitHub Issues',
    'scoreboard.not_pages': 'Not on GitHub Pages',
    'scoreboard.loading': 'Loading…',
    'scoreboard.failed': 'Failed (API limit?)',
    'scoreboard.no_scores': 'No scores yet.',
    'scoreboard.top_n': 'Top {n}',
    'scoreboard.last_run': 'Last run: {mode} score {score}',
    'scoreboard.alert_pages': 'Scoreboard needs GitHub Pages URL like user.github.io/repo',
    'scoreboard.alert_no_run': 'No last run yet. Play a Sprint/Set first.',

    // App status & prompts
    'status.loading': 'Loading…',
    'status.ready': 'Ready',
    'status.dataset': '{name} • {n} airports',
    'status.failed': 'App failed. Open console.',
    'confirm.reset': 'Reset overall stats?',

    // Added for HU/EN toggle + missing HTML keys
    'home.dataset': 'Dataset: Wizz network only (no global airports).',
    'prompt.mixed': 'Mixed',
    'prompt.icao': 'ICAO CODE',
    'prompt.iata': 'IATA CODE',
    'prompt.city': 'CITY',
    'prompt.name': 'AIRPORT NAME',
    'rapid.mode.sprint60': 'Sprint 60s',
    'rapid.mode.sprint30': 'Sprint 30s',
    'rapid.mode.set30': 'Set of 30',
    'rapid.placeholder': 'Type answer… then press Enter',
    'map.mode.practice': 'Practice',
    'badge.map_click': 'Click map • auto-next in 2s',
    'srs.show': 'Show',
    'srs.enter_reveals': '(Enter also reveals)',
    'srs.placeholder': 'Type answer…',
    'srs.due': '{n} due',
    'srs.pill.correct': 'Correct',
    'srs.pill.not_quite': 'Not quite',
    'srs.grade.again': 'Again',
    'srs.grade.hard': 'Hard',
    'srs.grade.good': 'Good',
    'srs.grade.easy': 'Easy',
    'brief.generate': 'Generate',
    'brief.lang.en': 'English',
    'brief.lang.hu': 'Hungarian',
    'heatmap.min': 'Min mistakes:',
    'heatmap.only_current': 'Only current set',
    'heatmap.export_mistakes': 'Export mistakes CSV',
    'heatmap.export_confusions': 'Export confusions CSV',
    'ops.badge': 'Routes & alternates',
    'ops.mode.alternates': 'Alternates',
    'challenge.badge': 'mixed',
    'challenge.dur.5': '5 min',
    'challenge.dur.10': '10 min',
    'challenge.dur.15': '15 min',
    'challenge.finished': 'Finished. Score={score}. Submit from Scoreboard if you want.',
    'challenge.need_pool': 'Not enough airports in the dataset.',
    'history.badge': 'this run',
    'history.items': 'items',
    'history.mode.learn': 'LEARN',
    'history.mode.rapid': 'RAPID',
    'history.mode.map': 'MAP',
    'history.mode.srs': 'SRS',
    'history.mode.challenge': 'CHALLENGE',
    'scoreboard.nickname': 'Nickname (for submit)',
    'scoreboard.submit': 'Submit last run',
    'scoreboard.anonymous': 'anonymous',
    'detail.ok': 'OK: {expected}',
    'detail.wrong': 'Your: {user} • Correct: {expected}',
    'detail.answer': 'Answer: {expected}',
    'detail.hit': 'Hit (≈{km} km)',
    'detail.miss': 'Miss (≈{km} km) • Correct: {correct}',
    'ui.lang_hu_title': 'Switch to Hungarian',
    'ui.lang_en_title': 'Switch to English',
    'pro.toggle': 'Pro dispatcher mode',
    'pro.daily_btn': 'Daily Top20 confusion drill',
    'pro.base_context': 'BASE: {base}',
        'pro.desc': 'Base↔outstation focus, weighted bases, plus an automatic daily drill from your most frequent confusions.',
    'pro.base': 'From base: {base}',

  },

  hu: {
    // App shell
    'app.title': 'icao-iata-trainer',
    'app.subtitle': 'Wizz network • ICAO/IATA tréning diszpécsereknek',

    'ui.language_label': 'NYELV',
    'ui.language_title': 'Felület nyelve',

    // Navigation
    'nav.home': 'Kezdőlap',
    'nav.learn': 'Tanulás',
    'nav.rapid': 'Gyors',
    'nav.map': 'Térkép',
    'nav.drill': 'Gyakorlás',
    'nav.srs': 'SRS',
    'nav.ops': 'Ops',
    'nav.challenge': 'Kihívás',
    'nav.brief': 'Brief',
    'nav.heatmap': 'Hibatérkép',
    'nav.reset': 'Nullázás',

    // Progress
    'progress.title': 'Haladás',
    'kpi.total': 'Összes',
    'kpi.correct': 'Jó',
    'kpi.wrong': 'Hibás',
    'kpi.accuracy': 'Pontosság',

    // Home
    'home.title': 'Kezdőlap',
    'home.badge': 'Válassz módot',
    'home.tip': 'Tipp: az Eredménytábla jobbra van. A becenevet a böngésző tárolja.',

    // Generic UI
    'ui.expected': 'Várt válasz:',
    'ui.start': 'Indítás',
    'ui.time': 'Idő:',
    'ui.score': 'Pont:',
    'ui.clear': 'Törlés',
    'ui.refresh': 'Frissítés',
    'ui.submit_last': 'Utolsó futás beküldése',
    'ui.copy': 'Másolás',
    'ui.copied': 'Másolva',
    'ui.generate': 'Generálás',
    'ui.export_mistakes': 'Hibák CSV export',
    'ui.export_confusions': 'Keverések CSV export',
    'ui.only_scope': 'Csak az aktuális készlet',
    'ui.min_mistakes': 'Min. hibaszám:',
    'ui.voice': 'Hang',
    'ui.mcq': 'Feleletválasztós',
    'ui.nickname_ph': 'Becenév (beküldéshez)',

    // Labels used in questions
    'label.icao_code': 'ICAO KÓD',
    'label.iata_code': 'IATA KÓD',
    'label.city': 'VÁROS',
    'label.airport_name': 'REPÜLŐTÉR NÉV',
    'label.answer': 'VÁLASZ',

    'clue.icao': 'ICAO',
    'clue.iata': 'IATA',
    'clue.city': 'VÁROS',
    'clue.name': 'NÉV',

    // Badges / hints
    'badge.enter_next': 'Enter: ellenőrzés • Enter: következő',
    'badge.map_hint': 'Kattints a térképre • automatikus továbblépés 2 mp múlva',
    'badge.optional': 'opcionális',
    'badge.len_20_60': '20–60 mp',
    'badge.leaflet': 'Leaflet',
    'badge.routes_alts': 'Útvonalak és alternatívok',
    'badge.mixed': 'kevert',
    'badge.this_run': 'aktuális futás',

    // Views
    'learn.title': 'Tanulás',
    'learn.placeholder': 'Írd be a választ… majd Enter',
    'learn.sub.ready': 'Írd be a választ és nyomj Entert',
    'learn.sub.correct_next': '✅ Jó — Enter a következőhöz',
    'learn.sub.wrong_next': '❌ Hibás — Enter a következőhöz',

    'rapid.title': 'Gyors',
    'rapid.sub.ready': 'Válassz módot és típust, majd Indítás',
    'rapid.sub.mcq_pick': 'Válassz választ (MCQ)',
    'rapid.sub.type_enter': 'Írd be a választ és nyomj Entert',
    'rapid.run_finished': 'Futás vége. Pont={score}. Eredménytábla → Utolsó futás beküldése.',

    'map.title': 'Térkép',
    'map.sub.ready': 'Válassz módot és típust, majd Indítás',
    'map.sub.click': 'Kattints a térképre (nincs Következő gomb)',

    'drill.title': 'Gyakorlás',
    'drill.quick_actions': 'Gyors műveletek',
    'drill.review': '🔁 Hibák ismétlése',
    'drill.boss_iata': '🧊 Boss IATA',
    'drill.boss_icao': '🧊 Boss ICAO',
    'drill.errors_map': '🗺️ Hibatérkép',
    'drill.brief': '🧾 Brief',
    'drill.most_missed': 'Legtöbbet elrontott repterek',
    'drill.top_confusions': 'Top keverések',
    'drill.mistakes_lb': 'Hibák ranglista',
    'drill.local_browser': 'helyi böngésző',
    'drill.no_mistakes': 'Még nincs rögzített hibád. Indíts egy Gyors vagy SRS kört.',
    'drill.conf_pairs': 'Keverés párok',
    'drill.target_boss': 'Ezeket érdemes Boss Fight-tal gyakorolni.',
    'drill.no_iata_conf': 'Még nincs IATA keverés.',
    'drill.no_icao_conf': 'Még nincs ICAO keverés.',

    'srs.title': 'SRS',
    'srs.sub.no_airports': 'Nincs repülőtér az adatbázisban.',
    'srs.sub.type_then_show': 'Írd be a választ, majd Show/Enter a felfedéshez.',

    'brief.title': 'Brief generátor',
    'brief.copy': 'Másolás',

    'heatmap.title': 'Hibatérkép',

    'ops.title': 'Ops',
    'ops.sub.pick_two': 'Válassz KÉT ésszerű alternatívot a cél közelében (legközelebbi repterek).',
    'ops.not_enough': 'Kevés repülőtér van az adatbázisban.',

    'challenge.title': 'Shift kihívás',
    'challenge.sub.mcq': 'Feleletválasztós. Kattints a jó válaszra.',

    // History / Scoreboard
    'history.title': 'Előzmények',
    'history.meta': '{mode} • {n} elem',
    'history.empty': 'Még nincs válasz.',

    'scoreboard.title': 'Eredménytábla',
    'scoreboard.badge': 'GitHub Issues',
    'scoreboard.not_pages': 'Nem GitHub Pages-en fut',
    'scoreboard.loading': 'Betöltés…',
    'scoreboard.failed': 'Hiba (API limit?)',
    'scoreboard.no_scores': 'Még nincs eredmény.',
    'scoreboard.top_n': 'Top {n}',
    'scoreboard.last_run': 'Utolsó futás: {mode} pont {score}',
    'scoreboard.alert_pages': 'Az eredménytábla GitHub Pages URL-t igényel (user.github.io/repo)',
    'scoreboard.alert_no_run': 'Nincs utolsó futás. Indíts előbb egy Sprint/Set kört.',

    // App status & prompts
    'status.loading': 'Betöltés…',
    'status.ready': 'Kész',
    'status.dataset': '{name} • {n} repülőtér',
    'status.failed': 'Hiba. Nézd meg a konzolt.',
    'confirm.reset': 'Nullázod az összes statisztikát?',

    // Hozzáadva a nyelvi kapcsolóhoz + hiányzó kulcsok
    'home.dataset': 'Adatbázis: csak Wizz network (nincs globális készlet).',
    'prompt.mixed': 'Kevert',
    'prompt.icao': 'ICAO KÓD',
    'prompt.iata': 'IATA KÓD',
    'prompt.city': 'VÁROS',
    'prompt.name': 'REPÜLŐTÉR NÉV',
    'rapid.mode.sprint60': 'Sprint 60 mp',
    'rapid.mode.sprint30': 'Sprint 30 mp',
    'rapid.mode.set30': '30-as szett',
    'rapid.placeholder': 'Írd be a választ… majd Enter',
    'map.mode.practice': 'Gyakorlás',
    'badge.map_click': 'Kattints a térképre • automatikus továbblépés 2 mp múlva',
    'srs.show': 'Mutat',
    'srs.enter_reveals': '(Enter is felfed)',
    'srs.placeholder': 'Írd be a választ…',
    'srs.due': '{n} esedékes',
    'srs.pill.correct': 'Helyes',
    'srs.pill.not_quite': 'Nem jó',
    'srs.grade.again': 'Újra',
    'srs.grade.hard': 'Nehéz',
    'srs.grade.good': 'Jó',
    'srs.grade.easy': 'Könnyű',
    'brief.generate': 'Generálás',
    'brief.lang.en': 'Angol',
    'brief.lang.hu': 'Magyar',
    'heatmap.min': 'Min. hibaszám:',
    'heatmap.only_current': 'Csak az aktuális készlet',
    'heatmap.export_mistakes': 'Hibák CSV export',
    'heatmap.export_confusions': 'Keverések CSV export',
    'ops.badge': 'Útvonalak és alternatívok',
    'ops.mode.alternates': 'Alternatívok',
    'challenge.badge': 'kevert',
    'challenge.dur.5': '5 perc',
    'challenge.dur.10': '10 perc',
    'challenge.dur.15': '15 perc',
    'challenge.finished': 'Vége. Pont={score}. Ha szeretnéd, beküldheted az Eredménytáblán.',
    'challenge.need_pool': 'Kevés repülőtér van az adatbázisban.',
    'history.badge': 'aktuális futás',
    'history.items': 'elem',
    'history.mode.learn': 'TANULÁS',
    'history.mode.rapid': 'GYORS',
    'history.mode.map': 'TÉRKÉP',
    'history.mode.srs': 'SRS',
    'history.mode.challenge': 'KIHÍVÁS',
    'scoreboard.nickname': 'Becenév (beküldéshez)',
    'scoreboard.submit': 'Utolsó futás beküldése',
    'scoreboard.anonymous': 'névtelen',
    'detail.ok': 'OK: {expected}',
    'detail.wrong': 'Te: {user} • Helyes: {expected}',
    'detail.answer': 'Válasz: {expected}',
    'detail.hit': 'Találat (≈{km} km)',
    'detail.miss': 'Mellé (≈{km} km) • Helyes: {correct}',
    'ui.lang_hu_title': 'Magyar',
    'ui.lang_en_title': 'English',
    'pro.toggle': 'Profi diszpécser mód',
    'pro.daily_btn': 'Napi Top20 keverés drill',
    'pro.base_context': 'BASE: {base}',
        'pro.desc': 'Base↔outstation fókusz, bases súlyozás, és a leggyakoribb keveréseidből automata napi gyakorlás.',
    'pro.base': 'Bázis: {base}',

  }
};

const PACK_NAME = {
  en: {
    'wizz-network': 'Wizz Network',
    'wizz-bases': 'Wizz Bases',
    'review-mistakes': 'Review (your mistakes)',
    'boss-iata': 'Boss Fight (IATA)',
    'boss-icao': 'Boss Fight (ICAO)'
  
    'daily-top20': 'Daily Top20 (your confusions)',},
  hu: {
    'wizz-network': 'Wizz Network',
    'wizz-bases': 'Wizz Bázisok',
    'review-mistakes': 'Hibák ismétlése',
    'boss-iata': 'Boss Fight (IATA)',
    'boss-icao': 'Boss Fight (ICAO)'
  
    'daily-top20': 'Napi Top20 (keverések)',}
};

export const i18n = {
  lang: 'hu',
  _listeners: [],

  init(){
    const saved = storage.get('uiLang', null);
    // Default is Hungarian (user can switch and it will persist).
    this.lang = (saved==='en' || saved==='hu') ? saved : 'hu';
  },

  onChange(cb){
    if(typeof cb==='function') this._listeners.push(cb);
  },

  setLang(lang){
    const l = (lang==='en' || lang==='hu') ? lang : 'hu';
    if(this.lang === l) return;
    this.lang = l;
    storage.set('uiLang', l);
    this.apply();
    for(const cb of this._listeners){ try{ cb(l);}catch(e){} }
  },

  t(key, vars=null, fallback=null){
    const table = DICT[this.lang] || DICT.en;
    const base = (table && table[key]!==undefined) ? table[key] : (DICT.en[key]!==undefined ? DICT.en[key] : (fallback!==null ? fallback : key));
    return format(base, vars);
  },

  packName(packId, fallback=''){
    const table = PACK_NAME[this.lang] || PACK_NAME.en;
    return table[packId] || (PACK_NAME.en[packId] || fallback || packId);
  },

  apply(root=document){
    try{ document.documentElement.lang = this.lang; }catch(e){}

    // text nodes
    root.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      if(!key) return;
      el.textContent = this.t(key, null, el.textContent);
    });

    // placeholders
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key = el.getAttribute('data-i18n-placeholder');
      if(!key) return;
      el.setAttribute('placeholder', this.t(key, null, el.getAttribute('placeholder')||''));
    });

    // titles
    root.querySelectorAll('[data-i18n-title]').forEach(el=>{
      const key = el.getAttribute('data-i18n-title');
      if(!key) return;
      el.setAttribute('title', this.t(key, null, el.getAttribute('title')||''));
    });
  }
};
