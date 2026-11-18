// Our own % for every game this week (same ratings + daily replay as the app). Usage: node scripts/predict-week.mjs
import fs from 'node:fs';
import { clubLam, applyClubSeason, clubUpto } from '../src/model/ratings.js';
import { gridOf } from '../src/model/math.js';

const W = JSON.parse(fs.readFileSync('public/week.json', 'utf8'));
const R = JSON.parse(fs.readFileSync('model/data/espn-results.json', 'utf8')).lg;
// replay this season's results after each league's snapshot, exactly like the app does at start
for (const [lg, L] of Object.entries(R)) {
  const up = clubUpto(lg);
  if (!up) continue;
  const games = L.map((g) => ({ d: '20' + g[0].slice(0, 2) + '-' + g[0].slice(2, 4) + '-' + g[0].slice(4, 6), h: g[1], a: g[2], hs: g[3], as: g[4], yh: g[5], ya: g[6] })).filter((g) => g.d > up);
  applyClubSeason(lg, games);
}
const P = (g, f) => { let s = 0; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (f(i, j)) s += g[i * 9 + j]; return s; };
const out = [];
for (const f of W.fx) {
  const [id, lg, iso, , h, , a] = f;
  const lam = clubLam({ lg, h, a });
  if (!lam) { out.push({ id, lg, iso, h, a, none: true }); continue; }
  const g = gridOf(lam[0], lam[1]);
  const H = P(g, (i, j) => i > j), D = P(g, (i, j) => i === j), A = P(g, (i, j) => i < j);
  out.push({ id, lg, iso, h, a, lam: lam.map((x) => +x.toFixed(2)), H: +H.toFixed(3), D: +D.toFixed(3), A: +A.toFixed(3),
    o15: +P(g, (i, j) => i + j > 1).toFixed(3), o25: +P(g, (i, j) => i + j > 2).toFixed(3), u35: +P(g, (i, j) => i + j < 4).toFixed(3),
    hs: +P(g, (i) => i > 0).toFixed(3), as: +P(g, (i, j) => j > 0).toFixed(3) });
}
fs.writeFileSync('/tmp/predictions.json', JSON.stringify(out));
console.log(out.length, 'games,', out.filter((x) => x.none).length, 'without ratings');
