import json, datetime as dt, statistics as st
T = json.load(open('tickets.json'))
def windows(name, plan):
    # every 30-day month starting on each match day; plan(bank, day_tickets) -> new bank
    days = sorted({d for k in T for d, _ in T[k]})
    by = {k: dict((d, tuple(t)) for d, t in T[k]) for k in T}
    res = []
    for s in days:
        s0 = dt.date.fromisoformat(s); e = (s0 + dt.timedelta(days=30)).isoformat()
        if e > days[-1]: break
        bank = 1.0; peak = 1.0
        for d in [x for x in days if s <= x < e]:
            bank = plan(bank, {k: by[k].get(d) for k in by})
            if bank >= 10 and name.startswith('Chase'): break
            if bank < 0.02: break
        res.append(bank)
    n = len(res)
    print(f"{name:44s} months {n:3d} | 10x+ {100*sum(r>=10 for r in res)/n:4.1f}% | doubled {100*sum(r>=2 for r in res)/n:4.1f}% | ended up {100*sum(r>1 for r in res)/n:4.1f}% | lost half+ {100*sum(r<=.5 for r in res)/n:4.1f}% | median x{st.median(res):.2f}")
def stake(key, f):
    def plan(b, day):
        t = day.get(key)
        if not t: return b
        s = b * f; return b - s + (s * t[0] if t[1] else 0)
    return plan
def chase(key):
    def plan(b, day):
        t = day.get(key)
        if not t: return b
        return b * t[0] if t[1] else 0.0
    return plan
windows('Steady: 5% a day on strongest single', stake('singleb', .05))
windows('Steady: 10% a day on 3 strongest (treble)', stake('tre', .10))
windows('App style: 10% a day on Favourites 4+', stake('fav', .10))
windows('Bold: 25% a day on Favourites 4+', stake('fav', .25))
windows('Fire-9 style: 10% a day', stake('f9', .10))
windows('Chase: all-in on treble until 10x', chase('tre'))
windows('Chase: all-in on Favourites 4+ until 10x', chase('fav'))
