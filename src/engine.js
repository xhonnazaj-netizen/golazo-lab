import DATA from './data/match-data.js';
// personal tickets live in a git-ignored file; the public build simply has none
const PERSONAL = Object.values(import.meta.glob('./data/personal.local.js', { eager: true }))[0];
if (PERSONAL && PERSONAL.default && PERSONAL.default.T) DATA.T = PERSONAL.default.T;
import { COMBO_REC } from './data/combo-record.js';
import SUG_SEED from './data/sug-seed.js';
import { loadWeek, teamWeek, keyPlayers, signings, cardMen, week as weekData } from './model/week.js';
import { teamInfo as tdbInfo, h2h as tdbH2H, rankOf as tdbRank } from './model/teamdb.js';
import { LS } from './util/storage.js';
import { BASE, W, J, lim } from './data/provider.js';
import { rnd, pois, gam, bs, pp, gridOf, pdev, priorFrom, clamp } from './model/math.js';
import { eloOf, eloKey, formX, eloLam, clubLam, clubKey, clubRating, clubUpto, clubTest, leagueTrust, cardsOf, updateElo, loadRatings, applyClubSeason, applyNationalGames, ratingsInfo } from './model/ratings.js';
import { markets, marketsShown, shown, predictability, nice } from './model/markets.js';
/* Golazo Lab engine: data, models, live polling, tickets. UI lives in React components. */
const UI = { status: "Connecting…", ok: true, toasts: [], goal: null };
let __v = 0,
  __t = null;
const subs = new Set();
export function subscribe(f) {
  subs.add(f);
  return () => subs.delete(f);
}
export const getVersion = () => __v;
function emit() {
  if (__t) return;
  __t = setTimeout(() => {
    __t = null;
    __v++;
    subs.forEach((f) => f());
  }, 30);
}
const drawAll = emit;
let NOTIF = false;
function alertMsg(kind, msg) {
  const a = {
    id: Math.random().toString(36).slice(2),
    kind,
    msg,
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  ALERTS.unshift(a);
  ALERTS.length = Math.min(ALERTS.length, 30);
  UI.toasts = [a, ...UI.toasts].slice(0, 3);
  setTimeout(() => {
    UI.toasts = UI.toasts.filter((x) => x.id !== a.id);
    emit();
  }, 8000);
  if (SOUND) beep(kind === "good" ? [660, 880] : kind === "bad" ? [440, 330] : [600, 600]);
  if (NOTIF && document.hidden && kind !== "info") {
    try {
      new Notification("Golazo Lab", { body: msg });
    } catch (e) {}
  }
  emit();
}
function flashGoal(e) {
  UI.goal = { t: Date.now(), e };
  const lu = LU[SEL];
  if (e && lu) {
    const nm = (e.pl || [])[0];
    const p = [...lu.h.players, ...lu.a.players].find((x) => x.name === nm);
    FLASH = p ? p.id : null;
    setTimeout(() => {
      FLASH = null;
      emit();
    }, 6000);
  }
  if (SOUND) beep([523, 659, 784, 1047]);
  emit();
}
let ODDS_KEY = (() => {
  try {
    return localStorage.getItem("mb_okey") || "";
  } catch (e) {
    return "";
  }
})();
const LEAGUES = [
  ["uefa.nations", "Nations League"],
  ["eng.1", "Premier League"],
  ["esp.1", "LaLiga"],
  ["ita.1", "Serie A"],
  ["ger.1", "Bundesliga"],
  ["fra.1", "Ligue 1"],
  ["uefa.champions", "Champions League"],
  ["uefa.europa", "Europa League"],
  ["chi.1", "Chile – Primera"],
  ["bra.1", "Brazil – Série A"],
  ["arg.1", "Argentina – Liga Profesional"],
  ["mex.1", "Mexico – Liga MX"],
  ["usa.1", "USA – MLS"],
  ["col.1", "Colombia – Liga BetPlay"],
  ["eng.2", "England – Championship"],
  ["ned.1", "Netherlands – Eredivisie"],
  ["por.1", "Portugal – Primeira Liga"],
  ["bel.1", "Belgium – Pro League"],
  ["tur.1", "Turkey – Süper Lig"],
  ["sco.1", "Scotland – Premiership"],
];
// which model a competition uses: club leagues -> club ratings, everything else -> national-team ratings
const CLUB_LEAGUES = new Set(["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "chi.1", "bra.1", "arg.1", "mex.1", "usa.1", "col.1", "eng.2", "ned.1", "por.1", "bel.1", "tur.1", "sco.1", "uefa.champions", "uefa.europa"]);
const ownLam = (m) => (CLUB_LEAGUES.has(m.lg) ? clubLam(m) : eloLam(m));
const OKEY = {
  "uefa.nations": "soccer_uefa_nations_league",
  "eng.1": "soccer_epl",
  "esp.1": "soccer_spain_la_liga",
  "ita.1": "soccer_italy_serie_a",
  "ger.1": "soccer_germany_bundesliga",
  "fra.1": "soccer_france_ligue_one",
  "uefa.champions": "soccer_uefa_champs_league",
  "uefa.europa": "soccer_uefa_europa_league",
  "chi.1": "soccer_chile_campeonato",
  "bra.1": "soccer_brazil_campeonato",
  "arg.1": "soccer_argentina_primera_division",
  "mex.1": "soccer_mexico_ligamx",
  "usa.1": "soccer_usa_mls",
  "eng.2": "soccer_efl_champ",
  "ned.1": "soccer_netherlands_eredivisie",
  "por.1": "soccer_portugal_primeira_liga",
  "bel.1": "soccer_belgium_first_div",
  "tur.1": "soccer_turkey_super_league",
  "sco.1": "soccer_spl",
};
const CDF = DATA.cdf,
  PREV = DATA.prev,
  XGB = DATA.xgb,
  TXG = DATA.txg;
const byE = {};
DATA.M.forEach((m) => {
  m.lg = "uefa.nations";
  m.enh = 1;
  // our own model only: the bookmaker's prices are kept for comparison, never mixed in
  const own = eloLam(m) || m.lamModel;
  if (own) {
    m.lam = own.slice();
    m.lamModel = own.slice();
    m.g = gridOf(own[0], own[1]);
    m.src = "our team ratings";
  }
  byE[m.eid] = m;
});
const ST = {};
const S = (eid) =>
  ST[eid] ||
  (ST[eid] = {
    state: "pre",
    min: 0,
    h: 0,
    a: 0,
    rh: 0,
    ra: 0,
    ch: 0,
    ca: 0,
    yh: 0,
    ya: 0,
    oh: 0,
    oa: 0,
    ev: [],
    shots: [],
    corn: [],
    xh: 0,
    xa: 0,
    date: null,
    clock: "",
    goals: -1,
  });
const BOARD = {};
BOARD["uefa.nations|20261116"] = DATA.M.map((m) => m.eid);
let CUR = { lg: "uefa.nations", date: "20261116" };
let SEL = DATA.M.find((m) => m.hA === "GER").eid,
  STAKE = 5000,
  SOUND = false,
  VIEW = "players";
let BANK = LS.get("mb_bank", 100000);
function xgOf(z, f) {
  const x = [0, 0, 0, 0, 0, 0, 0, 0, f[0], 0, f[2], f[3], f[4], f[5]];
  x[z] = 1;
  let e = 0;
  for (let k = 0; k < 14; k++) e += XGB[k] * x[k];
  return 1 / (1 + Math.exp(-e));
}
function remFrac(s) {
  if (s.state === "post") return 0;
  if (s.state !== "in") return 1;
  const m = s.min;
  if (m >= 90) return 0.03;
  if (m <= 0) return 1;
  return Math.max(0.03, 1 - CDF[Math.min(89, m - 1)]);
}
function lamsNow(m, s) {
  // live: our own in-play model only (live bookmaker prices are compared, not mixed in)
  return lamsModel(m, s);
}
function lamsModel(m, s) {
  const r = remFrac(s);
  let lh = m.lam[0],
    la = m.lam[1];
  if (s.state === "in") {
    const fr = 1 - r,
      w = 0.15;
    lh = (1 - w * fr) * lh + w * s.xh;
    la = (1 - w * fr) * la + w * s.xa;
  }
  lh *= r;
  la *= r;
  if (s.state === "in") {
    // score-state effect, measured on 19,760 league games (2nd-half goals vs expected): level x0.97, trailing by 1 x1.07, leading by 1 x0.955, 2+ either way ~x1.04-1.06
    const d = s.h - s.a,
      k = Math.min(2, Math.abs(d)),
      TR = [0.972, 1.066, 1.058],
      LD = [0.972, 0.955, 1.036];
    if (d < 0) {
      lh *= TR[k];
      la *= LD[k];
    } else if (d > 0) {
      la *= TR[k];
      lh *= LD[k];
    } else {
      lh *= TR[0];
      la *= TR[0];
    }
    // red cards: team down to 10 scores x0.75, opponent x1.35 (measured x0.75 / x1.36)
    lh *= Math.pow(0.75, s.rh) * Math.pow(1.35, s.ra);
    la *= Math.pow(0.75, s.ra) * Math.pow(1.35, s.rh);
    // momentum: who created more in the last 15 minutes tilts the rest of the game a little (max +-10%)
    const mo = momentum(s);
    if (mo) {
      lh *= 0.9 + 0.2 * mo.share;
      la *= 0.9 + 0.2 * (1 - mo.share);
    }
  }
  return [lh, la, r];
}
function momentum(s) {
  if (!s || s.state !== "in" || !s.shots) return null;
  const t = s.min || 0;
  const o = [0, 0];
  s.shots.forEach((x) => {
    if (x.mi <= t && x.mi > t - 15) o[x.side] += x.xg;
  });
  (s.corn || []).forEach((c) => {
    if (c[0] <= t && c[0] > t - 15) o[c[1]] += 0.03;
  });
  const T = o[0] + o[1];
  if (T < 0.25) return null;
  return { share: o[0] / T, h: o[0], a: o[1] };
}
// ---- live advisor: reads the game and picks the best live bets with a reason ----
function liveAdvice(eid) {
  const m = byE[eid],
    s = S(eid);
  if (!m || s.state !== "in") return null;
  const R = simOf(eid),
    L = markets(m),
    P = (n) => {
      const x = L.find((k) => k.n === n);
      return x ? frac(R, x.f) : null;
    };
  const mo = momentum(s),
    t = s.h + s.a,
    lines = [];
  const lead = s.h > s.a ? m.h : s.a > s.h ? m.a : null;
  lines.push(lead ? `${lead} lead ${Math.max(s.h, s.a)}-${Math.min(s.h, s.a)} at ${s.clock}` : `Level ${s.h}-${s.a} at ${s.clock}`);
  if (mo) {
    const top = mo.share > 0.62 ? m.h : mo.share < 0.38 ? m.a : null;
    lines.push(top ? `${top} on top in the last 15 min` : `Even game in the last 15 min`);
  } else lines.push("Quiet spell – few chances in the last 15 min");
  if (s.rh || s.ra) lines.push(`Red card: ${s.rh ? m.h : m.a} down to 10`);
  const more = R.lh + R.la;
  lines.push(more < 0.45 ? "Probably no more goals" : more < 1.1 ? "We expect about 1 more goal" : "More goals likely");
  const cands = [];
  const add = (n, why) => {
    const p = P(n);
    if (p != null && p >= 0.55 && p <= 0.93 && shown(n)) cands.push({ eid, n, p, min: 1.05 / p, why, need: needInfo(eid, n) });
  };
  add(`Over ${t + 0.5}`, mo && mo.h + mo.a > 0.8 ? "both sides creating chances" : "goals still expected");
  add(`Under ${t + 1.5}`, !mo ? "slow game, few chances" : "game under control");
  add(`Under ${t + 2.5}`, "two more goals unlikely");
  const yc = (s.yh || 0) + (s.ya || 0);
  add(`Over ${yc + 0.5} yellows`, s.min > 55 && Math.abs(s.h - s.a) <= 1 ? "tight game, cards come late" : "");
  add(`Under ${yc + 2.5} yellows`, s.min > 70 ? "little time left for cards" : "");
  if (lead) {
    add(`${lead} win`, `${lead} ahead`);
    add(`${lead} or draw`, `${lead} ahead, safer`);
  } else {
    add(`${m.h} or draw`, "level game");
    add(`${m.a} or draw`, "level game");
  }
  if (s.h === 0) add(`${m.h} over 0.5`, mo && mo.share > 0.55 ? `${m.h} pushing` : "");
  if (s.a === 0) add(`${m.a} over 0.5`, mo && mo.share < 0.45 ? `${m.a} pushing` : "");
  // rank: prefer bets in the 65-85% band and ones backed by what is happening (a reason)
  cands.forEach((c) => {
    c.score = -Math.abs(c.p - 0.75) + (c.why ? 0.08 : 0) + (predictability(c.n) - 2) * 0.03;
  });
  const seen = new Set();
  const picks = cands
    .sort((a, b) => b.score - a.score)
    .filter((c) => !seen.has(c.n) && seen.add(c.n))
    .slice(0, 3);
  return { lines, picks, mo };
}
const LIVEIDEA = {};
function liveIdeas() {
  Object.keys(ST).forEach((eid) => {
    const s = ST[eid];
    if (s.state !== "in" || !byE[eid]) return;
    if (!(inTickets(eid) || eid === SEL || (DAY && dayGames(DAY).some((g) => g.eid === eid)))) return;
    const a = liveAdvice(eid);
    if (!a || !a.picks.length) return;
    const b = a.picks[0];
    if (!b.why) return;
    const k = eid + "|" + b.n,
      last = LIVEIDEA[eid];
    if (last && (last.k === k || Date.now() - last.t < 10 * 60000)) return;
    LIVEIDEA[eid] = { k, t: Date.now() };
    const m = byE[eid];
    alertMsg(
      "info",
      "💡 Live idea " +
        m.hA +
        "–" +
        m.aA +
        ": " +
        nice(b.n) +
        " " +
        pct(b.p) +
        " – " +
        b.why +
        ". Bet if " + BOOK + " pays " +
        b.min.toFixed(2) +
        "+",
    );
  });
}
function remC(s, cdf) {
  if (s.state === "post") return 0;
  if (s.state !== "in") return 1;
  const m = s.min;
  if (m >= 90) return 0.02;
  if (m <= 0) return 1;
  return Math.max(0.02, 1 - cdf[Math.min(89, m - 1)]);
}
const SIMS = {};
function simulate(eid, N) {
  const m = byE[eid],
    s = S(eid);
  const pre = s.state === "pre";
  const [lh, la, r] = lamsNow(m, s);
  let gc = null;
  if (pre) {
    gc = [];
    let a = 0;
    const t = m.g.reduce((x, y) => x + y, 0);
    m.g.forEach((v) => {
      a += v / t;
      gc.push(a);
    });
  }
  const H1F = pre ? 0.441 : s.min < 45 ? Math.max(0, (45 - s.min) / (95 - s.min)) : 0;
  const R = {
    N,
    H1H: new Int16Array(N),
    H1A: new Int16Array(N),
    H1OK: pre || s.min < 45,
    GH: new Int16Array(N),
    GA: new Int16Array(N),
    CH: new Int16Array(N),
    CA: new Int16Array(N),
    Y: new Int16Array(N),
    RD: new Int16Array(N),
    O: new Int16Array(N),
    NG: new Int8Array(N),
    lh,
    la,
  };
  for (let n = 0; n < N; n++) {
    let gh, ga, nh, na;
    if (pre) {
      const c = bs(gc, rnd());
      gh = Math.floor(c / 9);
      ga = c % 9;
      nh = gh;
      na = ga;
    } else {
      nh = pois(lh);
      na = pois(la);
      gh = s.h + nh;
      ga = s.a + na;
    }
    R.GH[n] = gh;
    R.GA[n] = ga;
    {
      const bh = pre ? gh : nh,
        ba = pre ? ga : na;
      let x = 0,
        y = 0;
      for (let k = 0; k < bh; k++) if (rnd() < H1F) x++;
      for (let k = 0; k < ba; k++) if (rnd() < H1F) y++;
      R.H1H[n] = (pre ? 0 : s.h) + x;
      R.H1A[n] = (pre ? 0 : s.a) + y;
    }
    R.NG[n] = nh + na === 0 ? 0 : rnd() < nh / (nh + na) ? 1 : 2;
    const rc = remC(s, DATA.ccdf),
      ry = remC(s, DATA.ycdf),
      d0 = s.h - s.a;
    const kc = (m.c[0] + m.c[1]) / 0.2,
      G = rc > 0 ? gam(kc) / kc : 1;
    let fh, fa;
    if (pre) {
      fh = Math.min(1.25, Math.max(0.8, 1 + 0.05 * (ga - gh)));
      fa = Math.min(1.25, Math.max(0.8, 1 + 0.05 * (gh - ga)));
    } else {
      fh = d0 < 0 ? 1.14 : d0 > 0 ? 0.83 : 1;
      fa = d0 > 0 ? 1.14 : d0 < 0 ? 0.83 : 1;
    }
    R.CH[n] = s.ch + pois(m.c[0] * rc * G * fh);
    R.CA[n] = s.ca + pois(m.c[1] * rc * G * fa);
    const ky = (m.y[0] + m.y[1]) / 0.05,
      Gy = ry > 0 ? gam(ky) / ky : 1,
      fy = Math.abs(pre ? gh - ga : d0) <= 1 ? 1.06 : 0.88;
    R.Y[n] = s.yh + s.ya + pois((m.y[0] + m.y[1]) * ry * Gy * fy);
    R.RD[n] = s.rh + s.ra + pois((m.r[0] + m.r[1]) * r);
    R.O[n] = s.oh + s.oa + pois((m.o[0] + m.o[1]) * r);
  }
  return (SIMS[eid] = R);
}
const frac = (R, f) => {
  let c = 0;
  for (let n = 0; n < R.N; n++) if (f(R, n)) c++;
  return c / R.N;
};
const simOf = (eid) => SIMS[eid] || simulate(eid, 20000);
function mkMatch(e, lg) {
  const c = e.competitions[0],
    H = c.competitors.find((x) => x.homeAway === "home"),
    A = c.competitors.find((x) => x.homeAway === "away");
  const m = {
    eid: e.id,
    lg,
    hA: H.team.abbreviation,
    aA: A.team.abbreviation,
    h: H.team.displayName,
    a: A.team.displayName,
    tid: [H.team.id, A.team.id],
    col: [H.team.color || "7f93ab", H.team.alternateColor || "ffffff", A.team.color || "3df5ff", A.team.alternateColor || "ffffff"],
    logo: [H.team.logo, A.team.logo],
    c: (DATA.lgm[lg] || { c: [5.1, 4.5] }).c,
    y: (DATA.lgm[lg] || { y: [1.8, 2.0] }).y,
    o: [1.7, 1.6],
    r: [0.05, 0.06],
    lam: [1.45, 1.15],
    odds: {},
    dyn: 1,
    neu: !!c.neutralSite,
  };
  const EL = ownLam(m);
  if (EL) {
    m.lam = EL;
    m.lamModel = EL;
    m.src = "our team ratings";
  }
  const cy = cardsOf(m);
  if (cy) m.y = cy;
  m.g = gridOf(m.lam[0], m.lam[1]);
  byE[m.eid] = m;
  lim(() => enrich(m)).catch(() => {});
  return m;
}
const am = (x) => (x == null || x === "" ? null : +x > 0 ? 1 + x / 100 : 1 + 100 / -x);

// ---- our own model: built from each team's last 5 results (free, no key) ----
function formModel(m, sm) {
  try {
    const L5 = ((sm && sm.boxscore) || {}).lastFiveGames || [];
    if (L5.length < 2) return null;
    const mu = 1.3,
      k = 4;
    const r = L5.map((x) => {
      const tid = String(x.team && x.team.id);
      let gf = 0,
        ga = 0,
        n = 0;
      (x.events || []).forEach((e) => {
        const h = +e.homeTeamScore,
          a = +e.awayTeamScore;
        if (e.homeTeamScore == null || isNaN(h) || isNaN(a)) return;
        const home = String(e.homeTeamId) === tid;
        gf += home ? h : a;
        ga += home ? a : h;
        n++;
      });
      return { tid, att: (gf + k * mu) / (n + k) / mu, def: (ga + k * mu) / (n + k) / mu, n };
    });
    const tids = (m.tid || []).map(String);
    const H = r.find((x) => x.tid === tids[0]) || r[0],
      A = r.find((x) => x.tid === tids[1]) || r[1];
    if (!H || !A || H.n + A.n < 3) return null;
    return [clamp(mu * 1.1 * H.att * A.def, 0.25, 3.6), clamp(mu * 0.92 * A.att * H.def, 0.2, 3.2)];
  } catch (e) {
    return null;
  }
}
function applyOwnModel(m, sm) {
  if (m.enh) return;
  // our own model: national-team ratings or club ratings, plus each team's last 5 games. Bookmaker odds are NOT mixed in.
  const R = ownLam(m);
  const F5 = formModel(m, sm);
  let F = R;
  if (R && F5 && CLUB_LEAGUES.has(m.lg)) F = [Math.exp(0.75 * Math.log(R[0]) + 0.25 * Math.log(F5[0])), Math.exp(0.75 * Math.log(R[1]) + 0.25 * Math.log(F5[1]))];
  if (!F) F = F5;
  let lam = F;
  m.src = R ? "our team ratings" : F5 ? "recent form (last 5 games)" : "league average";
  if (F) m.lamModel = F;
  if (!lam) return;
  m.lam = lam;
  m.g = gridOf(lam[0], lam[1]);
  const sh = lam[0] / (lam[0] + lam[1]),
    lg = DATA.lgm[m.lg] || { c: [5.1, 4.5], y: [1.8, 2.0] };
  const tc = lg.c[0] + lg.c[1],
    ty = lg.y[0] + lg.y[1];
  m.c = [+(tc * (0.5 + 0.6 * (sh - 0.5))).toFixed(2), +(tc * (0.5 - 0.6 * (sh - 0.5))).toFixed(2)];
  m.y = cardsOf(m) || [+(ty * (0.5 - 0.3 * (sh - 0.5))).toFixed(2), +(ty * (0.5 + 0.3 * (sh - 0.5))).toFixed(2)];
}
function setOddsKey(k) {
  ODDS_KEY = (k || "").trim();
  try {
    ODDS_KEY ? localStorage.setItem("mb_okey", ODDS_KEY) : localStorage.removeItem("mb_okey");
  } catch (e) {}
  emit();
}
const hasOddsKey = () => !!ODDS_KEY;
function exportCode() {
  const o = { v: 1, t: MY.filter((x) => !x.preset), h: HID, l: LOG, b: BANK };
  return btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function importCode(s) {
  const o = JSON.parse(decodeURIComponent(escape(atob(String(s).trim()))));
  if (!o || o.v !== 1) throw new Error("bad");
  let n = 0;
  (o.t || []).forEach((t) => {
    if (!MY.some((x) => x.id === t.id)) {
      MY.push(t);
      n++;
    }
  });
  (o.h || []).forEach((id) => {
    if (!HID.includes(id)) HID.push(id);
  });
  MY = MY.filter((x) => !(x.preset && HID.includes(x.id)));
  if (Array.isArray(o.l) && o.l.length > LOG.length) LOG = o.l;
  LS.set("mb_log", LOG);
  LS.set("mb_hidden", HID);
  saveTickets();
  emit();
  return n;
}
async function enrich(m) {
  const sm = await J(BASE(m.lg) + "summary?event=" + m.eid, 120000);
  const p = (sm.pickcenter || [])[0];
  if (p) {
    const o = {
      H: am(p.homeTeamOdds && p.homeTeamOdds.moneyLine),
      D: am(p.drawOdds && p.drawOdds.moneyLine),
      A: am(p.awayTeamOdds && p.awayTeamOdds.moneyLine),
    };
    if (p.overUnder === 2.5 && p.overOdds && p.underOdds) {
      o["O2.5"] = am(p.overOdds);
      o["U2.5"] = am(p.underOdds);
    }
    if (o.H && o.D && o.A) {
      m.odds = o;
      recordOdds(m.eid, o, "espn");
    }
  }
  applyOwnModel(m, sm);
  delete SIMS[m.eid];
  if (m.eid === SEL) drawAll();
}

// ---- accuracy tracker: freeze each match's pre-kick-off %, score it at full time ----
const ACC = LS.get("mb_acc", {});
function gridHDA(m) {
  const g = m.g;
  let H = 0,
    D = 0,
    A = 0,
    O = 0,
    T = 0;
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++) {
      const p = g[i * 9 + j] || 0;
      T += p;
      if (i > j) H += p;
      else if (i === j) D += p;
      else A += p;
      if (i + j > 2) O += p;
    }
  return [H / T, D / T, A / T, O / T];
}
function trackAcc(eid, s) {
  const m = byE[eid];
  if (!m || !m.g) return;
  const a = ACC[eid];
  if (s.state === "pre") {
    const [h, d, aw, o] = gridHDA(m);
    ACC[eid] = {
      p: [+h.toFixed(3), +d.toFixed(3), +aw.toFixed(3)],
      o: +o.toFixed(3),
      n: m.h + " v " + m.a,
      t: s.date || null,
      src: m.src || "bookmaker prices",
    };
  } else if (s.state === "post" && a && !a.out) {
    a.out = [s.h, s.a];
  } else return;
  const ks = Object.keys(ACC);
  if (ks.length > 600) ks.slice(0, ks.length - 600).forEach((k) => delete ACC[k]);
  LS.set("mb_acc", ACC);
}
function accStats() {
  const done = Object.values(ACC).filter((x) => x.out);
  let bs = 0,
    fav = 0,
    o = 0;
  done.forEach((x) => {
    const [h, a] = x.out,
      r = [h > a, h === a, h < a].map(Number);
    bs += x.p.reduce((s, p, i) => s + (p - r[i]) ** 2, 0);
    const fi = x.p.indexOf(Math.max(...x.p));
    fav += r[fi];
    o += x.o > 0.5 === h + a > 2 ? 1 : 0;
  });
  const n = done.length;
  return { n, brier: n ? bs / n : null, fav: n ? fav / n : null, ou: n ? o / n : null, list: done.slice(-8).reverse() };
}
async function pollBoard(lg, date) {
  try {
    const sb = await J(BASE(lg) + "scoreboard?dates=" + date, 20000);
    const key = lg + "|" + date;
    const ids = [];
    (sb.events || []).forEach((e) => {
      if (!byE[e.id]) mkMatch(e, lg);
      ids.push(e.id);
      const s = S(e.id),
        c = e.competitions[0],
        t = c.status.type;
      const was = s.state;
      s.state = t.state;
      s.detail = t.shortDetail || "";
      s.clock = c.status.displayClock;
      const mm = String(c.status.displayClock || "").match(/\d+/g);
      s.min = mm ? +mm[0] : 0;
      s.date = e.date;
      c.competitors.forEach((k) => {
        if (k.homeAway === "home") s.h = +k.score || 0;
        else s.a = +k.score || 0;
      });
      if (was !== s.state) delete SIMS[e.id];
      if (s.state === "pre" || (s.state === "post" && was !== "post")) trackAcc(e.id, s);
      if (was === "pre" && s.state === "in") snapClose(e.id);
      if (s.state === "in" && inTickets(e.id)) snapClose(e.id);
    });
    if (!(key in BOARD) || !BOARD[key].length || lg !== "uefa.nations") BOARD[key] = ids;
    UI.status = "Live data · updated " + new Date().toLocaleTimeString();
    UI.ok = true;
    return true;
  } catch (e) {
    UI.status = "Could not reach live data. Retrying…";
    UI.ok = false;
    return false;
  }
}
function parseComm(sm, m) {
  const comp = sm.header && sm.header.competitions[0];
  if (!comp) return null;
  const H = comp.competitors.find((c) => c.homeAway === "home"),
    A = comp.competitors.find((c) => c.homeAway === "away");
  const hn = H.team.displayName,
    an = A.team.displayName;
  const shots = [],
    corn = [],
    feed = [];
  (sm.commentary || []).forEach((c, i) => {
    const txt = (c.text || "").trim();
    if (txt) {
      const ty0 = (c.play && c.play.type && c.play.type.type) || "";
      const tm0 = c.play && c.play.team && c.play.team.displayName;
      feed.push({ c: (c.time && c.time.displayValue) || "", tx: txt, side: tm0 === hn ? 0 : tm0 === an ? 1 : -1, k: /goal/.test(ty0) && !/disallow|attempt/.test(ty0) ? "goal" : /red-card/.test(ty0) ? "red" : /yellow-card/.test(ty0) ? "yel" : /substitution/.test(ty0) ? "sub" : /shot|attempt|saved|woodwork|post/.test(ty0) ? "shot" : "" });
    }
    const ty = (c.play && c.play.type && c.play.type.type) || "";
    const tm = c.play && c.play.team && c.play.team.displayName;
    const side = tm === hn ? 0 : tm === an ? 1 : -1;
    if (side < 0) return;
    const mm = String((c.time && c.time.displayValue) || "").match(/\d+/);
    const mi = mm ? Math.min(90, +mm[0]) : 0;
    const tx = (c.text || "").toLowerCase();
    if (/corner-awarded/.test(ty)) corn.push([mi, side]);
    if (!/own-goal/.test(ty) && /^shot|^goal|penalty---|woodwork|post/.test(ty) && !/disallow/.test(ty)) {
      const pen = /penalty/.test(ty) || /converts the penalty|penalty saved|penalty missed/.test(tx);
      const z = pen
        ? 7
        : /very close range/.test(tx)
          ? 0
          : /six yard box/.test(tx)
            ? 1
            : /centre of the box/.test(tx)
              ? 2
              : /difficult angle/.test(tx)
                ? 4
                : /side of the box/.test(tx)
                  ? 3
                  : /more than (35|40) yards|long range/.test(tx)
                    ? 6
                    : /outside the box/.test(tx)
                      ? 5
                      : 2;
      const f = [
        /header/.test(tx + ty) ? 1 : 0,
        0,
        /with a cross/.test(tx) ? 1 : 0,
        /through ball/.test(tx) ? 1 : 0,
        /fast break/.test(tx) ? 1 : 0,
        /following a corner|following a set piece/.test(tx) ? 1 : 0,
      ];
      const goal = /^goal|penalty---scored/.test(ty) ? 1 : 0;
      const lr = / left/.test(tx.split("shot")[1] || tx) ? -1 : / right/.test(tx.split("shot")[1] || tx) ? 1 : 0;
      const who = (c.text || "").match(/[.!]\s([^.(]+?)\s\(/);
      shots.push({ mi, side, z, f, goal, xg: xgOf(z, f), lr, i, who: who ? who[1] : "", ty, on: /on-target|^goal|saved/.test(ty) });
    }
  });
  return { shots, corn, feed: feed.reverse().slice(0, 60) };
}
async function pollSummary(eid) {
  const s = S(eid),
    m = byE[eid];
  try {
    const sm = await J(BASE(m.lg) + "summary?event=" + eid, s.state === "in" ? 25000 : 300000);
    ((sm.boxscore && sm.boxscore.teams) || []).forEach((t) => {
      const st = {};
      (t.statistics || []).forEach((x) => (st[x.name] = +x.displayValue || 0));
      const side = t.team.abbreviation === m.hA || (m.tid && t.team.id && t.team.id === m.tid[0]) ? "h" : "a";
      s["box" + side] = st;
      s["c" + side] = st.wonCorners || 0;
      s["y" + side] = st.yellowCards || 0;
      s["r" + side] = st.redCards || 0;
      s["o" + side] = st.offsides || 0;
    });
    const ev = (sm.keyEvents || [])
      .filter((k) => k.type && /goal|card|substitution|penalty|halftime|end|kickoff/i.test(k.type.type || k.type.text || ""))
      .map((k) => ({
        c: (k.clock && k.clock.displayValue) || "",
        ty: (k.type.type || k.type.text || "").toLowerCase(),
        tx: k.shortText || k.text || "",
        tm: k.team && k.team.abbreviation,
        pl: (k.participants || []).map((p) => p.athlete && p.athlete.displayName),
      }));
    const goals = ev.filter((x) => /goal/.test(x.ty) && !/disallowed|miss/.test(x.ty)).length;
    const reds = ev.filter((x) => /red/.test(x.ty)).length;
    if (s.goals >= 0) {
      if (goals > s.goals) {
        const g = ev.filter((x) => /goal/.test(x.ty)).slice(-1)[0];
        if (eid === SEL) flashGoal(g);
        if (inTickets(eid)) alertMsg("info", "⚽ Goal in " + m.hA + "–" + m.aA + ": " + ((g && g.tx) || "") + " (" + s.h + "-" + s.a + ")");
      }
      if (reds > s.reds && inTickets(eid)) alertMsg("warn", "🟥 Red card in " + m.hA + "–" + m.aA);
    }
    s.goals = goals;
    s.reds = reds;
    s.ev = ev;
    const pc = parseComm(sm, m);
    if (pc) {
      s.shots = pc.shots;
      s.corn = pc.corn;
      s.feed = pc.feed;
      pingNew(eid);
      s.xh = pc.shots.filter((x) => x.side === 0).reduce((a, x) => a + x.xg, 0);
      s.xa = pc.shots.filter((x) => x.side === 1).reduce((a, x) => a + x.xg, 0);
    }
    if (
      (sm.rosters || []).some((r) => (r.roster || []).some((p) => p.starter)) &&
      (!LU[eid] || /Predicted|not/.test(LU[eid].h.src) || s.state === "in")
    ) {
      if (LU[eid] && /Predicted/.test(LU[eid].h.src) && inTickets(eid))
        alertMsg("info", "📋 Lineups are out for " + m.hA + "–" + m.aA + ". Chances will update.");
      loadLineup(m);
    }
  } catch (e) {}
}
const LO = {};
let LOC = LS.get("mb_lo_credits", null),
  LOT = 0;
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();
const same = (a, b) => {
  a = norm(a);
  b = norm(b);
  return a === b || a.split(" ")[0] === b.split(" ")[0] || a.includes(b) || b.includes(a);
};
async function pollLiveOdds(lgs) {
  if (!ODDS_KEY) return;
  for (const lg of lgs) {
    const k = OKEY[lg];
    if (!k) continue;
    try {
      const r = await fetch(
        `https://api.the-odds-api.com/v4/sports/${k}/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`,
      );
      const rem = r.headers.get("x-requests-remaining");
      if (rem != null) {
        LOC = +rem;
        LS.set("mb_lo_credits", LOC);
      }
      if (!r.ok) continue;
      const d = await r.json();
      d.forEach((ev) => {
        const m = Object.values(byE).find((x) => x.lg === lg && same(x.h, ev.home_team) && same(x.a, ev.away_team));
        if (!m) return;
        const P = {};
        ev.bookmakers.forEach((b) =>
          b.markets.forEach((mk) =>
            mk.outcomes.forEach((o) => {
              let key = null;
              if (mk.key === "h2h") key = same(o.name, ev.home_team) ? "H" : same(o.name, ev.away_team) ? "A" : "D";
              else if (mk.key === "totals" && String(o.point).endsWith(".5")) key = (o.name === "Over" ? "O" : "U") + o.point;
              if (key) (P[key] = P[key] || []).push(o.price);
            }),
          ),
        );
        const o = {};
        for (const k2 in P) {
          const a = P[k2].sort((x, y) => x - y);
          o[k2] = a[a.length >> 1];
        }
        LO[m.eid] = { t: Date.now(), o, live: new Date(ev.commence_time) < new Date() };
        if (!LO[m.eid].live) recordOdds(m.eid, o, "odds-api");
      });
    } catch (e) {}
  }
  LOT = Date.now();
  Object.values(byE).forEach((m) => {
    if (LO[m.eid] && S(m.eid).state === "pre" && m.lineupOdds) applyFreshOdds(m);
  });
}
const LU = {},
  RT = {},
  SHR = {};
function depth(p) {
  const a = (p.pos || "").toUpperCase();
  if (a === "G" || a === "GK") return 0;
  if (/WB/.test(a)) return 1.5;
  if (/^(CD|CB|LB|RB|D$|SW)/.test(a)) return 1;
  if (/DM/.test(a)) return 2;
  if (/^(AM|LW|RW|CAM)/.test(a)) return 4;
  if (/^(F|CF|ST|LF|RF|S$)/.test(a)) return 5;
  return 3;
}
function lat(p) {
  const a = (p.pos || "").toUpperCase();
  if (/-L$|^L/.test(a)) return -1;
  if (/-R$|^R/.test(a)) return 1;
  return 0;
}
function role(p) {
  const d = depth(p);
  return d === 0 ? "G" : d < 2 ? "D" : d < 4 ? "M" : d < 5 ? "AM" : "F";
}
function parseRoster(ro) {
  return (ro.roster || []).map((p) => ({
    id: p.athlete.id,
    name: p.athlete.displayName,
    short: p.athlete.lastName || p.athlete.displayName.split(" ").slice(-1)[0],
    jersey: p.jersey || "",
    pos: (p.position && p.position.abbreviation) || "",
    starter: !!p.starter,
    fp: +(p.formationPlace || 0),
    subIn: !!p.subbedIn,
    subOut: !!p.subbedOut,
  }));
}
function layout(players, f) {
  const offs = players.filter((p) => p.starter && p.subOut).sort((a, b) => a.fp - b.fp),
    ons = players.filter((p) => !p.starter && p.subIn);
  const swap = {};
  offs.forEach((p, i) => {
    if (ons[i]) swap[p.id] = ons[i];
  });
  const st = players.filter((p) => p.starter);
  const gk = st.find((p) => depth(p) === 0) || st[0];
  const out = st.filter((p) => p !== gk).sort((x, y) => depth(x) - depth(y) || x.fp - y.fp);
  let rows = (f || "")
    .split("-")
    .map(Number)
    .filter((x) => x > 0);
  if (rows.reduce((a, b) => a + b, 0) !== out.length) {
    const g = {};
    out.forEach((p) => {
      const d = Math.round(depth(p));
      (g[d] = g[d] || []).push(p);
    });
    rows = Object.keys(g)
      .sort()
      .map((k) => g[k].length);
  }
  const R = [];
  let i = 0;
  rows.forEach((k) => {
    R.push(
      out
        .slice(i, i + k)
        .sort((x, y) => lat(x) - lat(y) || x.fp - y.fp)
        .map((p) => swap[p.id] || p),
    );
    i += k;
  });
  return { gk: swap[gk && gk.id] || gk, rows: R };
}
async function prevEvent(m, side) {
  const ab = side === "h" ? m.hA : m.aA;
  if (!m.dyn && PREV[ab]) return PREV[ab][0];
  const tid = m.tid[side === "h" ? 0 : 1];
  const sc = await J(BASE(m.lg) + "teams/" + tid + "/schedule", Infinity);
  const done = (sc.events || []).filter((e) => e.competitions[0].status.type.completed && e.id !== m.eid);
  return done.length ? done[done.length - 1].id : null;
}
async function loadLineup(m) {
  const eid = m.eid;
  let sum = null;
  try {
    sum = await J(BASE(m.lg) + "summary?event=" + eid, S(eid).state === "pre" ? 300000 : 30000);
  } catch (e) {}
  const res = {},
    need = [];
  for (const side of ["h", "a"]) {
    const ab = side === "h" ? m.hA : m.aA,
      tid = (m.tid || [])[side === "h" ? 0 : 1];
    const mt = (r) => r.team && (r.team.abbreviation === ab || (tid && r.team.id === tid));
    let ro = sum && (sum.rosters || []).find(mt);
    if (ro && (ro.roster || []).some((p) => p.starter)) res[side] = { f: ro.formation, players: parseRoster(ro), src: "Confirmed lineup" };
    else {
      try {
        const pid = await prevEvent(m, side);
        const ps = await J(BASE(m.lg) + "summary?event=" + pid, Infinity);
        const r2 = (ps.rosters || []).find(mt);
        const d = ps.header && ps.header.competitions[0].date;
        res[side] = {
          f: r2 && r2.formation,
          players: r2 ? parseRoster(r2) : [],
          src: "Predicted from last match" + (d ? " (" + new Date(d).toLocaleDateString([], { day: "numeric", month: "short" }) + ")" : ""),
        };
      } catch (e) {
        res[side] = { f: "", players: [], src: "Lineup not available" };
      }
    }
    res[side].players.forEach((p) => need.push(p));
  }
  LU[eid] = res;
  if (eid === SEL) drawAll();
  await Promise.all(need.filter((p) => p.starter || p.subIn).map((p) => rate(p).catch(() => {})));
  if (eid === SEL) drawAll();
  lineupStrength(m).catch(() => {});
}
function leagueF(n) {
  n = n || "";
  if (/English Premier/i.test(n)) return 1;
  if (/LALIGA|Spanish/i.test(n)) return 0.97;
  if (/Italian|Serie A/i.test(n)) return 0.95;
  if (/Bundesliga/i.test(n) && !/2\./.test(n) && !/Austrian/i.test(n)) return 0.95;
  if (/French|Ligue 1/i.test(n)) return 0.9;
  if (/Championship/i.test(n)) return 0.8;
  if (/Dutch|Portuguese|Belgian|Turkish|Saudi|Scottish|Eredivisie|Liga Portugal/i.test(n)) return 0.78;
  if (/MLS|Greek|Czech|Danish|Swiss|Austrian|Russian|Polish|Croatian|Serbian/i.test(n)) return 0.72;
  return 0.64;
}
async function rate(p) {
  if (RT[p.id]) return RT[p.id];
  const [s, a] = await Promise.all([
    lim(() => J(W + p.id + "/stats", Infinity)).catch(() => null),
    lim(() => J(W + p.id, Infinity)).catch(() => null),
  ]);
  const cat = s && (s.categories || [])[0],
    nm = cat ? cat.names : [],
    ix = (k) => nm.indexOf(k),
    rows = cat ? (cat.statistics || []).slice(0, 2) : [];
  const t = { STRT: 0, G: 0, A: 0, SHOT: 0, SOG: 0, FC: 0, FA: 0, YC: 0, RC: 0, OFF: 0 },
    cur = { STRT: 0, G: 0, A: 0 };
  let lf = 0.64,
    seasons = [];
  rows.forEach((r, j) => {
    const f = leagueF(r.season && r.season.displayName);
    if (j === 0) lf = f;
    for (const k in t) t[k] += +r.stats[ix(k)] || 0;
    if (j === 0) for (const k in cur) cur[k] = +r.stats[ix(k)] || 0;
    seasons.push([r.season.displayName, +r.stats[ix("STRT")] || 0, +r.stats[ix("G")] || 0, +r.stats[ix("A")] || 0]);
  });
  if (rows.length === 2 && leagueF(rows[1].season.displayName) > lf) lf = (lf + leagueF(rows[1].season.displayName)) / 2;
  const S_ = Math.max(t.STRT, 1),
    rl = role(p);
  const gps = (t.G / S_) * lf,
    aps = (t.A / S_) * lf,
    cg = ((cur.G + cur.A) / Math.max(cur.STRT, 1)) * lf;
  const ATK = clamp(35 + 73 * Math.pow(gps, 0.55), 30, 97),
    CRE = clamp(35 + 94 * Math.pow(aps, 0.49), 30, 97),
    SHT = clamp(30 + 50 * (t.SOG / Math.max(t.SHOT, 1)) + 3 * Math.min(t.SHOT / S_, 4), 30, 95),
    DIS = clamp(92 - (55 * t.YC) / S_ - (3 * t.FC) / S_ - (30 * t.RC) / S_, 30, 99),
    EXP = clamp(28 + 0.7 * t.STRT * lf + 28 * lf, 30, 96),
    FRM = clamp(35 + 63 * Math.pow(cg, 0.5) + 0.5 * Math.min(cur.STRT, 10), 30, 97);
  let base =
    rl === "F"
      ? 0.42 * ATK + 0.18 * CRE + 0.1 * SHT + 0.1 * FRM + 0.2 * EXP
      : rl === "AM"
        ? 0.25 * ATK + 0.32 * CRE + 0.1 * FRM + 0.33 * EXP
        : rl === "M"
          ? 0.12 * ATK + 0.3 * CRE + 0.18 * DIS + 0.4 * EXP
          : rl === "D"
            ? 0.06 * ATK + 0.1 * CRE + 0.24 * DIS + 0.6 * EXP
            : 0.2 * DIS + 0.8 * EXP;
  const OVR = Math.round(clamp(0.72 * base + 0.28 * (52 + 42 * lf), 40, 94));
  const ath = (a && a.athlete) || {};
  const GP = { F: 0.3, AM: 0.17, M: 0.07, D: 0.03, G: 0 },
    AP = { F: 0.1, AM: 0.14, M: 0.08, D: 0.04, G: 0.005 }; // goals/assists per start pulled towards the position average (12 starts of weight)
  const gw = rl === "G" ? 0 : (t.G * lf + 12 * GP[rl]) / (t.STRT + 12),
    aw = (t.A * lf + 12 * AP[rl]) / (t.STRT + 12);
  return (RT[p.id] = {
    OVR,
    ATK: Math.round(ATK),
    CRE: Math.round(CRE),
    SHT: Math.round(SHT),
    DIS: Math.round(DIS),
    EXP: Math.round(EXP),
    FRM: Math.round(FRM),
    club: (ath.team && ath.team.displayName) || "",
    age: ath.age,
    flag: ath.flag && ath.flag.href,
    seasons,
    gw,
    aw,
    role: rl,
    has: rows.length > 0,
  });
}
function shares(players) {
  const on = players.filter((p) => (p.starter && !p.subOut) || p.subIn);
  const dg = (p) => (RT[p.id] ? RT[p.id].gw : { F: 0.3, AM: 0.17, M: 0.07, D: 0.03, G: 0 }[role(p)]),
    da = (p) => (RT[p.id] ? RT[p.id].aw : { F: 0.1, AM: 0.14, M: 0.08, D: 0.04, G: 0.005 }[role(p)]);
  const sg = on.reduce((s, p) => s + dg(p), 0) || 1,
    sa = on.reduce((s, p) => s + da(p), 0) || 1;
  const o = {};
  on.forEach((p) => {
    o[p.id] = { g: (0.85 * dg(p)) / sg, a: (0.72 * da(p)) / sa };
  });
  return o;
}
const legName = (m, ty, line) =>
  ty === "hd"
    ? m.h + " or draw"
    : ty === "ad"
      ? m.a + " or draw"
      : ty === "home"
        ? m.h + " win"
        : ty === "away"
          ? m.a + " win"
          : ty === "draw"
            ? "Draw"
            : ty === "over"
              ? "Over " + line
              : ty === "under"
                ? "Under " + line
                : ty === "ucorn"
                  ? "Under " + line + " corners"
                  : "Over " + line + " corners";
const HID = LS.get("mb_hidden", []);
const PRESET = DATA.T.map((t, i) => ({
  id: t.real ? "1w_" + t.n.match(/#(\d+)/)[1] : "m16v3_" + i,
  n: t.real ? t.n : t.n + " (Mon)",
  odds: t.odds,
  stake: t.stake,
  real: t.real,
  legs: t.legs.map(([eid, ty, line, o, date]) => ({
    eid,
    lg: "uefa.nations",
    date: date || "20261116",
    n: legName(byE[eid] || {}, ty, line),
    o: o || null,
  })),
  preset: 1,
}));
let MY = [...PRESET.filter((t) => !HID.includes(t.id)), ...LS.get("mb_tickets", [])];
let DRAFT = [];
let LOG = LS.get("mb_log", []);
const P0 = LS.get("mb_p0", {});
const CO = {};
const inTickets = (eid) => MY.some((t) => t.legs.some((l) => l.eid === eid));
const LEGP0 = LS.get("mb_legp0", {});
let p0Timer = null;
const saveP0Soon = () => {
  if (p0Timer) return;
  p0Timer = setTimeout(() => {
    p0Timer = null;
    LS.set("mb_legp0", LEGP0);
  }, 3000);
};
function legMk(l) {
  const m = byE[l.eid];
  return m ? markets(m).find((x) => x.n === l.n) : null;
}
function legState(l) {
  const m = byE[l.eid];
  if (!m) return { p: null, lab: l.n, m: null, s: null };
  const mk = legMk(l);
  if (!mk) return { p: null, lab: l.n, m, s: S(l.eid) };
  const R = simOf(l.eid);
  const pw = frac(R, mk.f),
    pu = mk.pu ? frac(R, mk.pu) : 0,
    s = S(l.eid);
  // remember our % before kick-off, to check later how your bets did against it
  if (s.state === "pre") {
    const k = l.eid + "|" + l.n;
    if (LEGP0[k] == null || Math.abs(LEGP0[k] - (pw + pu)) > 0.01) {
      LEGP0[k] = +(pw + pu).toFixed(3);
      saveP0Soon();
    }
  }
  return { p: pw + pu, pw, pu, lab: l.n, m, s, f: mk.f };
}
function ticketP(t) {
  const by = {};
  t.legs.forEach((l) => (by[l.eid] = by[l.eid] || []).push(l));
  let P = 1;
  for (const eid in by) {
    const m = byE[eid];
    if (!m) return null;
    const mks = by[eid].map(legMk).filter(Boolean);
    if (mks.length < by[eid].length) return null;
    const R = simOf(eid);
    let c = 0;
    for (let n = 0; n < R.N; n++) {
      let ok = 1;
      for (const k of mks)
        if (!(k.f(R, n) || (k.pu && k.pu(R, n)))) {
          ok = 0;
          break;
        }
      c += ok;
    }
    P *= c / R.N;
  }
  return P;
}
function ticketE(t) {
  if (!t.legs.length || !t.legs.every((l) => l.o > 1)) {
    const P = ticketP(t);
    return P == null ? null : P * (t.odds || 1 / Math.max(P, 1e-9));
  }
  const by = {};
  t.legs.forEach((l) => (by[l.eid] = by[l.eid] || []).push(l));
  let E = 1;
  for (const eid in by) {
    if (!byE[eid]) return null;
    const ls = by[eid].map((l) => [l, legMk(l)]);
    if (ls.some((x) => !x[1])) return null;
    const R = simOf(eid);
    let s = 0;
    for (let n = 0; n < R.N; n++) {
      let mu = 1;
      for (const [l, k] of ls) {
        if (k.mult) {
          mu *= k.mult(R, n, l.o);
          if (!mu) break;
        } else if (k.f(R, n)) mu *= l.o;
        else if (k.pu && k.pu(R, n)) mu *= 1;
        else {
          mu = 0;
          break;
        }
      }
      s += mu;
    }
    E *= s / R.N;
  }
  return E;
}
const tOdds = (t) => (t.legs.length && t.legs.every((l) => l.o > 1) ? t.legs.reduce((a, l) => a * l.o, 1) : t.odds);
function settled(ls) {
  const st = ls.map((x) =>
    !x.s || x.p == null ? "?" : x.s.state !== "pre" && x.p === 0 ? "L" : x.s.state !== "pre" && x.p === 1 ? "W" : "-",
  );
  return st.includes("L") ? "LOST" : st.every((x) => x === "W") ? "WON" : null;
}
const PREVL = {};
const ALERTS = [];
function beep(fs) {
  try {
    const a = new AudioContext();
    fs.forEach((f, i) => {
      const o = a.createOscillator(),
        g = a.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(0.0001, a.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i * 0.15 + 0.35);
      o.start(a.currentTime + i * 0.15);
      o.stop(a.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {}
}
function checkAlerts() {
  MY.forEach((t) => {
    const ls = t.legs.map(legState);
    const P = ticketP(t);
    const res = settled(ls);
    ls.forEach((l, i) => {
      if (l.p == null || !l.s) return;
      const k = t.id + "|" + i,
        pv = PREVL[k];
      const st = l.s.state !== "pre" && l.p === 1 ? "W" : l.s.state !== "pre" && l.p === 0 ? "L" : "-";
      if (pv) {
        if (st === "W" && pv.st !== "W") alertMsg("good", "✓ " + t.n + ": " + l.m.hA + "–" + l.m.aA + " " + nice(l.lab, l.m) + " won ✓");
        if (st === "L" && pv.st !== "L") alertMsg("bad", "✗ " + t.n + ": " + l.m.hA + "–" + l.m.aA + " " + nice(l.lab, l.m) + " lost");
        if (st === "-" && l.s.state === "in" && l.p < 0.35 && pv.p >= 0.35)
          alertMsg("warn", "⚠ " + t.n + ": " + nice(l.lab) + " (" + l.m.hA + "–" + l.m.aA + ") is in trouble");
        if (st === "-" && l.s.state === "in" && l.p - pv.p > 0.2)
          alertMsg("good", "▲ " + t.n + ": " + nice(l.lab) + " (" + l.m.hA + "–" + l.m.aA + ") looks much better now");
      }
      PREVL[k] = { p: l.p, st };
    });
    const k2 = t.id + "|T",
      pv = PREVL[k2];
    if (P != null && !res) {
      PREVL[k2] = { P };
    }
    if (res && P0[t.id] != null && !LOG.some((x) => x.id === t.id)) {
      LOG.unshift({
        id: t.id,
        n: t.n,
        odds: tOdds(t),
        stake: t.stake || STAKE,
        res,
        p0: P0[t.id],
        clv: (clvOf(t) || {}).v,
        d: new Date().toISOString().slice(0, 10),
      });
      LS.set("mb_log", LOG);
    }
    if (P != null && P0[t.id] == null && ls.every((l) => l.s && l.s.state === "pre")) {
      P0[t.id] = P;
      LS.set("mb_p0", P0);
    }
  });
  // pressure alert for ticket matches (shown as information)
  Object.values(byE).forEach((m) => {
    const s = ST[m.eid];
    if (!s || s.state !== "in" || !inTickets(m.eid)) return;
    [0, 1].forEach((sd) => {
      const x = s.shots.filter((z) => z.side === sd && z.mi > s.min - 15).reduce((a, z) => a + z.xg, 0);
      const k = "pr|" + m.eid + "|" + sd;
      if (x >= 1.0 && !(PREVL[k] > s.min - 30)) {
        PREVL[k] = s.min;
        alertMsg("info", "🔥 " + (sd ? m.a : m.h) + " are attacking a lot (" + m.hA + "–" + m.aA + ")");
      }
    });
  });
}
function lum(hex) {
  hex = (hex || "888888").replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function cdist(a, b) {
  const p = (x) => [0, 2, 4].map((i) => parseInt((x || "888888").slice(i, i + 2), 16) || 0);
  const A = p(a),
    Bc = p(b);
  return Math.hypot(A[0] - Bc[0], A[1] - Bc[1], A[2] - Bc[2]);
}
function colors(m) {
  let h, a, a2;
  if (m.col) {
    h = m.col[0];
    a = m.col[2];
    a2 = m.col[3];
  } else {
    h = PREV[m.hA][1];
    a = PREV[m.aA][1];
    a2 = PREV[m.aA][2];
  }
  if (cdist(h, a) < 130) a = a2;
  if (cdist(h, a) < 130) a = "3df5ff";
  if (lum(h) < 0.12) h = (m.col ? m.col[1] : PREV[m.hA][2]) || h;
  if (lum(a) < 0.12) a = "3df5ff";
  return ["#" + h, "#" + a];
}
const FLAG = {
  GER: "ger",
  NED: "ned",
  SUI: "sui",
  SCO: "sco",
  GRE: "gre",
  SRB: "srb",
  MKD: "mkd",
  SVN: "svn",
  GIB: "gib",
  MLT: "mlt",
  FRO: "fro",
  MDA: "mda",
  KAZ: "kaz",
  SVK: "svk",
  EST: "est",
  BUL: "bul",
  ISL: "isl",
  LUX: "lux",
  LTU: "ltu",
  LIE: "lie",
};
const logo = (m, side) => (m.logo ? m.logo[side] : `https://a.espncdn.com/i/teamlogos/countries/500/${FLAG[side ? m.aA : m.hA]}.png`);
const X0 = 170,
  Y0 = 110,
  PW = 860,
  PH = 540;
let FLASH = null;
function shotXY(sh) {
  const hsh = ((sh.i * 2654435761) >>> 0) / 4294967296,
    hs2 = (((sh.i * 40503 + 17) >>> 0) % 1000) / 1000;
  const cy = Y0 + PH / 2;
  const L = sh.lr || (hsh < 0.5 ? -1 : 1);
  let dx, dy;
  switch (sh.z) {
    case 7:
      dx = 90;
      dy = 0;
      break;
    case 0:
      dx = 18 + hsh * 14;
      dy = (hs2 - 0.5) * 50;
      break;
    case 1:
      dx = 25 + hsh * 20;
      dy = (hs2 - 0.5) * 130;
      break;
    case 2:
      dx = 60 + hsh * 75;
      dy = (hs2 - 0.5) * 130;
      break;
    case 3:
      dx = 40 + hsh * 90;
      dy = L * (85 + hs2 * 70);
      break;
    case 4:
      dx = 8 + hsh * 30;
      dy = L * (90 + hs2 * 70);
      break;
    case 5:
      dx = 150 + hsh * 80;
      dy = (hs2 - 0.5) * 300;
      break;
    default:
      dx = 260 + hsh * 140;
      dy = (hs2 - 0.5) * 320;
  }
  return sh.side === 0 ? [X0 + PW - dx, cy + dy] : [X0 + dx, cy - dy];
}
function pressureAt(s, t) {
  const o = [0, 0];
  s.shots.forEach((x) => {
    if (x.mi <= t && x.mi > t - 10) o[x.side] += x.xg + 0.02;
  });
  s.corn.forEach((c) => {
    if (c[0] <= t && c[0] > t - 10) o[c[1]] += 0.03;
  });
  return o;
}
const pct = (x) => (x == null ? "…" : (x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0) + "%");
const fo = (x) => (x > 0 ? (1 / x).toFixed(2) : "–");
function countdown(d) {
  const ms = new Date(d) - Date.now();
  const t = new Date(d).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  if (ms <= 0) return "Kick-off soon";
  const h = Math.floor(ms / 3600000),
    mi = Math.floor((ms % 3600000) / 60000);
  return `${t} · in ${h}h ${mi}m`;
}

// plain-words label: keeps the bookmaker name and adds what it means

let DAY = null;
const DAYLOAD = {};

// ---- the bookmaker's view, for comparison only: their % with the margin removed, and their odds ----
function bookOdds(m, n) {
  const lo = LO[m.eid],
    st = S(m.eid).state;
  if (st === "post") return null;
  const liveOk = lo && lo.live && Date.now() - lo.t < 360000;
  if (st === "in" && !liveOk) return null;
  const o = st === "in" ? lo.o : Object.assign({}, m.odds || {}, (lo && !lo.live && lo.o) || {});
  const H = o.H, D = o.D, A = o.A;
  let k;
  if (H && D && A) {
    const [ph, pd, pa] = pdev([H, D, A]);
    if (n === m.h + " win") return { p: ph, o: H };
    if (n === "Draw") return { p: pd, o: D };
    if (n === m.a + " win") return { p: pa, o: A };
    if (n === m.h + " or draw") return { p: ph + pd, o: null };
    if (n === m.a + " or draw") return { p: pa + pd, o: null };
    if (n === "No draw") return { p: ph + pa, o: null };
  }
  if ((k = n.match(/^(Over|Under) (\d+\.5)$/)) && o["O" + k[2]] && o["U" + k[2]]) {
    const [po, pu] = pdev([o["O" + k[2]], o["U" + k[2]]]);
    return k[1] === "Over" ? { p: po, o: o["O" + k[2]] } : { p: pu, o: o["U" + k[2]] };
  }
  return null;
}
// agreement with the bookies. Tested on 5,202 club games with real odds: when our % and the bookies' % agree,
// short tickets came out about even; when we disagreed, the bookies were usually right. So "agree" is a safety mark.
function valueOf(m, n, p) {
  const b = bookOdds(m, n);
  if (!b) return null;
  const ev = b.o ? p * b.o : null;
  return { book: b.p, odds: b.o, diff: p - b.p, ev, agree: Math.abs(p - b.p) <= 0.05 || (p >= 0.6 && b.p >= 0.6), value: false };
}
// the % used to BUILD tickets: the lower of ours and the bookies' when both exist (tested: much better tickets)
function safeP(m, n, p) {
  const b = bookOdds(m, n);
  return b ? Math.min(p, b.p) : p;
}
// the bookmaker the user plays at (only a name for labels; nothing is sent there)
let BOOK = LS.get("mb_book", "1win") || "1win";
function setBook(v) {
  BOOK = String(v || "").trim().slice(0, 20) || "1win";
  LS.set("mb_book", BOOK);
  emit();
}
const bookName = () => BOOK;
function ymdOf(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}
// load a day's games without changing the day shown on Today
async function loadDayData(date) {
  if (!DAYLOAD[date]) {
    DAYLOAD[date] = 1;
    await Promise.all(LEAGUES.map(([lg]) => pollBoard(lg, date)));
  }
  emit();
}
async function loadDay(date) {
  DAY = date;
  emit();
  if (!DAYLOAD[date]) {
    DAYLOAD[date] = 1;
    await Promise.all(LEAGUES.map(([lg]) => pollBoard(lg, date)));
  }
  emit();
  // tomorrow too, so Fire 9 / Best 6 can fill up late in the day
  const nx = nextYmd(date);
  if (!DAYLOAD[nx]) {
    DAYLOAD[nx] = 1;
    await Promise.all(LEAGUES.map(([lg]) => pollBoard(lg, nx)));
    emit();
  }
}
function dayGames(date) {
  const out = [];
  LEAGUES.forEach(([lg, name]) => {
    (BOARD[lg + "|" + date] || []).forEach((eid) => {
      if (byE[eid]) out.push({ eid, lg, name });
    });
  });
  return out;
}
const PICKSETS = {
  safe: (m) => [m.h + " or draw", m.a + " or draw", m.h + " over 0.5", m.a + " over 0.5", "Over 1.5", "Under 3.5", "Under 4.5"],
  goals: (m) => ["Over 1.5", "Over 2.5", "Over 3.5", "Under 2.5", "Under 3.5", m.h + " over 0.5", m.a + " over 0.5", m.h + " over 1.5", m.a + " over 1.5"],
  teams: (m) => [m.h + " win", m.a + " win", m.h + " or draw", m.a + " or draw", m.h + " over 0.5", m.a + " over 0.5"],
  cards: (m) => ["Over 2.5 yellows", "Over 3.5 yellows", "Over 4.5 yellows", "Under 3.5 yellows", "Under 4.5 yellows", "Under 5.5 yellows"],
  wins: (m) => [m.h + " win", m.a + " win"],
  fire: (m) => [m.h + " or draw", m.a + " or draw", "Over 1.5", "Under 3.5", m.h + " over 0.5", m.a + " over 0.5"],
};
function nextYmd(date) {
  const d = new Date(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8) + 1);
  return ymdOf(d);
}
const m0 = (x) => { const m = byE[x.eid]; return m ? [m.h, m.a].reduce((s, tm) => s.split(tm).join("T"), x.n) : x.n; };
function pickList(date, kind, lo = 0.5, hi = 0.97, lgf, preOnly) {
  const out = [];
  dayGames(date).forEach(({ eid, lg, name }) => {
    if (lgf && lgf !== lg) return;
    const s = S(eid);
    if (s.state === "post" || (preOnly && s.state !== "pre")) return;
    const m = byE[eid],
      R = simOf(eid),
      L = markets(m);
    let best = null;
    (PICKSETS[kind] || PICKSETS.safe)(m).forEach((n) => {
      const x = L.find((k) => k.n === n);
      if (!x || !shown(n)) return;
      const p = frac(R, x.f);
      if (p < lo || p > hi) return;
      if (!best || p > best.p) best = { eid, n, p, lg, name, v: valueOf(m, n, p) };
    });
    if (best) out.push(best);
  });
  // variety: the same bet (e.g. Total Under 4.5) at most 3 times, the rest go to the bottom
  const seen = {};
  const L = out.map((x) => ({ ...x, tilt: myTilt(x.n) })).sort((a, b) => b.p * b.tilt - a.p * a.tilt);
  const top = [],
    rest = [];
  L.forEach((x) => {
    const k = m0(x);
    (seen[k] = (seen[k] || 0) + 1) <= 3 ? top.push(x) : rest.push(x);
  });
  return top.concat(rest);
}
// ---- ready tickets. Every rule below was tested on past match days (record shown in the app) ----
function combos(date) {
  const C = [];
  // games still to play today; if today has too few, tomorrow's games are added (so Fire 9 always has 9)
  // games for a ticket: today's games still to start; if too few, games being played now, then tomorrow's games
  // leagues we predict poorly (very even leagues: tested) never go into ready tickets
  const okLg = (x) => leagueTrust(x.lg) !== 1;
  const pool = (need) => {
    let g = dayGames(date).filter((x) => S(x.eid).state === "pre" && okLg(x));
    if (g.length < need) g = g.concat(dayGames(date).filter((x) => S(x.eid).state === "in" && (S(x.eid).min || 0) < 60 && okLg(x)));
    if (g.length < need) g = g.concat(dayGames(nextYmd(date)).filter((x) => S(x.eid).state === "pre" && okLg(x)));
    return g;
  };
  const cand = (names, lo, hi, need = 0) => {
    const out = [];
    pool(need).forEach(({ eid, lg, name }) => {
      const m = byE[eid],
        R = simOf(eid),
        L = markets(m);
      names(m).forEach(([n, ty]) => {
        const x = L.find((k) => k.n === n);
        if (!x) return;
        const p = frac(R, x.f),
          r = safeP(m, n, p);
        if (r >= lo && r <= hi) out.push({ eid, n, p, r, lg, name, ty });
      });
    });
    return out.sort((a, b) => b.r - a.r);
  };
  // one bet per game, highest % first, at most `maxper` of one kind; stop when total odds reach `target`
  const take = (L, target, maxper, maxlegs = 10) => {
    const sel = [],
      c = {},
      used = new Set();
    let P = 1;
    for (const x of L) {
      if (used.has(x.eid) || (c[x.ty] || 0) >= maxper) continue;
      sel.push(x);
      used.add(x.eid);
      c[x.ty] = (c[x.ty] || 0) + 1;
      P *= x.p;
      if (1 / P >= target || sel.length >= maxlegs) break;
    }
    return 1 / P >= target ? sel : [];
  };
  // exactly n bets, safest first; if total odds stay under `target`, start one step lower down the list (Fire 9)
  const exact = (L, n, maxper, target = 4) => {
    for (let s = 0; s < L.length; s++) {
      const sel = [],
        c = {},
        used = new Set();
      let P = 1;
      for (const x of L.slice(s)) {
        if (used.has(x.eid) || (c[x.ty] || 0) >= maxper) continue;
        sel.push(x);
        used.add(x.eid);
        c[x.ty] = (c[x.ty] || 0) + 1;
        P *= x.p;
        if (sel.length === n) break;
      }
      if (sel.length < n) return [];
      if (1 / P >= target) return sel;
    }
    return [];
  };
  const mk = (id, title, desc, L) => {
    if (L.length >= 2) {
      const P = L.reduce((a, x) => a * x.p, 1);
      C.push({ id, title, desc, legs: L, fair: 1 / P, rec: COMBO_REC[id] || null, st: strengthOf(L.map((x) => x.p)) });
    }
  };
  const DC = (m) => [
      [m.h + " or draw", "dc"],
      [m.a + " or draw", "dc"],
    ],
    SC = (m) => [
      [m.h + " over 0.5", "sc"],
      [m.a + " over 0.5", "sc"],
    ],
    W = (m) => [
      [m.h + " win", "w"],
      [m.a + " win", "w"],
    ];
  const f9 = exact(cand((m) => [...DC(m), ...SC(m), ["Over 1.5", "o15"], ["Under 3.5", "u35"]], 0.72, 0.88, 9), 9, 3);
  mk("f9", "🔥 Fire 9", "9 games, one safe bet each", f9);
  // Fire 9 never just disappears: say why it is missing
  if (!f9.length) C.push({ id: "f9", wait: true, title: "🔥 Fire 9", desc: "needs 9 games with a safe bet", have: new Set(cand((m) => [...DC(m), ...SC(m), ["Over 1.5", "o15"], ["Under 3.5", "u35"]], 0.72, 0.88, 9).map((x) => x.eid)).size, rec: COMBO_REC.f9 });
  // Best 6: in each game the bet that pays most while our % stays 60-80%, then the 6 strongest games
  const b6 = [];
  pool(6).forEach(({ eid, lg, name }) => {
    const m = byE[eid],
      R = simOf(eid),
      L = markets(m);
    let best = null;
    [...W(m), ...DC(m), ...SC(m)].forEach(([n, ty]) => {
      const x = L.find((k) => k.n === n);
      if (!x) return;
      const p = frac(R, x.f);
      if (p >= 0.6 && p <= 0.8 && (!best || p < best.p)) best = { eid, n, p, lg, name, ty };
    });
    if (best) b6.push(best);
  });
  b6.sort((a, b) => b.p - a.p);
  let s6 = 0;
  while (b6.length - s6 >= 6 && 1 / b6.slice(s6, s6 + 6).reduce((a, x) => a * x.p, 1) < 4) s6++;
  mk("b6", "💎 Best 6", "6 games, the best-paying bet we still like", b6.length - s6 >= 6 ? b6.slice(s6, s6 + 6) : []);
  mk("safe3", "🛡 Safe 3", "3 strongest favourites – the best odds zone", exact(cand(W, 0.6, 0.95), 3, 99, 1));
  mk("fav", "👑 Favourites 4+", "the strongest teams to win (W1 / W2)", take(cand(W, 0.55, 0.9), 4, 99));
  mk("gol", "⚽ Goals 4+", "only Total Over / Under bets", take(cand((m) => [["Over 1.5", "o15"], ["Over 2.5", "o25"], ["Under 3.5", "u35"], ["Under 2.5", "u25"], ...SC(m)], 0.6, 0.9), 4, 3));
  mk("big", "🎰 Big payout 10+", "fewer, riskier bets", take(cand((m) => [...W(m), ...DC(m), ...SC(m)], 0.45, 0.7), 10, 99));
  return C;
}
function useCombo(L) {
  setDraft(
    L.map((x) => {
      const s = S(x.eid),
        dt = s.date ? new Date(s.date) : null;
      return { eid: x.eid, lg: x.lg, date: dt ? ymdOf(dt) : DAY, n: x.n, o: null };
    }),
  );
}
// ---- ticket strength: judged bet by bet (each bet's own %), never "the chance of the whole ticket" ----
function strengthOf(ps) {
  const P = ps.filter((p) => p != null);
  if (!P.length) return null;
  const s = (p) => Math.max(0, Math.min(10, ((p - 0.5) / 0.45) * 10));
  const avg = P.reduce((a, p) => a + p, 0) / P.length,
    low = Math.min(...P);
  const weak = P.filter((p) => p < 0.6).length;
  // each bet gets 0-10 (50% = 0, 95% = 10); the ticket = 60% the average bet + 40% the weakest bet
  const sc = Math.round(0.6 * (P.reduce((a, p) => a + s(p), 0) / P.length) + 0.4 * s(low));
  const lab = sc >= 7 ? "Strong" : sc >= 5 ? "Good" : sc >= 3 ? "Medium" : "Risky";
  return { sc, lab, avg, low, weak, n: P.length };
}
function ticketStrength(t) {
  const legs = t.legs.map((l) => ({ l, ...legState(l) }));
  const open = legs.filter((x) => x.p != null && !(x.s && x.s.state === "post"));
  const st = strengthOf(open.map((x) => x.p));
  if (!st) return null;
  const weakest = open.slice().sort((a, b) => a.p - b.p)[0];
  return { ...st, weakest: weakest && { eid: weakest.l.eid, n: weakest.l.n, p: weakest.p } };
}
// ---- protection: a safer bet in the same game, or a small bet on the opposite of the weakest bet ----
function saferOf(m, n) {
  let k;
  const out = [];
  if ((k = n.match(/^(.+) win$/))) out.push(k[1] + " or draw");
  if (n === "Draw") out.push(m.h + " or draw", m.a + " or draw");
  if ((k = n.match(/^Over (\d+)\.5$/)) && +k[1] > 0) out.push("Over " + (+k[1] - 1) + ".5");
  if ((k = n.match(/^Under (\d+)\.5$/))) out.push("Under " + (+k[1] + 1) + ".5");
  if ((k = n.match(/^(.+) over (\d)\.5$/)) && +k[2] > 0) out.push(k[1] + " over " + (+k[2] - 1) + ".5");
  if ((k = n.match(/^Over (\d+)\.5 yellows$/)) && +k[1] > 1) out.push("Over " + (+k[1] - 1) + ".5 yellows");
  if ((k = n.match(/^Under (\d+)\.5 yellows$/))) out.push("Under " + (+k[1] + 1) + ".5 yellows");
  return out;
}
function oppositeOf(m, n) {
  let k;
  if ((k = n.match(/^(.+) win$/))) return k[1] === m.h ? m.a + " or draw" : m.h + " or draw";
  if ((k = n.match(/^(.+) or draw$/))) return k[1] === m.h ? m.a + " win" : m.h + " win";
  if (n === "Draw") return "No draw";
  if (n === "No draw") return "Draw";
  if ((k = n.match(/^Over (\d+\.5)$/))) return "Under " + k[1];
  if ((k = n.match(/^Under (\d+\.5)$/))) return "Over " + k[1];
  if ((k = n.match(/^Over (\d+\.5) yellows$/))) return "Under " + k[1] + " yellows";
  if ((k = n.match(/^Under (\d+\.5) yellows$/))) return "Over " + k[1] + " yellows";
  return null;
}
function protection(t) {
  const st = ticketStrength(t);
  if (!st || !st.weakest) return null;
  const w = st.weakest,
    m = byE[w.eid];
  if (!m) return null;
  const R = simOf(w.eid),
    L = markets(m);
  const P = (n) => {
    const x = L.find((k) => k.n === n);
    return x ? frac(R, x.f) + (x.pu ? frac(R, x.pu) : 0) : null;
  };
  const swap = saferOf(m, w.n)
    .map((n) => ({ n, p: P(n) }))
    .filter((x) => x.p != null && x.p > w.p + 0.04)[0];
  const opp = oppositeOf(m, w.n),
    po = opp ? P(opp) : null;
  const stake = t.stake || STAKE,
    odds = tOdds(t);
  // the cover bet pays back your stake if the weak bet loses: cover stake = ticket stake / (cover odds - 1)
  let cover = null;
  if (opp && po > 0.05 && po < 0.95) {
    const bo = (bookOdds(m, opp) || {}).o;
    const co = bo || +(0.93 / po).toFixed(2);
    if (co > 1.05) cover = { n: opp, p: po, o: co, oursOnly: !bo, stake: Math.ceil(stake / (co - 1) / 10) * 10, worth: odds ? odds * stake > (stake + stake / (co - 1)) * 1.3 : true };
  }
  return { weakest: w, m, swap: swap ? { ...swap, from: w.p } : null, cover };
}
// ---- "how many are missing": what a bet still needs, live ----
function needInfo(eid, n) {
  const m = byE[eid],
    s = S(eid);
  if (!m || !s || s.state === "pre") return null;
  const g = (s.h || 0) + (s.a || 0),
    y = (s.yh || 0) + (s.ya || 0);
  let k, need, done, txt;
  const pl = (x, w) => x + " more " + w + (x === 1 ? "" : "s");
  if ((k = n.match(/^Over (\d+)\.5$/))) {
    need = +k[1] + 1 - g;
    txt = need <= 0 ? "✓ done" : "needs " + pl(need, "goal");
    done = need <= 0;
  } else if ((k = n.match(/^Under (\d+)\.5$/))) {
    const room = +k[1] - g;
    txt = room < 0 ? "✗ too many goals" : room === 0 ? "no more goals allowed" : "can take " + pl(room, "goal");
    done = room < 0 ? false : null;
  } else if ((k = n.match(/^(.+) over (\d)\.5$/))) {
    const have = k[1] === m.h ? s.h : s.a;
    need = +k[2] + 1 - (have || 0);
    txt = need <= 0 ? "✓ done" : k[1] + " needs " + pl(need, "goal");
    done = need <= 0;
  } else if ((k = n.match(/^Over (\d+)\.5 yellows$/))) {
    need = +k[1] + 1 - y;
    txt = need <= 0 ? "✓ done" : "needs " + pl(need, "yellow card");
    done = need <= 0;
  } else if ((k = n.match(/^Under (\d+)\.5 yellows$/))) {
    const room = +k[1] - y;
    txt = room < 0 ? "✗ too many cards" : room === 0 ? "no more cards allowed" : "can take " + pl(room, "card");
  } else if ((k = n.match(/^(.+) (win|or draw)$/))) {
    const me = k[1] === m.h ? s.h : s.a,
      op = k[1] === m.h ? s.a : s.h,
      d = me - op;
    txt = k[2] === "win" ? (d > 0 ? "winning now" : d === 0 ? "needs 1 goal" : "needs " + (1 - d) + " goals") : d >= 0 ? (d > 0 ? "winning now" : "level now ✓") : "needs " + -d + " goal" + (-d > 1 ? "s" : "");
  } else if (n === "Draw") txt = g === 0 || s.h === s.a ? "level now ✓" : "needs " + Math.abs(s.h - s.a) + " goal";
  else if (n === "No draw") txt = s.h !== s.a ? "not level now ✓" : "needs 1 goal";
  else return null;
  return { txt, done, now: { g, y }, final: s.state === "post" };
}
// ---- what wins for you: your finished bets grouped by bet type (keep what works, drop what doesn't) ----
function betKind(n) {
  if (/ yellows$/.test(n)) return "Yellow cards";
  if (n === "Draw") return "X (draw)";
  if (n === "No draw") return "12";
  if (/ win$/.test(n)) return "W1 / W2";
  if (/ or draw$/.test(n)) return "1X / X2";
  if (/^Over \d/.test(n)) return "Total Over";
  if (/^Under \d/.test(n)) return "Total Under";
  if (/ over \d/.test(n)) return "Team total";
  return "Other";
}
function myBetStats() {
  const G = {};
  MY.filter((t) => t.real || !t.preset).forEach((t) =>
    t.legs.forEach((l) => {
      const s = S(l.eid);
      if (!s || s.state !== "post") return;
      const ls = legState(l);
      if (ls.p !== 1 && ls.p !== 0) return;
      const k = betKind(l.n);
      const g = (G[k] = G[k] || { k, n: 0, w: 0, exp: 0, ne: 0 });
      g.n++;
      g.w += ls.p;
      const p0 = LEGP0[l.eid + "|" + l.n];
      if (p0 != null) {
        g.exp += p0;
        g.ne++;
      }
    }),
  );
  return Object.values(G).sort((a, b) => b.n - a.n);
}
// your tilt per bet type: after 6+ finished bets, types that win more than we expected rank a bit higher (max ±10%)
function myTilt(n) {
  const g = myBetStats().find((x) => x.k === betKind(n));
  if (!g || g.ne < 6) return 1;
  return clamp((g.w + 2) / (g.exp + 2), 0.9, 1.1);
}
// ---- history of the tickets the app suggested: saved before kick-off, settled at the final whistle ----
let SUG = (() => {
  const s = LS.get("mb_sug", []);
  const ids = new Set(s.map((x) => x.id));
  return SUG_SEED.filter((x) => !ids.has(x.id)).concat(s);
})();
const saveSug = () => LS.set("mb_sug", SUG.filter((x) => !SUG_SEED.some((y) => y.id === x.id)).slice(-400));
function recordSuggestions(date, C) {
  if (date < ymdOf(new Date())) return;
  let ch = false;
  C.forEach((c) => {
    if (c.wait || !c.legs || !c.legs.length) return;
    const id = date + "|" + c.id;
    if (SUG.some((x) => x.id === id)) return;
    if (!c.legs.every((l) => S(l.eid).state === "pre")) return;
    SUG.push({ id, date, cid: c.id, title: c.title, fair: +c.fair.toFixed(2), t: Date.now(), legs: c.legs.map((l) => ({ eid: l.eid, lg: l.lg, n: l.n, p: +l.p.toFixed(3) })) });
    ch = true;
  });
  if (ch) saveSug();
}
function sugStatus(x) {
  if (x.res) return { res: x.res, legs: x.legs.map((l) => ({ ...l, st: l.ok ? "won" : "lost" })) };
  const legs = x.legs.map((l) => {
    const ls = legState(l),
      s = ls.s;
    const st = !s ? "wait" : s.state === "post" ? (ls.p >= 0.5 ? "won" : "lost") : s.state === "in" ? (ls.p >= 0.995 ? "won" : ls.p <= 0.005 ? "lost" : "live") : "wait";
    return { ...l, st, now: ls.p };
  });
  const res = legs.some((l) => l.st === "lost") ? "LOST" : legs.every((l) => l.st === "won") ? "WON" : legs.some((l) => l.st === "live" || l.st === "won") ? "LIVE" : "WAITING";
  if ((res === "WON" || (res === "LOST" && legs.every((l) => l.st === "won" || l.st === "lost"))) && !x.res && legs.every((l) => l.st === "won" || l.st === "lost")) {
    x.res = res;
    x.legs = legs.map((l) => ({ eid: l.eid, lg: l.lg, n: l.n, p: l.p, ok: l.st === "won" ? 1 : 0 }));
    saveSug();
  }
  return { res, legs };
}
const HISTLOAD = {};
async function loadHistory() {
  // a ticket can span several days (e.g. Friday to Sunday): load its first day and the next two
  const dates = [...new Set(SUG.filter((x) => !x.res).flatMap((x) => [x.date, nextYmd(x.date), nextYmd(nextYmd(x.date))]))];
  for (const d of dates) {
    if (HISTLOAD[d] || DAYLOAD[d]) continue;
    HISTLOAD[d] = 1;
    await Promise.all(LEAGUES.map(([lg]) => pollBoard(lg, d)));
  }
  emit();
}
function sugHistory() {
  return SUG.slice()
    .sort((a, b) => (a.date === b.date ? (a.t || 0) - (b.t || 0) : a.date < b.date ? 1 : -1))
    .map((x) => ({ ...x, ...sugStatus(x) }));
}
function sugRecord() {
  const H = sugHistory().filter((x) => x.res === "WON" || x.res === "LOST");
  const won = H.filter((x) => x.res === "WON");
  return { n: H.length, won: won.length, lost: H.length - won.length, back: won.reduce((a, x) => a + bookPay(x), 0), staked: H.length };
}
// what 1win would roughly pay: our odds minus the bookie's cut (about 5% per bet, measured on 5,202 games)
const bookPay = (x) => x.fair * Math.pow(0.95, x.legs.length);

// ---- AI challenge: play money, the app stakes on its own suggested tickets by a fixed rule ----
const CH_MODES = {
  steady: { cid: "safe3", f: 0.1, name: "Steady", desc: "10% of the money each day on Safe 3" },
  bold: { cid: "fav", f: 0.1, name: "Bold", desc: "10% each day on Favourites 4+" },
  chase: { cid: "safe3", f: 1, until: 10, name: "Chase 10x", desc: "everything on Safe 3 every day until 10x – or nothing" },
};
let CH = LS.get("mb_ch", null);
function startChallenge(start, mode) {
  CH = { start: +start, mode, from: ymdOf(new Date()), t: Date.now() };
  LS.set("mb_ch", CH);
  emit();
}
function stopChallenge() {
  CH = null;
  LS.set("mb_ch", null);
  emit();
}
function challengeState() {
  if (!CH) return null;
  const M_ = CH_MODES[CH.mode] || CH_MODES.steady;
  let bank = CH.start,
    done = null;
  const log = [];
  const days = sugHistory()
    .filter((x) => x.cid === M_.cid && x.date >= CH.from)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const end = ymdOf(new Date(new Date(+CH.from.slice(0, 4), +CH.from.slice(4, 6) - 1, +CH.from.slice(6, 8) + 30)));
  let pending = null;
  for (const x of days) {
    if (x.date >= end || done) break;
    const stake = Math.round(bank * M_.f);
    const odds = +bookPay(x).toFixed(2);
    if (x.res === "WON" || x.res === "LOST") {
      const win = x.res === "WON" ? Math.round(stake * odds) : 0;
      bank = bank - stake + win;
      log.push({ date: x.date, title: x.title, stake, odds, res: x.res, bank });
      if (M_.until && bank >= CH.start * M_.until) done = "GOAL";
      if (bank < 50) done = "BUST";
    } else pending = { date: x.date, title: x.title, stake, odds, res: x.res, legs: x.legs };
  }
  if (!done && ymdOf(new Date()) >= end) done = "END";
  return { ...CH, mode: M_, key: CH.mode, bank, log, pending: done ? null : pending, done, end };
}

// ---- why this prediction: what we looked at, in plain words ----
function whyOf(eid) {
  const m = byE[eid];
  if (!m) return null;
  const R = simOf(eid);
  const H = frac(R, (R, n) => R.GH[n] > R.GA[n]),
    D = frac(R, (R, n) => R.GH[n] === R.GA[n]),
    A = 1 - H - D;
  const nat = !CLUB_LEAGUES.has(m.lg) && eloOf(m.h) != null && eloOf(m.a) != null;
  const club = !nat && clubKey(m.lg, m.h) && clubKey(m.lg, m.a);
  const pts = [];
  const team = (name, side) => {
    const o = { name, side };
    if (nat) {
      const k = eloKey(name);
      o.rank = tdbRank(k);
      const [att, def] = formX(k);
      o.att = att;
      o.def = def;
      const I = tdbInfo(k, "nt", 6);
      if (I) o.form = I.last.slice(0, 5);
    } else if (club) {
      const cr = clubRating(m.lg, name);
      if (cr) {
        o.rating = cr.r;
        o.att = cr.att;
        o.def = cr.def;
        o.yf = cr.y;
      }
    }
    const f = FORM[m.eid] && FORM[m.eid][side === 0 ? "h" : "a"];
    if (!o.form && f) o.form = f;
    return o;
  };
  const th = team(m.h, 0),
    ta = team(m.a, 1);
  // 1. who is stronger
  const fav = H > A ? th : ta,
    gap = Math.abs(H - A);
  if (nat && th.rank && ta.rank) pts.push({ k: "strength", t: `${m.h} are #${th.rank.rank} in our world ranking, ${m.a} #${ta.rank.rank}.` });
  else if (club && th.rating && ta.rating) {
    const d = th.rating - ta.rating;
    pts.push({ k: "strength", t: Math.abs(d) < 40 ? `${m.h} and ${m.a} are about as strong as each other this season.` : `${d > 0 ? m.h : m.a} are clearly the stronger team on this season's results.` });
  } else pts.push({ k: "strength", t: `We have little history for these teams, so we lean on their league's averages.` });
  // 2. form
  [th, ta].forEach((x) => {
    const bits = [];
    if (x.att != null) bits.push(x.att > 1.12 ? "scoring more than usual lately" : x.att < 0.88 ? "scoring less than usual lately" : "");
    if (x.def != null) bits.push(x.def > 1.12 ? "letting in more than usual" : x.def < 0.88 ? "very tight at the back" : "");
    const b = bits.filter(Boolean);
    if (x.form && x.form.length) {
      const fs = x.form.map((g) => g.r || g).join("");
      pts.push({ k: "form", t: `${x.name}: last games ${fs}${b.length ? " – " + b.join(", ") : ""}.`, form: x.form });
    } else if (b.length) pts.push({ k: "form", t: `${x.name}: ${b.join(", ")}.` });
  });
  // 2b. clubs: table, goals, new signings, cards (this week's data)
  if (!nat && weekData()) {
    const wh = teamWeek(m.h),
      wa = teamWeek(m.a);
    const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
    const tl = [wh, wa].filter((w) => w && w.st).map((w) => `${w.n} ${ord(w.st.rank)}${w.st.group ? " in " + w.st.group : ""} (${w.st.pts} pts from ${w.st.gp} games)`);
    if (tl.length) pts.push({ k: "table", t: "Table: " + tl.join(" · ") + "." });
    const kp = [wh, wa].filter(Boolean).map((w) => {
      const p = keyPlayers(w, 2);
      return p.length ? `${w.n}: ${p.map((x) => `${x[0]} ${x[5]}`).join(", ")}` : "";
    }).filter(Boolean);
    if (kp.length) pts.push({ k: "players", t: "Top scorers this season – " + kp.join(" · ") + "." });
    const sg = [wh, wa].filter((w) => w && w.tr && w.tr.in.length).map((w) => `${w.n} signed ${w.tr.in.length} (e.g. ${signings(w, 3).map((x) => x[1]).join(", ")})`);
    if (sg.length) pts.push({ k: "signings", t: "Summer transfers: " + sg.join(" · ") + "." });
    const cm = [wh, wa].filter(Boolean).flatMap((w) => cardMen(w, 1).map((x) => `${x[0]} (${w.n}) ${x[8]} yellows`));
    if (cm.length) pts.push({ k: "cards", t: "Most booked: " + cm.join(" · ") + "." });
    [wh, wa].forEach((w, i) => {
      if (w && w.form && w.form.length && !pts.some((p) => p.k === "form" && p.t.startsWith(w.n))) {
        pts.push({ k: "form", t: `${w.n}: last games ${w.form.slice(0, 5).map((g) => (g[2] > g[3] ? "W" : g[2] === g[3] ? "D" : "L")).join("")} (${w.form.slice(0, 3).map((g) => (g[4] ? "v " : "@ ") + g[1] + " " + g[2] + "-" + g[3]).join(", ")}).`, side: i });
      }
    });
  }
  // 3. home / neutral
  pts.push({ k: "home", t: m.neu ? "Neutral ground – no home advantage." : `${m.h} play at home – that's worth about a third of a goal.` });
  // 4. head to head (national teams)
  if (nat) {
    const h2 = tdbH2H(eloKey(m.h), eloKey(m.a), "nt", 5);
    if (h2 && h2.all) pts.push({ k: "h2h", t: `Last ${h2.all} meeting${h2.all > 1 ? "s" : ""} since 2018: ${m.h} won ${h2.w}, ${h2.d} draw${h2.d === 1 ? "" : "s"}, ${m.a} won ${h2.l}. (Counts only a little – old games say less than form.)` });
  }
  // 5. goals and cards we expect
  const tg = m.lam[0] + m.lam[1];
  pts.push({ k: "goals", t: `We expect about ${tg < 1.8 ? "1–2" : tg < 2.6 ? "2–3" : "3 or more"} goals: ${m.h} around ${m.lam[0].toFixed(1)}, ${m.a} around ${m.lam[1].toFixed(1)}.` });
  if (m.y) pts.push({ k: "cards", t: `Yellow cards: about ${(m.y[0] + m.y[1]).toFixed(1)} in the game${club && (th.yf > 1.15 || ta.yf > 1.15) ? ` – ${th.yf > ta.yf ? m.h : m.a} pick up more cards than most` : ""}.` });
  // 6. bookies
  const bh = bookOdds(m, m.h + " win"),
    ba = bookOdds(m, m.a + " win");
  if (bh && ba) {
    const d = H - bh.p;
    pts.push({ k: "book", t: Math.abs(d) <= 0.05 ? "The bookies see it almost the same way ✓" : `The bookies rate ${d > 0 ? m.a : m.h} a bit higher than we do – when we disagree, take extra care.` });
  }
  const st = S(eid);
  const now = st.state === "in" ? `${st.h > st.a ? m.h + " lead" : st.h < st.a ? m.a + " lead" : "Level"} ${st.h}-${st.a} at ${st.clock || st.min + "'"} – ` : "";
  const verdict = now + (gap < 0.1 ? (now ? "a close game, no clear favourite." : "A close game – no clear favourite.") : `${fav.name} are ${gap > 0.35 ? "clear" : "slight"} favourites${now ? " now" : ""}.`);
  const tr = club ? leagueTrust(m.lg) : null;
  if (tr) pts.push({ k: "trust", t: tr === 3 ? "We predict this league well (tested on last season's games) ★★★" : tr === 2 ? "We predict this league okay ★★ – results can surprise." : "This league is very even and hard to predict ★ – it is kept out of our ready tickets. Take care." });
  return {
    H, D, A, verdict, pts, nat, club, trust: tr,
    how: [
      "We rate every team from all its past results – wins against strong teams and big wins count more.",
      "Recent games count more than old ones, so a team in form moves up fast.",
      "We add home advantage, then play this match 20,000 times on the computer.",
      "Our % = how often each result happened in those 20,000 games.",
    ],
    data: nat ? "National teams: every international since 1872, updated with this season's games." : club ? ((clubTest(m.lg) ? `This league: tested on the last ${clubTest(m.lg)[2]} games, our % beat the league average by ${Math.round((1 - clubTest(m.lg)[0] / clubTest(m.lg)[1]) * 1000) / 10}%. ` : "Big 5 leagues: 19,760 games since 2015. ") + "Results, squads and tables: ESPN · transfers: Wikipedia (CC BY-SA).") : "League averages.",
  };
}
// ---- best picks per team (for people building their own tickets) ----
function bestPicks(eid) {
  const m = byE[eid];
  if (!m) return null;
  const R = simOf(eid),
    s = S(eid);
  const L = markets(m);
  const P = (n) => {
    const x = L.find((k) => k.n === n);
    return x ? { n, p: frac(R, x.f), v: valueOf(m, n, frac(R, x.f)) } : null;
  };
  const alive = (x) => x && x.p > 0.02 && x.p < 0.995;
  const team = (t) =>
    [t + " win", t + " or draw", t + " over 0.5", t + " over 1.5"]
      .map(P)
      .filter(alive)
      .sort((a, b) => b.p - a.p)
      .slice(0, 3);
  const match = ["Over 1.5", "Over 2.5", "Under 2.5", "Under 3.5", "Under 4.5", "Draw", "Over 2.5 yellows", "Over 3.5 yellows", "Under 4.5 yellows", "Under 5.5 yellows"]
    .map(P)
    .filter((x) => alive(x) && x.p >= 0.5)
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  return { h: team(m.h), a: team(m.a), x: match, live: s.state === "in", done: s.state === "post" };
}
function addPick(eid, n) {
  const m = byE[eid];
  if (!m) return;
  const s = S(eid);
  const d = DRAFT.slice();
  const i = d.findIndex((l) => l.eid === eid && l.n === n);
  if (i >= 0) d.splice(i, 1);
  else {
    const dt = s.date ? new Date(s.date) : null;
    d.push({
      eid,
      lg: m.lg,
      date: dt ? dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, "0") + String(dt.getDate()).padStart(2, "0") : CUR.date,
      n,
      o: null,
    });
  }
  setDraft(d);
}
const inDraft = (eid, n) => DRAFT.some((l) => l.eid === eid && l.n === n);

function signal(t, P, E, res, legs) {
  const stake = t.stake || STAKE,
    odds = tOdds(t),
    fair = E != null ? stake * E : null;
  const started = legs.some((l) => l.s && l.s.state !== "pre");
  const left = legs.filter((l) => l.s && !(l.s.state !== "pre" && (l.p === 0 || l.p === 1))).length;
  if (res === "WON") return { cls: "won", big: "WON", txt: `Pays CLP ${odds ? Math.round(stake * odds).toLocaleString("en-US") : "–"}` };
  if (res === "LOST") return { cls: "lost", big: "LOST", txt: "One bet lost. Nothing to take." };
  if (!started) {
    return { cls: "pre", big: "NOT STARTED", txt: "" };
  }
  if (!odds) return { cls: "pre", big: "TYPE ODDS", txt: "Type the " + BOOK + " odds on this ticket to see what it is worth." };
  const o = parseFloat(CO[t.id]);
  if (o > 0 && fair) {
    const pay = stake * odds,
      q = clamp(E / odds, 0, 1),
      B = Math.max(BANK, stake * 2),
      CE = Math.exp(q * Math.log(B + pay) + (1 - q) * Math.log(B)) - B;
    if (o >= fair)
      return { cls: "cash", big: "TAKE THE MONEY", txt: `Take it: ${BOOK} pays more than your ticket is worth (worth ${clp0(fair)}).` };
    if (o >= CE)
      return {
        cls: "close",
        big: "UP TO YOU",
        txt: `Fair deal for safety: you give up ${clp0(fair - o)} on average to lock in ${clp0(o)}.`,
      };
    return { cls: "hold", big: "KEEP IT", txt: `Too low. Worth ${clp0(fair)}; I'd only take ${clp0(Math.max(CE, 0))} or more.` };
  }
  return {
    cls: "hold",
    big: "KEEP IT",
    txt: `Keep it. Only take money if ${BOOK} offers ${fair ? clp0(fair) : "–"} or more${left === 1 ? " (1 bet left)" : ""}.`,
  };
}
const clp0 = (x) => "CLP " + Math.round(x).toLocaleString("en-US");
const CLOSE = LS.get("mb_close", {});
function closeKey(l) {
  return l.eid + "|" + l.n;
}
function snapClose(eid) {
  const m = byE[eid];
  if (!m) return;
  MY.forEach((t) =>
    t.legs.forEach((l) => {
      if (l.eid !== eid || CLOSE[closeKey(l)]) return;
      const k = (legMk(l) || {}).k;
      if (!k) return;
      const lo = LO[eid];
      const s = S(eid);
      const fresh = lo && s.date && lo.t > new Date(s.date) - 45 * 60000;
      const pr = (fresh && lo.o[k]) || (m.odds && m.odds[k]);
      if (pr) CLOSE[closeKey(l)] = { p: pr, fresh: !!fresh };
    }),
  );
  LS.set("mb_close", CLOSE);
}
function clvOf(t) {
  const ls = t.legs.filter((l) => l.o > 1 && CLOSE[closeKey(l)]);
  if (!ls.length) return null;
  const a = ls.reduce((x, l) => x * l.o, 1),
    b = ls.reduce((x, l) => x * CLOSE[closeKey(l)].p, 1);
  return {
    v: a / b - 1,
    n: ls.length,
    of: t.legs.length,
    beat: ls.filter((l) => l.o > CLOSE[closeKey(l)].p).length,
    fresh: ls.every((l) => CLOSE[closeKey(l)].fresh),
  };
}
const SAFE_STYLE = { ultra: [0.85, 0.94, "Ultra safe"], safe: [0.8, 0.9, "Safe"], fire: [0.7, 0.82, "Fire (bigger odds)"] };
function safeCands(m) {
  return [`${m.h} or draw`, `${m.a} or draw`, "Over 0.5", "Over 1.5", "Over 2.5", "Under 2.5", "Under 3.5", "Under 4.5", `${m.h} win`, `${m.a} win`, `${m.h} over 0.5`, `${m.a} over 0.5`, "Over 2.5 yellows", "Under 5.5 yellows"];
}
const FORM = {};
async function loadForm(m) {
  if (FORM[m.eid]) return FORM[m.eid];
  try {
    const sm = await J(BASE(m.lg) + "summary?event=" + m.eid, 600000);
    const o = {};
    (sm.lastFiveGames || []).forEach((t) => {
      const side = t.team && (t.team.abbreviation === m.hA || (m.tid && t.team.id === m.tid[0])) ? "h" : "a";
      o[side] = (t.events || [])
        .slice(-5)
        .map((e) => ({ d: e.gameDate, at: e.atVs, op: e.opponent && e.opponent.abbreviation, sc: e.score, r: e.gameResult }));
    });
    const ss = (sm.seasonseries || [])[0];
    o.h2h =
      ss && ss.events
        ? ss.events.map((e) => ({
            d: e.date,
            sc: (e.competitors || []).map((c) => c.team && c.team.abbreviation + " " + c.score).join(" – "),
          }))
        : [];
    return (FORM[m.eid] = o);
  } catch (e) {
    return (FORM[m.eid] = {});
  }
}
const OH = LS.get("mb_oh", {});
function recordOdds(eid, o, src) {
  if (!o || !o.H) return;
  const a = (OH[eid] = OH[eid] || []);
  const last = a[a.length - 1];
  const p = pdev([o.H, o.D, o.A]);
  const ov = o["O2.5"] && o["U2.5"] ? pdev([o["O2.5"], o["U2.5"]])[0] : null;
  if (last && Math.abs(last.h - p[0]) < 0.002 && Math.abs(last.a - p[2]) < 0.002 && Date.now() - last.t < 3600000) return;
  a.push({ t: Date.now(), h: +p[0].toFixed(4), d: +p[1].toFixed(4), a: +p[2].toFixed(4), o: ov != null ? +ov.toFixed(4) : null, src });
  if (a.length > 200) a.shift();
  LS.set("mb_oh", OH);
}
const PING = [];
let lastSeen = {};
function pingNew(eid) {
  const s = S(eid);
  const key = eid;
  const prev = lastSeen[key] || { sh: s.shots.length, co: s.corn.length, ev: s.ev.length };
  if (eid === SEL) {
    s.shots.slice(prev.sh).forEach((sh) => {
      const [x, y] = shotXY(sh);
      PING.push({
        x,
        y,
        t: Date.now(),
        txt: (sh.goal ? "GOAL " : "Shot ") + (sh.who || "") + " · xG " + sh.xg.toFixed(2),
        c: sh.goal ? "#ff3d9a" : "#3df5ff",
      });
    });
    s.corn.slice(prev.co).forEach((c) => {
      const top = (c[0] * 7) % 2;
      PING.push({
        x: c[1] === 0 ? X0 + PW - 6 : X0 + 6,
        y: top ? Y0 + 6 : Y0 + PH - 6,
        t: Date.now(),
        txt: "Corner " + (c[1] === 0 ? byE[eid].hA : byE[eid].aA),
        c: "#ffd25a",
      });
    });
    s.ev
      .slice(prev.ev)
      .filter((e) => /card/.test(e.ty))
      .forEach((e) => {
        PING.push({
          x: X0 + PW / 2,
          y: Y0 + 40,
          t: Date.now(),
          txt: (/red/.test(e.ty) ? "🟥 " : "🟨 ") + (e.pl[0] || ""),
          c: /red/.test(e.ty) ? "#ff5468" : "#ffd25a",
        });
      });
  }
  lastSeen[key] = { sh: s.shots.length, co: s.corn.length, ev: s.ev.length };
}
function liveBets(m, s) {
  const R = simOf(m.eid),
    t = s.h + s.a,
    y = (s.yh || 0) + (s.ya || 0),
    lo = LO[m.eid];
  const live = lo && lo.live && Date.now() - lo.t < 360000;
  const L = markets(m);
  const want = new Set([
    `Over ${t + 0.5}`,
    `Under ${t + 0.5}`,
    `Over ${t + 1.5}`,
    `Under ${t + 1.5}`,
    `Under ${t + 2.5}`,
    `${m.h} win`,
    "Draw",
    `${m.a} win`,
    `${m.h} or draw`,
    `${m.a} or draw`,
    `${m.h} over ${(s.h || 0) + 0.5}`,
    `${m.a} over ${(s.a || 0) + 0.5}`,
    `Over ${y + 0.5} yellows`,
    `Over ${y + 1.5} yellows`,
    `Under ${y + 1.5} yellows`,
    `Under ${y + 2.5} yellows`,
  ]);
  return L.filter((x) => want.has(x.n) && shown(x.n))
    .map((x) => {
      const p = frac(R, x.f);
      const od = live && x.k ? lo.o[x.k] : null;
      const ev = od ? p * od - 1 : null,
        vv = valueOf(m, x.n, p);
      return { ag: !!(vv && vv.agree && od), n: x.n, k: x.k, p, fair: 1 / Math.max(p, 1e-6), min: 1.05 / Math.max(p, 1e-6), od, ev, need: needInfo(m.eid, x.n) };
    })
    .filter((b) => b.p > 0.03 && b.p < 0.97)
    .sort((a, b) => (b.ev != null ? b.ev : -1) - (a.ev != null ? a.ev : -1) || Math.abs(a.p - 0.55) - Math.abs(b.p - 0.55));
}
// "best odds now": bets we still like (our % 55%+), highest odds first; 1win odds shown when we have them
function bestOddsNow(eid, k = 5) {
  const m = byE[eid],
    s = S(eid);
  if (!m || !s) return [];
  let L;
  if (s.state === "in") L = liveBets(m, s);
  else {
    const R = simOf(eid);
    L = marketsShown(m).map((x) => {
      const p = frac(R, x.f),
        v = valueOf(m, x.n, p);
      return { n: x.n, p, fair: 1 / Math.max(p, 1e-6), od: v && v.odds, ev: v && v.ev != null ? v.ev - 1 : null, ag: !!(v && v.agree) };
    });
  }
  // highest odds first, at most 2 of one kind (1X2 / goals / cards) so the list stays varied
  const kind = (n) => (/yellows$/.test(n) ? "c" : /^(Over|Under)| over /.test(n) ? "g" : "r");
  const cnt = {};
  return L.filter((b) => b.p >= 0.55 && b.p <= 0.92)
    .sort((a, b) => (b.od || b.fair) - (a.od || a.fair))
    .filter((b) => (cnt[kind(b.n)] = (cnt[kind(b.n)] || 0) + 1) <= 2)
    .slice(0, k);
}
const PREF = Object.assign(
  { pitch: "compact", strip: "all", mom: true, playing: true, bets: true, pMk: true, pSt: true, pEv: true, pLu: true, pCx: true },
  LS.get("mb_layout", {}),
);
let N100 = false;
const CLOSEF = {};
async function tick() {
  const boards = new Set([CUR.lg + "|" + CUR.date]);
  if (DAY)
    LEAGUES.forEach(([lg]) => {
      if ((BOARD[lg + "|" + DAY] || []).some((e) => S(e).state !== "post")) boards.add(lg + "|" + DAY);
    });
  MY.forEach((t) => t.legs.forEach((l) => boards.add(l.lg + "|" + l.date)));
  await Promise.all(
    [...boards].map((b) => {
      const [lg, d] = b.split("|");
      return pollBoard(lg, d);
    }),
  );
  const ids = new Set([SEL]);
  Object.keys(ST).forEach((e) => {
    if (ST[e].state === "in" && (inTickets(e) || (BOARD[CUR.lg + "|" + CUR.date] || []).includes(e))) ids.add(e);
  });
  MY.forEach((t) =>
    t.legs.forEach((l) => {
      if (ST[l.eid] && ST[l.eid].state === "post" && !ST[l.eid].box_done) {
        ids.add(l.eid);
        ST[l.eid].box_done = 1;
      }
    }),
  );
  await Promise.all([...ids].map(pollSummary));
  // live odds: every 3 minutes while a ticket match is live (saves free credits)
  const soon = [
    ...new Set(
      MY.flatMap((t) =>
        t.legs
          .filter((l) => {
            const z = ST[l.eid];
            return z && z.state === "pre" && z.date && new Date(z.date) - Date.now() < 20 * 60000 && new Date(z.date) - Date.now() > 0;
          })
          .map((l) => l.lg),
      ),
    ),
  ].filter((lg) => !(CLOSEF[lg] > Date.now() - 15 * 60000));
  if (soon.length) {
    soon.forEach((lg) => (CLOSEF[lg] = Date.now()));
    await pollLiveOdds(soon);
  }
  const liveT = [...new Set(MY.flatMap((t) => t.legs.filter((l) => ST[l.eid] && ST[l.eid].state === "in").map((l) => l.lg)))];
  if (liveT.length && Date.now() - LOT > 180000) await pollLiveOdds(liveT);
  Object.keys(ST).forEach((eid) => {
    if (byE[eid] && (ST[eid].state === "in" || !SIMS[eid])) simulate(eid, eid === SEL && N100 ? 100000 : 20000);
  });
  checkAlerts();
  liveIdeas();
  drawAll();
}
function setLam(m, lh, la, note) {
  m.lam = [lh, la];
  m.g = gridOf(lh, la);
  m.note = note;
  delete SIMS[m.eid];
}
function applyFreshOdds(m) {
  // fresh bookmaker prices are only stored for comparison ("1win %"); our own % is never mixed with them
  const lo = LO[m.eid];
  if (!lo || S(m.eid).state !== "pre") return false;
  m.odds = Object.assign({}, m.odds || {}, lo.o);
  return false;
}
const avgR = (ps) => {
  const r = ps
    .filter((p) => p.starter)
    .map((p) => RT[p.id] && RT[p.id].OVR)
    .filter(Boolean);
  return r.length >= 8 ? r.reduce((a, b) => a + b, 0) / r.length : null;
};
async function lineupStrength(m) {
  const lu = LU[m.eid];
  if (!lu || !/Confirmed/.test(lu.h.src + lu.a.src) || lu.str) return;
  const str = {};
  for (const side of ["h", "a"]) {
    const T = lu[side];
    if (!/Confirmed/.test(T.src)) continue;
    try {
      const pid = await prevEvent(m, side);
      const ps = await J(BASE(m.lg) + "summary?event=" + pid, Infinity);
      const ab = side === "h" ? m.hA : m.aA,
        tid = (m.tid || [])[side === "h" ? 0 : 1];
      const r2 = (ps.rosters || []).find((r) => r.team && (r.team.abbreviation === ab || (tid && r.team.id === tid)));
      const prev = r2 ? parseRoster(r2) : [];
      await Promise.all(prev.filter((p) => p.starter).map((p) => rate(p).catch(() => {})));
      const a = avgR(T.players),
        b = avgR(prev);
      if (a != null && b != null) {
        const ids = new Set(T.players.filter((p) => p.starter).map((p) => p.id));
        str[side] = { now: a, prev: b, out: prev.filter((p) => p.starter && !ids.has(p.id)).map((p) => p.name) };
      }
    } catch (e) {}
  }
  lu.str = str;
  if (S(m.eid).state !== "pre") return;
  if (!m.lineupOdds && (LOC == null || LOC > 20)) {
    m.lineupOdds = 1;
    await pollLiveOdds([m.lg]);
  }
  if (!applyFreshOdds(m)) {
    const dh = str.h ? str.h.now - str.h.prev : 0,
      da = str.a ? str.a.now - str.a.prev : 0;
    if (dh || da) {
      const base = m.lam0 || (m.lam0 = m.lam.slice());
      const c = (x) => clamp(x, 0.88, 1.12);
      setLam(
        m,
        base[0] * c((1 + 0.01 * dh) * (1 - 0.006 * da)),
        base[1] * c((1 + 0.01 * da) * (1 - 0.006 * dh)),
        "adjusted for lineup changes (our estimate)",
      );
    }
  }
  if (m.eid === SEL) drawAll();
}
const CTX = {};
async function loadContext(m) {
  if (CTX[m.eid]) return CTX[m.eid];
  const c = {};
  try {
    const st = await J("https://site.api.espn.com/apis/v2/sports/soccer/" + m.lg + "/standings", 1800000);
    (st.children || [{ standings: st.standings }]).forEach((g) => {
      const E = (g.standings && g.standings.entries) || [];
      const rows = E.map((e) => {
        const s = {};
        e.stats.forEach((x) => (s[x.name] = +x.value));
        return {
          ab: e.team.abbreviation,
          id: e.team.id,
          pts: s.points || 0,
          gp: s.gamesPlayed || 0,
          rank: s.rank || 0,
          gd: s.pointDifferential || 0,
        };
      });
      ["h", "a"].forEach((side) => {
        const ab = side === "h" ? m.hA : m.aA,
          tid = (m.tid || [])[side === "h" ? 0 : 1];
        const me = rows.find((r) => r.ab === ab || (tid && r.id === tid));
        if (!me) return;
        const n = rows.length,
          tot = m.lg === "uefa.nations" ? 2 * (n - 1) : (n - 1) * 2,
          rem = Math.max(0, tot - me.gp);
        const sorted = rows.slice().sort((a, b) => a.rank - b.rank);
        const above = sorted[me.rank - 2],
          below = sorted[me.rank];
        const mx = (r) => r.pts + 3 * Math.max(0, tot - r.gp);
        let txt;
        if (m.lg !== "uefa.nations") txt = `${me.rank}. place, ${me.pts} pts after ${me.gp} games`;
        else {
          const lockedUp = !above || mx(me) < above.pts,
            lockedDown = !below || mx(below) < me.pts;
          txt =
            `${(g.name || "").replace("League ", "")} · ${me.rank}. of ${n}, ${me.pts} pts, ${rem} game${rem === 1 ? "" : "s"} left` +
            (rem === 0
              ? ""
              : lockedUp && lockedDown
                ? " · position already decided, may rotate players"
                : me.rank === 1 && lockedDown
                  ? " · group won"
                  : lockedUp
                    ? " · can only defend its place"
                    : " · still fighting for a higher place");
        }
        c[side] = txt;
      });
    });
  } catch (e) {}
  for (const side of ["h", "a"]) {
    try {
      const pid = await prevEvent(m, side);
      const ps = await J(BASE(m.lg) + "summary?event=" + pid, Infinity);
      const d = ps.header && ps.header.competitions[0].date;
      const k = S(m.eid).date;
      if (d && k) {
        const days = Math.round((new Date(k) - new Date(d)) / 864e5);
        c["r" + side] = days;
      }
    } catch (e) {}
  }
  return (CTX[m.eid] = c);
}

// ---- stake advice: fractional Kelly with hard cap; price check vs fair ----
function stakeAdvice(legs, odds) {
  if (!legs.length) return null;
  const t = { legs, odds };
  const P = ticketP(t);
  if (P == null || !(P > 0)) return null;
  const fair = 1 / P;
  if (!(odds > 1)) return { fair };
  const edge = P * odds - 1,
    frac = legs.length === 1 ? 0.25 : legs.length <= 3 ? 0.15 : 0.1;
  const f = edge > 0 ? Math.min(0.02, (frac * edge) / (odds - 1)) : 0;
  const st = Math.round((f * BANK) / 500) * 500;
  return { fair, edge, stake: st, price: odds / fair - 1 };
}
function weekSpent() {
  const w0 = Date.now() - 7 * 864e5;
  return MY.filter((t) => !t.preset && +String(t.id).slice(1) > w0).reduce((a, t) => a + (+t.stake || 0), 0);
}
const SAFE = Object.assign({ budget: 20000, max: 5000 }, LS.get("mb_safe", {}));
function setSafe(k, v) {
  SAFE[k] = v;
  LS.set("mb_safe", SAFE);
  emit();
}
// ---------- actions for the UI ----------
function sharesFor(eid) {
  const lu = LU[eid];
  if (!lu) return null;
  return (SHR[eid] = Object.assign({}, shares(lu.h.players), shares(lu.a.players)));
}
function selectMatch(eid) {
  if (!byE[eid]) return;
  SEL = eid;
  N100 = false;
  delete SIMS[SEL];
  simulate(SEL, 20000);
  emit();
  if (!LU[SEL]) loadLineup(byE[SEL]);
  pollSummary(SEL).then(() => {
    delete SIMS[SEL];
    emit();
  });
}
async function setCompetition(lg, date) {
  CUR = { lg, date };
  LS.set("mb_lg", lg);
  emit();
  await pollBoard(lg, date);
  const ids = BOARD[lg + "|" + date] || [];
  if (ids.length) selectMatch(ids.find((e) => S(e).state === "in") || ids[0]);
  emit();
}
function run100k() {
  const t = performance.now();
  N100 = true;
  simulate(SEL, 100000);
  emit();
  return Math.round(performance.now() - t);
}
function saveTickets() {
  LS.set(
    "mb_tickets",
    MY.filter((x) => !x.preset),
  );
}
function addTicket(t) {
  MY.push(t);
  saveTickets();
  emit();
}
function removeTicket(t) {
  MY = MY.filter((x) => x.id !== t.id);
  if (t.preset) {
    HID.push(t.id);
    LS.set("mb_hidden", HID);
  }
  saveTickets();
  emit();
}
function setDraft(d) {
  DRAFT = d;
  emit();
}
function setPref(k, v) {
  PREF[k] = v;
  LS.set("mb_layout", PREF);
  emit();
}
function setBank(v) {
  BANK = v;
  LS.set("mb_bank", v);
  emit();
}
async function enableNotif() {
  if (!("Notification" in window)) return false;
  let p = Notification.permission;
  if (p !== "granted") p = await Notification.requestPermission().catch(() => "denied");
  NOTIF = p === "granted";
  emit();
  return NOTIF;
}
async function refreshOdds() {
  await pollLiveOdds([byE[SEL].lg]);
  emit();
}
// ---- this season's results (ESPN), replayed into our ratings once a day ----
const INTL = ["uefa.nations", "fifa.friendly", "fifa.worldq.uefa", "fifa.worldq.conmebol", "fifa.worldq.concacaf", "fifa.worldq.afc", "fifa.worldq.caf", "uefa.euroq", "concacaf.nations.league", "fifa.world"];
const CLUBLG = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "chi.1", "bra.1", "arg.1", "mex.1", "usa.1", "col.1", "eng.2", "ned.1", "por.1", "bel.1", "tur.1", "sco.1"];
let SEASON = { nat: 0, club: 0 };
function parseResults(j, lg) {
  return (j.events || [])
    .map((e) => {
      const c = e.competitions && e.competitions[0];
      if (!c || !c.status || !c.status.type || c.status.type.state !== "post") return null;
      const H = c.competitors.find((x) => x.homeAway === "home"),
        A = c.competitors.find((x) => x.homeAway === "away");
      if (!H || !A || H.score == null || A.score == null) return null;
      const yel = (side) => (c.details || []).filter((d) => (d.yellowCard || /yellow/i.test((d.type && d.type.text) || "")) && d.team && String(d.team.id) === String(side.team.id)).length;
      const hasD = Array.isArray(c.details) && c.details.length > 0;
      return {
        d: String(e.date).slice(0, 10),
        h: H.team.displayName,
        a: A.team.displayName,
        hs: +H.score,
        as: +A.score,
        neu: !!c.neutralSite,
        t: lg === "fifa.friendly" ? "Friendly" : lg === "fifa.world" ? "FIFA World Cup" : "qualification",
        yh: hasD ? yel(H) : null,
        ya: hasD ? yel(A) : null,
      };
    })
    .filter(Boolean);
}
async function seasonGames(lg, from) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const to = ymdOf(y),
    key = "mb_ss_" + lg,
    c = LS.get(key, null);
  if (c && c.to === to && c.from === from) return c.g;
  if (from > to) return [];
  // ESPN takes one month per request (dates=YYYYMM)
  const months = [];
  for (let y = +from.slice(0, 4), mo = +from.slice(4, 6); y * 100 + mo <= +to.slice(0, 6); mo === 12 ? ((y += 1), (mo = 1)) : (mo += 1)) months.push(y + String(mo).padStart(2, "0"));
  try {
    const parts = await Promise.all(months.map((ym) => J(BASE(lg) + "scoreboard?dates=" + ym, 3600000).then((j) => parseResults(j, lg)).catch(() => [])));
    const lo = from.slice(0, 4) + "-" + from.slice(4, 6) + "-" + from.slice(6),
      hi = to.slice(0, 4) + "-" + to.slice(4, 6) + "-" + to.slice(6);
    const seen = new Set();
    const g = parts.flat().filter((x) => x.d >= lo && x.d <= hi && !seen.has(x.d + x.h) && seen.add(x.d + x.h));
    LS.set(key, { from, to, g });
    return g;
  } catch (e) {
    return (c && c.g) || [];
  }
}
function refreshLams() {
  Object.values(byE).forEach((m) => {
    const s = S(m.eid);
    if (s.state === "post") return;
    const own = ownLam(m);
    if (!own) return;
    m.lamModel = own.slice();
    m.lam = own.slice();
    m.g = gridOf(own[0], own[1]);
    const cy = cardsOf(m);
    if (cy) m.y = cy;
    delete SIMS[m.eid];
  });
}
async function loadSeason() {
  const info = ratingsInfo();
  const next = (d) => (d ? nextYmd(String(d).replace(/-/g, "")) : "20260701");
  const nat = (await Promise.all(INTL.map((lg) => seasonGames(lg, next(info.nat))))).flat().sort((a, b) => (a.d < b.d ? -1 : 1));
  SEASON.nat = applyNationalGames(nat);
  const clubs = await Promise.all(CLUBLG.map((lg) => seasonGames(lg, next(clubUpto(lg) || info.club))));
  SEASON.club = 0;
  CLUBLG.forEach((lg, i) => (SEASON.club += applyClubSeason(lg, clubs[i].sort((a, b) => (a.d < b.d ? -1 : 1)))));
  SEASON.t = Date.now();
  refreshLams();
  emit();
  return SEASON;
}
async function start() {
  // nightly ratings (Pages) first, so every new match is priced with the freshest team strengths
  await loadRatings();
  // this week's squads, tables, scorers and transfers (collected nightly) – in the background
  loadWeek().then((w) => w && emit()).catch(() => {});
  // this season's results: wait up to 5 s, then carry on (the update still lands when it arrives)
  await Promise.race([loadSeason().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  const d = new Date(),
    today = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const pref = LS.get("mb_lg", "uefa.nations");
  const order = [pref, ...LEAGUES.map((x) => x[0]).filter((x) => x !== pref)];
  let found = false;
  for (const lg of order) {
    await pollBoard(lg, today);
    const ids = BOARD[lg + "|" + today] || [];
    const open = ids.filter((e) => S(e).state !== "post");
    if (open.length || (lg === pref && ids.length)) {
      CUR = { lg, date: today };
      SEL = (open.length ? open : ids).find((e) => S(e).state === "in") || (open.length ? open : ids)[0];
      found = true;
      break;
    }
  }
  if (!found) CUR = { lg: pref, date: today };
  DATA.M.forEach((m) => recordOdds(m.eid, m.odds, "start"));
  Object.keys(byE).forEach((e) => simulate(e, 20000));
  emit();
  if (byE[SEL]) await loadLineup(byE[SEL]).catch(() => {});
  await tick();
  setInterval(tick, 30000);
  updateElo();
  setInterval(emit, 20000);
  for (const eid of BOARD[CUR.lg + "|" + CUR.date] || []) if (!LU[eid]) await loadLineup(byE[eid]).catch(() => {});
}
export const E = {
  get SEL() {
    return SEL;
  },
  get DAY() {
    return DAY;
  },
  get SEASON() {
    return SEASON;
  },
  get CUR() {
    return CUR;
  },
  get STAKE() {
    return STAKE;
  },
  set STAKE(v) {
    STAKE = v;
    emit();
  },
  get SOUND() {
    return SOUND;
  },
  set SOUND(v) {
    SOUND = v;
    emit();
  },
  get VIEW() {
    return VIEW;
  },
  set VIEW(v) {
    VIEW = v;
    emit();
  },
  get MY() {
    return MY;
  },
  get DRAFT() {
    return DRAFT;
  },
  get LOG() {
    return LOG;
  },
  set LOG(v) {
    LOG = v;
    LS.set("mb_log", v);
    emit();
  },
  get BANK() {
    return BANK;
  },
  get LOC() {
    return LOC;
  },
  get FLASH() {
    return FLASH;
  },
  get NOTIF() {
    return NOTIF;
  },
  get N100() {
    return N100;
  },
};
export {
  UI,
  emit,
  DATA,
  LEAGUES,
  byE,
  S,
  ST,
  BOARD,
  LS,
  LU,
  RT,
  SHR,
  LO,
  CO,
  P0,
  HID,
  PREF,
  ALERTS,
  FORM,
  OH,
  CTX,
  CLOSE,
  PING,
  SAFE_STYLE,
  X0,
  Y0,
  PW,
  PH,
  PREV,
  TXG,
  simOf,
  simulate,
  frac,
  markets,
  lamsNow,
  remFrac,
  pdev,
  priorFrom,
  colors,
  lum,
  logo,
  pct,
  fo,
  countdown,
  pressureAt,
  shotXY,
  depth,
  role,
  layout,
  rate,
  shares,
  sharesFor,
  legState,
  legMk,
  ticketP,
  ticketE,
  tOdds,
  settled,
  signal,
  clvOf,
  inTickets,
  safeCands,
  liveBets,
  loadForm,
  loadContext,
  recordOdds,
  pollLiveOdds,
  alertMsg,
  beep,
  selectMatch,
  setCompetition,
  setOddsKey,
  nice,
  liveAdvice,
  momentum,
  predictability,
  bestPicks,
  loadDay,
  loadDayData,
  dayGames,
  pickList,
  combos,
  useCombo,
  ymdOf,
  addPick,
  inDraft,
  accStats,
  stakeAdvice,
  weekSpent,
  SAFE,
  setSafe,
  eloOf,
  updateElo,
  hasOddsKey,
  exportCode,
  importCode,
  run100k,
  addTicket,
  removeTicket,
  setDraft,
  setPref,
  setBank,
  enableNotif,
  refreshOdds,
  start,
  pollBoard,
  loadLineup,
  clamp,
  shown,
  marketsShown,
  bookOdds,
  valueOf,
  strengthOf,
  ticketStrength,
  protection,
  needInfo,
  bestOddsNow,
  nextYmd,
  setBook,
  bookName,
  myBetStats,
  safeP,
  sugHistory,
  sugRecord,
  loadHistory,
  recordSuggestions,
  bookPay,
  startChallenge,
  stopChallenge,
  challengeState,
  CH_MODES,
  whyOf,
  leagueTrust,
  myTilt,
  loadSeason,
  betKind,
};
