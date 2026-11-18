"""Team ratings (Elo + recent form) for the extra leagues, trained on ESPN results (model/data/espn-results.json).
Same method as the big-5 club model. Walk-forward test on the last 12 months vs the league average.
Writes model/data/clubs-extra.json, merged into the app's ratings by merge step."""
import json, math, collections, datetime as dt, sys

CAL = {'chi.1', 'bra.1', 'arg.1', 'usa.1', 'col.1'}           # seasons run January-December
NEW = ['eng.2', 'ned.1', 'por.1', 'bel.1', 'tur.1', 'sco.1', 'chi.1', 'bra.1', 'arg.1', 'mex.1', 'usa.1', 'col.1']
R = json.load(open('model/data/espn-results.json'))['lg']

def season(lg, d):
    y, m = 2000 + int(d[:2]), int(d[2:4])
    return y if lg in CAL else (y if m >= 7 else y - 1)

def pmf(l): return [math.exp(-l) * l ** k / math.factorial(k) for k in range(11)]
def brier(lh, la, hs, as_):
    a, b = pmf(lh), pmf(la)
    H = sum(a[i] * b[j] for i in range(11) for j in range(11) if i > j); D = sum(a[i] * b[i] for i in range(11)); A = 1 - H - D
    O = sum(a[i] * b[j] for i in range(11) for j in range(11) if i + j > 2)
    o = [hs > as_, hs == as_, hs < as_]
    return (H - o[0]) ** 2 + (D - o[1]) ** 2 + (A - o[2]) ** 2 + (O - (hs + as_ > 2)) ** 2

def run(lg, games, b, K, DEC=0.9, KP=25, reg=0.2, test_from=None, test_to='999999'):
    Rt = {}; F = collections.defaultdict(lambda: [0., 0., 0., 0.]); Y = {}; mu = [1.4 * 50, 1.15 * 50, 50.]; yl = [2.2 * 50, 50.]
    seas = {}; S = Sb = 0.0; n = 0
    for g in games:
        d, h, a, hs, as_, yh, ya, neu = g
        s = season(lg, d)
        for t in (h, a):
            if t not in Rt: Rt[t] = 1450.0
            if seas.get(t) != s:
                if t in seas: Rt[t] = Rt[t] * (1 - reg) + 1500 * reg
                seas[t] = s
        mh, ma = mu[0] / mu[2], mu[1] / mu[2]
        dr = Rt[h] - Rt[a]
        lh0 = mh * math.exp(b * dr); la0 = ma * math.exp(-b * dr)
        x = lambda v, i, j: (v[i] + KP) / (v[j] + KP)
        fh, fa = F[h], F[a]
        lh = lh0 * x(fh, 0, 1) * x(fa, 2, 3); la = la0 * x(fa, 0, 1) * x(fh, 2, 3)
        if test_from and test_from <= d < test_to:
            S += brier(lh, la, hs, as_); Sb += brier(mh, ma, hs, as_); n += 1
        W = 1 if hs > as_ else .5 if hs == as_ else 0; We = 1 / (10 ** (-(dr + 60) / 400) + 1)
        gd = abs(hs - as_); G = 1 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8
        dl = K * G * (W - We); Rt[h] += dl; Rt[a] -= dl
        for tm, gf, xf, ga, xa in ((h, hs, lh0, as_, la0), (a, as_, la0, hs, lh0)):
            f = F[tm]; f[0] = f[0] * DEC + gf; f[1] = f[1] * DEC + xf; f[2] = f[2] * DEC + ga; f[3] = f[3] * DEC + xa
        mu[0] = mu[0] * 0.998 + hs; mu[1] = mu[1] * 0.998 + as_; mu[2] = mu[2] * 0.998 + 1
        if yh is not None and ya is not None:
            avg = yl[0] / yl[1]
            Y[h] = Y.get(h, 1.0) * 0.95 + (yh / avg) * 0.05; Y[a] = Y.get(a, 1.0) * 0.95 + (ya / avg) * 0.05
            yl[0] = yl[0] * 0.998 + (yh + ya) / 2; yl[1] = yl[1] * 0.998 + 1
    return dict(R=Rt, F=F, Y=Y, mu=mu, yl=yl, seas=seas, score=(S / n if n else None, Sb / n if n else None, n))

out = {'teams': {}, 'lgm': {}, 'bLg': {}, 'kLg': {}, 'ylg': {}, 'uptoLg': {}, 'cal': sorted(CAL), 'test': {}}
print(f"{'league':8s} {'games':>6s} {'test':>5s} {'ours':>7s} {'avg':>7s} {'gain':>6s}  b      K")
for lg in NEW:
    G = [g for g in R.get(lg, []) if g[3] is not None]
    if len(G) < 200: print(lg, 'too few games'); continue
    last = G[-1][0]
    ld = dt.date(2000 + int(last[:2]), int(last[2:4]), int(last[4:6])) - dt.timedelta(days=365)
    tf = ld.strftime('%y%m%d')
    tune_from = (ld - dt.timedelta(days=365)).strftime('%y%m%d')
    best = None
    # settings are chosen on the year BEFORE the test year, then scored on the last 12 months only
    for b in (0.0012, 0.0016, 0.002, 0.0025, 0.003, 0.0035):
        for K in (6, 8, 10, 15, 20):
            r = run(lg, G, b, K, test_from=tune_from, test_to=tf)
            if r['score'][0] is not None and (best is None or r['score'][0] < best[0]): best = (r['score'][0], b, K)
    _, b, K = best
    r = run(lg, G, b, K, test_from=tf)
    s = r['score']
    print(f"{lg:8s} {len(G):6d} {s[2]:5d} {s[0]:7.4f} {s[1]:7.4f} {100 * (s[1] - s[0]) / s[1]:5.1f}%  {b:.4f} {K}")
    cur = max(r['seas'].values())
    teams = {t: [round(v), [round(x, 2) for x in r['F'][t]], round(r['Y'].get(t, 1.0), 2)] for t, v in r['R'].items() if r['seas'][t] >= cur - (0 if lg in CAL else 0)}
    out['teams'][lg] = teams
    out['lgm'][lg] = [round(r['mu'][0] / r['mu'][2], 3), round(r['mu'][1] / r['mu'][2], 3)]
    out['bLg'][lg] = b; out['kLg'][lg] = K
    out['ylg'][lg] = round(r['yl'][0] / r['yl'][1], 2)
    out['uptoLg'][lg] = '20' + last[:2] + '-' + last[2:4] + '-' + last[4:6]
    out['test'][lg] = [round(s[0], 4), round(s[1], 4), s[2]]
json.dump(out, open('model/data/clubs-extra.json', 'w'), separators=(',', ':'))
print('teams', {k: len(v) for k, v in out['teams'].items()})
