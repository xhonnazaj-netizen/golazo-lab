# Golazo Lab

**The numbers behind the game.** Golazo Lab shows the real chances behind every football match – win %, goals, halves, corners and cards – plus ready combinations with a tested track record and a live advisor that reads the game as it happens.

Everything runs in your browser. No account, no server, no tracking.

## Open it

- **Online:** open the GitHub Pages link of this repository (Settings → Pages). On a phone, use *Add to Home Screen* to install it like an app.
- **On a PC:** download `index.html` from the latest build and double-click it.

## What's inside

| Screen | What it does |
| --- | --- |
| Today | Every game of the day in 8 competitions, win %, top bets with ★ predictability, ready combinations (total odds 4+) with their past record |
| Match | Live pitch, live advisor (what is happening + best live bets), all bets incl. halves, margins, clean sheets |
| My tickets | Track your tickets live, keep / take-the-money advice, weekly limits, move tickets between devices |
| 💬 Assistant | Ask in English or Spanish: "Germany chance", "best unders", "should I take the money?" |

## How the maths works

- **Team strength:** World Football Elo fitted on ~49,000 international results, plus time-weighted attack/defence factors (tested: error 0.190 vs 0.194 for Elo alone). Updates itself weekly from the free CC0 [international results dataset](https://github.com/martj42/international_results).
- **Scores:** Dixon-Coles adjusted Poisson grid, 20,000 simulations per match. Bookmaker prices (when available) are de-vigged and blended 85/15 with the model.
- **Live:** score-state and red-card effects measured on 19,760 league games; momentum from the last 15 minutes of chances.
- **Honesty:** every pre-match % is saved and checked at full time (Accuracy page). Bet types carry ★★★ (easy to predict) to ★ (close to a coin flip).

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # maths unit tests
npm run build    # one self-contained dist/index.html
```

Pushing to `main` runs the tests, builds and publishes to GitHub Pages (`.github/workflows/pages.yml`). In the repository settings set **Pages → Source → GitHub Actions** once.

## Data sources

- Live scores, line-ups and events: ESPN public site feed (unofficial; personal use only – a licensed provider is needed for any commercial version).
- International results: martj42/international_results (CC0).
- Optional live odds: The Odds API (your own key, stored only in your browser).

## Play safe

18+ only. Predictions are probabilities, not guarantees – a 4+ odds ticket wins roughly 1 day in 4 or 5. Set the weekly limit in *My tickets → More → My limits*.

© 2026 Golazo Lab. All rights reserved.
