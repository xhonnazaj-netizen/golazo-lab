# Join our club model's pre-match % (same fit as the app) with real Bet365 / best-market odds.
import sys, csv, math, json, collections
sys.path.insert(0, '/home/claude/club')
import os; os.chdir('/home/claude/club')
src = open('/home/claude/club/clubelo.py').read().split("best=None")[0]
g = {}; exec(src, g)
out = g['run'](0.002, 15, collect=True)[3]
DIV = {'eng.1': 'E0', 'esp.1': 'SP1', 'ita.1': 'I1', 'ger.1': 'D1', 'fra.1': 'F1'}
M = {}
for r in csv.DictReader(open('/home/claude/xgabora/club-football-match-data-2000-2025/data/Matches.csv', encoding='utf-8')):
    if r['MatchDate'] >= '2023-07-01': M[(r['Division'], r['MatchDate'], r['HomeTeam'])] = r
def grid(lh, la, rho=-0.05):
    P = [[math.exp(-lh) * lh**i / math.factorial(i) * math.exp(-la) * la**j / math.factorial(j) for j in range(11)] for i in range(11)]
    P[0][0] *= 1 - lh * la * rho; P[0][1] *= 1 + lh * rho; P[1][0] *= 1 + la * rho; P[1][1] *= 1 - rho
    s = sum(map(sum, P)); return [[x / s for x in row] for row in P]
rows = []; miss = collections.Counter()
f = lambda x: float(x) if x not in ('', 'NA', None) else None
for d, lh, la, mh, ma in out:
    r = M.get((DIV[d['lg']], d['date'], d['h']))
    if not r: miss[d['lg']] += 1; continue
    P = grid(lh, la)
    H = sum(P[i][j] for i in range(11) for j in range(11) if i > j); D = sum(P[i][i] for i in range(11)); A = 1 - H - D
    O = sum(P[i][j] for i in range(11) for j in range(11) if i + j > 2)
    hs1 = sum(P[i][j] for i in range(1, 11) for j in range(11)); as1 = sum(P[i][j] for i in range(11) for j in range(1, 11))
    rows.append(dict(date=d['date'], lg=d['lg'], h=d['h'], a=d['a'], hs=d['hs'], as_=d['as_'], p=dict(H=H, D=D, A=A, O=O, U=1 - O, HX=H + D, AX=A + D, H1=hs1, A1=as1),
        o=dict(H=f(r['OddHome']), D=f(r['OddDraw']), A=f(r['OddAway']), O=f(r['Over25']), U=f(r['Under25'])),
        mx=dict(H=f(r['MaxHome']), D=f(r['MaxDraw']), A=f(r['MaxAway']), O=f(r['MaxOver25']), U=f(r['MaxUnder25']))))
print(len(rows), 'joined; missing', dict(miss))
json.dump(rows, open('/home/claude/money/rows.json', 'w'))
