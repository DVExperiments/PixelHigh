# Pixel High School

*Every pixel counts.* The secondary school of Pixel City. Follows the [Pixel Universe Shared Conventions](../Pixel_Universe_Shared_Conventions.md). Published at `dvexperiments.github.io/PixelHigh/`.

## How it works

- **Opening:** 8:30am city time on Monday 16 November 2026, in Term 4. Its plot on the City map becomes the school building at that moment.
- **Students:** every census resident in Years 9 to 13. A student's Year level is their age at the end of the school year, on the census's life clock, minus 4 (so a pixel who turns 17 during a school year is in Year 13), as in New Zealand; their Class is the school year in which they turn 17. Students join and leave as their households move.
- **Calendar:** the school year is a Pixel Year (one calendar month), named by its number (Pixel Year 13 is December 2026). After a short opening term from 16 to 27 November 2026 (Pixel Year 12), each year has four terms of 67 pixel days (about five and a half real days) with 17-day holidays, laid out on the pixel days as a New Zealand year is from February to mid-December. Each big day falls on the real day its pixel date begins; lessons are on real weekdays during a term, 8:45 to 3:15 city time, and "week" counts pixel weeks.
- **Houses:** Red, Green, Blue and Alpha, assigned for life. Points come from sports day, the production, each term's results and the prom, and the House Cup is presented at prize-giving.
- **Subjects:** Years 9–10 take the core (English, Mathematics, Colour Science, Pixel History, Civics, PE). Years 11–13 take English and five options chosen by aptitude, including Probability (with the Bookmaker), Applied Dithering, Typography and Kerning, Racing Studies, Meteorology, Media Studies and Music Technology.
- **Grades:** NCEA-style Excellence, Merit, Achieved and Not Achieved, from each student's census traits plus a little luck. Results come at the end of Terms 1–3, in end-of-year reports (Years 9–10) and as NCEA external results early in the next Pixel Year (Years 11–13).
- **Staff:** working-age residents, one teacher for every sixteen students. The principal is the first of them aged 45 or over. When staff move away, others take their places.
- **The year's events:** sports day (Term 1), the production (Term 3), end-of-year exams, the Year 13 prom (a real day or so before the last day, with a Prom Pixel and a court), prize-giving (Dux, proxime accessit, subject cups, awards, the House Cup), the yearbook with class superlatives, and storm closures.
- **City life:** on school days, teenagers on the City map walk to Pixel High, eat lunch on the field and walk home after the last bell.

## API (`window.PixelUniverse.school`)

| Member | Returns |
| --- | --- |
| `stateAt(t)` | Term and week, whether lessons are on, the roll by year, the principal, house points, the calendar, the prom and prize-giving |
| `eventsBetween(from, to)` | `school.opens`, `term.start`/`term.end`, `sports.day`, `production`, `exams.start`, `prom.tonight`, `prom.crowned`, `prizegiving`, `results`, `school.closed` |
| `rollAt(t)` | Every student on the roll: `{ id, year, home }` |
| `recordFor(id, year)` | A student's house, form, subjects, abilities, attendance and class |
| `gradesOf(id, year, t)` | Their grades released by time `t` |
| `inSession(t)`, `where(t)`, `yearOf(year)` | The calendar |
| `schoolYearOf(t)`, `yearName(year)`, `FIRST_YEAR` | The school year (a Pixel Year number) at a moment, and its name (`'Pixel Year 14'`) |
| `staffAt(t)`, `housePoints(year, t)`, `promOf(year, t)`, `prizeGiving(year, t)`, `yearbook(classOf, t)` | The rest |

Load after Weather, Senate, City's `universe.js` and `census.js`.

## Pages

`#/` home, `#/students[/<year>]`, `#/student/<id>`, `#/houses`, `#/calendar`, `#/prom`, `#/yearbook[/<class>]`, `#/staff`. Add `?at=2026-12-13T10:00` (city time) to visit another moment.
