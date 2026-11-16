// Team database for the assistant: recent results, form, goals, cards, head-to-head, top scorers, rankings.
// All local data (src/data/teams-db.js) – no outside service.
import DB from '../data/teams-db.js';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Spanish / common names → database names
const ALIAS = {
  alemania: 'Germany', espana: 'Spain', francia: 'France', inglaterra: 'England', italia: 'Italy', portugal: 'Portugal',
  'paises bajos': 'Netherlands', holanda: 'Netherlands', belgica: 'Belgium', suiza: 'Switzerland', escocia: 'Scotland',
  gales: 'Wales', irlanda: 'Republic of Ireland', 'irlanda del norte': 'Northern Ireland', grecia: 'Greece', turquia: 'Turkey',
  croacia: 'Croatia', serbia: 'Serbia', polonia: 'Poland', ucrania: 'Ukraine', suecia: 'Sweden', noruega: 'Norway',
  dinamarca: 'Denmark', finlandia: 'Finland', islandia: 'Iceland', austria: 'Austria', hungria: 'Hungary',
  'republica checa': 'Czech Republic', chequia: 'Czech Republic', eslovaquia: 'Slovakia', eslovenia: 'Slovenia',
  rumania: 'Romania', bulgaria: 'Bulgaria', albania: 'Albania', 'macedonia del norte': 'North Macedonia', macedonia: 'North Macedonia',
  bosnia: 'Bosnia and Herzegovina', montenegro: 'Montenegro', kosovo: 'Kosovo', georgia: 'Georgia', armenia: 'Armenia',
  azerbaiyan: 'Azerbaijan', kazajistan: 'Kazakhstan', lituania: 'Lithuania', letonia: 'Latvia', estonia: 'Estonia',
  luxemburgo: 'Luxembourg', 'islas feroe': 'Faroe Islands', feroe: 'Faroe Islands', moldavia: 'Moldova', chipre: 'Cyprus',
  malta: 'Malta', andorra: 'Andorra', 'san marino': 'San Marino', gibraltar: 'Gibraltar', bielorrusia: 'Belarus', rusia: 'Russia',
  brasil: 'Brazil', argentina: 'Argentina', uruguay: 'Uruguay', colombia: 'Colombia', chile: 'Chile', peru: 'Peru',
  ecuador: 'Ecuador', paraguay: 'Paraguay', bolivia: 'Bolivia', venezuela: 'Venezuela', mexico: 'Mexico',
  'estados unidos': 'United States', eeuu: 'United States', usa: 'United States', canada: 'Canada', japon: 'Japan',
  'corea del sur': 'South Korea', corea: 'South Korea', marruecos: 'Morocco', egipto: 'Egypt', senegal: 'Senegal',
  nigeria: 'Nigeria', 'costa de marfil': 'Ivory Coast', argelia: 'Algeria', tunez: 'Tunisia', camerun: 'Cameroon',
  'arabia saudita': 'Saudi Arabia', iran: 'Iran', australia: 'Australia', 'nueva zelanda': 'New Zealand', qatar: 'Qatar',
  // clubs
  'man city': 'Man City', 'manchester city': 'Man City', city: 'Man City', 'man united': 'Man United', 'man utd': 'Man United',
  'manchester united': 'Man United', united: 'Man United', spurs: 'Tottenham', forest: "Nott'm Forest", 'nottingham forest': "Nott'm Forest",
  villa: 'Aston Villa', atletico: 'Ath Madrid', 'atletico madrid': 'Ath Madrid', 'atletico de madrid': 'Ath Madrid', atleti: 'Ath Madrid',
  athletic: 'Ath Bilbao', 'athletic bilbao': 'Ath Bilbao', 'athletic club': 'Ath Bilbao', barca: 'Barcelona', real: 'Real Madrid',
  madrid: 'Real Madrid', 'real sociedad': 'Sociedad', 'rayo vallecano': 'Vallecano', rayo: 'Vallecano', espanyol: 'Espanol',
  'celta vigo': 'Celta', psg: 'Paris SG', 'paris saint germain': 'Paris SG', 'paris sg': 'Paris SG', om: 'Marseille',
  'olympique marseille': 'Marseille', 'olympique lyon': 'Lyon', ol: 'Lyon', bayern: 'Bayern Munich', 'bayern munich': 'Bayern Munich',
  'bayern munchen': 'Bayern Munich', bvb: 'Dortmund', 'borussia dortmund': 'Dortmund', gladbach: "M'gladbach",
  monchengladbach: "M'gladbach", leipzig: 'RB Leipzig', frankfurt: 'Ein Frankfurt', 'eintracht frankfurt': 'Ein Frankfurt',
  koln: 'FC Koln', cologne: 'FC Koln', bremen: 'Werder Bremen', juve: 'Juventus', 'inter milan': 'Inter', internazionale: 'Inter',
  'ac milan': 'Milan', 'as roma': 'Roma', 'hellas verona': 'Verona',
};

let NT = null,
  CL = null;
function parse() {
  if (NT) return;
  NT = DB.g.split(';').map((s) => {
    const [d, h, a, hs, as, t] = s.split(',');
    return { d: '20' + d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4, 6), h: DB.nt[+h], a: DB.nt[+a], hs: +hs, as: +as, t: DB.tour[+t] };
  });
  CL = (DB.cg || '')
    .split(';')
    .filter(Boolean)
    .map((s) => {
      const [d, h, a, hs, as, yh, ya, lg] = s.split(',');
      return { d: '20' + d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4, 6), h: DB.cl[+h], a: DB.cl[+a], hs: +hs, as: +as, yh: +yh, ya: +ya, t: LGNAME[DB.lgs[+lg]] || DB.lgs[+lg] };
    });
}

// find every team mentioned in a question (nations and clubs), best matches first
function findTeams(q) {
  const x = ' ' + norm(q) + ' ';
  const hits = [];
  const add = (name, kind, at, len) => {
    if (!hits.some((h) => h.name === name)) hits.push({ name, kind, at, len });
  };
  const isClub = (n) => DB.cl.includes(n);
  Object.keys(ALIAS)
    .sort((a, b) => b.length - a.length)
    .forEach((k) => {
      const i = x.indexOf(' ' + k + ' ');
      if (i >= 0) add(ALIAS[k], isClub(ALIAS[k]) ? 'cl' : 'nt', i, k.length);
    });
  const tryList = (list, kind) =>
    list.forEach((n) => {
      const k = norm(n);
      if (k.length < 3) return;
      const i = x.indexOf(' ' + k + ' ');
      if (i >= 0) add(n, kind, i, k.length);
    });
  tryList(DB.cl, 'cl');
  // "como" is also Spanish for "how": only the club when written "Como" (capital) mid-sentence or "Como FC"
  const ci = hits.findIndex((h) => h.name === 'Como');
  const qs = String(q).trim().replace(/^[¿¡"'(\s]+/, "");
  if (ci >= 0 && !(/.\bComo\b/.test(qs.trim()) || /^\s*Como\s+(v|vs|-|contra)\b/.test(qs) || /como (fc|1907)/i.test(qs))) hits.splice(ci, 1);
  tryList(DB.nt, 'nt');
  // drop shorter names hidden inside a longer match ("Ireland" inside "Northern Ireland")
  const out = hits.filter((h) => !hits.some((o) => o !== h && o.at <= h.at && o.at + o.len >= h.at + h.len && o.len > h.len));
  return out.sort((a, b) => a.at - b.at);
}

function gamesOf(name, kind) {
  parse();
  const L = kind === 'cl' ? CL : NT;
  return L.filter((g) => g.h === name || g.a === name).map((g) => {
    const home = g.h === name,
      gf = home ? g.hs : g.as,
      ga = home ? g.as : g.hs;
    return { d: g.d, opp: home ? g.a : g.h, home, gf, ga, r: gf > ga ? 'W' : gf === ga ? 'D' : 'L', t: g.t, y: kind === 'cl' ? (home ? g.yh : g.ya) : null, yo: kind === 'cl' ? (home ? g.ya : g.yh) : null };
  });
}

// a player name from the national-team scorer lists (since 2022)
function findScorer(q) {
  const words = norm(q).split(' ').filter((w) => w.length >= 4);
  if (!words.length) return null;
  let best = null;
  Object.entries(DB.sc || {}).forEach(([ti, L]) =>
    L.forEach(([n, c], i) => {
      const parts = norm(n).split(' ');
      if (words.some((w) => parts.includes(w)) && (!best || c > best.c)) best = { n, c, t: DB.nt[+ti], rank: i + 1 };
    }),
  );
  return best;
}
const LGNAME = { 'la-liga': 'La Liga', 'premier-league': 'Premier League', 'serie-a': 'Serie A', bundesliga: 'Bundesliga', 'ligue-1': 'Ligue 1' };
const RANK = () => {
  const E = DB.elo || {};
  return (DB.fifa || [])
    .filter((i) => E[i])
    .map((i) => [DB.nt[i], E[i]])
    .sort((a, b) => b[1] - a[1]);
};
let RK = null;
function rankOf(name) {
  RK = RK || RANK();
  const i = RK.findIndex((x) => x[0] === name);
  return i < 0 ? null : { rank: i + 1, elo: RK[i][1], of: RK.length };
}
function ranking(n = 20) {
  RK = RK || RANK();
  return RK.slice(0, n);
}

function teamInfo(name, kind, n = 10) {
  const G = gamesOf(name, kind);
  if (!G.length) return null;
  const last = G.slice(-n).reverse();
  const avg = (f) => last.reduce((a, g) => a + f(g), 0) / last.length;
  const scorers = kind === 'nt' ? ((DB.sc || {})[DB.nt.indexOf(name)] || []) : [];
  return {
    name,
    kind,
    last,
    form: last.slice(0, 6).map((g) => g.r).join(''),
    w: last.filter((g) => g.r === 'W').length,
    dr: last.filter((g) => g.r === 'D').length,
    l: last.filter((g) => g.r === 'L').length,
    gf: avg((g) => g.gf),
    ga: avg((g) => g.ga),
    o25: avg((g) => (g.gf + g.ga > 2.5 ? 1 : 0)),
    u35: avg((g) => (g.gf + g.ga < 3.5 ? 1 : 0)),
    scored: avg((g) => (g.gf > 0 ? 1 : 0)),
    cs: avg((g) => (g.ga === 0 ? 1 : 0)),
    y: kind === 'cl' ? avg((g) => g.y) : null,
    yt: kind === 'cl' ? avg((g) => g.y + g.yo) : null,
    scorers,
    rank: kind === 'nt' ? rankOf(name) : null,
    upd: kind === 'cl' ? '20' + DB.cupd.slice(0, 2) + '-' + DB.cupd.slice(2, 4) : DB.upd,
  };
}

function h2h(a, b, kind, n = 8) {
  const G = gamesOf(a, kind).filter((g) => g.opp === b);
  const last = G.slice(-n).reverse();
  return { list: last, w: G.filter((g) => g.r === 'W').length, d: G.filter((g) => g.r === 'D').length, l: G.filter((g) => g.r === 'L').length, all: G.length };
}

// 1win words, explained simply
const GLOSSARY = [
  [/\bw1\b|\bp1\b|^1$/, 'W1', 'The home team (first team) wins.'],
  [/\bw2\b|\bp2\b|^2$/, 'W2', 'The away team (second team) wins.'],
  [/^x$|\bdraw\b|empate/, 'X', 'The game ends in a draw.'],
  [/\b1x\b/, '1X', 'Home team wins OR draw. You only lose if the away team wins.'],
  [/\bx2\b/, 'X2', 'Away team wins OR draw. You only lose if the home team wins.'],
  [/\b12\b/, '12', 'Any team wins – you lose only on a draw.'],
  [/total over|\bover\b|\bmas de\b|\bmas\b/, 'Total Over 2.5', 'At least 3 goals in the game (Over 1.5 = at least 2, Over 3.5 = at least 4).'],
  [/total under|\bunder\b|\bmenos\b/, 'Total Under 2.5', '2 goals or fewer in the game (Under 3.5 = 3 or fewer).'],
  [/team total|individual total|total individual|over 0\.5/, 'Team Total Over 0.5', 'That team scores at least 1 goal.'],
  [/yellow|card|tarjeta|amarilla/, 'Yellow cards Total Over 3.5', 'At least 4 yellow cards in the game (both teams together).'],
  [/cash ?out|cobrar|retirar/, 'Cash-out', '1win offers you money before the ticket ends. Take it only if it is more than what the ticket is worth now (the app tells you).'],
  [/express|combo|parlay|combinada|acumulada/, 'Express (combo)', 'Many bets on one ticket. All must win. The odds multiply.'],
  [/\bodds\b|cuota/, 'Odds', 'How much you get back for each 1 you bet. 2.00 → bet 1,000, get 2,000.'],
];
function glossary(q) {
  const x = norm(q).replace(/^(what is|what does|que es|que significa|qué es)\s+/, '').replace(/\s*(mean|means)\s*$/, '');
  return GLOSSARY.filter(([re]) => re.test(x)).map(([, t, d]) => ({ t, d }));
}

export { findTeams, findScorer, teamInfo, h2h, ranking, rankOf, glossary, GLOSSARY, norm };
export const DBINFO = { nt: DB.nt.length, games: (DB.g.match(/;/g) || []).length + 1, clubs: DB.cl.length, upd: DB.upd };
