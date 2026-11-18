// Golazo Lab data collector – shared by the nightly GitHub job (Node 20) and the browser (for testing).
// Sources: ESPN public site API (fixtures, tables, top scorers, squads with season stats, results)
// and Wikipedia (summer 2026 transfer lists, CC BY-SA). No keys, no paid services.

export const LEAGUES = {
  'eng.1': { n: 'Premier League', wiki: 'English', hist: '202508' },
  'esp.1': { n: 'LaLiga', wiki: 'Spanish', hist: '202508' },
  'ita.1': { n: 'Serie A', wiki: 'Italian', hist: '202508' },
  'ger.1': { n: 'Bundesliga', wiki: 'German', hist: '202508' },
  'fra.1': { n: 'Ligue 1', wiki: 'French', hist: '202508' },
  'eng.2': { n: 'Championship', wiki: 'English', hist: '202308' },
  'ned.1': { n: 'Eredivisie', wiki: 'Dutch', hist: '202308' },
  'por.1': { n: 'Primeira Liga', hist: '202308' },
  'bel.1': { n: 'Belgian Pro League', wiki: 'Belgian', hist: '202307' },
  'tur.1': { n: 'Süper Lig', wiki: 'Turkish', hist: '202308' },
  'sco.1': { n: 'Scottish Premiership', wiki: 'Scottish', hist: '202308' },
  'chi.1': { n: 'Primera División (Chile)', hist: '202301' },
  'bra.1': { n: 'Brasileirão', hist: '202304' },
  'arg.1': { n: 'Liga Profesional (Argentina)', hist: '202301' },
  'mex.1': { n: 'Liga MX', wiki: 'Mexican', hist: '202301' },
  'usa.1': { n: 'MLS', hist: '202302' },
  'col.1': { n: 'Liga BetPlay (Colombia)', hist: '202301' },
  'uefa.champions': { n: 'Champions League' },
  'uefa.europa': { n: 'Europa League' },
};
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
const ESPN2 = 'https://site.api.espn.com/apis/v2/sports/soccer/';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const UA = 'GolazoLab/1.0 (https://github.com/xhonnazaj-netizen/golazo-lab; data collector)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let LOG = () => {};
export function setLogger(f) { LOG = f; }

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, typeof window === 'undefined' ? { headers: { 'User-Agent': UA } } : undefined);
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) return null;
    } catch (e) { /* retry */ }
    await sleep(700 * (i + 1));
  }
  return null;
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ---- dates (Chile time, the user's clock) ----
const fmtCL = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });
export const localDay = (d) => fmtCL.format(d); // YYYY-MM-DD
export function weekWindow(now = new Date()) {
  const from = localDay(now);
  const d = new Date(from + 'T12:00:00Z');
  const toSun = (7 - d.getUTCDay()) % 7; // 0 when today is Sunday
  const end = new Date(d.getTime() + toSun * 86400000);
  return { from, to: end.toISOString().slice(0, 10) };
}
const ymd = (s) => s.replace(/-/g, '');
function dayList(from, to, extra = 1) {
  const out = [];
  let d = new Date(from + 'T12:00:00Z');
  const e = new Date(to + 'T12:00:00Z').getTime() + extra * 86400000;
  while (d.getTime() <= e) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  return out;
}
function monthList(fromYM, now = new Date()) {
  const out = [];
  let y = +fromYM.slice(0, 4), m = +fromYM.slice(4, 6);
  const end = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
  while (y * 100 + m <= end) { out.push(String(y) + String(m).padStart(2, '0')); m === 12 ? ((y += 1), (m = 1)) : (m += 1); }
  return out;
}

// ---- ESPN ----
const statMap = (x) => {
  const o = {};
  ((x.statistics && x.statistics.splits && x.statistics.splits.categories) || []).forEach((c) => (c.stats || []).forEach((s) => (o[s.name] = s.value)));
  return o;
};
export function parseEvent(e, lg) {
  const c = e.competitions && e.competitions[0];
  if (!c) return null;
  const H = c.competitors.find((x) => x.homeAway === 'home'), A = c.competitors.find((x) => x.homeAway === 'away');
  if (!H || !A) return null;
  const yel = (side) => (c.details || []).filter((d) => (d.yellowCard || /yellow/i.test((d.type && d.type.text) || '')) && d.team && String(d.team.id) === String(side.team.id)).length;
  return {
    id: e.id, lg, date: e.date, state: c.status && c.status.type && c.status.type.state,
    hId: H.team.id, h: H.team.displayName, aId: A.team.id, a: A.team.displayName,
    hs: H.score != null ? +H.score : null, as: A.score != null ? +A.score : null,
    yh: (c.details || []).length ? yel(H) : null, ya: (c.details || []).length ? yel(A) : null,
    venue: c.venue && c.venue.fullName, neutral: !!c.neutralSite,
  };
}
export async function fixtures(lg, from, to) {
  const days = dayList(from, to, 1);
  const lists = await pool(days, 3, (d) => getJSON(ESPN + lg + '/scoreboard?dates=' + ymd(d)));
  const seen = new Set(), out = [];
  lists.forEach((j) => ((j && j.events) || []).forEach((e) => {
    if (seen.has(e.id)) return;
    const local = localDay(new Date(e.date));
    if (local < from || local > to) return;
    seen.add(e.id);
    const p = parseEvent(e, lg);
    if (p) out.push(p);
  }));
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
export async function results(lg, fromYM) {
  const months = monthList(fromYM);
  const lists = await pool(months, 3, (ym) => getJSON(ESPN + lg + '/scoreboard?dates=' + ym + '&limit=300'));
  const seen = new Set(), out = [];
  lists.forEach((j) => ((j && j.events) || []).forEach((e) => {
    if (seen.has(e.id)) return;
    const p = parseEvent(e, lg);
    if (!p || p.state !== 'post' || p.hs == null) return;
    seen.add(e.id);
    out.push(p);
  }));
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
export async function standings(lg) {
  const j = await getJSON(ESPN2 + lg + '/standings');
  if (!j) return [];
  const groups = (j.children || []).length ? j.children : [j];
  return groups.map((g) => ({
    g: g.name || '',
    rows: (((g.standings && g.standings.entries) || [])).map((x) => {
      const s = Object.fromEntries((x.stats || []).map((z) => [z.name, z.value]));
      return [s.rank || 0, x.team.id, x.team.displayName, s.gamesPlayed || 0, s.wins || 0, s.ties || 0, s.losses || 0, s.pointsFor || 0, s.pointsAgainst || 0, s.points || 0];
    }).sort((a, b) => (a[0] || 99) - (b[0] || 99)),
  })).filter((g) => g.rows.length);
}
export async function leaders(lg) {
  const j = await getJSON(ESPN + lg + '/statistics');
  const pick = (name) => ((((j && j.stats) || []).find((s) => s.name === name) || {}).leaders || []).slice(0, 25)
    .map((l) => [l.athlete && l.athlete.displayName, l.athlete && l.athlete.team && l.athlete.team.displayName, l.value]);
  return { sc: pick('goalsLeaders'), as: pick('assistsLeaders') };
}
export async function squad(lg, teamId) {
  const j = await getJSON(ESPN + lg + '/teams/' + teamId + '/roster');
  return ((j && j.athletes) || []).map((x) => {
    const s = statMap(x);
    return [x.displayName, (x.position && x.position.abbreviation) || '', x.age || null, s.appearances || 0, s.subIns || 0, s.totalGoals || 0,
      s.totalShots || 0, s.shotsOnTarget || 0, s.yellowCards || 0, s.redCards || 0, x.citizenship || '', x.jersey || '', s.goalAssists || 0];
  }).sort((a, b) => b[5] - a[5] || b[3] - a[3]);
}

// ---- Wikipedia transfer lists ----
export function cleanWiki(s) {
  s = String(s || '');
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)(\|[^}]*)?\}\}/gi, '$1 $2');
  s = s.replace(/\{\{\s*sort\s*\|[^|}]*\|([^}]*)\}\}/gi, '$1');
  s = s.replace(/\{\{\s*(?:fbu|fb|fbw|fb team)\s*\|([^|}]*)[^}]*\}\}/gi, '$1');
  let prev;
  do { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, ''); } while (s !== prev);
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
function splitCell(c) {
  // " rowspan="2" |9 February 2026" -> attributes + value (the bar must not be inside [[ ]] or {{ }})
  let depth = 0;
  for (let i = 0; i < c.length; i++) {
    const two = c.slice(i, i + 2);
    if (two === '[[' || two === '{{') { depth++; i++; continue; }
    if (two === ']]' || two === '}}') { depth--; i++; continue; }
    if (c[i] === '|' && depth === 0) {
      const attr = c.slice(0, i);
      if (/^\s*(rowspan|colspan|style|align|class|data-sort-value|scope|width|bgcolor)\b/i.test(attr)) {
        const rs = attr.match(/rowspan\s*=\s*"?(\d+)/i);
        return { v: c.slice(i + 1), span: rs ? +rs[1] : 1 };
      }
      return { v: c, span: 1 };
    }
  }
  return { v: c, span: 1 };
}
export function parseTables(w) {
  const out = [];
  let i = 0;
  while ((i = w.indexOf('{|', i)) >= 0) {
    const j = w.indexOf('\n|}', i);
    if (j < 0) break;
    const t = w.slice(i, j);
    i = j + 3;
    const parts = t.split(/\n\|-[^\n]*/);
    const head = [];
    const hp = parts.findIndex((p) => /^!/m.test(p));
    if (hp < 0) continue;
    (parts[hp].match(/^!.*$/gm) || []).forEach((h) => h.replace(/^!/, '').split('!!').forEach((x) => head.push(cleanWiki(splitCell(x).v).toLowerCase())));
    const col = (re) => head.findIndex((h) => re.test(h));
    const ci = { date: col(/date/), player: col(/player|name/), from: col(/from/), to: col(/^to\b|moving to|\bto\b/), fee: col(/fee|notes|type/) };
    if (ci.player < 0 || ci.from < 0 || ci.to < 0) continue;
    const pend = [];
    for (const p of parts.slice(hp + 1)) {
      const cells = [];
      for (const line of p.split('\n')) {
        if (line.startsWith('|}') || line.startsWith('|+')) continue;
        if (line.startsWith('!')) { cells.length = 0; break; }
        if (line.startsWith('|')) line.slice(1).split('||').forEach((c) => cells.push(c));
        else if (cells.length && line.trim()) cells[cells.length - 1] += ' ' + line;
      }
      if (!cells.length) continue;
      const parsed = cells.map(splitCell);
      const row = [];
      let k = 0;
      for (let c = 0; c < head.length; c++) {
        if (pend[c] && pend[c].left > 0) { row.push(pend[c].v); pend[c].left--; continue; }
        const x = parsed[k++];
        if (!x) { row.push(''); continue; }
        const v = cleanWiki(x.v);
        row.push(v);
        if (x.span > 1) pend[c] = { v, left: x.span - 1 };
      }
      const g = (n) => (ci[n] >= 0 ? row[ci[n]] || '' : '');
      if (g('player') && g('from') && g('to')) out.push([g('date'), g('player'), g('from'), g('to'), g('fee').slice(0, 40)]);
    }
  }
  return out;
}
export async function wikiTransfers(country) {
  const page = `List of ${country} football transfers summer 2026`;
  const q = new URLSearchParams({ action: 'parse', format: 'json', origin: '*', page, prop: 'wikitext', formatversion: '2', redirects: '1' });
  const j = await getJSON(WIKI + '?' + q);
  return j && j.parse && j.parse.wikitext ? parseTables(j.parse.wikitext) : [];
}

// ---- club-name matching (Wikipedia names -> ESPN team ids) ----
const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'cd', 'ud', 'sv', 'fk', 'sk', 'as', 'ss', 'us', 'club', 'de', 'calcio', 'futbol', 'football', 'ssc', 'acf', 'rc', 'rcd', 'ca', 'vfb', 'vfl', 'tsg', 'bv', 'ogc', 'losc', 'jk', 'spor', 'sporting']);
const ALIAS = { 'inter milan': 'internazionale', 'athletic bilbao': 'athletic club', psv: 'psv eindhoven', az: 'az alkmaar', 'paris sg': 'paris saint germain', psg: 'paris saint germain', 'bayern munchen': 'bayern munich', 'wolves': 'wolverhampton wanderers', 'spurs': 'tottenham hotspur', 'man city': 'manchester city', 'man utd': 'manchester united' };
export const normClub = (s) => {
  let x = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  x = ALIAS[x] || x;
  return x.split(' ').filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)).join(' ');
};
export function clubMatcher(teams) {
  const L = teams.map(([id, name]) => ({ id, name, k: normClub(name) })).filter((t) => t.k);
  return (name) => {
    const k = normClub(name);
    if (!k) return null;
    let t = L.find((x) => x.k === k);
    if (!t) t = L.find((x) => (x.k.length >= 5 && k.startsWith(x.k)) || (k.length >= 5 && x.k.startsWith(k)));
    return t ? t.id : null;
  };
}

// ---- recent form from results ----
export function formOf(res, teamId, n = 6) {
  return res.filter((g) => g.hId === teamId || g.aId === teamId).slice(-n).reverse().map((g) => {
    const home = g.hId === teamId;
    return [g.date.slice(0, 10), home ? g.a : g.h, home ? g.hs : g.as, home ? g.as : g.hs, home ? 1 : 0];
  });
}

// ---- everything for one week ----
export async function collectWeek({ now = new Date(), only = null, wiki = true, hist = true } = {}) {
  const { from, to } = weekWindow(now);
  const lgs = Object.keys(LEAGUES).filter((lg) => !only || only.includes(lg));
  const week = { v: 1, updated: new Date().toISOString(), from, to, lg: {}, fx: [], tm: {}, src: 'ESPN · Wikipedia (CC BY-SA)' };
  const RES = {};
  for (const lg of lgs) {
    const L = LEAGUES[lg];
    const [fx, table, ld, res] = await Promise.all([fixtures(lg, from, to), standings(lg), leaders(lg), hist && L.hist ? results(lg, L.hist) : Promise.resolve([])]);
    RES[lg] = res;
    LOG(`${lg}: ${fx.length} fixtures, ${table.reduce((a, g) => a + g.rows.length, 0)} table rows, ${ld.sc.length} scorers, ${res.length} results`);
    if (!fx.length && !table.length) continue;
    week.lg[lg] = { n: L.n, table, sc: ld.sc, as: ld.as };
    fx.forEach((f) => week.fx.push([f.id, lg, f.date, f.hId, f.h, f.aId, f.a, f.venue || '']));
    const ids = [...new Set(fx.flatMap((f) => [f.hId, f.aId]))];
    const sq = await pool(ids, 4, (id) => squad(lg, id));
    ids.forEach((id, i) => {
      const name = (fx.find((f) => f.hId === id) || {}).h || (fx.find((f) => f.aId === id) || {}).a;
      week.tm[id] = { n: name, lg, sq: sq[i] || [], form: formOf(res, id), tr: { in: [], out: [] } };
    });
  }
  // transfers: one Wikipedia page per country, matched to ESPN clubs of every tracked league
  if (wiki) {
    const allTeams = [];
    Object.entries(week.lg).forEach(([lg, x]) => x.table.forEach((g) => g.rows.forEach((r) => allTeams.push([r[1], r[2], lg]))));
    const match = clubMatcher(allTeams.map(([id, n]) => [id, n]));
    const countries = [...new Set(lgs.map((lg) => LEAGUES[lg].wiki).filter(Boolean))];
    const seen = new Set();
    let n = 0;
    for (const c of countries) {
      const rows = await wikiTransfers(c);
      LOG(`wiki ${c}: ${rows.length} rows`);
      rows.forEach(([date, player, fromC, toC, fee]) => {
        const key = player + '|' + fromC + '|' + toC;
        if (seen.has(key)) return;
        seen.add(key);
        const fi = match(fromC), ti = match(toC);
        const add = (id, dir, rec) => {
          if (!id) return;
          if (!week.tm[id]) {
            const t = allTeams.find((x) => x[0] === id);
            week.tm[id] = { n: t ? t[1] : '', lg: t ? t[2] : '', sq: [], form: formOf(RES[t && t[2]] || [], id), tr: { in: [], out: [] } };
          }
          week.tm[id].tr[dir].push(rec);
          n++;
        };
        add(ti, 'in', [date, player, fromC, fee]);
        add(fi, 'out', [date, player, toC, fee]);
      });
    }
    LOG(`transfers matched: ${n}`);
  }
  // keep the results compact for model training
  const res = {};
  Object.entries(RES).forEach(([lg, L]) => {
    if (L.length) res[lg] = L.map((g) => [g.date.slice(2, 10).replace(/-/g, ''), g.h, g.a, g.hs, g.as, g.yh, g.ya, g.neutral ? 1 : 0]);
  });
  return { week, res };
}
