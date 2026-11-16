// Pure maths helpers: random numbers, Poisson/Gamma sampling, Dixon-Coles score grid, de-vig.
let seed = 777;

const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const nrm = () => {
  let u = 0;
  while (!u) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

const pois = (l) => {
  if (l <= 0) return 0;
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * nrm()));
  let L = Math.exp(-l),
    k = 0,
    p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
};

function gam(a) {
  if (a < 1) return gam(a + 1) * Math.pow(rnd(), 1 / a);
  const d = a - 1 / 3,
    c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      x = nrm();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rnd();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

const bs = (arr, u) => {
  let lo = 0,
    hi = arr.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < u) lo = m + 1;
    else hi = m;
  }
  return lo;
};

const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];

const pp = (k, l) => (Math.exp(-l) * Math.pow(l, k)) / fact[k];

function gridOf(lh, la, rho = -0.05) {
  const g = [];
  let t = 0;
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++) {
      let p = pp(i, lh) * pp(j, la);
      if (i === 0 && j === 0) p *= 1 - lh * la * rho;
      else if (i === 0 && j === 1) p *= 1 + lh * rho;
      else if (i === 1 && j === 0) p *= 1 + la * rho;
      else if (i === 1 && j === 1) p *= 1 - rho;
      g.push(p);
      t += p;
    }
  return g.map((x) => x / t);
}

function pdev(pr) {
  const q = pr.map((x) => 1 / x);
  let lo = 0.3,
    hi = 3,
    k = 1;
  for (let it = 0; it < 50; it++) {
    k = (lo + hi) / 2;
    const s = q.reduce((a, x) => a + Math.pow(x, k), 0);
    s > 1 ? (lo = k) : (hi = k);
  }
  return q.map((x) => Math.pow(x, k));
}

function priorFrom(o) {
  if (!o.H || !o.D || !o.A) return null;
  const lines = Object.keys(o)
    .filter((k) => k[0] === "O" && o["U" + k.slice(1)] && k.endsWith(".5"))
    .map((k) => +k.slice(1));
  const tg = lines.map((L) => [L, pdev([o["O" + L], o["U" + L]])[0]]);
  let L = 2.6;
  if (tg.length) {
    let best = 1e9;
    for (let x = 0.4; x <= 6; x += 0.01) {
      let e = 0;
      for (const [l, p] of tg) {
        let c = 0;
        for (let k = 0; k <= Math.floor(l); k++) c += pp(k, x);
        e += (1 - c - p) ** 2;
      }
      if (e < best) {
        best = e;
        L = x;
      }
    }
  }
  const p = pdev([o.H, o.D, o.A]),
    pd = p[0] - p[2];
  let l2 = 0.02,
    h2 = 0.98,
    f = 0.5;
  for (let it = 0; it < 40; it++) {
    f = (l2 + h2) / 2;
    let ph = 0,
      pa = 0;
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 9; j++) {
        const q = pp(i, L * f) * pp(j, L * (1 - f));
        if (i > j) ph += q;
        else if (j > i) pa += q;
      }
    ph - pa > pd ? (h2 = f) : (l2 = f);
  }
  return [L * f, L * (1 - f)];
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export { rnd, nrm, pois, gam, bs, fact, pp, gridOf, pdev, priorFrom, clamp };
