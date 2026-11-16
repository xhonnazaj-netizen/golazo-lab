# Golazo Lab

**The numbers behind the game.** Golazo Lab gives its **own** % for every football match – 1X2 (W1 / X / W2, 1X / X2 / 12), Total Over / Under and yellow cards – plus ready combinations with a tested track record, ticket strength and protection, and a live advisor that reads the game as it happens. Bookmaker odds are never mixed into our % – they are only shown next to them, to compare.

Everything runs in your browser. No account, no server, no tracking.

## Open it

- **Online:** open the GitHub Pages link of this repository (Settings → Pages). On a phone, use *Add to Home Screen* to install it like an app.
- **On a PC:** download `index.html` from the latest build and double-click it.

## What's inside

| Screen | What it does |
| --- | --- |
| Today | Every game of the day, our W1 · X · W2, top bets with ★ predictability and a 💰 mark when the bookies pay more than a bet is worth, ready combinations (Fire 9, Best 6, Favourites, Goals, Big payout – all total odds 4+) with their tested record and ticket strength |
| Match | Stadium with live commentary and "Best odds now" beside it, live advisor, "needs 1 more goal / can take 2 more cards" on every live bet, all 1X2 / Total / Cards lines |
| My tickets | Track your tickets live, ticket strength (from each bet's own %), cover bet to protect the weakest leg, safer swap while building, keep / take-the-money advice, what wins for you, weekly limits |
| 💬 Assistant | English or Spanish: "Spain", "Spain v France", "Real Madrid", "Fire 9", "how strong is my ticket?", "¿qué es X2?" – team form, head-to-head, scorers and rankings from a built-in database |

## How the maths works

- **Team strength:** World Football Elo fitted on ~49,000 international results, plus time-weighted attack/defence factors (tested: error 0.190 vs 0.194 for Elo alone). Updates itself weekly from the free CC0 [international results dataset](https://github.com/martj42/international_results).
- **Clubs (top 5 leagues):** club Elo + form fitted on 19,760 games 2015-2026 (Brier 0.833 vs 0.897 for the league average), plus each club's yellow-card habit.
- **Scores:** Dixon-Coles adjusted Poisson grid, 20,000 simulations per match. **Our own model only** – bookmaker prices are de-vigged and shown separately ("Bookies %") so you can spot value.
- **Tested and rejected:** pi-ratings (Constantinou & Fenton 2013) scored 0.837 vs our 0.833 on the same club games; penaltyblog's Bivariate Poisson (Karlis & Ntzoufras) and Negative Binomial models gave the same accuracy as Dixon-Coles (0.18935 / 0.18938 vs 0.18944). Corners and both-teams-score were dropped from suggestions: their results are close to luck.
- **Live:** score-state and red-card effects measured on 19,760 league games; momentum from the last 15 minutes of chances.
- **Honesty:** every pre-match % is saved and checked at full time (Accuracy page). Bet types carry ★★★ (easy to predict) to ★ (close to a coin flip).

## Project structure

```
src/
  engine.js            live state, polling, tickets, live advisor (uses the modules below)
  data/provider.js     the ONLY place that knows the data source (swap for a licensed API here)
  data/match-data.js   embedded model data: timing curves, league averages, xG shot model
  data/elo-data.js     ratings snapshot (written by model/train.py)
  model/math.js        Poisson / Gamma sampling, Dixon-Coles grid, de-vig
  model/ratings.js     Elo + form, blended 70/30 with penaltyblog Dixon-Coles
  model/markets.js     every bet market, 1win-style names, which bets are suggested, predictability stars
  model/teamdb.js      assistant database: form, head-to-head, scorers, rankings, 1win glossary
  data/teams-db.js     national-team results since 2018 + top-5-league results (built by model/build_db.py)
  data/personal.local.js  your own tickets (optional, git-ignored – never published)
  util/storage.js      safe localStorage
  App.jsx, Today.jsx, MatchView.jsx, Tickets.jsx, Assistant.jsx   screens
model/train.py         nightly training with penaltyblog -> public/ratings.json
tests/                 maths unit tests (Vitest)
```

## Nightly model training

`.github/workflows/train.yml` runs `model/train.py` every night: it downloads the latest international results, fits Elo + form and a time-decayed Dixon-Coles model with [penaltyblog](https://github.com/martineastwood/penaltyblog), and commits `public/ratings.json`. The site then redeploys and the app loads the new ratings on start.

Back-test on 2,959 competitive internationals (2023-2026), average Brier score over 14 markets (lower is better): Elo + form 0.19023 · Dixon-Coles 0.19253 · **70/30 blend 0.18944**.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # maths unit tests
npm run lint     # code checks
npm run train    # retrain ratings (needs: pip install -r model/requirements.txt)
npm run build    # one self-contained dist/index.html
```

Pushing to `main` runs the tests, builds and publishes to GitHub Pages (`.github/workflows/pages.yml`). In the repository settings set **Pages → Source → GitHub Actions** once.

## Data sources

- Live scores, line-ups and events: ESPN public site feed (unofficial; personal use only – a licensed provider is needed for any commercial version).
- International results: martj42/international_results (CC0).
- Optional live odds: The Odds API (your own key, stored only in your browser).

## Play safe

18+ only. Predictions are probabilities, not guarantees – a 4+ odds ticket wins roughly 1 day in 4 or 5 (Fire 9: 30 of 136 tested match days). Set the weekly limit in *My tickets → More → My limits*.

© 2026 Golazo Lab. All rights reserved.
