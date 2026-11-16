// Every bet market the app prices, as a function over simulated matches, plus plain-word labels and predictability stars.
const MKC = {};

function markets(m) {
  if (MKC[m.eid]) return MKC[m.eid];
  const h = m.h,
    a = m.a,
    L = [];
  SIDE[h] = 1;
  SIDE[a] = 2;
  const A = (g, n, f, k) => L.push({ g, n, f, k });
  const T = (R, n) => R.GH[n] + R.GA[n];
  A("Result", h + " win", (R, n) => R.GH[n] > R.GA[n], "H");
  A("Result", "Draw", (R, n) => R.GH[n] === R.GA[n], "D");
  A("Result", a + " win", (R, n) => R.GH[n] < R.GA[n], "A");
  A("Result", h + " or draw", (R, n) => R.GH[n] >= R.GA[n]);
  A("Result", a + " or draw", (R, n) => R.GH[n] <= R.GA[n]);
  A("Result", "No draw", (R, n) => R.GH[n] !== R.GA[n]);
  A("Result", "Next goal: " + h, (R, n) => R.NG[n] === 1);
  A("Result", "Next goal: " + a, (R, n) => R.NG[n] === 2);
  A("Result", "No more goals", (R, n) => R.NG[n] === 0);
  [0.5, 1.5, 2.5, 3.5, 4.5].forEach((x) => {
    A("Goals", "Over " + x, (R, n) => T(R, n) > x, "O" + x);
    A("Goals", "Under " + x, (R, n) => T(R, n) < x, "U" + x);
  });
  [1, 2, 3, 4].forEach((x) => {
    L.push({ g: "Goals", n: "Over " + x + ".0", f: (R, n) => T(R, n) > x, pu: (R, n) => T(R, n) === x });
    L.push({ g: "Goals", n: "Under " + x + ".0", f: (R, n) => T(R, n) < x, pu: (R, n) => T(R, n) === x });
  });
  // quarter lines: half the stake on each neighbouring line (e.g. Over 2.25 = half on 2.0, half on 2.5)
  [1, 2, 3].forEach((x) => {
    L.push({
      g: "Goals",
      n: "Over " + x + ".25",
      f: (R, n) => T(R, n) > x,
      pu: (R, n) => T(R, n) === x,
      mult: (R, n, o) => (T(R, n) > x ? o : T(R, n) === x ? 0.5 : 0),
    });
    L.push({
      g: "Goals",
      n: "Over " + x + ".75",
      f: (R, n) => T(R, n) > x + 1,
      pu: (R, n) => T(R, n) === x + 1,
      mult: (R, n, o) => (T(R, n) > x + 1 ? o : T(R, n) === x + 1 ? 0.5 * o + 0.5 : 0),
    });
    L.push({
      g: "Goals",
      n: "Under " + x + ".25",
      f: (R, n) => T(R, n) < x,
      pu: (R, n) => T(R, n) === x,
      mult: (R, n, o) => (T(R, n) < x ? o : T(R, n) === x ? 0.5 * o + 0.5 : 0),
    });
    L.push({
      g: "Goals",
      n: "Under " + x + ".75",
      f: (R, n) => T(R, n) <= x,
      pu: (R, n) => T(R, n) === x + 1,
      mult: (R, n, o) => (T(R, n) <= x ? o : T(R, n) === x + 1 ? 0.5 : 0),
    });
  });
  A("Goals", "Both teams score", (R, n) => R.GH[n] > 0 && R.GA[n] > 0);
  A("Goals", "Not both score", (R, n) => R.GH[n] === 0 || R.GA[n] === 0);
  A("Goals", h + " clean sheet", (R, n) => R.GA[n] === 0);
  A("Goals", a + " clean sheet", (R, n) => R.GH[n] === 0);
  A("Goals", h + " win to nil", (R, n) => R.GH[n] > R.GA[n] && R.GA[n] === 0);
  A("Goals", a + " win to nil", (R, n) => R.GA[n] > R.GH[n] && R.GH[n] === 0);
  A("Result", h + " wins by 2+", (R, n) => R.GH[n] - R.GA[n] >= 2);
  A("Result", a + " wins by 2+", (R, n) => R.GA[n] - R.GH[n] >= 2);
  L.push({ g: "Result", n: h + " draw no bet", f: (R, n) => R.GH[n] > R.GA[n], pu: (R, n) => R.GH[n] === R.GA[n] });
  L.push({ g: "Result", n: a + " draw no bet", f: (R, n) => R.GA[n] > R.GH[n], pu: (R, n) => R.GH[n] === R.GA[n] });
  A("Goals", h + " over 2.5", (R, n) => R.GH[n] > 2);
  A("Goals", a + " over 2.5", (R, n) => R.GA[n] > 2);
  A("Halves", "1st half over 0.5", (R, n) => R.H1H[n] + R.H1A[n] > 0);
  A("Halves", "1st half over 1.5", (R, n) => R.H1H[n] + R.H1A[n] > 1);
  A("Halves", "1st half under 1.5", (R, n) => R.H1H[n] + R.H1A[n] < 2);
  A("Halves", "Half-time: " + h + " leads", (R, n) => R.H1H[n] > R.H1A[n]);
  A("Halves", "Half-time: draw", (R, n) => R.H1H[n] === R.H1A[n]);
  A("Halves", "Half-time: " + a + " leads", (R, n) => R.H1H[n] < R.H1A[n]);
  A("Halves", "Goal in both halves", (R, n) => R.H1H[n] + R.H1A[n] > 0 && R.GH[n] + R.GA[n] > R.H1H[n] + R.H1A[n]);
  A("Halves", "2nd half has more goals", (R, n) => R.GH[n] + R.GA[n] - R.H1H[n] - R.H1A[n] > R.H1H[n] + R.H1A[n]);
  A("Goals", h + " over 0.5", (R, n) => R.GH[n] > 0);
  A("Goals", a + " over 0.5", (R, n) => R.GA[n] > 0);
  A("Goals", h + " over 1.5", (R, n) => R.GH[n] > 1);
  A("Goals", a + " over 1.5", (R, n) => R.GA[n] > 1);
  const C = (R, n) => R.CH[n] + R.CA[n];
  [8, 9, 10, 11].forEach((x) => {
    L.push({ g: "Corners", n: "Over " + x + ".0 corners", f: (R, n) => C(R, n) > x, pu: (R, n) => C(R, n) === x });
    L.push({ g: "Corners", n: "Under " + x + ".0 corners", f: (R, n) => C(R, n) < x, pu: (R, n) => C(R, n) === x });
  });
  [6.5, 7.5, 8.5, 9.5, 10.5, 11.5].forEach((x) => {
    A("Corners", "Over " + x + " corners", (R, n) => C(R, n) > x);
    A("Corners", "Under " + x + " corners", (R, n) => C(R, n) < x);
  });
  A("Corners", h + " more corners", (R, n) => R.CH[n] > R.CA[n]);
  A("Corners", a + " more corners", (R, n) => R.CH[n] < R.CA[n]);
  [2.5, 3.5, 4.5, 5.5].forEach((x) => {
    A("Cards", "Over " + x + " yellows", (R, n) => R.Y[n] > x);
    A("Cards", "Under " + x + " yellows", (R, n) => R.Y[n] < x);
  });
  A("Cards", "Red card shown", (R, n) => R.RD[n] > 0);
  A("Cards", "No red card", (R, n) => R.RD[n] === 0);
  [1.5, 2.5, 3.5].forEach((x) => {
    A("Cards", "Over " + x + " offsides", (R, n) => R.O[n] > x);
    A("Cards", "Under " + x + " offsides", (R, n) => R.O[n] < x);
  });
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) A("Score", i + "-" + j, (R, n) => R.GH[n] === i && R.GA[n] === j);
  return (MKC[m.eid] = L);
}

// how predictable each bet type is (tested: 5,700 recent top-5-league games + 4,600 internationals). 3 = strong, 2 = medium, 1 = weak
function predictability(n) {
  if (/ win$| or draw$|^Draw$|^No draw$| draw no bet$| wins by 2\+$|Half-time: .* leads/.test(n)) return 3;
  if (/ over [01]\.5$| clean sheet$| win to nil$| more corners$|fouls/.test(n)) return 2;
  return 1;
}

// Bets the app shows and suggests: 1X2 (incl. 1X / X2 / 12), Total Over/Under (match and team) and yellow cards.
// Corners, halves, handicaps, both-teams-score etc. are still priced (old tickets keep working) but never suggested.
function shown(n) {
  return /^(Draw|No draw)$| win$| or draw$|^(Over|Under) \d+\.5$| over [012]\.5$|^(Over|Under) \d+\.5 yellows$/.test(n);
}
function marketsShown(m) {
  return markets(m).filter((x) => shown(x.n));
}

// 1win words: W1 / X / W2, 1X / X2 / 12, Total Over / Under, Individual total, Yellow cards total.
const SIDE = {};
function nice(n, m) {
  if (!n) return n;
  const side = (team) => (m ? (team === m.h ? 1 : team === m.a ? 2 : 0) : SIDE[team] || 0);
  let k;
  if (n === "Draw") return "X · Draw";
  if (n === "No draw") return "12 · No draw";
  if ((k = n.match(/^(.+) win$/))) { const s = side(k[1]); return (s === 2 ? "W2" : s === 1 ? "W1" : "W") + " · " + k[1]; }
  if ((k = n.match(/^(.+) or draw$/))) { const s = side(k[1]); return (s === 2 ? "X2" : s === 1 ? "1X" : "DC") + " · " + k[1] + " or draw"; }
  if ((k = n.match(/^(Over|Under) (\d+\.5)$/))) return "Total " + k[1] + " " + k[2];
  if ((k = n.match(/^(Over|Under) (\d+\.5) yellows$/))) return "Yellow cards Total " + k[1] + " " + k[2];
  if ((k = n.match(/^(Over|Under) (\d+\.5) corners$/))) return "Corners Total " + k[1] + " " + k[2];
  if ((k = n.match(/^(.+) over (\d\.5)$/))) return k[1] + " Total Over " + k[2];
  if ((k = n.match(/^Next goal: (.+)$/))) return "Next goal · " + k[1];
  return n;
}

export { markets, marketsShown, shown, predictability, nice, SIDE };
