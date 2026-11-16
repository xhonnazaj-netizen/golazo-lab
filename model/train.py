"""Golazo Lab nightly model training.

Downloads the free CC0 international results list, then fits:
  1. World Football Elo + time-weighted attack/defence form (same maths as the app)
  2. A Dixon-Coles goal model with time decay, using penaltyblog (MIT licence)
and writes public/ratings.json, which the app loads on start.

Back-test (2023-2026, 2,959 competitive internationals, avg Brier over 14 markets):
  Elo+form 0.19023 | Dixon-Coles 0.19253 | 70/30 blend 0.18944  -> the app uses the 70/30 blend.

Run:  pip install penaltyblog pandas  &&  python model/train.py
"""
import csv, io, json, math, collections, datetime, urllib.request
import pandas as pd
import penaltyblog as pb

URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
OUT = "public/ratings.json"
SNAPSHOT = "src/data/elo-data.js"   # embedded copy for when the app is opened as a file
XI, YEARS = 0.0018, 5          # time decay per day, training window
A, B, DEC, KP = 0.18, 0.0018, 0.9, 25


def k_factor(t):
    t = t.lower()
    if t == "fifa world cup":
        return 60
    if any(x in t for x in ["euro", "copa américa", "african cup of nations", "asian cup", "gold cup"]) and "qualification" not in t:
        return 50
    if "qualification" in t or "nations league" in t:
        return 40
    return 20 if t == "friendly" else 30


def elo_and_form(rows):
    R = collections.defaultdict(lambda: 1500.0)
    F = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
    last = {}
    for r in rows:
        hs, as_ = int(r["home_score"]), int(r["away_score"])
        h, a = r["home_team"], r["away_team"]
        dr = R[h] - R[a] + (0 if r["neutral"] == "TRUE" else 100)
        lh0, la0 = math.exp(A + B * dr), math.exp(A - B * dr)
        w = 1 if hs > as_ else 0.5 if hs == as_ else 0
        we = 1 / (10 ** (-dr / 400) + 1)
        gd = abs(hs - as_)
        g = 1 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8
        d = k_factor(r["tournament"]) * g * (w - we)
        R[h] += d
        R[a] -= d
        for tm, gf, xf, ga, xa in ((h, hs, lh0, as_, la0), (a, as_, la0, hs, lh0)):
            f = F[tm]
            f[0], f[1], f[2], f[3] = f[0] * DEC + gf, f[1] * DEC + xf, f[2] * DEC + ga, f[3] * DEC + xa
        last[h] = last[a] = r["date"]
    keep = [t for t in R if last.get(t, "") >= "2018"]
    return {"r": {t: round(R[t]) for t in keep}, "f": {t: [round(x, 2) for x in F[t]] for t in keep},
            "a": A, "b": B, "dec": DEC, "kp": KP, "upto": rows[-1]["date"]}


def dixon_coles(df):
    df = df[df.date >= df.date.max() - pd.Timedelta(days=365 * YEARS)]
    w = pb.models.dixon_coles_weights(df.date, XI)
    m = pb.models.DixonColesGoalModel(df.home_score, df.away_score, df.home_team, df.away_team, w)
    m.fit()
    p = m.get_params()
    teams = sorted({k[7:] for k in p if k.startswith("attack_")})
    return {"home_advantage": round(p["home_advantage"], 4), "rho": round(p["rho"], 4), "weight": 0.3,
            "teams": {t: [round(p["attack_" + t], 4), round(p["defence_" + t], 4)] for t in teams}}


def main():
    text = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8")
    rows = [r for r in csv.DictReader(io.StringIO(text)) if r["home_score"] not in ("", "NA")]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df["home_score"] = df.home_score.astype(int)
    df["away_score"] = df.away_score.astype(int)
    out = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "elo": elo_and_form(rows), "dc": dixon_coles(df)}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    with open(SNAPSHOT, "w", encoding="utf-8") as fh:
        fh.write("// Ratings snapshot written by model/train.py (Elo + form, and penaltyblog Dixon-Coles).\n"
                 "// The app also loads the latest public/ratings.json when served over http(s).\n"
                 "const RATINGS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n\nexport default RATINGS;\n")
    print(f"wrote {OUT}: {len(out['elo']['r'])} Elo teams, {len(out['dc']['teams'])} Dixon-Coles teams, results up to {out['elo']['upto']}")


if __name__ == "__main__":
    main()
