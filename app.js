/*
 * Pixel High's website. Rendering only: reads PixelUniverse.school and the census. Supports ?at=YYYY-MM-DDTHH:MM
 * (city time) to visit the school at another moment.
 * Routes: #/ · #/students[/<year>[/<page>]] · #/student/<id> · #/houses · #/calendar · #/prom · #/yearbook[/<class>] · #/staff
 */
(function () {
  'use strict';
  const U = window.PixelUniverse || {};
  const S = U.school, K = U.census, W = U.climate;
  const $ = (id) => document.getElementById(id);
  const main = $('main');
  const DAY = 86400000, H = 3600000;
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  // ?at= is read as city time (UTC+12 once the school is open)
  const parsed = at ? Date.parse((at.length <= 16 ? at + ':00' : at) + 'Z') - 12 * H : NaN;
  const offset = isNaN(parsed) ? 0 : parsed - Date.now();
  const now = () => Date.now() + offset;
  const AT = isNaN(parsed) ? '' : '?at=' + encodeURIComponent(at);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const link = (r, text) => '<a href="' + AT + '#/' + r + '">' + text + '</a>';
  const num = (n) => Number(n).toLocaleString('en');
  const fDay = new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  const fLong = new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fTime = new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
  const city = (ms) => ms + 12 * H; // the school keeps city time: format city moments with UTC formatters
  const head = (title, lede, kicker) => '<section class="page-head">' + (kicker ? '<p class="kicker">' + kicker + '</p>' : '') + '<h1>' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + '</section>';
  const fact = (k, v, small) => '<div><dt>' + k + '</dt><dd>' + v + (small ? ' <small>' + small + '</small>' : '') + '</dd></div>';
  const census = (id) => 'https://dvexperiments.github.io/City/census.html' + AT + '#/resident/' + id;
  const HOUSE_C = { Red: 'var(--R)', Green: 'var(--G)', Blue: 'var(--B)', Alpha: 'var(--A)' };
  const tile = (s, sub) => '<li><a class="tile" href="' + AT + '#/student/' + s.id + '"><span class="sw" style="--c:' + s.color + ';--h:' + HOUSE_C[s.house.name || s.house] + '"><i></i><span class="hs"></span></span><b>' + esc(s.name) + '</b><span>' + esc(sub) + '</span></a></li>';

  // ---------------------------------------------------------------- home
  function status(st) {
    const t = now();
    if (!st.started) return 'Pixel High opens on ' + fLong.format(city(S.opens)) + '.';
    if (st.closed) return 'The school is closed today: a storm is crossing the city.';
    if (st.inSession) return 'Term ' + st.term + ', week ' + st.week + '. Lessons are on.';
    if (st.schoolDay) return 'Term ' + st.term + ', week ' + st.week + '. ' + (((t + 12 * H) % DAY) / H < 9 ? 'The bell goes at 8:45.' : 'Lessons have finished for the day.');
    if (st.term) return 'Term ' + st.term + ', week ' + st.week + '. No lessons at the weekend.';
    const next = S.yearOf(st.schoolYear).terms.filter((x) => x.start > t)[0] || S.yearOf(st.schoolYear + 1).terms[0];
    return 'The school is on holiday until ' + fLong.format(city(next.start)) + '.';
  }
  function home() {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return head('Pixel High School', status(st) + ' Every resident of Pixel City in Years 9 to 13 will be enrolled.', 'Pixel City');
    const cal = st.calendar, pg = st.prizeGiving;
    let h = head('Pixel High School', esc(status(st)), 'Pixel City, ' + fLong.format(city(t)) + (st.schoolYear ? '. ' + S.yearName(st.schoolYear) : ''));
    h += '<dl class="facts">' + fact('Students', num(st.roll)) + fact('Teachers', num(st.teachers)) + fact('Principal', st.principal ? '<a href="' + census(st.principal.id) + '">' + esc(st.principal.name) + '</a>' : '') +
      fact('House leading', esc(st.houses[0].name), st.houses[0].points + ' points') + '</dl>';
    if (st.principal) h += '<div class="letter"><p>Welcome to Pixel High, the secondary school of Pixel City. Every one of our ' + num(st.roll) + ' students lives in the city, and every one of them is a pixel. We expect each of them to shine to the best of their ability, and no brighter.</p>' +
      '<p>Our students learn to read, to reason, to kern, and to wait patiently for the end of a Daily Crawl. ' + (pg.happened ? 'Congratulations to ' + esc(pg.dux.name) + ', our Dux, and to the Class of ' + S.yearName(st.schoolYear) + '.' : 'Please remember that the prom is for Year 13 students only, and that the school is not responsible for anything said on Pixel FM.') + '</p>' +
      '<p class="sig">' + esc(st.principal.name) + ', Principal</p></div>';
    // upcoming dates
    const dates = [];
    const add = (ms, what) => { if (ms > t) dates.push([ms, what]); };
    for (const tr of cal.terms) { add(tr.start, 'Term ' + tr.n + ' begins'); add(tr.end, 'Term ' + tr.n + ' ends'); }
    add(cal.sports, st.schoolYear === S.FIRST_YEAR ? 'Opening-week relay' : 'Sports day'); if (cal.production) add(cal.production, 'The school production opens'); if (cal.exams) add(cal.exams, 'End-of-year exams begin');
    add(cal.prom, 'Year 13 prom'); add(cal.prize, 'Prize-giving and graduation'); add(cal.results, 'NCEA results released');
    dates.sort((a, b) => a[0] - b[0]);
    const news = S.eventsBetween(t - 45 * DAY, t).reverse().slice(0, 8);
    h += '<div class="two"><section><h2>Coming up</h2><ul class="dates">' + (dates.slice(0, 6).map((d) => '<li><time>' + fDay.format(city(d[0])) + '</time><span>' + esc(d[1]) + '</span></li>').join('') || '<li><span></span><span class="muted">Nothing until next year.</span></li>') + '</ul></section>' +
      '<section><h2>School news</h2><ul class="news">' + (news.map((e) => '<li><time>' + fDay.format(city(Date.parse(e.time))) + '</time><span>' + esc(e.headline) + '</span></li>').join('') || '<li><span></span><span class="muted">A quiet few weeks.</span></li>') + '</ul></section></div>';
    h += '<h2>House points</h2>' + housesHtml(st.houses);
    return h;
  }
  function housesHtml(houses) {
    const max = Math.max(1, houses[0].points);
    return '<div class="houses">' + houses.map((x) => '<div class="house" style="--c:' + x.color + '"><h3>' + esc(x.name) + '</h3><p class="pts">' + x.points + '</p><p>' + esc(x.motto) + '</p><div class="bar"><i style="width:' + (x.points / max) * 100 + '%"></i></div></div>').join('') + '</div>';
  }

  // ---------------------------------------------------------------- students
  const PAGE = 60;
  function students(year, page) {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return home();
    year = +year || 9; page = +page || 0;
    const roll = S.rollAt(t).filter((s) => s.year === year);
    const recs = roll.map((s) => S.recordFor(s.id, st.schoolYear)).filter(Boolean).sort((a, b) => (a.form < b.form ? -1 : a.form > b.form ? 1 : a.name < b.name ? -1 : 1));
    let h = head('Students', num(st.roll) + ' students in five year levels. Every resident of the city in Years 9 to 13 is enrolled.', 'Pixel High School');
    h += '<form class="search" id="find"><input id="findq" type="search" placeholder="Find a student by name" aria-label="Find a student by name"><button>Find</button></form>';
    h += '<nav class="yeartabs" aria-label="Year levels">' + [9, 10, 11, 12, 13].map((y) => '<a href="' + AT + '#/students/' + y + '"' + (y === year ? ' aria-current="page"' : '') + '>Year ' + y + ' <span class="muted">' + num(st.byYear[y]) + '</span></a>').join('') + '</nav>';
    h += '<ul class="tiles">' + recs.slice(page * PAGE, page * PAGE + PAGE).map((r) => tile(r, r.form + ', ' + r.house.name)).join('') + '</ul>';
    h += '<p class="pager"><span>' + (page > 0 ? link('students/' + year + '/' + (page - 1), 'Previous ' + PAGE) : '') + '</span><span>' + ((page + 1) * PAGE < recs.length ? link('students/' + year + '/' + (page + 1), 'Next ' + PAGE) : '') + '</span></p>';
    return h;
  }
  function find(name) {
    const t = now(), st = S.stateAt(t), qv = name.toLowerCase();
    const found = S.rollAt(t).map((s) => S.recordFor(s.id, st.schoolYear)).filter((r) => r && r.name.toLowerCase().indexOf(qv) >= 0).slice(0, 120);
    return head(found.length ? found.length + ' students found' : 'No student by that name', 'Searching for “' + esc(name) + '”.', link('students', 'Students')) + '<ul class="tiles">' + found.map((r) => tile(r, 'Year ' + r.year + ', ' + r.house.name)).join('') + '</ul>';
  }
  function student(id) {
    const t = now(), st = S.stateAt(t);
    const Y = st.schoolYear || S.schoolYearOf(t);
    let rec = S.recordFor(id, Y), yearUsed = Y;
    if (!rec) { for (let y = Y - 1; y >= S.FIRST_YEAR && !rec; y--) { rec = S.recordFor(id, y); yearUsed = y; } }
    if (!rec) return head('Not a student', 'Pixel High has no record of this resident. ' + '<a href="' + census(id) + '">See their census file</a>.');
    const onRoll = S.rollAt(t).some((s) => s.id === id);
    let h = '<div class="profile"><span class="sw" style="--c:' + rec.color + ';--h:' + HOUSE_C[rec.house.name] + '"><i></i><span class="hs"></span></span><div><p class="kicker">' +
      (onRoll ? 'Year ' + rec.year + ', form ' + rec.form : rec.classOf <= yearUsed ? 'Class of ' + S.yearName(rec.classOf) + ', graduated' : 'No longer at Pixel High') + '</p><h1 style="font:800 clamp(2rem,5vw,3.2rem)/1 var(--display);margin:0 0 8px">' + esc(rec.name) + '</h1>' +
      '<p class="lede" style="font-size:1rem"><a href="' + census(id) + '">Their census file</a>, ' + esc(rec.district) + ' district.</p></div></div>';
    h += '<dl class="facts">' + fact('House', '<span class="chip" style="--c:' + rec.house.color + '"></span>' + esc(rec.house.name)) + fact('Class of', S.yearName(rec.classOf)) + fact('Attendance', rec.attendance + '%') +
      fact('Best subject', esc(S.SUBJECTS[rec.subjects.slice().sort((a, b) => rec.ability[b] - rec.ability[a])[0]].name)) + '</dl>';
    // grades, by subject and assessment: this year's, and last year's when they're still recent
    const gradesTable = (yr) => {
      const r2 = S.recordFor(id, yr), gs = r2 ? S.gradesOf(id, yr, t) : [];
      if (!gs.length) return '';
      const keys = []; gs.forEach((g) => { if (keys.indexOf(g.key) < 0) keys.push(g.key); });
      const names = {}; gs.forEach((g) => (names[g.key] = g.assessment));
      return '<h2>' + yr + ', Year ' + r2.year + '</h2><div class="table-wrap"><table class="data"><thead><tr><th>Subject</th>' + keys.map((k) => '<th>' + esc(names[k]) + '</th>').join('') + '</tr></thead><tbody>' +
        r2.subjects.map((k) => '<tr><td>' + esc(S.SUBJECTS[k].name) + '</td>' + keys.map((key) => { const g = gs.filter((x) => x.key === key && x.subject === k)[0]; return '<td>' + (g ? '<span class="g ' + g.grade + '" title="' + S.GRADE_NAME[g.grade] + '">' + g.grade + '</span>' : '') + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>';
    };
    const tables = [yearUsed, yearUsed - 1].filter((y) => y >= S.FIRST_YEAR).map(gradesTable).filter(Boolean);
    h += tables.length ? tables.join('') + '<p class="muted">E Excellence, M Merit, A Achieved, N Not Achieved.</p>'
      : '<h2>Subjects</h2><p class="muted">Studying ' + esc(rec.subjects.map((k) => S.SUBJECTS[k].name).join(', ')) + '. No results have been released yet.</p>';
    // honours
    const honours = [];
    const pg = S.prizeGiving(yearUsed, t), prom = S.promOf(yearUsed, t);
    if (pg.happened) {
      if (pg.dux && pg.dux.id === id) honours.push('Dux of Pixel High, ' + yearUsed);
      if (pg.proxime && pg.proxime.id === id) honours.push('Proxime accessit, ' + yearUsed);
      pg.cups.forEach((c) => { if (c.winner.id === id) honours.push('The ' + c.subject + ' Cup, ' + yearUsed); });
      pg.awards.forEach((a) => { if (a.winner.id === id) honours.push(a.name + ', ' + yearUsed); });
    }
    if (prom.happened && prom.promPixel) { if (prom.promPixel.id === id) honours.push('Prom Pixel, ' + yearUsed); if (prom.court.some((c) => c.id === id)) honours.push('Prom court, ' + yearUsed); }
    if (rec.year === 13 || rec.classOf <= yearUsed) { const yb = S.yearbook(rec.classOf, t); yb.superlatives.forEach((s) => { if (s.winner.id === id) honours.push('Yearbook: “' + s.title + '”'); }); }
    if (honours.length) h += '<h2>Honours</h2><ul class="dates">' + honours.map((x) => '<li><span>★</span><span>' + esc(x) + '</span></li>').join('') + '</ul>';
    return h;
  }

  // ---------------------------------------------------------------- houses
  function houses() {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return home();
    const roll = S.rollAt(t).map((s) => S.recordFor(s.id, st.schoolYear)).filter(Boolean);
    let h = head('Houses', 'Every student belongs to one of four houses, named for the three subpixels that make every pixel, and the alpha channel that decides how much of it you see.', 'Pixel High School');
    h += housesHtml(st.houses);
    for (const x of st.houses) {
      const members = roll.filter((r) => r.house.id === x.id);
      const captains = members.filter((r) => r.year === 13).sort((a, b) => b.traits.brightness - a.traits.brightness).slice(0, 2);
      h += '<h2><span class="chip" style="--c:' + x.color + '"></span>' + esc(x.name) + ' house <span class="muted" style="font:500 1rem var(--body)">' + num(members.length) + ' members</span></h2>' +
        '<p>' + (captains.length ? 'House captains: ' + captains.map((c) => link('student/' + c.id, esc(c.name))).join(' and ') + '.' : '') + ' Motto: “' + esc(x.motto) + '”.</p>';
    }
    h += '<p class="muted">House points come from sports day, the production, each term’s results and the prom. The House Cup is presented at prize-giving.</p>';
    return h;
  }

  // ---------------------------------------------------------------- calendar
  function calendar() {
    const t = now(), Y = Math.max(S.FIRST_YEAR, S.schoolYearOf(t));
    let h = head('Calendar', 'The school keeps city time. Four terms, from February to December.', 'Pixel High School');
    for (const y of [Y, Y + 1]) {
      const cal = S.yearOf(y);
      const rows = [];
      for (const tr of cal.terms) rows.push([tr.start, 'Term ' + tr.n, fDay.format(city(tr.start)) + ' to ' + fDay.format(city(tr.end))]);
      rows.push([cal.sports, y === S.FIRST_YEAR ? 'Opening-week relay' : 'Sports day', fDay.format(city(cal.sports))]);
      if (cal.production) rows.push([cal.production, 'School production', fDay.format(city(cal.production))]);
      if (cal.exams) rows.push([cal.exams, 'End-of-year exams begin', fDay.format(city(cal.exams))]);
      rows.push([cal.prom, 'Year 13 prom', fDay.format(city(cal.prom)) + ', 7pm']);
      rows.push([cal.prize, 'Prize-giving and graduation', fDay.format(city(cal.prize)) + ', 7pm']);
      rows.push([cal.results, 'NCEA results released', fDay.format(city(cal.results))]);
      rows.sort((a, b) => a[0] - b[0]);
      h += '<h2>' + S.yearName(y) + (y === S.FIRST_YEAR ? ', the school’s opening term' : '') + '</h2><div class="table-wrap"><table class="data"><tbody>' + rows.map((r) => '<tr' + (r[0] < t ? ' class="muted"' : '') + '><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    return h;
  }

  // ---------------------------------------------------------------- prom
  function prom() {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return home();
    let Y = st.schoolYear, p = S.promOf(Y, t);
    if (S.yearOf(Y).prize < t - 3 * DAY && Y > S.FIRST_YEAR) { Y -= 1; p = S.promOf(Y, t); }
    let h = head('The ' + S.yearName(Y) + ' prom', '“' + esc(p.theme) + '”, at ' + esc(p.venue) + ', on ' + fLong.format(city(p.at)) + ' at ' + fTime.format(city(p.at)) + '. For the Class of ' + S.yearName(Y) + '.', 'Pixel High School');
    if (!p.happened) {
      const days = Math.ceil((p.at - t) / DAY);
      h += '<p class="lede">' + (days > 0 ? days + ' day' + (days === 1 ? '' : 's') + ' to go.' : 'Tonight.') + ' Every Year 13 student is invited. Dress code: full brightness.</p>';
      return h;
    }
    h += '<div class="crown"><span class="sw" style="--c:' + p.promPixel.color + '"><i></i></span><div><p>Prom Pixel of the Class of ' + S.yearName(Y) + '</p><h2>' + link('student/' + p.promPixel.id, esc(p.promPixel.name)) + '</h2><p>' + esc(p.promPixel.house) + ' house, form ' + esc(p.promPixel.form) + '. Crowned in front of ' + num(p.attended) + ' of ' + num(p.eligible) + ' classmates. The last dance was ' + esc(p.lastDance) + '.</p></div></div>';
    h += '<h2>The prom court</h2><ul class="tiles">' + p.court.map((c) => tile({ id: c.id, name: c.name, color: c.color, house: c.house }, c.house + ', ' + c.form)).join('') + '</ul>';
    return h;
  }

  // ---------------------------------------------------------------- yearbook
  function yearbook(cls) {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return home();
    const Y = +cls || (S.yearOf(st.schoolYear).prize < t ? st.schoolYear : st.schoolYear);
    const yb = S.yearbook(Y, t), pg = S.prizeGiving(Y, t);
    let h = head('The Class of ' + S.yearName(Y), (yb.graduated ? 'Graduated on ' + fLong.format(city(S.yearOf(Y).prize)) + '. ' : 'Year 13 this year. ') + num(yb.members.length) + ' pixels.', 'The Pixel High yearbook');
    h += '<nav class="yeartabs" aria-label="Classes">' + [Y - 1, Y, Y + 1].filter((y) => y >= S.FIRST_YEAR).map((y) => '<a href="' + AT + '#/yearbook/' + y + '"' + (y === Y ? ' aria-current="page"' : '') + '>Class of ' + S.yearName(y) + '</a>').join('') + '</nav>';
    if (pg.happened) h += '<div class="crown"><span class="sw" style="--c:' + pg.dux.color + '"><i></i></span><div><p>Dux of Pixel High, ' + S.yearName(Y) + '</p><h2>' + link('student/' + pg.dux.id, esc(pg.dux.name)) + '</h2><p>Proxime accessit: ' + esc(pg.proxime.name) + '. ' + esc(pg.houseCup.name) + ' house won the House Cup with ' + pg.houseCup.points + ' points.</p></div></div>';
    h += '<h2>Voted by the class</h2><ul class="sup">' + yb.superlatives.map((s) => '<li><span>' + esc(s.title) + '</span>' + link('student/' + s.winner.id, esc(s.winner.name)) + '</li>').join('') + '</ul>';
    if (pg.happened) h += '<h2>Subject cups</h2><ul class="sup">' + pg.cups.map((c) => '<li><span>' + esc(c.subject) + '</span>' + link('student/' + c.winner.id, esc(c.winner.name)) + '</li>').join('') + '</ul>';
    h += '<h2>The class</h2><ul class="tiles">' + yb.members.slice(0, 240).map((m) => tile({ id: m.id, name: m.name, color: m.color, house: m.house }, m.house + ', ' + m.form)).join('') + '</ul>';
    if (yb.members.length > 240) h += '<p class="muted">And ' + num(yb.members.length - 240) + ' more. Every one of them is in the census.</p>';
    return h;
  }

  // ---------------------------------------------------------------- staff
  function staff() {
    const t = now(), st = S.stateAt(t);
    if (!st.started) return home();
    const sf = S.staffAt(t), by = {};
    for (const x of sf.teachers) (by[x.subject] = by[x.subject] || []).push(x);
    let h = head('Staff', num(sf.teachers.length) + ' teachers, one for every sixteen students. All of them live in Pixel City.', 'Pixel High School');
    if (sf.principal) { const p = K.summary(sf.principal.id, t); h += '<dl class="facts">' + fact('Principal', '<a href="' + census(p.id) + '">' + esc(p.name) + '</a>', p.age + ', ' + p.districtName) + '</dl>'; }
    h += Object.keys(S.SUBJECTS).filter((k) => by[k]).map((k) => '<h2>' + esc(S.SUBJECTS[k].name) + ' <span class="muted" style="font:500 1rem var(--body)">' + by[k].length + '</span></h2><p>' +
      by[k].map((x) => { const p = K.summary(x.id, t); return '<a href="' + census(x.id) + '">' + esc(p.name) + '</a>'; }).join(', ') + '</p>').join('');
    return h;
  }

  // ---------------------------------------------------------------- routing
  function render() {
    if (!S || !S.ready()) { main.innerHTML = head('The school is closed', 'Pixel High needs the Census Office, and it could not be reached. Please try again shortly.', 'Pixel High School'); return; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const r = parts[0] || '';
    main.innerHTML = r === 'students' ? students(parts[1], parts[2]) : r === 'find' ? find(decodeURIComponent(parts[1] || '')) : r === 'student' ? student(parts[1]) : r === 'houses' ? houses() :
      r === 'calendar' ? calendar() : r === 'prom' ? prom() : r === 'yearbook' ? yearbook(parts[1]) : r === 'staff' ? staff() : home();
    document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.r === (r === 'student' || r === 'find' ? 'students' : r) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const f = $('find');
    if (f) f.addEventListener('submit', (e) => { e.preventDefault(); const v = $('findq').value.trim(); if (v) location.hash = '#/find/' + encodeURIComponent(v); });
    window.scrollTo(0, 0);
  }
  if (AT) {
    const b = $('travel'); b.hidden = false;
    b.innerHTML = 'Visiting the school at ' + esc(at.replace('T', ' ')) + ', city time. <a href="' + location.pathname + location.hash + '">Return to the present</a>.';
    document.querySelectorAll('.tabs a, .crest-link').forEach((a) => a.setAttribute('href', AT + a.getAttribute('href')));
  }
  window.addEventListener('hashchange', render);
  setTimeout(render, 20);
})();
