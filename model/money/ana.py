import json, math, random, collections, statistics as st
R = json.load(open('rows.json'))
won = lambda r, k: {'H': r['hs'] > r['as_'], 'D': r['hs'] == r['as_'], 'A': r['hs'] < r['as_'], 'O': r['hs'] + r['as_'] > 2, 'U': r['hs'] + r['as_'] < 3}[k]
# 1) accuracy: our % vs Bet365's % (margin removed)
B = Bm = Bb = n = 0; marg = []
for r in R:
    o = r['o']
    if not all(o[k] for k in 'HDAOU'): continue
    s = 1/o['H'] + 1/o['D'] + 1/o['A']; marg.append(s - 1)
    q = {k: 1/o[k]/s for k in 'HDA'}
    y = {k: won(r, k) for k in 'HDA'}
    B += sum((r['p'][k] - y[k])**2 for k in 'HDA'); Bm += sum((q[k] - y[k])**2 for k in 'HDA')
    Bb += sum((0.3*r['p'][k] + 0.7*q[k] - y[k])**2 for k in 'HDA'); n += 1
print(f"1X2 error  ours {B/n:.4f}   Bet365 {Bm/n:.4f}   30/70 mix {Bb/n:.4f}   (n={n}, Bet365 1X2 margin avg {st.mean(marg)*100:.1f}%)")
# 2) value singles: bet when our % x odds > 1+t
for book in ('o', 'mx'):
    for t in (0.0, 0.05, 0.10, 0.20):
        for lo, hi in ((1.01, 2.2), (2.2, 99)):
            st_ = ret = nb = 0
            for r in R:
                for k in 'HDAOU':
                    od = r[book][k]
                    if not od or not (lo <= od < hi): continue
                    if r['p'][k] * od > 1 + t:
                        nb += 1; st_ += 1; ret += od if won(r, k) else 0
            if nb: print(f"value singles {('Bet365' if book=='o' else 'best price'):10s} edge>{int(t*100):2d}% odds {lo}-{hi}: bets {nb:5d}  return {100*(ret-st_)/st_:+.1f}%")
