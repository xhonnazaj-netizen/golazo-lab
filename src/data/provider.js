// Data provider: the ONLY place that knows where live football data comes from.
// Today: ESPN public site feed (personal use). For a commercial version swap BASE/J for a licensed API here.
const BASE = (lg) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/`,
  W = "https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/";

const cache = {};

async function J(u, ttl) {
  const c = cache[u];
  if (c && (ttl === Infinity || Date.now() - c.t < ttl)) return c.v;
  const r = await fetch(u);
  if (!r.ok) throw new Error(r.status);
  const v = await r.json();
  cache[u] = { t: Date.now(), v };
  return v;
}

const q = [];

let act = 0;

const lim = (fn) =>
  new Promise((res, rej) => {
    q.push([fn, res, rej]);
    pump();
  });

function pump() {
  while (act < 6 && q.length) {
    const [fn, res, rej] = q.shift();
    act++;
    fn()
      .then(res, rej)
      .finally(() => {
        act--;
        pump();
      });
  }
}

export { BASE, W, J, lim };
