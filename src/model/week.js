// This week's data, collected every night by model/collect.mjs (ESPN + Wikipedia):
// fixtures, league tables, top scorers, squads with season stats, recent form and summer transfers.
let WEEK = null;
let IDX = null;
const PAGES = 'https://xhonnazaj-netizen.github.io/golazo-lab/week.json';

export const wnorm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function index() {
  IDX = { team: new Map(), players: [] };
  Object.entries(WEEK.tm || {}).forEach(([id, t]) => {
    if (!t.n) return;
    IDX.team.set(wnorm(t.n), id);
    (t.sq || []).forEach((p) => IDX.players.push({ k: wnorm(p[0]), p, tid: id }));
  });
}
export function setWeek(j) {
  WEEK = j && j.tm ? j : null;
  if (WEEK) index();
  return WEEK;
}
export async function loadWeek() {
  const urls = [];
  if (typeof location !== 'undefined' && /^https?:/.test(location.protocol) && !/localhost/.test(location.hostname)) urls.push('./week.json');
  urls.push(PAGES);
  for (const u of urls) {
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tm = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
      const r = await fetch(u, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined });
      if (tm) clearTimeout(tm);
      if (r.ok) return setWeek(await r.json());
    } catch (e) {
      /* try the next one */
    }
  }
  return null;
}
export const week = () => WEEK;

// ---- teams ----
export function teamId(name) {
  if (!WEEK) return null;
  const k = wnorm(name);
  if (IDX.team.has(k)) return IDX.team.get(k);
  for (const [n, id] of IDX.team) if (n.length >= 5 && (n.startsWith(k + ' ') || k.startsWith(n + ' '))) return id;
  return null;
}
export function standingOf(id) {
  const t = WEEK && WEEK.tm[id];
  if (!t) return null;
  const L = WEEK.lg[t.lg];
  if (!L) return null;
  for (const g of L.table) {
    const r = g.rows.find((x) => String(x[1]) === String(id));
    if (r) return { rank: r[0], gp: r[3], w: r[4], d: r[5], l: r[6], gf: r[7], ga: r[8], pts: r[9], group: L.table.length > 1 ? g.g : '', of: g.rows.length };
  }
  return null;
}
export function teamWeek(name) {
  const id = teamId(name);
  if (!id) return null;
  const t = WEEK.tm[id];
  const fx = WEEK.fx.filter((f) => String(f[3]) === String(id) || String(f[5]) === String(id));
  return { id, ...t, st: standingOf(id), fx, league: (WEEK.lg[t.lg] || {}).n || '' };
}
// players: [name, pos, age, apps, subIns, goals, shots, onTarget, yellow, red, nationality, shirt, assists]
export const P = { name: 0, pos: 1, age: 2, apps: 3, subs: 4, goals: 5, shots: 6, sot: 7, yc: 8, rc: 9, nat: 10, shirt: 11, ast: 12 };
export function keyPlayers(t, n = 3) {
  return (t && t.sq ? t.sq : []).filter((p) => p[P.apps] > 0 && p[P.goals] > 0).sort((a, b) => b[P.goals] - a[P.goals] || a[P.apps] - b[P.apps]).slice(0, n);
}
export function cardMen(t, n = 2) {
  return (t && t.sq ? t.sq : []).filter((p) => p[P.yc] >= 3).sort((a, b) => b[P.yc] - a[P.yc]).slice(0, n);
}
export function signings(t, n = 5) {
  return (t && t.tr ? t.tr.in : []).slice(-n).reverse();
}
export function departures(t, n = 5) {
  return (t && t.tr ? t.tr.out : []).slice(-n).reverse();
}

// ---- leagues ----
const LGW = [
  [/premier|epl|inglaterra|england(?! champ)/, 'eng.1'], [/championship/, 'eng.2'], [/la ?liga|spain|espana/, 'esp.1'], [/serie a|italy|italia/, 'ita.1'],
  [/bundesliga|germany|alemania/, 'ger.1'], [/ligue 1|france|francia/, 'fra.1'], [/chile|chilena|campeonato nacional/, 'chi.1'], [/brasil|brazil|brasileirao/, 'bra.1'],
  [/argentin/, 'arg.1'], [/mexic|liga mx/, 'mex.1'], [/\bmls\b|usa|estados unidos/, 'usa.1'], [/colombia/, 'col.1'], [/eredivisie|netherlands|holanda|dutch/, 'ned.1'],
  [/portugal/, 'por.1'], [/belgi/, 'bel.1'], [/turk|turqu/, 'tur.1'], [/scotland|escocia|scottish/, 'sco.1'], [/champions/, 'uefa.champions'], [/europa league/, 'uefa.europa'],
];
export function leagueIn(q) {
  const x = wnorm(q);
  const hit = LGW.find(([re]) => re.test(x));
  return hit ? hit[1] : null;
}
export const leagueName = (lg) => (WEEK && WEEK.lg[lg] && WEEK.lg[lg].n) || lg;
export const tableOf = (lg) => (WEEK && WEEK.lg[lg] ? WEEK.lg[lg].table : []);
export const scorersOf = (lg) => (WEEK && WEEK.lg[lg] ? WEEK.lg[lg].sc : []);
export const assistsOf = (lg) => (WEEK && WEEK.lg[lg] ? WEEK.lg[lg].as : []);
export function fixturesOf(lg, day) {
  if (!WEEK) return [];
  const local = (iso) => new Date(iso).toLocaleDateString('en-CA');
  return WEEK.fx.filter((f) => (!lg || f[1] === lg) && (!day || local(f[2]) === day));
}

// ---- players ----
export function findPlayer(q) {
  if (!WEEK) return null;
  const words = wnorm(q).split(' ').filter((w) => w.length >= 4);
  if (!words.length) return null;
  let best = null;
  for (const x of IDX.players) {
    const parts = x.k.split(' ');
    const hit = words.filter((w) => parts.includes(w)).length;
    if (!hit) continue;
    const sc = hit * 100 + x.p[P.goals] * 2 + x.p[P.apps];
    if (!best || sc > best.sc) best = { ...x, sc };
  }
  if (!best) return null;
  const t = WEEK.tm[best.tid];
  return { p: best.p, team: t.n, lg: t.lg, tid: best.tid };
}
// names of every team in the data (for spotting a team in a question)
export function teamsIn(q) {
  if (!WEEK) return [];
  const x = ' ' + wnorm(q) + ' ';
  const hits = [];
  for (const [n, id] of IDX.team) {
    const i = x.indexOf(' ' + n + ' ');
    if (i >= 0) hits.push({ id, n: WEEK.tm[id].n, at: i, len: n.length });
  }
  return hits.filter((h) => !hits.some((o) => o !== h && o.at <= h.at && o.at + o.len >= h.at + h.len && o.len > h.len)).sort((a, b) => a.at - b.at);
}
