/*
 * Pixel High: the city's secondary school.
 *
 * Every resident of Pixel City in Years 9 to 13 is a student, read from the Census Office: the Year level is the
 * school year minus the birth year minus four, as in New Zealand. Students arrive and leave as their families move.
 * The school keeps city time and a New Zealand year of four terms, from February to December.
 *
 * Everything is a pure function of time: houses, subjects, grades, sports day, the production, the prom and the
 * prize-giving come out the same for every visitor. Grades grow from each student's character in the census.
 *
 * A reader: it reads the census (City's universe.js and census.js) and the Weather Bureau (storm closures).
 * Seeds start "school:". Registers window.PixelUniverse.school.
 */
(function (root) {
  'use strict';

  const VERSION = '0.1.0';
  const MIN = 60000, H = 3600000, DAY = 86400000, WEEK = 7 * DAY;
  const CITY = 12 * H;                        // the school keeps City Standard Time (it opens after the Renewal)
  const OPENS_DATE = [2026, 10, 16];           // Monday 16 November 2026, city date
  const cityMidnight = (y, m, d) => Date.UTC(y, m, d) - CITY;
  const OPENS = cityMidnight.apply(null, OPENS_DATE) + 8 * H + 30 * MIN; // the doors open at 8:30, city time
  const BELL = { start: 8 * H + 45 * MIN, end: 15 * H + 15 * MIN };

  function rng(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const seeded = (s) => rng(hash('school:' + s));
  const unit = (s) => seeded(s)();
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  const cityDate = (t) => new Date(t + CITY);                 // a Date whose UTC fields read as city time
  const cityDayStart = (t) => { const d = cityDate(t); return cityMidnight(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const ymd = (t) => { const d = cityDate(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };

  const U = () => root.PixelUniverse || {};
  const ok = (x) => !!(x && (!x.ready || x.ready()));
  const ready = () => ok(U().census) && ok(U().city);

  // ================================================================ the calendar
  const day = (y, m, d) => cityMidnight(y, m, d);
  function firstWeekdayOnOrAfter(y, m, d, wd) { let t = day(y, m, d); while (cityDate(t).getUTCDay() !== wd) t += DAY; return t; }
  function lastWeekdayOnOrBefore(y, m, d, wd) { let t = day(y, m, d); while (cityDate(t).getUTCDay() !== wd) t -= DAY; return t; }
  const calCache = new Map();
  /** The school year Y: four terms of about ten weeks, and the year's fixed events. Times are city midnights. */
  function yearOf(Y) {
    if (calCache.has(Y)) return calCache.get(Y);
    let terms;
    if (Y === 2026) terms = [{ n: 4, start: day(2026, 10, 16), end: day(2026, 11, 17) }];
    else {
      const t1 = firstWeekdayOnOrAfter(Y, 1, 2, 1);
      terms = [];
      let s = t1;
      for (let n = 1; n <= 4; n++) {
        const e = n < 4 ? s + 10 * WEEK - 3 * DAY : lastWeekdayOnOrBefore(Y, 11, 17, 4);
        terms.push({ n, start: s, end: e });
        s = e + 3 * DAY + 2 * WEEK;
      }
    }
    const T = (n) => terms.filter((x) => x.n === n)[0];
    const prize = T(4).end;                                   // the last day of the year
    const prom = prize - 5 * DAY;                             // the Saturday before
    const ev = {
      terms, prize, prom,
      sports: T(1) ? T(1).start + 4 * WEEK + 3 * DAY : T(4).start + 4 * DAY,   // 2026: an opening-week relay
      production: T(3) ? T(3).start + 7 * WEEK + 2 * DAY : null,
      exams: T(4) ? T(4).start + (Y === 2026 ? 1 : 3) * WEEK : null,          // end-of-year exams begin
      results: firstWeekdayOnOrAfter(Y + 1, 0, 13, 3)                          // NCEA results, the next January
    };
    calCache.set(Y, ev);
    return ev;
  }
  /** Which school year a moment belongs to, and where in it we are. */
  function where(t) {
    const Y = cityDate(t).getUTCFullYear(), cal = yearOf(Y), d = cityDayStart(t);
    for (const tr of cal.terms) if (d >= tr.start && d <= tr.end) {
      const wd = cityDate(t).getUTCDay();
      return { Y, cal, term: tr.n, week: Math.floor((d - tr.start) / WEEK) + 1, schoolDay: wd >= 1 && wd <= 5 };
    }
    return { Y, cal, term: null, week: null, schoolDay: false };
  }
  /** Whether lessons are on at time t (a school day, between the bells, not closed for a storm). */
  function inSession(t) {
    if (t < OPENS) return false;
    const w = where(t);
    if (!w.schoolDay) return false;
    const into = t - cityDayStart(t);
    if (into < BELL.start || into > BELL.end) return false;
    return !closedFor(cityDayStart(t));
  }
  function closedFor(d) {
    const W = U().climate;
    if (!ok(W)) return false;
    try { const x = W.sample(d + 7 * H); return !!(x.storm && x.gust >= 75); } catch (e) { return false; }
  }

  // ================================================================ students
  const HOUSES = [
    { id: 'R', name: 'Red', color: '#E5484D', motto: 'First among the three' },
    { id: 'G', name: 'Green', color: '#3FB566', motto: 'Where the eye is most sensitive' },
    { id: 'B', name: 'Blue', color: '#3D7FE0', motto: 'Deep, and proud of it' },
    { id: 'A', name: 'Alpha', color: '#B9C3CA', motto: 'Present, whether you can see us or not' }
  ];
  const SUBJECTS = {
    english: { name: 'English', w: { warmth: 0.5, saturation: 0.3, sharpness: 0.2 } },
    maths: { name: 'Mathematics', w: { sharpness: 0.7, flicker: -0.2, saturation: 0.1 } },
    probability: { name: 'Probability (with the Bookmaker)', w: { sharpness: 0.6, brightness: 0.2, flicker: -0.2 } },
    calculus: { name: 'Calculus', w: { sharpness: 0.8, flicker: -0.2 } },
    colour: { name: 'Colour Science', w: { saturation: 0.5, sharpness: 0.4 } },
    optics: { name: 'Optics', w: { sharpness: 0.6, saturation: 0.3 } },
    dithering: { name: 'Applied Dithering', w: { saturation: 0.7, flicker: 0.1, sharpness: 0.2 } },
    kerning: { name: 'Typography and Kerning', w: { sharpness: 0.7, saturation: 0.2 } },
    history: { name: 'Pixel History', w: { warmth: 0.4, sharpness: 0.3, saturation: 0.2 } },
    civics: { name: 'Civics (the Senate)', w: { brightness: 0.4, sharpness: 0.3, warmth: 0.2 } },
    racing: { name: 'Racing Studies (Glacial)', w: { brightness: 0.3, sharpness: 0.3, flicker: -0.3 } },
    weather: { name: 'Meteorology', w: { sharpness: 0.5, flicker: 0.2 } },
    media: { name: 'Media Studies (the Daily Pixel)', w: { brightness: 0.5, saturation: 0.3 } },
    music: { name: 'Music Technology (Pixel FM)', w: { saturation: 0.6, brightness: 0.3 } },
    pe: { name: 'Physical Education', w: { brightness: 0.4, flicker: -0.5 } }
  };
  const JUNIOR = ['english', 'maths', 'colour', 'history', 'civics', 'pe'];
  const SENIOR = ['probability', 'calculus', 'colour', 'optics', 'dithering', 'kerning', 'history', 'civics', 'racing', 'weather', 'media', 'music', 'pe'];
  const GRADE = (s) => (s >= 0.78 ? 'E' : s >= 0.6 ? 'M' : s >= 0.42 ? 'A' : 'N');
  const GRADE_NAME = { E: 'Excellence', M: 'Merit', A: 'Achieved', N: 'Not Achieved' };
  const GRADE_POINTS = { E: 4, M: 3, A: 2, N: 0 };

  const yearLevel = (birth, Y) => Y - new Date(birth + CITY).getUTCFullYear() - 4;
  const classOf = (birth) => new Date(birth + CITY).getUTCFullYear() + 17;

  const rollCache = new Map();
  /** Everyone on the roll at time t: [{ id, year, home }]. Empty before the school opens and outside a school year. */
  function rollAt(t) {
    if (t < OPENS - 8 * H || !ready()) return [];
    const d = cityDayStart(t);
    if (rollCache.has(d)) return rollCache.get(d);
    const K = U().census, Y = cityDate(t).getUTCFullYear();
    const cal = yearOf(Y);
    // after prize-giving the leavers have gone and the school waits for next year's intake
    const effY = d > cal.prize ? null : Y;
    const out = [];
    if (effY !== null && d >= cal.terms[0].start - 4 * WEEK) {
      for (const h of K.homes()) for (const m of K.householdAt(h.i, d + 12 * H).members) {
        if (d + 12 * H < m.birth) continue;
        const yl = yearLevel(m.birth, effY);
        if (yl >= 9 && yl <= 13) out.push({ id: m.id, year: yl, home: h.i });
      }
    }
    if (rollCache.size > 10) rollCache.clear();
    rollCache.set(d, out);
    return out;
  }

  const recCache = new Map();
  /** A student's school record for school year Y: house, form, subjects and abilities (fixed for that year). */
  function recordFor(id, Y) {
    const key = id + ':' + Y;
    if (recCache.has(key)) return recCache.get(key);
    const K = U().census, c = K.character(id);
    if (!c) return null;
    const yl = yearLevel(c.birth, Y);
    if (yl < 9 || yl > 13) return null;
    const house = HOUSES[hash('school:house:' + id) % 4];
    const r = seeded('subjects:' + id + ':' + Y);
    let subjects;
    if (yl <= 10) subjects = JUNIOR.slice();
    else {
      // seniors take English and five options, leaning towards what they're good at
      const T = c.traits;
      const ranked = SENIOR.map((k) => { let s = 0; for (const tr in SUBJECTS[k].w) s += SUBJECTS[k].w[tr] * (tr === 'flicker' ? 1 - T.flicker : T[tr]); return [k, s + r() * 0.45 + unit('fav:' + id + ':' + k) * 0.25]; })
        .sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      subjects = ['english'].concat(ranked.slice(0, 5));
    }
    const ability = {};
    for (const k of subjects) {
      let s = 0.25;
      for (const tr in SUBJECTS[k].w) { const w = SUBJECTS[k].w[tr]; s += (w < 0 ? -w * (1 - c.traits[tr]) : w * c.traits[tr]) * 0.55; }
      s += (unit('talent:' + id + ':' + k) - 0.5) * 0.4 + (yl - 9) * 0.015;
      ability[k] = clamp(s, 0.05, 0.98);
    }
    const form = yl + String.fromCharCode(65 + hash('school:form:' + id + ':' + Y) % 8);
    const rec = { id, name: c.name, color: c.color, birth: c.birth, year: yl, form, house, subjects, ability, classOf: classOf(c.birth), traits: c.traits,
      district: c.districtName, attendance: Math.round(clamp(0.97 - c.traits.flicker * 0.08 - unit('absent:' + id + ':' + Y) * 0.06, 0.78, 1) * 1000) / 10 };
    if (recCache.size > 20000) recCache.clear();
    recCache.set(key, rec);
    return rec;
  }

  // ---------------------------------------------------------------- assessments and grades
  /** The year's assessments: [{ key, name, at (results released), levels: [years], external }] */
  function assessments(Y) {
    const cal = yearOf(Y), out = [];
    for (const tr of cal.terms) if (tr.n < 4) out.push({ key: Y + '-T' + tr.n, name: 'Term ' + tr.n + (tr.n === 2 ? ' mid-year exams' : tr.n === 3 ? ' practice exams' : ' assessments'), at: tr.end + 15 * H, levels: [9, 10, 11, 12, 13] });
    out.push({ key: Y + '-ey', name: 'End-of-year reports', at: cal.prize + 9 * H, levels: [9, 10] });
    out.push({ key: Y + '-ncea', name: 'NCEA external results', at: cal.results + 8 * H, levels: [11, 12, 13], external: true });
    return out;
  }
  function grade(rec, subject, a) {
    const noise = (unit('grade:' + rec.id + ':' + subject + ':' + a.key) - 0.5) * 0.3;
    const score = clamp(rec.ability[subject] + noise - (rec.attendance < 88 ? 0.05 : 0), 0, 1);
    return GRADE(score);
  }
  /** A student's grades up to time t in school year Y: [{ assessment, subject, grade }] */
  function gradesOf(id, Y, t) {
    const rec = recordFor(id, Y);
    if (!rec) return [];
    const out = [];
    for (const a of assessments(Y)) {
      if (a.at > t || a.levels.indexOf(rec.year) < 0) continue;
      if (Y === 2026 && !a.external && a.key !== '2026-ey') continue; // the first year is a short one
      for (const k of rec.subjects) out.push({ assessment: a.name, key: a.key, subject: k, subjectName: SUBJECTS[k].name, grade: grade(rec, k, a) });
    }
    return out;
  }
  const avgPoints = (gs) => (gs.length ? gs.reduce((s, g) => s + GRADE_POINTS[g.grade], 0) / gs.length : 0);

  // ================================================================ the staff
  const staffCache = new Map();
  /** The teachers at time t: working-age residents of the city, one for every sixteen students. */
  function staffAt(t) {
    if (t < OPENS - 8 * H || !ready()) return { principal: null, teachers: [] };
    const d = cityDayStart(t);
    if (staffCache.has(d)) return staffCache.get(d);
    const K = U().census, roll = rollAt(t).length || 4200;
    const need = Math.ceil(roll / 16);
    const cands = [];
    for (const h of K.homes()) for (const m of K.householdAt(h.i, d + 12 * H).members) {
      const age = Math.floor((d - m.birth) / 31557600000);
      if (age >= 26 && age <= 64) cands.push([unit('teacher:' + m.id), m.id, age]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    const chosen = cands.slice(0, need);
    const keys = Object.keys(SUBJECTS);
    const teachers = chosen.map(([, id, age]) => ({ id, age, subject: keys[hash('school:teaches:' + id) % keys.length] }));
    const principal = teachers.filter((x) => x.age >= 45)[0] || teachers[0] || null;
    const out = { principal, teachers };
    if (staffCache.size > 10) staffCache.clear();
    staffCache.set(d, out);
    return out;
  }

  // ================================================================ the year's big days
  const PROM_THEMES = ['Sixteen Million Colours', 'A Night at the Grand Prix', 'Under the Floodlights', 'After Dark Mode', 'The Last Refresh', 'Starry Night (Dithered)', 'Full Brightness', 'Overscan'];
  const PROM_VENUES = ['the concourse of the Glacial Stadium', 'the Hall of Champions at the Museum', 'the school hall, repainted for the night', 'the Senate House plaza, by permission of the Presiding Officer'];
  const SPORTS = ['the 100-pixel sprint', 'the 400-pixel relay', 'the long nap (endurance)', 'the high refresh (jump)', 'the dither dash'];

  function houseRank(seedKey) { return HOUSES.slice().sort((a, b) => unit(seedKey + ':' + a.id) - unit(seedKey + ':' + b.id)); }

  /** Prom: the theme, the venue, who went and, once it has happened, the Prom Pixel and the court. */
  function promOf(Y, t) {
    const cal = yearOf(Y), at = cal.prom + 19 * H;
    const r = seeded('prom:' + Y);
    const theme = pick(r, PROM_THEMES), venue = pick(r, PROM_VENUES);
    const out = { year: Y, at, theme, venue, happened: t >= at + 5 * H };
    if (!out.happened) return out;
    const roll = rollAt(cal.prom + 12 * H).filter((s) => s.year === 13);
    const recs = roll.map((s) => recordFor(s.id, Y)).filter(Boolean);
    const going = recs.filter((x) => x.traits.brightness * 0.6 + x.traits.warmth * 0.3 + unit('promgo:' + x.id) * 0.5 > 0.42);
    const scored = going.map((x) => [x, x.traits.brightness * 0.5 + x.traits.warmth * 0.35 + x.traits.saturation * 0.15 + unit('promvote:' + x.id) * 0.4]).sort((a, b) => b[1] - a[1]);
    out.attended = going.length; out.eligible = recs.length;
    out.promPixel = scored[0] ? brief(scored[0][0]) : null;
    out.court = scored.slice(1, 7).map((s) => brief(s[0]));
    out.lastDance = pick(r, ['“Sixteen Million Colours”, by the Pixel FM house band', 'the Pixel FM chart number one', 'a slow song nobody could name', '“Wake Me at the Line”, by Lossless']);
    return out;
  }
  const brief = (rec) => ({ id: rec.id, name: rec.name, color: rec.color, house: rec.house.name, form: rec.form });

  /** Prize-giving: the Dux, the runner-up, subject cups, the House Cup and a few awards of character. */
  function prizeGiving(Y, t) {
    const cal = yearOf(Y), at = cal.prize + 18 * H;
    const out = { year: Y, at, happened: t >= at + 2 * H };
    if (!out.happened) return out;
    const roll = rollAt(cal.prize + 12 * H);
    const seniors = roll.filter((s) => s.year === 13).map((s) => recordFor(s.id, Y)).filter(Boolean);
    const avg = (rec) => { const gs = []; for (const a of assessments(Y)) if (a.at <= at && a.levels.indexOf(13) >= 0 && !a.external && (Y !== 2026)) for (const k of rec.subjects) gs.push({ grade: grade(rec, k, a) }); return gs.length ? avgPoints(gs) : rec.subjects.reduce((s, k) => s + rec.ability[k], 0) / rec.subjects.length * 4; };
    const ranked = seniors.map((x) => [x, avg(x) + unit('dux:' + x.id) * 0.01]).sort((a, b) => b[1] - a[1]);
    out.dux = ranked[0] ? brief(ranked[0][0]) : null;
    out.proxime = ranked[1] ? brief(ranked[1][0]) : null;
    out.cups = Object.keys(SUBJECTS).map((k) => {
      const best = seniors.filter((x) => x.ability[k] !== undefined).sort((a, b) => b.ability[k] + unit('cup:' + a.id) * 0.02 - a.ability[k] - unit('cup:' + b.id) * 0.02)[0];
      return best ? { subject: SUBJECTS[k].name, winner: brief(best) } : null;
    }).filter(Boolean);
    const by = (f) => { const all = roll.map((s) => recordFor(s.id, Y)).filter(Boolean); return brief(all.sort((a, b) => f(b) - f(a))[0]); };
    out.awards = [
      { name: 'The Citizenship Award', winner: by((x) => x.traits.warmth + unit('cit:' + x.id) * 0.1) },
      { name: 'The Spirit of Pixel High', winner: by((x) => x.traits.brightness + unit('spirit:' + x.id) * 0.1) },
      { name: 'Full Attendance, with distinction', winner: by((x) => x.attendance + unit('att:' + x.id)) }
    ];
    out.houseCup = housePoints(Y, t)[0];
    out.leavers = seniors.length;
    return out;
  }

  /** The house points table for school year Y, as it stood at time t. */
  function housePoints(Y, t) {
    const cal = yearOf(Y), pts = { R: 0, G: 0, B: 0, A: 0 };
    const award = (when, key, values) => { if (t < when) return; houseRank(key).forEach((h, i) => (pts[h.id] += values[i] || 0)); };
    award(cal.sports + 15 * H, 'sports:' + Y, [60, 40, 25, 10]);
    if (cal.production) award(cal.production + 21 * H, 'production:' + Y, [30, 20, 15, 10]);
    for (const tr of cal.terms) award(tr.end + 15 * H, 'term:' + Y + ':' + tr.n, [25, 18, 12, 6]);
    award(cal.prom + 23 * H, 'prom:' + Y, [10, 8, 6, 4]);
    return HOUSES.map((h) => Object.assign({ points: pts[h.id] }, h)).sort((a, b) => b.points - a.points || (a.id < b.id ? -1 : 1));
  }

  /** The yearbook of a graduating class: every member, and the class's superlatives. */
  const SUPERLATIVES = [
    ['Most likely to win a Daily Crawl', (x) => (1 - x.traits.flicker) * 0.6 + x.traits.sharpness * 0.4],
    ['Most likely to sit in the Senate', (x) => x.traits.brightness * 0.5 + x.traits.sharpness * 0.5],
    ['Most likely to be late', (x) => (1 - x.traits.sharpness)],
    ['Best dressed (by colour temperature)', (x) => x.traits.saturation],
    ['Class clown', (x) => x.traits.brightness * 0.7 + (1 - x.traits.sharpness) * 0.3],
    ['Most likely to sleep through a Grand Prix', (x) => (1 - x.traits.brightness) * 0.6 + (1 - x.traits.flicker) * 0.4],
    ['Kindest pixel in the year', (x) => x.traits.warmth],
    ['Most likely to correct your kerning', (x) => x.traits.sharpness * 0.8 + (1 - x.traits.warmth) * 0.2]
  ];
  function yearbook(classYear, t) {
    const Y = classYear, cal = yearOf(Y);
    const atT = Math.min(t, cal.prize + 12 * H);
    const members = rollAt(atT).filter((s) => s.year === 13).map((s) => recordFor(s.id, Y)).filter(Boolean)
      .sort((a, b) => (a.name.split(' ').slice(-1)[0] < b.name.split(' ').slice(-1)[0] ? -1 : a.name.split(' ').slice(-1)[0] > b.name.split(' ').slice(-1)[0] ? 1 : a.name < b.name ? -1 : 1));
    const used = new Set();
    const superlatives = SUPERLATIVES.map(([title, f]) => {
      const best = members.filter((m) => !used.has(m.id)).map((m) => [m, f(m) + unit('sup:' + title + ':' + m.id) * 0.08]).sort((a, b) => b[1] - a[1])[0];
      if (!best) return null;
      used.add(best[0].id);
      return { title, winner: brief(best[0]) };
    }).filter(Boolean);
    return { classOf: Y, members: members.map(brief), superlatives, graduated: t >= cal.prize + 20 * H };
  }

  // ================================================================ events
  function eventsBetween(from, to) {
    if (!ready() || to < OPENS - DAY) return [];
    const out = [];
    const emit = (ms, type, importance, idPart, data, headline) => { if (ms >= from && ms < to) out.push({ id: 'school:' + idPart, time: iso(ms), source: 'school', type, importance, data, headline }); };
    const y0 = cityDate(Math.max(from, OPENS)).getUTCFullYear() - 1, y1 = cityDate(to).getUTCFullYear();
    for (let Y = Math.max(2026, y0); Y <= y1; Y++) {
      const cal = yearOf(Y);
      if (Y === 2026) emit(OPENS, 'school.opens', 4, 'opens', {}, 'Pixel High opens its doors, and ' + (rollAt(OPENS).length || 'four thousand') + ' students find their form rooms');
      for (const tr of cal.terms) {
        if (!(Y === 2026)) emit(tr.start + BELL.start, 'term.start', 2, Y + ':t' + tr.n + ':start', { term: tr.n }, 'Term ' + tr.n + ' begins at Pixel High');
        emit(tr.end + BELL.end, 'term.end', 1, Y + ':t' + tr.n + ':end', { term: tr.n }, tr.n === 4 ? 'The school year ends at Pixel High' : 'Term ' + tr.n + ' ends at Pixel High; the holidays begin');
      }
      const sports = houseRank('sports:' + Y), sr = seeded('sportsday:' + Y);
      emit(cal.sports + 15 * H, 'sports.day', 2, Y + ':sports', { winner: sports[0].name },
        (Y === 2026 ? 'The opening-week relay' : 'Sports day') + ' at Pixel High: ' + sports[0].name + ' house wins, with ' + pick(sr, SPORTS) + ' decided by a single pixel');
      if (cal.production) {
        const pr = seeded('production:' + Y), shows = ['Les Misérables (in Sixteen Colours)', 'A Midsummer Night’s Refresh', 'The Phantom of the Overscan', 'Guys and Dither', 'Grease (Anti-Aliased)', 'Into the Woods (Low Resolution)'];
        emit(cal.production + 21 * H, 'production', 2, Y + ':production', {}, 'Pixel High’s production of ' + pick(pr, shows) + ' opens to a full hall');
      }
      if (cal.exams) emit(cal.exams + BELL.start, 'exams.start', 1, Y + ':exams', {}, 'End-of-year exams begin at Pixel High; the corridors fall silent');
      const prom = promOf(Y, to);
      emit(prom.at, 'prom.tonight', 2, Y + ':prom:on', { theme: prom.theme }, 'Pixel High’s Year 13 prom, “' + prom.theme + '”, is tonight at ' + prom.venue);
      if (prom.happened && prom.promPixel) emit(prom.at + 4 * H, 'prom.crowned', 3, Y + ':prom', { promPixel: prom.promPixel.name, attended: prom.attended },
        prom.promPixel.name + ' (' + prom.promPixel.house + ') is crowned Prom Pixel of the Class of ' + Y + ', in front of ' + prom.attended + ' classmates');
      const pg = prizeGiving(Y, to);
      if (pg.happened && pg.dux) emit(pg.at + H, 'prizegiving', 3, Y + ':prize', { dux: pg.dux.name, houseCup: pg.houseCup.name },
        pg.dux.name + ' is named Dux of Pixel High as the Class of ' + Y + ' graduates; ' + pg.houseCup.name + ' house lifts the House Cup');
      if (cal.results + 8 * H < to && cal.results + 8 * H >= from) {
        const sample = rollAt(cal.prize).filter((s) => s.year >= 11).slice(0, 600);
        let pass = 0, n = 0;
        for (const s of sample) { const rec = recordFor(s.id, Y); if (!rec) continue; const a = assessments(Y).filter((x) => x.external)[0]; for (const k of rec.subjects) { n++; if (grade(rec, k, a) !== 'N') pass++; } }
        emit(cal.results + 8 * H, 'results', 2, Y + ':results', { passRate: n ? Math.round(pass / n * 100) : null }, 'NCEA results are out: Pixel High students achieve ' + (n ? Math.round(pass / n * 100) : '?') + '% of their external standards');
      }
    }
    // storm closures, on school days only
    for (let d = cityDayStart(Math.max(from, OPENS)); d < to; d += DAY) {
      const w = where(d + 12 * H);
      if (w.term && w.schoolDay && closedFor(d)) emit(d + 6 * H, 'school.closed', 2, 'closed:' + ymd(d + 12 * H), {}, 'Pixel High is closed today as a storm crosses the city');
    }
    out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return out;
  }

  // ================================================================ public API
  function stateAt(t) {
    if (!ready()) return { time: t, started: false, unavailable: 'The Census Office could not be reached' };
    if (t < OPENS) return { time: t, started: false, opens: iso(OPENS) };
    const w = where(t), roll = rollAt(t), staff = staffAt(t);
    const byYear = { 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
    for (const s of roll) byYear[s.year]++;
    const closed = w.schoolDay && w.term && closedFor(cityDayStart(t));
    return {
      time: t, started: true, version: VERSION, schoolYear: w.Y, term: w.term, week: w.week, schoolDay: !!(w.schoolDay && w.term), closed, inSession: inSession(t),
      roll: roll.length, byYear, principal: staff.principal ? U().census.summary(staff.principal.id, t) : null, teachers: staff.teachers.length,
      houses: housePoints(w.Y, t), calendar: yearOf(w.Y), prom: promOf(w.Y, t), prizeGiving: prizeGiving(w.Y, t)
    };
  }

  root.PixelUniverse = root.PixelUniverse || {};
  root.PixelUniverse.school = {
    version: VERSION, source: 'school', startDate: ymd(OPENS), opens: OPENS, ready, HOUSES, SUBJECTS, GRADE_NAME,
    stateAt, eventsBetween, inSession, where, yearOf, rollAt, recordFor, gradesOf, staffAt, housePoints, promOf, prizeGiving, yearbook, assessments,
    yearLevel, classOf, cityDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
