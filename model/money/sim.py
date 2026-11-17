import json, random, collections, statistics as st
R = json.load(open('rows.json'))
won = lambda r, k: {'H': r['hs'] > r['as_'], 'D': r['hs'] == r['as_'], 'A': r['hs'] < r['as_'], 'O': r['hs'] + r['as_'] > 2, 'U': r['hs'] + r['as_'] < 3}[k]
days = collections.defaultdict(list)
for r in R:
    if all(r['o'][k] for k in 'HDAOU'): days[r['date']].append(r)
D = sorted(days)
def ticket(games, target=4.0, kinds='HA', lo=.55, hi=.9, by='ours', maxlegs=10, exact=0):
    c = []
    for r in games:
        s = 1/r['o']['H'] + 1/r['o']['D'] + 1/r['o']['A']
        for k in kinds:
            q = 1/r['o'][k]/(s if k in 'HDA' else (1/r['o']['O'] + 1/r['o']['U']))
            p = r['p'][k] if by == 'ours' else q if by == 'book' else min(r['p'][k], q)
            if lo <= p <= hi: c.append((p, r, k))
    c.sort(key=lambda x: -x[0]); used = set(); legs = []; O = 1
    for p, r, k in c:
        if r['h'] in used: continue
        used.add(r['h']); legs.append((r, k)); O *= r['o'][k]
        if (not exact and O >= target) or len(legs) >= maxlegs: break
    if exact and len(legs) < exact: return None
    if not exact and O < target: return None
    return O, all(won(r, k) for r, k in legs), len(legs)
def summary(name, fn):
    T = [(d, fn(days[d])) for d in D]; T = [(d, t) for d, t in T if t]
    w = sum(t[1] for _, t in T); ret = sum(t[0] for _, t in T if t[1])
    print(f"{name:34s} days {len(T):4d}  won {w:3d} ({100*w/len(T):4.1f}%)  avg odds {st.mean(t[0] for _, t in T):5.1f}  legs {st.mean(t[2] for _, t in T):.1f}  money back per 100 staked {100*ret/len(T):5.1f}")
    return T
T1 = summary('Favourites 4+ (our %)', lambda g: ticket(g, 4, 'HA', .55, .9, 'ours'))
T2 = summary('Favourites 4+ (bookies %)', lambda g: ticket(g, 4, 'HA', .55, .9, 'book'))
T3 = summary('Goals O/U 2.5 4+ (our %)', lambda g: ticket(g, 4, 'OU', .55, .9, 'ours'))
T4 = summary('Mix 1X2+O/U 4+ (our %)', lambda g: ticket(g, 4, 'HAOU', .6, .9, 'ours'))
T5 = summary('Double: 2 strongest (our %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'ours', 2, 2))
T5b = summary('Double: 2 strongest (bookies %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'book', 2, 2))
T8 = summary('Treble: 3 strongest (bookies %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'book', 3, 3))
T9 = summary('Fire-9 style: 9 strongest (bookies)', lambda g: ticket(g, 1, 'HAOU', .6, .95, 'book', 9, 9))
T6 = summary('Single strongest (our %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'ours', 1, 1))
T6b = summary('Single strongest (bookies %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'book', 1, 1))
T7 = summary('Big payout 10+ (our %)', lambda g: ticket(g, 10, 'HA', .45, .75, 'ours'))
json.dump({'fav': T1, 'favb': T2, 'gol': T3, 'dbl': T5, 'dblb': T5b, 'tre': T8, 'single': T6, 'singleb': T6b, 'big': T7, 'f9': T9}, open('tickets.json', 'w'))
T10 = summary('Treble: 3 strongest (our %)', lambda g: ticket(g, 1, 'HA', .6, .95, 'ours', 3, 3))
T11 = summary('Treble: 3 strongest W/1X2 DC (our %)', lambda g: ticket(g, 1, 'HA', .62, .95, 'ours', 3, 3))
T12 = summary('Treble: 3 strongest, both agree', lambda g: ticket(g, 1, 'HA', .6, .95, 'agree', 3, 3))
T13 = summary('Favourites 4+, both agree', lambda g: ticket(g, 4, 'HA', .55, .9, 'agree'))
T14 = summary('Goals 4+, both agree', lambda g: ticket(g, 4, 'OU', .55, .9, 'agree'))
T15 = summary('Single strongest, both agree', lambda g: ticket(g, 1, 'HA', .6, .95, 'agree', 1, 1))
json.dump({'fav': T13, 'tre': T12, 'gol': T14, 'single': T15}, open('tickets_agree.json', 'w'))
