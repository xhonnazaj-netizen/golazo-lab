# Builds src/data/teams-db.js: national teams (since 2016) + top-5-league clubs (last 2 seasons) for the assistant.
import csv, json, sys, collections, glob, os
res, gs, clubdir, out, ratings = sys.argv[1:6]
R = json.load(open(ratings))
elo = (R.get('elo') or {}).get('r', {})
# ---- national teams ----
games = []
for r in csv.DictReader(open(res, encoding='utf-8')):
    if r['date'] < '2018-01-01' or r['home_score'] in ('NA', ''): continue
    games.append((r['date'], r['home_team'], r['away_team'], int(r['home_score']), int(r['away_score']), r['tournament']))
teams = sorted({g[1] for g in games} | {g[2] for g in games})
idx = {t: i for i, t in enumerate(teams)}
tour = sorted({g[5] for g in games}); tid = {t: i for i, t in enumerate(tour)}
# compact games: "YYMMDD,h,a,hs,as,t" joined by ';'
G = ';'.join(f"{d[2:4]}{d[5:7]}{d[8:10]},{idx[h]},{idx[a]},{hs},{as_},{tid[t]}" for d, h, a, hs, as_, t in games)
sc = collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(gs, encoding='utf-8')):
    if r['date'] < '2022-01-01' or r['own_goal'] == 'TRUE': continue
    sc[r['team']][r['scorer']] += 1
S = {idx[t]: [[n, c] for n, c in sc[t].most_common(4)] for t in sc if t in idx}
# elo per team: ratings.json elo is {name:[rating,...]} or {name:rating}
E = {}
for t in teams:
    v = elo.get(t)
    if v is None: continue
    E[idx[t]] = round(v[0] if isinstance(v, list) else v)
# ---- clubs ----
cl = []
for f in sorted(glob.glob(os.path.join(clubdir, '*-2425.csv')) + glob.glob(os.path.join(clubdir, '*-2526.csv'))):
    lg = os.path.basename(f).rsplit('-', 1)[0]
    for r in csv.DictReader(open(f, encoding='utf-8-sig')):
        try:
            d = r['Date']
            if '-' in d: yy, mm, dd = d.split('-')
            else: dd, mm, yy = d.split('/')
            yy = yy[-2:]
            cl.append((lg, yy + mm + dd, r['HomeTeam'], r['AwayTeam'], int(r['FTHG']), int(r['FTAG']), int(r.get('HY') or 0), int(r.get('AY') or 0)))
        except Exception: pass
cl.sort(key=lambda x: x[1])
clubs = sorted({x[2] for x in cl} | {x[3] for x in cl}); cidx = {t: i for i, t in enumerate(clubs)}
lgs = sorted({x[0] for x in cl}); lidx = {t: i for i, t in enumerate(lgs)}
CG = ';'.join(f"{d},{cidx[h]},{cidx[a]},{hs},{as_},{hy},{ay},{lidx[lg]}" for lg, d, h, a, hs, as_, hy, ay in cl)
import re
OFF = re.compile(r'qualification|Nations League|FIFA World Cup|UEFA Euro|Copa Am|Gold Cup|African Cup of Nations|AFC Asian Cup|Arab Cup|Gulf Cup|AFF Championship|SAFF|CECAFA|COSAFA|Oceania Nations')
fifa = sorted({idx[g[1]] for g in games if OFF.search(g[5]) and 'CONIFA' not in g[5]} | {idx[g[2]] for g in games if OFF.search(g[5]) and 'CONIFA' not in g[5]})
db = {'fifa': fifa, 'upd': max(g[0] for g in games), 'nt': teams, 'tour': tour, 'g': G, 'sc': S, 'elo': E, 'cl': clubs, 'lgs': lgs, 'cg': CG, 'cupd': cl[-1][1] if cl else ''}
js = '// Team database for the assistant (built by model/build_db.py).\n// National teams: martj42/international_results (CC0), games since 2018, scorers since 2022.\n// Clubs: football-data.co.uk (top 5 leagues, last two seasons).\nconst TEAMS_DB = ' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + ';\nexport default TEAMS_DB;\n'
open(out, 'w', encoding='utf-8').write(js)
print(len(teams), 'nations', len(games), 'games', len(clubs), 'clubs', len(cl), 'club games', round(len(js) / 1024), 'KB')
