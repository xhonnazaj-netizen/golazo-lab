// Team strength: Elo + attack/defence form, blended 70/30 with penaltyblog Dixon-Coles ratings (ratings.json).
import RATINGS from '../data/elo-data.js';
const ELO0 = RATINGS.elo;
let DC = RATINGS.dc;
let CLUBS = RATINGS.clubs;
import { LS } from '../util/storage.js';
import { clamp } from './math.js';

let ELO = (() => {
  const s = LS.get("mb_elo2", null);
  return s && s.upto > ELO0.upto ? Object.assign({}, ELO0, s) : ELO0;
})();

const EALIAS = {
  "bosnia-herzegovina": "Bosnia and Herzegovina",
  turkiye: "Turkey",
  czechia: "Czech Republic",
  usa: "United States",
  "united states": "United States",
  "korea republic": "South Korea",
  "south korea": "South Korea",
  "ir iran": "Iran",
  "republic of ireland": "Republic of Ireland",
  "cote d'ivoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  "cape verde islands": "Cape Verde",
  "china pr": "China PR",
  "dr congo": "DR Congo",
  "congo dr": "DR Congo",
  "north korea": "North Korea",
  curacao: "Curaçao",
  "kyrgyz republic": "Kyrgyzstan",
  "chinese taipei": "Taiwan",
  "st. kitts and nevis": "Saint Kitts and Nevis",
  "st. lucia": "Saint Lucia",
  "st. vincent and the grenadines": "Saint Vincent and the Grenadines",
  "the gambia": "Gambia",
  gambia: "Gambia",
  eswatini: "Eswatini",
};

const enorm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const EIDX = {};

function eloIdx() {
  for (const k in EIDX) delete EIDX[k];
  Object.keys(ELO.r).forEach((k) => (EIDX[enorm(k)] = k));
}
eloIdx();

function eloOf(name) {
  const n = enorm(name);
  const k = EALIAS[n] || EIDX[n];
  return k != null && ELO.r[k] != null ? ELO.r[k] : null;
}

function eloKey(name) {
  const n = enorm(name);
  return EALIAS[n] || EIDX[n] || null;
}

function formX(k) {
  const f = (ELO.f || {})[k];
  if (!f) return [1, 1];
  const kp = ELO.kp || 25;
  return [(f[0] + kp) / (f[1] + kp), (f[2] + kp) / (f[3] + kp)];
}

function dcLam(m) {
  // penaltyblog Dixon-Coles: lambda = exp(home advantage + attack + opponent defence)
  if (!DC || !DC.teams) return null;
  const h = DC.teams[eloKey(m.h)], a = DC.teams[eloKey(m.a)];
  if (!h || !a) return null;
  const ha = m.neu ? 0 : DC.home_advantage;
  return [Math.exp(ha + h[0] + a[1]), Math.exp(a[0] + h[1])];
}

function eloLam(m) {
  const rh = eloOf(m.h),
    ra = eloOf(m.a);
  if (rh == null || ra == null) return null;
  const dr = rh - ra + (m.neu ? 0 : 100);
  const [ah, dh] = formX(eloKey(m.h)),
    [aa, da] = formX(eloKey(m.a));
  let lh = Math.exp(ELO.a + ELO.b * dr) * ah * da,
    la = Math.exp(ELO.a - ELO.b * dr) * aa * dh;
  // blend 70/30 with the Dixon-Coles model (back-test: avg Brier 0.19023 -> 0.18944)
  const d = dcLam(m);
  if (d) {
    const w = DC.weight ?? 0.3;
    lh = Math.exp((1 - w) * Math.log(lh) + w * Math.log(d[0]));
    la = Math.exp((1 - w) * Math.log(la) + w * Math.log(d[1]));
  }
  return [clamp(lh, 0.15, 4.5), clamp(la, 0.12, 4)];
}


// ---- clubs (5 big leagues): Elo + form fitted on 19,760 league games; tested 7% better than league averages ----
const CALIAS = {
  "manchester city": "Man City", "manchester united": "Man United", "nottingham forest": "Nott'm Forest", "wolverhampton wanderers": "Wolves",
  "tottenham hotspur": "Tottenham", "brighton & hove albion": "Brighton", "brighton and hove albion": "Brighton", "newcastle united": "Newcastle",
  "west ham united": "West Ham", "leeds united": "Leeds", "afc bournemouth": "Bournemouth", "athletic club": "Ath Bilbao", "athletic bilbao": "Ath Bilbao",
  "atletico madrid": "Ath Madrid", "atletico de madrid": "Ath Madrid", "real betis": "Betis", "celta vigo": "Celta", "rc celta": "Celta", "espanyol": "Espanol",
  "rcd espanyol": "Espanol", "real oviedo": "Oviedo", "rayo vallecano": "Vallecano", "real sociedad": "Sociedad", "deportivo alaves": "Alaves", "rcd mallorca": "Mallorca",
  "ac milan": "Milan", "as roma": "Roma", "hellas verona": "Verona", "internazionale": "Inter", "inter milan": "Inter", "ssc napoli": "Napoli", "bayer leverkusen": "Leverkusen",
  "borussia dortmund": "Dortmund", "borussia monchengladbach": "M'gladbach", "eintracht frankfurt": "Ein Frankfurt", "fc augsburg": "Augsburg", "1. fc koln": "FC Koln",
  "fc cologne": "FC Koln", "hamburg sv": "Hamburg", "hamburger sv": "Hamburg", "1. fc heidenheim 1846": "Heidenheim", "1. fc union berlin": "Union Berlin",
  "sc freiburg": "Freiburg", "st. pauli": "St Pauli", "fc st. pauli": "St Pauli", "tsg hoffenheim": "Hoffenheim", "vfb stuttgart": "Stuttgart", "vfl wolfsburg": "Wolfsburg",
  "mainz 05": "Mainz", "1. fsv mainz 05": "Mainz", "fsv mainz 05": "Mainz", "sv werder bremen": "Werder Bremen", "aj auxerre": "Auxerre", "as monaco": "Monaco",
  "stade brestois 29": "Brest", "le havre ac": "Le Havre", "rc lens": "Lens", "olympique lyonnais": "Lyon", "olympique de marseille": "Marseille", "ogc nice": "Nice",
  "paris saint-germain": "Paris SG", "stade rennais": "Rennes", "rc strasbourg": "Strasbourg", "rc strasbourg alsace": "Strasbourg", "fc nantes": "Nantes", "losc lille": "Lille",
  "fc lorient": "Lorient", "fc metz": "Metz", "angers sco": "Angers", "toulouse fc": "Toulouse",
};
function clubKey(lg, name) {
  const T = CLUBS && CLUBS.teams && CLUBS.teams[lg];
  if (!T) return null;
  const n = enorm(name);
  // leagues trained on ESPN names: exact names only (never mix up "Universidad de Chile" and "Universidad Católica")
  if ((CLUBS.exact || []).includes(lg)) {
    for (const k of Object.keys(T)) if (enorm(k) === n) return k;
    return null;
  }
  if (CALIAS[n] && T[CALIAS[n]]) return CALIAS[n];
  const strip = (s) => enorm(s).replace(/\b(fc|afc|cf|ac|as|sc|ssc|sv|vfb|vfl|tsg|rc|ogc|aj|1\.|club|de|calcio)\b/g, "").replace(/[^a-z ]/g, "").trim();
  const sn = strip(name);
  for (const k of Object.keys(T)) if (strip(k) === sn) return k;
  for (const k of Object.keys(T)) if (sn && (strip(k).startsWith(sn.split(" ")[0]) || sn.startsWith(strip(k).split(" ")[0]))) return k;
  return null;
}
function clubLam(m) {
  const kh = clubKey(m.lg, m.h), ka = clubKey(m.lg, m.a);
  if (!kh || !ka) return null;
  const T = CLUBS.teams[m.lg], mu = CLUBS.lgm[m.lg], kp = CLUBS.kp || 25;
  const [rh, fh] = T[kh], [ra, fa] = T[ka];
  const x = (f, i, j) => (f[i] + kp) / (f[j] + kp);
  const dr = rh - ra,
    b = (CLUBS.bLg && CLUBS.bLg[m.lg]) || CLUBS.b;
  return [clamp(mu[0] * Math.exp(b * dr) * x(fh, 0, 1) * x(fa, 2, 3), 0.2, 4.2), clamp(mu[1] * Math.exp(-b * dr) * x(fa, 0, 1) * x(fh, 2, 3), 0.15, 3.8)];
}
// yellow cards expected per team, from each club's card history (league average for national teams)
function cardsOf(m) {
  const T = CLUBS && CLUBS.teams && CLUBS.teams[m.lg];
  if (!T) return null;
  const kh = clubKey(m.lg, m.h), ka = clubKey(m.lg, m.a), avg = (CLUBS.ylg || {})[m.lg];
  if (!avg) return null;
  return [avg * ((kh && T[kh][2]) || 1), avg * ((ka && T[ka][2]) || 1)];
}

// Load the nightly ratings.json (only when served over http(s), e.g. GitHub Pages).
async function loadRatings() {
  try {
    if (!/^https?:/.test(location.protocol)) return false;
    const r = await fetch("./ratings.json", { cache: "no-cache" });
    if (!r.ok) return false;
    const j = await r.json();
    if (j.dc && j.dc.teams) DC = j.dc;
    if (j.clubs && j.clubs.teams) CLUBS = j.clubs;
    if (j.elo && j.elo.upto >= ELO.upto) {
      ELO = Object.assign({}, ELO, j.elo);
      eloIdx();
    }
    return true;
  } catch (e) {
    return false;
  }
}

function eloK(t) {
  t = t.toLowerCase();
  if (t === "fifa world cup") return 60;
  if (/euro|copa am|african cup of nations|asian cup|gold cup/.test(t) && !/qualif/.test(t)) return 50;
  if (/qualif|nations league/.test(t)) return 40;
  if (t === "friendly") return 20;
  return 30;
}

async function updateElo() {
  const st = LS.get("mb_elo2_t", 0);
  if (Date.now() - st < 7 * 864e5) return;
  LS.set("mb_elo2_t", Date.now());
  try {
    const r = await fetch("https://raw.githubusercontent.com/martj42/international_results/master/results.csv");
    if (!r.ok) return;
    const txt = await r.text();
    const R = Object.assign({}, ELO.r);
    const F = JSON.parse(JSON.stringify(ELO.f || {}));
    const DEC = ELO.dec || 0.9;
    let upto = ELO.upto,
      n = 0;
    txt.split("\n").forEach((line) => {
      const c = line.split(",");
      if (c.length < 9 || c[0] <= ELO.upto || c[0] === "date") return;
      const hs = +c[3],
        as = +c[4];
      if (c[3] === "" || isNaN(hs) || isNaN(as)) return;
      const h = c[1],
        a = c[2];
      R[h] = R[h] ?? 1500;
      R[a] = R[a] ?? 1500;
      const dr = R[h] - R[a] + (c[8].trim() === "TRUE" ? 0 : 100),
        lh0 = Math.exp(ELO.a + ELO.b * dr),
        la0 = Math.exp(ELO.a - ELO.b * dr);
      [
        [h, hs, lh0, as, la0],
        [a, as, la0, hs, lh0],
      ].forEach(([tm, gf, xf, ga, xa]) => {
        const f = F[tm] || (F[tm] = [0, 0, 0, 0]);
        f[0] = f[0] * DEC + gf;
        f[1] = f[1] * DEC + xf;
        f[2] = f[2] * DEC + ga;
        f[3] = f[3] * DEC + xa;
      });
      const We = 1 / (Math.pow(10, -dr / 400) + 1),
        W = hs > as ? 1 : hs === as ? 0.5 : 0,
        gd = Math.abs(hs - as),
        G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8,
        d = eloK(c[5]) * G * (W - We);
      R[h] = Math.round((R[h] + d) * 10) / 10;
      R[a] = Math.round((R[a] - d) * 10) / 10;
      if (c[0] > upto) upto = c[0];
      n++;
    });
    if (n) {
      ELO = Object.assign({}, ELO, { r: R, f: F, upto });
      LS.set("mb_elo2", { r: R, f: F, upto });
      eloIdx();
    }
  } catch (e) {}
}

// ---- this season, replayed in the browser every day from ESPN results (clubs + national teams) ----
// Same update rules as the trained models, so the ratings stay current between nightly trainings.
function applyClubSeason(lg, games) {
  const T = CLUBS && CLUBS.teams && CLUBS.teams[lg];
  const mu = CLUBS && CLUBS.lgm && CLUBS.lgm[lg];
  if (!T || !mu || !games.length) return 0;
  const b = (CLUBS.bLg && CLUBS.bLg[lg]) || CLUBS.b || 0.002,
    kp = CLUBS.kp || 25,
    K = (CLUBS.kLg && CLUBS.kLg[lg]) || 15,
    DEC = 0.9;
  const upto = clubUpto(lg);
  const games0 = games.filter((g) => g.d > upto);
  if (!games0.length) return 0;
  // a new season since the snapshot: every rating moves 20% back towards average (as in training)
  const cal = (CLUBS.cal || []).includes(lg);
  const seasonOf = (d) => (cal ? +d.slice(0, 4) : +d.slice(5, 7) >= 7 ? +d.slice(0, 4) : +d.slice(0, 4) - 1);
  if (!CLUBS._reg) CLUBS._reg = {};
  if (!CLUBS._reg[lg] && seasonOf(games0[0].d) > seasonOf(upto)) {
    Object.values(T).forEach((v) => (v[0] = v[0] * 0.8 + 1500 * 0.2));
    CLUBS._reg[lg] = 1;
  }
  const key = (name) => {
    const k = clubKey(lg, name);
    if (k) return k;
    T[name] = [1450, [0, 0, 0, 0], 1]; // promoted team: starts below average
    return name;
  };
  const ylg = (CLUBS.ylg || {})[lg] || 2;
  let n = 0;
  games.forEach((g) => {
    if (g.d <= upto) return;
    const h = key(g.h), a = key(g.a);
    const H = T[h], A = T[a];
    const dr = H[0] - A[0];
    const lh0 = mu[0] * Math.exp(b * dr), la0 = mu[1] * Math.exp(-b * dr);
    const W = g.hs > g.as ? 1 : g.hs === g.as ? 0.5 : 0, We = 1 / (Math.pow(10, -(dr + 60) / 400) + 1);
    const gd = Math.abs(g.hs - g.as), G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const d = K * G * (W - We);
    H[0] += d;
    A[0] -= d;
    [[H, g.hs, lh0, g.as, la0], [A, g.as, la0, g.hs, lh0]].forEach(([v, gf, xf, ga, xa]) => {
      const f = v[1];
      f[0] = f[0] * DEC + gf; f[1] = f[1] * DEC + xf; f[2] = f[2] * DEC + ga; f[3] = f[3] * DEC + xa;
    });
    if (g.yh != null) { H[2] = (H[2] ?? 1) * 0.95 + (g.yh / ylg) * 0.05; A[2] = (A[2] ?? 1) * 0.95 + (g.ya / ylg) * 0.05; }
    n++;
  });
  void kp;
  return n;
}
function applyNationalGames(games) {
  // in memory only: the weekly results.csv refresh stays the source of truth
  const R = Object.assign({}, ELO.r), F = JSON.parse(JSON.stringify(ELO.f || {})), DEC = ELO.dec || 0.9;
  let n = 0, upto = ELO.upto;
  games.forEach((g) => {
    if (g.d <= ELO.upto) return;
    const h = eloKey(g.h) || g.h, a = eloKey(g.a) || g.a;
    R[h] = R[h] ?? 1500; R[a] = R[a] ?? 1500;
    const dr = R[h] - R[a] + (g.neu ? 0 : 100), lh0 = Math.exp(ELO.a + ELO.b * dr), la0 = Math.exp(ELO.a - ELO.b * dr);
    [[h, g.hs, lh0, g.as, la0], [a, g.as, la0, g.hs, lh0]].forEach(([tm, gf, xf, ga, xa]) => {
      const f = F[tm] || (F[tm] = [0, 0, 0, 0]);
      f[0] = f[0] * DEC + gf; f[1] = f[1] * DEC + xf; f[2] = f[2] * DEC + ga; f[3] = f[3] * DEC + xa;
    });
    const We = 1 / (Math.pow(10, -dr / 400) + 1), W = g.hs > g.as ? 1 : g.hs === g.as ? 0.5 : 0, gd = Math.abs(g.hs - g.as);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8, d = eloK(g.t || "") * G * (W - We);
    R[h] += d; R[a] -= d;
    if (g.d > upto) upto = g.d;
    n++;
  });
  if (n) { ELO = Object.assign({}, ELO, { r: R, f: F, upto }); eloIdx(); }
  return n;
}
// a club's rating + form for the "why" panel
function clubRating(lg, name) {
  const T = CLUBS && CLUBS.teams && CLUBS.teams[lg];
  const k = clubKey(lg, name);
  if (!T || !k) return null;
  const [r, f, y] = T[k];
  const kp = CLUBS.kp || 25;
  return { r, att: (f[0] + kp) / (f[1] + kp), def: (f[2] + kp) / (f[3] + kp), y: y ?? 1 };
}
const clubUpto = (lg) => (CLUBS && CLUBS.uptoLg && CLUBS.uptoLg[lg]) || (CLUBS && CLUBS.upto);
const clubTest = (lg) => (CLUBS && CLUBS.test && CLUBS.test[lg]) || null;
const ratingsInfo = () => ({ nat: ELO.upto, club: CLUBS && CLUBS.upto });

export { clubUpto, clubTest, clubRating, applyClubSeason, applyNationalGames, ratingsInfo, eloOf, eloKey, formX, eloLam, dcLam, clubKey, clubLam, cardsOf, eloK, updateElo, loadRatings };
