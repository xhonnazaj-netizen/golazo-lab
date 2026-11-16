// Team strength: Elo + attack/defence form, blended 70/30 with penaltyblog Dixon-Coles ratings (ratings.json).
import RATINGS from '../data/elo-data.js';
const ELO0 = RATINGS.elo;
let DC = RATINGS.dc;
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

// Load the nightly ratings.json (only when served over http(s), e.g. GitHub Pages).
async function loadRatings() {
  try {
    if (!/^https?:/.test(location.protocol)) return false;
    const r = await fetch("./ratings.json", { cache: "no-cache" });
    if (!r.ok) return false;
    const j = await r.json();
    if (j.dc && j.dc.teams) DC = j.dc;
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

export { eloOf, eloKey, formX, eloLam, dcLam, eloK, updateElo, loadRatings };
