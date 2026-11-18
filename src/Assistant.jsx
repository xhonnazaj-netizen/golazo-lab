import React, { useEffect, useRef, useState } from 'react'
import * as M from './engine.js'
import { findTeams, findScorer, teamInfo, h2h, ranking, glossary, DBINFO } from './model/teamdb.js'
import { Strength } from './Bits.jsx'
import * as W from './model/week.js'
const { E } = M

/* Built-in assistant: understands set kinds of questions (English + Spanish)
   and answers only from the app's own numbers and its own team database. No outside service. */

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const clp = x => 'CLP ' + Math.round(x).toLocaleString('en-US')
const ymd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0') }
const P = (eid, n) => { const m = M.byE[eid]; const mk = M.markets(m).find(x => x.n === n); if (!mk) return null; const R = M.simOf(eid); return M.frac(R, mk.f) }
const nn = (eid, n) => { const m = M.byE[eid]; return M.nice(n, m) }
const B = () => M.bookName()

function pool() {
  const ids = new Set(M.BOARD[E.CUR.lg + '|' + E.CUR.date] || [])
  if (E.DAY) M.dayGames(E.DAY).forEach(g => ids.add(g.eid))
  E.MY.forEach(t => t.legs.forEach(l => { const s = M.ST[l.eid]; if (s && s.state !== 'post') ids.add(l.eid) }))
  return [...ids].filter(e => M.byE[e])
}
const open = ids => ids.filter(e => M.S(e).state !== 'post')
const vs = m => m.h + ' v ' + m.a
const when = e => { const s = M.S(e); return s.state === 'in' ? `LIVE ${s.h}-${s.a} · ${s.clock}` : s.state === 'post' ? `FT ${s.h}-${s.a}` : s.date ? new Date(s.date).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '' }

function findMatch(q, teams) {
  const T = teams || findTeams(q)
  const words = norm(q).split(/[^a-z]+/).filter(w => w.length >= 3)
  const names = T.map(t => norm(t.name))
  const score = e => { const m = M.byE[e]; const ns = [m.h, m.a, m.hA, m.aA].map(norm); let s = 0
    names.forEach(n => ns.forEach(x => { if (x === n || x.includes(n) || n.includes(x)) s += 2 }))
    words.forEach(w => ns.forEach(n => { if (n === w || (w.length >= 4 && n.startsWith(w)) || (w.length >= 5 && n.includes(w))) s++ })); return s }
  let best = null, bs = 0; const st = { in: 3, pre: 2, post: 1 }
  Object.keys(M.byE).forEach(e => { const s = score(e); if (s > bs || (s === bs && s > 0 && st[M.S(e).state] > st[M.S(best).state])) { best = e; bs = s } })
  return bs ? best : null
}

/* ---------- small pieces ---------- */
const Form = ({ L }) => <span className="aform">{L.map((g, i) => <span key={i} className={'fr ' + g.r} title={`${g.d} ${g.home ? 'v' : '@'} ${g.opp} ${g.gf}-${g.ga}`}>{g.r}</span>)}</span>
function MatchRow({ eid }) {
  const m = M.byE[eid], R = M.simOf(eid); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), D = M.frac(R, (R, n) => R.GH[n] === R.GA[n]), A = 1 - H - D
  return <div className="abox"><b>{vs(m)}</b> <span className="sub">{when(eid)}</span>
    <div className="atri"><span>W1 {m.hA} <b>{M.pct(H)}</b></span><span>X <b>{M.pct(D)}</b></span><span>W2 {m.aA} <b>{M.pct(A)}</b></span></div></div>
}
function PickList({ L, add = true }) {
  return <div className="abox">{L.map((x, i) => { const m = M.byE[x.eid]; const v = M.valueOf(m, x.n, x.p); return <div key={i} className="arow"><span><b>{nn(x.eid, x.n)}</b><span className="sub"> {m.hA}–{m.aA}{x.need ? ' · ' + x.need.txt : ''}</span></span><b>{M.pct(x.p)}</b><span className="sub">our odds {(1 / x.p).toFixed(2)}{v && v.agree ? ' ✓' : ''}</span>
    {add && <button className="aadd" title="Add to my ticket" onClick={() => addDraft([x])}>＋</button>}</div> })}</div>
}
function addDraft(L) {
  const d = E.DRAFT.slice(); L.forEach(x => { if (!d.some(l => l.eid === x.eid && l.n === x.n)) d.push({ eid: x.eid, lg: M.byE[x.eid].lg, date: M.S(x.eid).date ? ymd(M.S(x.eid).date) : E.CUR.date, n: x.n, o: null }) })
  M.setDraft(d); window.dispatchEvent(new Event('mb:builder'))
}
function bestPicks(filter, lo = .6, hi = .93) {
  const out = []
  open(pool()).forEach(e => { const m = M.byE[e], R = M.simOf(e); M.marketsShown(m).forEach(x => { if (x.pu || !filter(x, m)) return; const p = M.frac(R, x.f); if (p >= lo && p <= hi) out.push({ eid: e, n: x.n, p }) }) })
  return out.sort((a, b) => b.p - a.p)
}
function onePerMatch(L, k) { const seen = new Set(), r = []; for (const x of L) { if (seen.has(x.eid)) continue; seen.add(x.eid); r.push(x); if (r.length >= k) break } return r }

/* ---------- answers ---------- */
const CHIPS = ['What should I bet now?', 'Games this weekend', 'Ticket for Saturday', 'Premier League table', 'Top scorers LaLiga', 'Arsenal transfers', 'Colo Colo', 'How strong is my ticket?', 'Your suggestion history', 'What is X2?']
function aHelp() { return { text: 'I answer from this app’s own numbers and a database of ' + DBINFO.games.toLocaleString('en-US') + ' national-team games + 5 big leagues. Try:', chips: CHIPS } }

function aCash() {
  const mine = E.MY.filter(t => t.real || !t.preset)
  if (!mine.length) return { text: 'You have no tickets yet. Add one in My tickets → “＋ Add ticket”.' }
  return { node: <>{mine.map(t => { const legs = t.legs.map(M.legState); const res = M.settled(legs); const Ev = M.ticketE(t); const sg = M.signal(t, M.ticketP(t), Ev, res, legs); const stake = t.stake || E.STAKE; const odds = M.tOdds(t)
    const won = legs.filter(l => l.s && l.s.state !== 'pre' && l.p === 1).length, live = legs.filter(l => l.s && l.s.state === 'in').length
    const started = legs.some(l => l.s && l.s.state !== 'pre'); const big = res || (!started ? 'WAITING' : sg.big)
    const txt = res === 'WON' ? `It won: ${clp(stake * odds)}.` : res === 'LOST' ? 'One bet lost, nothing to cash out.' : !started ? 'Not started yet – nothing to do.' : (/–/.test(sg.txt) ? 'Going well – keep it running.' : sg.txt)
    return <div key={t.id} className="abox"><b>{t.real ? B() + ' #' + (t.n.match(/#(\d+)/) || [])[1] : t.n}</b> <span className={'apill ' + big.toLowerCase().replace(/ /g, '')}>{big}</span>
      <div>{txt}</div><div className="sub">{won} of {legs.length} won{live ? ` · ${live} live` : ''}{started && !res && Ev != null ? ` · worth now ${clp(stake * Ev)}` : ''}</div></div> })}
    <div className="sub">Type {B()}’s cash-out offer on the ticket (My tickets) and I’ll tell you if it’s a good deal.</div></>, chips: ['How strong is my ticket?'] }
}

function aStrength() {
  const mine = E.MY.filter(t => (t.real || !t.preset) && !M.settled(t.legs.map(M.legState)))
  if (!mine.length) return { text: 'No open tickets. Add one in My tickets and I’ll check how strong each bet is.' }
  return { node: <>{mine.map(t => { const st = M.ticketStrength(t); const pr = M.protection(t); const w = pr && pr.weakest
    return <div key={t.id} className="abox"><b>{t.real ? B() + ' #' + (t.n.match(/#(\d+)/) || [])[1] : t.n}</b><Strength st={st} small />
      {w && <div>Weakest bet: <b>{M.nice(w.n, pr.m)}</b> ({M.pct(w.p)}) in {pr.m.h} v {pr.m.a}.</div>}
      {pr && pr.swap && <div className="sub">🛡 Safer: change it to <b>{M.nice(pr.swap.n, pr.m)}</b> ({M.pct(pr.swap.p)}).</div>}
      {pr && pr.cover && <div className="sub">🛡 Cover: bet {clp(pr.cover.stake)} on <b>{M.nice(pr.cover.n, pr.m)}</b> at about {pr.cover.o.toFixed(2)} – gives your money back if the weak bet fails.{!pr.cover.worth ? ' Not worth it here.' : ''}</div>}</div> })}
    <div className="sub">Strength looks at each bet’s own %: 10 = every bet very likely. Under 5 = risky.</div></> }
}

function aCombo(id) {
  const day = E.DAY || E.CUR.date; const c = M.combos(day).find(x => x.id === id)
  const name = id === 'f9' ? 'Fire 9' : 'Best 6'
  if (!c || c.wait) return { text: `No ${name} right now: ${c && c.wait ? 'only ' + c.have + ' games left with a safe bet' : 'not enough games still to play'}. Try Tomorrow on the Today page.` }
  return { node: <><div className="ah">{c.title} · our odds {c.fair.toFixed(2)}</div><Strength st={c.st} small /><PickList L={c.legs} add={false} />
    {c.rec && <div className="sub">Tested on {c.rec[0]} past match days: won {c.rec[1]} ({Math.round(c.rec[1] / c.rec[0] * 100)}%).</div>}
    <div>Good deal if {B()} gives total odds above <b>{c.fair.toFixed(2)}</b>.</div>
    <button className="cta" style={{ marginTop: 8 }} onClick={() => { M.useCombo(c.legs); window.dispatchEvent(new Event('mb:builder')) }}>Use this ticket</button></>, chips: [id === 'f9' ? 'Best 6' : 'Fire 9', 'How strong is my ticket?'] }
}

function aValue() {
  const L = []
  open(pool()).forEach(e => { const m = M.byE[e], R = M.simOf(e); M.marketsShown(m).forEach(x => { const p = M.frac(R, x.f); if (p < .6 || p > .93) return; const v = M.valueOf(m, x.n, p); if (v && v.agree && v.odds) L.push({ eid: e, n: x.n, p, v }) }) })
  L.sort((a, b) => Math.min(b.p, b.v.book) - Math.min(a.p, a.v.book))
  if (!L.length) return { text: 'No bets right now where we and the bookies clearly agree (we need bookie odds for that game).' }
  return { node: <><div className="ah">Safest bets: we and the bookies agree ✓</div>
    <div className="abox">{onePerMatch(L, 6).map((x, i) => { const m = M.byE[x.eid]; return <div key={i} className="arow"><span><b>{nn(x.eid, x.n)}</b><span className="sub"> {m.hA}–{m.aA}</span></span><b>{M.pct(x.p)}</b><span className="sub">bookies {M.pct(x.v.book)} @{x.v.odds.toFixed(2)} ✓</span><button className="aadd" onClick={() => addDraft([x])}>＋</button></div> })}</div>
    <div className="sub">Tested on 5,202 club games: bets where both agree did clearly better than bets where we disagreed with the bookies.</div></> }
}

function aLive() {
  const live = Object.keys(M.ST).filter(e => M.byE[e] && M.S(e).state === 'in')
  if (!live.length) { const nx = open(pool()).filter(e => M.S(e).date).sort((a, b) => new Date(M.S(a).date) - new Date(M.S(b).date))[0]; return { text: 'Nothing is live right now.' + (nx ? ` Next: ${vs(M.byE[nx])}, ${when(nx)}.` : '') } }
  return { node: <>{live.map(e => <MatchRow key={e} eid={e} />)}</>, chips: ['Live bets now'] }
}
function aLiveBets(eid) {
  let ids = eid ? [eid] : Object.keys(M.ST).filter(e => M.byE[e] && M.S(e).state === 'in')
  ids = ids.filter(e => M.S(e).state === 'in')
  if (!ids.length) return { text: eid ? `${vs(M.byE[eid])} is not live yet (${when(eid)}).` : 'Nothing is live right now. Ask me again when a game starts.' }
  return { node: <>{ids.map(e => { const a = M.liveAdvice(e); const m = M.byE[e]
    return <div key={e}><div className="ah">{vs(m)} · {when(e)}</div>{a && <div className="sub">{a.lines.slice(1, 3).join(' · ')}</div>}{a && a.picks.length ? <PickList L={a.picks} /> : <div className="sub">No strong live bet right now.</div>}</div> })}
    <div className="sub">Only bet if {B()}’s live odds are at least “our odds”.</div></> }
}

function teamCard(t, eid) {
  const I = teamInfo(t.name, t.kind); if (!I) return null
  return <div className="abox" key={t.name}><b>{I.name}</b>{I.rank && <span className="sub"> · world rank #{I.rank.rank} (our rating {I.rank.elo})</span>}
    <div style={{ margin: '4px 0' }}><Form L={I.last.slice(0, 8)} /> <span className="sub">{I.w}W {I.dr}D {I.l}L last {I.last.length}</span></div>
    <div className="atri"><span>Scores <b>{I.gf.toFixed(1)}</b></span><span>Lets in <b>{I.ga.toFixed(1)}</b></span><span>Over 2.5 <b>{M.pct(I.o25)}</b></span><span>Under 3.5 <b>{M.pct(I.u35)}</b></span>{I.y != null && <span>Yellows <b>{I.y.toFixed(1)}</b> (game {I.yt.toFixed(1)})</span>}</div>
    <div className="sub" style={{ marginTop: 4 }}>{I.last.slice(0, 5).map(g => `${g.home ? 'v' : '@'} ${g.opp} ${g.gf}-${g.ga}`).join(' · ')}</div>
    {I.scorers.length > 0 && <div className="sub">Top scorers since 2022: {I.scorers.map(([n, c]) => `${n} ${c}`).join(', ')}</div>}
    {eid && <div style={{ marginTop: 4 }}>Next in the app: <b>{vs(M.byE[eid])}</b> <span className="sub">{when(eid)}</span></div>}
    <div className="sub" style={{ fontSize: 10 }}>Data to {I.upd}{I.kind === 'cl' ? ' (last season)' : ''}</div></div>
}
function aTeam(T, eid) {
  const cards = T.slice(0, 2).map(t => teamCard(t, eid)).filter(Boolean)
  if (!cards.length) return null
  return { node: <>{cards}{eid && <MatchRow eid={eid} />}</>, open: eid, chips: T.length >= 2 ? [`${T[0].name} v ${T[1].name} head to head`] : [`${T[0].name} scorers`, 'Top 20 teams'] }
}
function aH2H(a, b, eid) {
  if (a.kind !== b.kind) return null
  const H = h2h(a.name, b.name, a.kind)
  if (!H.all) return { text: `No games between ${a.name} and ${b.name} in my data (${a.kind === 'cl' ? 'last 2 seasons' : 'since 2018'}).`, node: aTeam([a, b], eid).node }
  return { node: <><div className="ah">{a.name} v {b.name} · last {H.all} meeting{H.all > 1 ? 's' : ''}</div>
    <div className="abox"><div className="atri"><span>{a.name} won <b>{H.w}</b></span><span>Draws <b>{H.d}</b></span><span>{b.name} won <b>{H.l}</b></span></div>
      {H.list.map((g, i) => <div key={i} className="arow"><span className="sub">{g.d}</span><span>{g.home ? `${a.name} ${g.gf}-${g.ga} ${b.name}` : `${b.name} ${g.ga}-${g.gf} ${a.name}`}</span><span className="sub">{g.t}</span></div>)}</div>
    {eid && <MatchRow eid={eid} />}<div className="sub">Old games count less than form – our % already use both.</div></>, open: eid, chips: [`${a.name} form`, `${b.name} form`] }
}
function aRank() {
  const L = ranking(20)
  return { node: <><div className="ah">Top 20 national teams (our own rating)</div><div className="abox">{L.map(([n, r], i) => <div key={n} className="arow"><span>#{i + 1} <b>{n}</b></span><span className="sub">{r}</span></div>)}</div>
    <div className="sub">Our rating moves after every game: big wins and wins against strong teams count more.</div></> }
}
function aScorers(t) {
  const I = teamInfo(t.name, t.kind); if (!I || !I.scorers.length) return { text: `I have no scorer list for ${t.name}.` }
  return { node: <><div className="ah">{t.name} – top scorers since 2022</div><div className="abox">{I.scorers.map(([n, c]) => <div key={n} className="arow"><span><b>{n}</b></span><span>{c} goals</span></div>)}</div></> }
}
function aGloss(q) {
  const G = glossary(q); if (!G.length) return null
  return { node: <div className="abox">{G.slice(0, 3).map(g => <div key={g.t} style={{ marginBottom: 4 }}><b>{g.t}</b> – {g.d}</div>)}</div>, chips: ['What is 1X?', 'What is Total Over?', 'What is cash-out?'] }
}

function aMatch(eid) {
  const m = M.byE[eid], s = M.S(eid); const g = n => P(eid, n)
  const rows = [[`${m.h} or draw`], [`${m.a} or draw`], ['Over 1.5'], ['Over 2.5'], ['Under 3.5'], [`${m.h} over 0.5`], [`${m.a} over 0.5`], ['Over 3.5 yellows']].map(([n]) => [n, g(n)])
  const R = M.simOf(eid); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), A = M.frac(R, (R, n) => R.GH[n] < R.GA[n])
  const fav = H > A ? m.h : m.a, fp = Math.max(H, A)
  return { node: <><MatchRow eid={eid} /><div className="abox">{rows.filter(r => r[1] != null).map(([n, p]) => { const v = M.valueOf(m, n, p); const nd = M.needInfo(eid, n); return <div key={n} className="arow"><span>{M.nice(n, m)}{nd ? <span className="sub"> · {nd.txt}</span> : null}</span><b>{p > .995 ? '✓' : M.pct(p)}</b><span className="sub">{p > .995 ? 'done' : p < .005 ? 'lost' : 'our odds ' + (1 / p).toFixed(2)}{v && v.agree ? ' ✓' : ''}</span><button className="aadd" onClick={() => addDraft([{ eid, n, p }])}>＋</button></div> })}</div>
    <div>{fp > .6 ? `${fav} are clear favourites.` : fp > .45 ? `${fav} are slight favourites.` : 'Close game – no clear favourite.'}</div></>,
    chips: s.state === 'in' ? ['Live bets now', 'Should I take the money?'] : [`${m.h} v ${m.a} head to head`, 'Fire 9'], open: eid }
}

function aGoals(q) {
  const hasO = /over|mas de|altas/.test(q), hasU = /under|menos|bajas/.test(q); const wantO = hasO || !hasU, wantU = hasU || !hasO
  const O = onePerMatch(bestPicks(x => /^Over \d\.5$/.test(x.n) && x.n !== 'Over 0.5', .6, .9), 5)
  const U = onePerMatch(bestPicks(x => /^Under \d\.5$/.test(x.n) && x.n !== 'Under 4.5', .6, .9), 5)
  if (!O.length && !U.length) return { text: 'No open games right now. Change the day on the Today page.' }
  return { node: <>{wantO && O.length > 0 && <><div className="ah">Total Over (more goals)</div><PickList L={O} /></>}{wantU && U.length > 0 && <><div className="ah">Total Under (fewer goals)</div><PickList L={U} /></>}
    <div className="sub">Only bet if {B()} pays more than our odds. ＋ adds it to your ticket.</div></> }
}
function aCards() {
  const L = onePerMatch(bestPicks(x => / yellows$/.test(x.n), .6, .9), 6)
  if (!L.length) return { text: 'No good card bets on the open games right now.' }
  return { node: <><div className="ah">Yellow cards Total</div><PickList L={L} /><div className="sub">Cards are best for club games (we know each team’s card habits). For national teams we use the average.</div></> }
}

function aBuild(q) {
  const n = +(q.match(/\b(\d{1,2})\b/) || [])[1] || (/safe|segur/.test(q) ? 5 : 4)
  const safe = /safe|segur/.test(q), risky = /high|big|alta|grande|risk|payout/.test(q)
  const lo = safe ? .8 : risky ? .35 : .65, hi = safe ? .95 : risky ? .6 : .85
  const ok = (x, m) => risky ? / win$/.test(x.n) || /^Over [23]\.5$/.test(x.n) : M.safeCands(m).includes(x.n)
  const L = onePerMatch(bestPicks(ok, lo, hi), Math.min(Math.max(n, 2), 10))
  if (L.length < 2) return { text: 'Not enough open games for a ticket. Pick another day on the Today page.' }
  const pAll = L.reduce((a, x) => a * x.p, 1)
  return { node: <><div className="ah">{safe ? 'Safe' : risky ? 'Big payout' : 'Balanced'} ticket · {L.length} bets</div><Strength st={M.strengthOf(L.map(x => x.p))} small /><PickList L={L} add={false} />
    <div>If {B()}’s total odds are above <b>{(1 / pAll).toFixed(2)}</b>, it’s a good deal.</div>
    <button className="cta" style={{ marginTop: 8 }} onClick={() => addDraft(L)}>Add these to my ticket</button></>, chips: ['Fire 9', 'Best 6', 'Make a safe ticket'] }
}

function aAcc() {
  const a = M.accStats()
  return { node: <><div>Our % come from our own team ratings, tested on thousands of past games (national teams and the 5 big leagues). We do not copy the bookies’ odds – we only compare with them.</div>
    {a.n ? <div className="abox">On your games: <b>{a.n}</b> finished · our favourite won <b>{M.pct(a.fav)}</b> · Total 2.5 right <b>{M.pct(a.ou)}</b></div> : <div className="sub">I save my % before every game and check them at the final whistle – your own results will show here soon.</div>}
    <div className="sub">No one wins every bet. Over many games, betting only when {B()} pays more than our odds is what counts.</div></> }
}


/* ---------- fluent answers ---------- */
const today = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') }
const dayWord = d => d === today() ? 'today' : d === M.nextYmd(today()) ? 'tomorrow' : new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
function TicketBox({ c }) {
  return <div className="abox"><b>{c.title}</b> <span className="sub">· {c.legs.length} bets · our odds {c.fair.toFixed(2)}</span><Strength st={c.st} small />
    {c.legs.map((x, i) => { const m = M.byE[x.eid]; return <div key={i} className="arow"><span><b>{nn(x.eid, x.n)}</b><span className="sub"> {m.hA}–{m.aA} · {when(x.eid)}</span></span><b>{M.pct(x.p)}</b></div> })}
    {c.rec && <div className="sub">Tested: won {c.rec[1]} of {c.rec[0]} days ({Math.round(c.rec[1] / c.rec[0] * 100)}%).</div>}
    <button className="cta" style={{ marginTop: 6 }} onClick={() => { M.useCombo(c.legs); window.dispatchEvent(new Event('mb:builder')) }}>Use this ticket</button></div>
}
// "what should I bet now?" – live games first, then the next games, plus the ticket we'd play
function aNow() {
  const live = Object.keys(M.ST).filter(e => M.byE[e] && M.S(e).state === 'in')
  const L = live.map(e => { const a = M.liveAdvice(e); return a && a.picks[0] ? { ...a.picks[0], eid: e } : null }).filter(Boolean)
  const d = today(); const C = M.combos(d).filter(c => !c.wait)
  const safe = C.find(c => c.id === 'safe3') || C[0]
  const next = M.pickList(d, 'safe', .6, .95, undefined, true).slice(0, 4)
  if (!L.length && !next.length && !C.length) return { text: 'Nothing left to play today. Want a ticket for tomorrow?', chips: ['Ticket for tomorrow', 'Top 20 teams'] }
  return { node: <>
    <div>{L.length ? `${L.length} game${L.length > 1 ? 's are' : ' is'} live right now – here’s what I like:` : 'Nothing live right now. Here’s what I like for the next games:'}</div>
    {L.length > 0 && <><div className="ah">🔴 Live now</div><PickList L={L.slice(0, 4)} /></>}
    {next.length > 0 && <><div className="ah">⏱ Coming up {dayWord(d)}</div><PickList L={next} /></>}
    {safe && <><div className="ah">🎟 The ticket I’d play</div><TicketBox c={safe} /></>}
    <div className="sub">Only bet if {B()} pays at least our odds. Small stakes – no bet is sure.</div></>, chips: ['Ticket for tomorrow', 'Safest bets', 'Why?', 'Fire 9'] }
}
// tickets for any day (today / tomorrow / a weekday) – loads that day's games first
async function aDay(d, which) {
  await M.loadDayData(d)
  await new Promise(r => setTimeout(r, 400))
  const C = M.combos(d).filter(c => !c.wait)
  M.recordSuggestions(d, C)
  if (!C.length) return { text: `No ready tickets for ${dayWord(d)} yet – not enough games in our competitions.`, chips: ['What should I bet now?'] }
  const pick = which ? C.filter(c => c.id === which) : [C.find(c => c.id === 'safe3'), C.find(c => c.id === 'gol') || C.find(c => c.id === 'fav')].filter(Boolean)
  const games = M.dayGames(d).length
  return { node: <><div>{games} games {dayWord(d)}. {pick.length > 1 ? 'Two tickets: a short safe one and a 4+ one.' : 'Here it is:'}</div>{pick.map(c => <TicketBox key={c.id} c={c} />)}
    <div className="sub">Also ready for {dayWord(d)}: {C.filter(c => !pick.includes(c)).map(c => c.title).join(' · ') || '–'}. The app saves these before kick-off and shows the results in My tickets.</div></>,
    chips: C.filter(c => !pick.includes(c)).slice(0, 3).map(c => c.title.replace(/^\S+ /, '') + ' ' + dayWord(d)) }
}
function aWhy(eid) {
  const w = M.whyOf(eid); if (!w) return null; const m = M.byE[eid]
  return { node: <><div className="ah">Why {m.h} v {m.a}?</div><div className="abox"><b>{w.verdict}</b>{w.pts.map((x, i) => <div key={i} style={{ marginTop: 4 }}>• {x.t}</div>)}</div>
    <div className="sub">How: {w.how.join(' ')}</div></>, open: eid, chips: [`${m.h} form`, `${m.h} v ${m.a} head to head`] }
}
function aHistory() {
  const r = M.sugRecord(); const H = M.sugHistory().slice(0, 6)
  if (!H.length) return { text: 'No suggested tickets saved yet – the app saves them every day before kick-off.' }
  return { node: <><div className="ah">Our suggested tickets</div>{r.n > 0 && <div>Finished: <b>{r.n}</b> · won <b>{r.won}</b> · lost <b>{r.lost}</b>. With 1,000 on each you’d have about <b>{Math.round(r.back * 1000).toLocaleString('en-US')}</b> back from {(r.n * 1000).toLocaleString('en-US')}.</div>}
    <div className="abox">{H.map(x => <div key={x.id} className="arow"><span><b>{x.title}</b><span className="sub"> {dayWord(x.date)}</span></span><span className={x.res === 'WON' ? 'ok' : x.res === 'LOST' ? 'ko' : 'sub'}>{x.res}</span></div>)}</div>
    <div className="sub">Full list with every bet: My tickets → “Our suggested tickets”.</div></> }
}
function aChallenge() {
  const st = M.challengeState()
  if (!st) return { text: 'The AI challenge gives me play money for 30 days and I bet on my own tickets by a fixed rule. Start it in My tickets → 🤖 AI money challenge (5,000 to 50,000). Honest numbers from 3 seasons of real odds: steady betting kept the money about level; going all-in reached 10x in about 6 months of 100 and lost everything in the rest.' }
  return { text: `Challenge (${st.mode.name}): started with CLP ${st.start.toLocaleString('en-US')}, now CLP ${st.bank.toLocaleString('en-US')} (x${(st.bank / st.start).toFixed(2)}).${st.pending ? ` Today: ${st.pending.title}, stake ${st.pending.stake.toLocaleString('en-US')}.` : ''}${st.done ? ' Finished: ' + st.done + '.' : ''}` }
}
function whenDay(q) {
  if (/tomorrow|manana/.test(q)) return M.nextYmd(today())
  if (/today|hoy|tonight|esta noche/.test(q)) return today()
  const W = ['sunday|domingo', 'monday|lunes', 'tuesday|martes', 'wednesday|miercoles', 'thursday|jueves', 'friday|viernes', 'saturday|sabado']
  const wi = W.findIndex(w => new RegExp('\\b(' + w + ')\\b').test(q)); if (wi < 0) return null
  const d = new Date(); let k = (wi - d.getDay() + 7) % 7; if (k === 0) k = 7; d.setDate(d.getDate() + k)
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

/* ---------- every league: tables, scorers, players, squads, transfers, this week's games (nightly data) ---------- */
const ordn = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th')
const FR = g => (g[2] > g[3] ? 'W' : g[2] === g[3] ? 'D' : 'L')
const wkWhen = iso => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
const noWeek = { text: 'The team and player data is still loading – try again in a few seconds.' }
function eidOf(h, a) { return Object.keys(M.byE).find(e => { const m = M.byE[e]; return W.wnorm(m.h) === W.wnorm(h) && W.wnorm(m.a) === W.wnorm(a) }) }
function aClub(t) {
  const w = W.teamWeek(t.n || t); if (!w) return null
  const kp = W.keyPlayers(w, 3), cm = W.cardMen(w, 2), si = W.signings(w, 5), de = W.departures(w, 4)
  const gp = w.st && w.st.gp ? w.st.gp : 0
  return { node: <><div className="abox"><b>{w.n}</b> <span className="sub">· {w.league}</span>
    {w.st && <div>{ordn(w.st.rank)}{w.st.group ? ' in ' + w.st.group : ''} · <b>{w.st.pts} pts</b> from {w.st.gp} games ({w.st.w}W {w.st.d}D {w.st.l}L) · goals {w.st.gf}-{w.st.ga}{gp ? ` (${(w.st.gf / gp).toFixed(1)} scored, ${(w.st.ga / gp).toFixed(1)} let in per game)` : ''}</div>}
    {w.form && w.form.length > 0 && <div style={{ margin: '4px 0' }}><span className="aform">{w.form.map((g, i) => <span key={i} className={'fr ' + FR(g)} title={`${g[0]} ${g[4] ? 'v' : '@'} ${g[1]} ${g[2]}-${g[3]}`}>{FR(g)}</span>)}</span> <span className="sub">{w.form.slice(0, 3).map(g => `${g[4] ? 'v' : '@'} ${g[1]} ${g[2]}-${g[3]}`).join(' · ')}</span></div>}
    {kp.length > 0 && <div>⚽ Top scorers: {kp.map(p => `${p[0]} ${p[5]}`).join(', ')}</div>}
    {cm.length > 0 && <div>🟨 Most booked: {cm.map(p => `${p[0]} ${p[8]}`).join(', ')}</div>}
    {si.length > 0 && <div>➕ Signed: {si.map(x => `${x[1]} (from ${x[2]}${x[3] ? ', ' + x[3] : ''})`).join('; ')}</div>}
    {de.length > 0 && <div className="sub">➖ Left: {de.map(x => `${x[1]} (to ${x[2]})`).join('; ')}</div>}
    {w.fx.map(f => { const e = eidOf(f[4], f[6]); return <div key={f[0]} style={{ marginTop: 4 }}>📅 <b>{f[4]} v {f[6]}</b> <span className="sub">{wkWhen(f[2])}</span>{e && <MatchRow eid={e} />}</div> })}
  </div><div className="sub" style={{ fontSize: 10 }}>Squads, tables: ESPN · transfers: Wikipedia (CC BY-SA)</div></>,
    open: (w.fx[0] && eidOf(w.fx[0][4], w.fx[0][6])) || null, chips: [`${w.n} squad`, `${w.n} transfers`, `${w.league} table`] }
}
function aTable(lg) {
  const T = W.tableOf(lg); if (!T.length) return { text: 'I have no table for that league.' }
  return { node: <><div className="ah">{W.leagueName(lg)} – table</div>{T.map(g => <div key={g.g} className="abox">{T.length > 1 && <b>{g.g}</b>}
    {g.rows.slice(0, T.length > 1 ? 8 : 20).map(r => <div key={r[1]} className="arow"><span>{r[0]}. <b>{r[2]}</b></span><span className="sub">{r[3]} games · {r[7]}-{r[8]}</span><b>{r[9]}</b></div>)}</div>)}</>,
    chips: [`Top scorers ${W.leagueName(lg)}`, `${W.leagueName(lg)} games this week`] }
}
function aLeagueScorers(lg) {
  const S = W.scorersOf(lg), A = W.assistsOf(lg); if (!S.length) return { text: 'No scorer list for that league.' }
  return { node: <><div className="ah">{W.leagueName(lg)} – top scorers</div><div className="abox">{S.slice(0, 10).map((x, i) => <div key={i} className="arow"><span>{i + 1}. <b>{x[0]}</b><span className="sub"> {x[1]}</span></span><b>{x[2]}</b></div>)}</div>
    {A.length > 0 && <><div className="ah">Assists</div><div className="abox">{A.slice(0, 5).map((x, i) => <div key={i} className="arow"><span><b>{x[0]}</b><span className="sub"> {x[1]}</span></span><b>{x[2]}</b></div>)}</div></>}</>, chips: [`${W.leagueName(lg)} table`] }
}
function aPlayer(f) {
  const p = f.p, P = W.P
  return { node: <div className="abox"><b>{p[P.name]}</b> <span className="sub">· {f.team}{p[P.pos] ? ' · ' + ({ G: 'goalkeeper', D: 'defender', M: 'midfielder', F: 'forward' }[p[P.pos]] || p[P.pos]) : ''}{p[P.age] ? ' · ' + p[P.age] + ' years' : ''}{p[P.nat] ? ' · ' + p[P.nat] : ''}</span>
    <div className="atri"><span>Games <b>{p[P.apps]}</b>{p[P.subs] ? <span className="sub"> ({p[P.subs]} as sub)</span> : null}</span><span>Goals <b>{p[P.goals]}</b></span>{p[P.ast] > 0 && <span>Assists <b>{p[P.ast]}</b></span>}<span>Shots <b>{p[P.shots]}</b> <span className="sub">({p[P.sot]} on target)</span></span><span>🟨 <b>{p[P.yc]}</b>{p[P.rc] ? ' 🟥 ' + p[P.rc] : ''}</span></div>
    {p[P.apps] > 0 && p[P.goals] > 0 && <div className="sub">A goal every {(p[P.apps] / p[P.goals]).toFixed(1)} games this season.</div>}</div>, chips: [`${f.team}`, `Top scorers ${W.leagueName(f.lg)}`] }
}
function aSquad(t) {
  const w = W.teamWeek(t.n || t); if (!w || !w.sq.length) return { text: 'No squad list for that team this week.' }
  const L = w.sq.filter(p => p[3] > 0).sort((a, b) => b[3] - a[3]).slice(0, 18)
  return { node: <><div className="ah">{w.n} – squad this season</div><div className="abox">{L.map(p => <div key={p[0]} className="arow"><span><b>{p[0]}</b><span className="sub"> {p[1]}{p[2] ? ' · ' + p[2] : ''}</span></span><span className="sub">{p[3]} games</span><span>⚽ {p[5]} · 🟨 {p[8]}</span></div>)}</div></>, chips: [`${w.n} transfers`, `${w.n}`] }
}
function aTransfers(t) {
  const w = W.teamWeek(t.n || t); if (!w) return null
  const I = w.tr.in.slice().reverse(), O = w.tr.out.slice().reverse()
  if (!I.length && !O.length) return { text: `I have no summer transfers for ${w.n} (lists exist for the European leagues and Mexico).` }
  return { node: <><div className="ah">{w.n} – summer 2026 transfers</div>
    {I.length > 0 && <div className="abox"><b>In ({I.length})</b>{I.slice(0, 12).map((x, i) => <div key={i} className="arow"><span><b>{x[1]}</b><span className="sub"> from {x[2]}</span></span><span className="sub">{x[3]}</span></div>)}</div>}
    {O.length > 0 && <div className="abox"><b>Out ({O.length})</b>{O.slice(0, 12).map((x, i) => <div key={i} className="arow"><span><b>{x[1]}</b><span className="sub"> to {x[2]}</span></span><span className="sub">{x[3]}</span></div>)}</div>}
    <div className="sub" style={{ fontSize: 10 }}>Source: Wikipedia transfer lists (CC BY-SA)</div></>, chips: [`${w.n}`, `${w.n} squad`] }
}
async function aWeekGames(lg, day, weekend) {
  const wk = W.week()
  let F = W.fixturesOf(lg, day).slice().sort((a, b) => (a[2] < b[2] ? -1 : 1))
  if (weekend) F = F.filter(f => [0, 6].includes(new Date(f[2]).getDay()))
  // load those days' games so our % can be shown
  const days = [...new Set(F.map(f => { const d = new Date(f[2]); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') }))]
  await Promise.all(days.map(d => M.loadDayData(d)))
  await new Promise(r => setTimeout(r, 300))
  if (!F.length) return { text: `No games ${lg ? 'in ' + W.leagueName(lg) + ' ' : ''}${day ? 'that day' : 'this week'}.` }
  const byDay = {}; F.forEach(f => { const d = new Date(f[2]).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }); (byDay[d] = byDay[d] || []).push(f) })
  return { node: <><div className="ah">{lg ? W.leagueName(lg) : 'All leagues'} · {day ? '' : weekend ? 'this weekend · ' : `${wk.from} to ${wk.to} · `}{F.length} games</div>
    {Object.entries(byDay).map(([d, L]) => <div key={d} className="abox"><b>{d}</b>{L.slice(0, 30).map(f => { const e = eidOf(f[4], f[6]); const R = e ? M.simOf(e) : null; const H = R ? M.frac(R, (R, n) => R.GH[n] > R.GA[n]) : null, A = R ? M.frac(R, (R, n) => R.GH[n] < R.GA[n]) : null
      return <div key={f[0]} className="arow"><span><b>{f[4]} v {f[6]}</b><span className="sub"> {new Date(f[2]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{lg ? '' : ' · ' + W.leagueName(f[1])}</span></span>{R ? <span className="sub">W1 {M.pct(H)} · W2 {M.pct(A)}</span> : <span className="sub">–</span>}</div> })}{L.length > 30 && <div className="sub">+{L.length - 30} more</div>}</div>)}</>,
    chips: ['What should I bet now?', 'Ticket for Saturday', 'Ticket for Sunday'] }
}

function answer(q0) {
  const q = norm(q0).replace(/^[¿¡\s"']+/, '').replace(/[?!.]+$/, '')
  if (!q.trim() || /^(help|ayuda|hi|hola|hello|hey|menu)\b/.test(q)) return aHelp()
  if (/^(what is|what does|que es|que significa|explain|explica)\b|\bmean(s)?\b/.test(q)) { const g = aGloss(q); if (g) return g }
  if (/corner|corne?r|esquina/.test(q)) return { text: 'We don’t suggest corners any more: too much luck. Try Total goals, 1X2 or yellow cards.', chips: ['Best goal bets', 'Cards bets'] }
  if (/strong|strength|fuerza|protect|proteg|cover|cubrir|weak|debil/.test(q)) return aStrength()
  const day = whenDay(q)
  if (day && /ticket|boleto|combi|parlay|express|apuesta|bet|tip|pick|fire|best 6|safe|goals|favourites|big payout/.test(q)) return aDay(day, /fire|fuego/.test(q) ? 'f9' : /best ?6/.test(q) ? 'b6' : /safe/.test(q) ? 'safe3' : /goal/.test(q) ? 'gol' : /favourite/.test(q) ? 'fav' : /big payout/.test(q) ? 'big' : null)
  if (/what (should|to|can) i bet|what do i bet|que (apuesto|apostar|juego)|hot (match|game|bet)|best bets? (now|today)|recommend|recomiend|tips? (today|now|hoy)|dame (algo|una apuesta)|que me recomiendas|^bet now|^tips?$/.test(q)) return aNow()
  if (/challenge|reto|desafio|50000|500000/.test(q)) return aChallenge()
  if (/history|historial|how did (you|your|the) (tips|tickets|suggestions)|your record|tu record|resultados de tus/.test(q)) return aHistory()
  if (/fire|fuego|\bf9\b/.test(q)) return aCombo('f9')
  if (/best ?6|mejor(es)? ?6|\bsix\b|\bseis\b|\bb6\b/.test(q)) return aCombo('b6')
  if (/value|valor|pay more|pagan mas|safest bets|agree|de acuerdo/.test(q)) return aValue()
  if (/ranking|top \d+ teams|top teams|best teams|mejores (equipos|selecciones)|world rank/.test(q)) return aRank()
  if (/my stats|what wins|wins for me|mis estadisticas|que me funciona|my record|mi record/.test(q)) { const L = M.myBetStats(); return L.length ? { node: <div className="abox">{L.map(g => <div key={g.k} className="arow"><span>{g.k}</span><b>{g.w}/{g.n}</b><span className="sub">{Math.round(g.w / g.n * 100)}% won</span></div>)}</div> } : { text: 'No finished bets of yours yet. When your games end I group your bets by type so you see what works for you.' } }
  if (/accura|precis|how good|how often.*right|trust|confia/.test(q)) return aAcc()
  if (/take (the )?money|cash|retir|cobr|my ticket|mis bolet|mi bolet|boleto|ticket.*(how|como)|how.*ticket/.test(q) && !/build|make|create|arma|crea|give me|dame/.test(q)) return aCash()
  if (/build|make|create|arma|crea|give me a ticket|dame un|combinada|parlay|safe ticket|high odds|big payout/.test(q)) return aBuild(q)
  // every club league: tables, scorers, squads, transfers, players, this week's games
  const lgq = W.leagueIn(q0), WT = W.teamsIn(q0)
  if (/table|tabla|posiciones|standings|clasificacion/.test(q) && (lgq || WT.length)) return W.week() ? aTable(lgq || W.teamWeek(WT[0].n).lg) : noWeek
  if (/top scor|scorers|goleador|pichichi|artiller|maximo/.test(q) && lgq && !WT.length) return W.week() ? aLeagueScorers(lgq) : noWeek
  if (/transfer|fichaj|signing|signed|refuerz|altas|bajas|who (did|has) .* (sign|buy)/.test(q) && WT.length) return aTransfers(WT[0]) || noWeek
  if (/squad|plantel|plantilla|jugadores de|players of|roster/.test(q) && WT.length) return aSquad(WT[0])
  if (/this week|esta semana|weekend|fin de semana|games|partidos|fixtures|calendario|juegan/.test(q) && !/ticket|boleto|bet|apuesta/.test(q) && (lgq || day || /week|semana|weekend/.test(q))) return W.week() ? aWeekGames(lgq, day ? day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6) : null, /weekend|fin de semana/.test(q) && !day) : noWeek
  const T = findTeams(q0); const eid = findMatch(q0, T)
  if (/live bet|en vivo|apuesta en vivo|bets now|live now/.test(q)) return aLiveBets(eid && M.S(eid).state === 'in' ? eid : null)
  if (/^why\??$|^por ?que\??$/.test(q)) { const e = E.SEL || eid; if (e) { const r = aWhy(e); if (r) return r } }
  if (eid && /why|por ?que|explain|explica|how did you|como lo|analy|anali|research|investig/.test(q)) { const r = aWhy(eid); if (r) return { ...r, node: <>{r.node}{T.length ? aTeam(T.slice(0, 2), null)?.node : null}</> } }
  if (T.length && /research|investig|analy|anali|tell me about|hablame de|info/.test(q) && !WT.length) { const r = aTeam(T, eid && M.S(eid).state !== 'post' ? eid : null); if (r) return r }
  if (WT.length && !(eid && /chance|odds|quien gana|who wins|probab|predic|bet|apuesta|cuota|why|por ?que/.test(q)) && !(T.length && T[0].kind === 'nt' && !WT.some(w => W.wnorm(w.n) === W.wnorm(T[0].name)))) { if (WT.length >= 2 && eid) return aMatch(eid); const r = aClub(WT[0]); if (r) return r }
  if (eid && /chance|odds|quien gana|who wins|probab|predic|bet|apuesta|cuota/.test(q)) return aMatch(eid)
  if (T.length >= 2 || (T.length && /h2h|head to head|cara a cara|historial/.test(q))) { if (T.length >= 2) { const r = aH2H(T[0], T[1], eid); if (r) return r } }
  if (T.length && /scorer|goleador|who scores|quien marca/.test(q)) return aScorers(T[0])
  if (/card|tarjeta|yellow|amarilla/.test(q) && !T.length) return aCards()
  if (/over|under|goal|gol|mas de|menos de|total/.test(q) && !T.length) return aGoals(q)
  if (T.length) { const r = aTeam(T, eid && M.S(eid).state !== 'post' ? eid : null); if (r) return r }
  if (eid) return aMatch(eid)
  const wp = W.findPlayer(q0); if (wp) return aPlayer(wp)
  const pl = findScorer(q0); if (pl) return { node: <div className="abox"><b>{pl.n}</b> – {pl.c} goals for <b>{pl.t}</b> since 2022{pl.rank === 1 ? ' (their top scorer)' : ''}.</div>, chips: [pl.t + ' form', pl.t + ' scorers'] }
  if (/live|vivo|score|marcador|now|ahora|playing/.test(q)) return aLive()
  return { text: 'I didn’t get that. Try one of these, or type a team name (e.g. “Spain”, “Real Madrid”):', chips: CHIPS }
}

export function Assistant() {
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState(() => [{ who: 'bot', ...aHelp(), text: 'Hi! Ask me anything about any of our 20 competitions – “games this weekend”, “Premier League table”, “Haaland”, “Arsenal transfers”, “ticket for Saturday”, “what should I bet now?”.' }]); const [inp, setInp] = useState('')
  const box = useRef(null)
  useEffect(() => { const f = () => setOpen(false); window.addEventListener('mb:builder', f); return () => window.removeEventListener('mb:builder', f) }, [])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs, open])
  const ask = q => {
    if (!q.trim()) return; let a; try { a = answer(q) } catch (e) { console.warn(e); a = { text: 'The numbers are still loading – try again in a few seconds.' } }
    setInp('')
    if (a && typeof a.then === 'function') {
      const id = Date.now(); setMsgs(m => [...m, { who: 'me', text: q }, { who: 'bot', id, text: 'Looking at the games…' }])
      a.then(r => setMsgs(m => m.map(x => x.id === id ? { who: 'bot', ...r } : x))).catch(() => setMsgs(m => m.map(x => x.id === id ? { who: 'bot', text: 'Couldn’t load those games – try again in a moment.' } : x)))
      return
    }
    setMsgs(m => [...m, { who: 'me', text: q }, { who: 'bot', ...a }])
  }
  return <>
    <button className={'abtn' + (open ? ' on' : '')} onClick={() => setOpen(!open)} aria-label="Assistant">{open ? '✕' : '💬'}</button>
    {open && <div className="apanel">
      <div className="ahd"><b>Assistant</b><span className="sub">our own numbers · 17 club leagues + national teams</span></div>
      <div className="amsgs" ref={box}>{msgs.map((m, i) => <div key={i} className={'amsg ' + m.who}>
        {m.text && <div>{m.text}</div>}{m.node}
        {m.open && <button className="linkb" onClick={() => { M.selectMatch(m.open); window.dispatchEvent(new CustomEvent('mb:view', { detail: 'stadium' })); setOpen(false) }}>Open this game ›</button>}
        {m.chips && <div className="achips">{m.chips.map(c => <button key={c} onClick={() => ask(c)}>{c}</button>)}</div>}</div>)}</div>
      <form className="ain" onSubmit={e => { e.preventDefault(); ask(inp) }}><input value={inp} onChange={e => setInp(e.target.value)} placeholder="Try: Spain, Real Madrid, Fire 9, ¿qué es X2?" /><button className="cta">Send</button></form>
    </div>}
  </>
}
