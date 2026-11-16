import React, { useEffect, useRef, useState } from 'react'
import * as M from './engine.js'
import { findTeams, findScorer, teamInfo, h2h, ranking, glossary, DBINFO } from './model/teamdb.js'
import { Strength } from './Bits.jsx'
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
  return <div className="abox">{L.map((x, i) => { const m = M.byE[x.eid]; const v = M.valueOf(m, x.n, x.p); return <div key={i} className="arow"><span><b>{nn(x.eid, x.n)}</b><span className="sub"> {m.hA}–{m.aA}{x.need ? ' · ' + x.need.txt : ''}</span></span><b>{M.pct(x.p)}</b><span className="sub">our odds {(1 / x.p).toFixed(2)}{v && v.value ? ' 💰' : ''}</span>
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
const CHIPS = ['How strong is my ticket?', 'Fire 9', 'Best 6', 'Best goal bets', 'Cards bets', 'Value bets', 'Spain form', 'Top 20 teams', 'What wins for me?', 'What is X2?']
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
  open(pool()).forEach(e => { const m = M.byE[e], R = M.simOf(e); M.marketsShown(m).forEach(x => { const p = M.frac(R, x.f); if (p < .5 || p > .93) return; const v = M.valueOf(m, x.n, p); if (v && v.value) L.push({ eid: e, n: x.n, p, v }) }) })
  L.sort((a, b) => (b.v.ev || 1 + b.v.diff) - (a.v.ev || 1 + a.v.diff))
  if (!L.length) return { text: 'No clear value right now: the bookies’ prices are close to our %. (Value only shows for games where we have bookie odds.)' }
  return { node: <><div className="ah">Where the bookies pay more than it is worth</div>
    <div className="abox">{onePerMatch(L, 6).map((x, i) => { const m = M.byE[x.eid]; return <div key={i} className="arow"><span><b>{nn(x.eid, x.n)}</b><span className="sub"> {m.hA}–{m.aA}</span></span><b>{M.pct(x.p)}</b><span className="sub">bookies {M.pct(x.v.book)}{x.v.odds ? ' @' + x.v.odds.toFixed(2) : ''} 💰</span><button className="aadd" onClick={() => addDraft([x])}>＋</button></div> })}</div>
    <div className="sub">Our % is higher than what the bookies’ odds say. Check {B()}’s odds are similar before you bet.</div></> }
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
  return { node: <><MatchRow eid={eid} /><div className="abox">{rows.filter(r => r[1] != null).map(([n, p]) => { const v = M.valueOf(m, n, p); const nd = M.needInfo(eid, n); return <div key={n} className="arow"><span>{M.nice(n, m)}{nd ? <span className="sub"> · {nd.txt}</span> : null}</span><b>{p > .995 ? '✓' : M.pct(p)}</b><span className="sub">{p > .995 ? 'done' : p < .005 ? 'lost' : 'our odds ' + (1 / p).toFixed(2)}{v && v.value ? ' 💰' : ''}</span><button className="aadd" onClick={() => addDraft([{ eid, n, p }])}>＋</button></div> })}</div>
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

function answer(q0) {
  const q = norm(q0).replace(/^[¿¡\s"']+/, '').replace(/[?!.]+$/, '')
  if (!q.trim() || /^(help|ayuda|hi|hola|hello|hey|menu)\b/.test(q)) return aHelp()
  if (/^(what is|what does|que es|que significa|explain|explica)\b|\bmean(s)?\b/.test(q)) { const g = aGloss(q); if (g) return g }
  if (/corner|corne?r|esquina/.test(q)) return { text: 'We don’t suggest corners any more: too much luck. Try Total goals, 1X2 or yellow cards.', chips: ['Best goal bets', 'Cards bets'] }
  if (/strong|strength|fuerza|protect|proteg|cover|cubrir|weak|debil/.test(q)) return aStrength()
  if (/fire|fuego|\bf9\b/.test(q)) return aCombo('f9')
  if (/best ?6|mejor(es)? ?6|\bsix\b|\bseis\b|\bb6\b/.test(q)) return aCombo('b6')
  if (/value|valor|pay more|pagan mas/.test(q)) return aValue()
  if (/ranking|top \d+ teams|top teams|best teams|mejores (equipos|selecciones)|world rank/.test(q)) return aRank()
  if (/my stats|what wins|wins for me|mis estadisticas|que me funciona|my record|mi record/.test(q)) { const L = M.myBetStats(); return L.length ? { node: <div className="abox">{L.map(g => <div key={g.k} className="arow"><span>{g.k}</span><b>{g.w}/{g.n}</b><span className="sub">{Math.round(g.w / g.n * 100)}% won</span></div>)}</div> } : { text: 'No finished bets of yours yet. When your games end I group your bets by type so you see what works for you.' } }
  if (/accura|precis|how good|how often.*right|trust|confia/.test(q)) return aAcc()
  if (/take (the )?money|cash|retir|cobr|my ticket|mis bolet|mi bolet|boleto|ticket.*(how|como)|how.*ticket/.test(q) && !/build|make|create|arma|crea|give me|dame/.test(q)) return aCash()
  if (/build|make|create|arma|crea|give me a ticket|dame un|combinada|parlay|safe ticket|high odds|big payout/.test(q)) return aBuild(q)
  const T = findTeams(q0); const eid = findMatch(q0, T)
  if (/live bet|en vivo|apuesta en vivo|bets now|live now/.test(q)) return aLiveBets(eid && M.S(eid).state === 'in' ? eid : null)
  if (eid && /chance|odds|quien gana|who wins|probab|predic|bet|apuesta|cuota/.test(q)) return aMatch(eid)
  if (T.length >= 2 || (T.length && /h2h|head to head|cara a cara|historial/.test(q))) { if (T.length >= 2) { const r = aH2H(T[0], T[1], eid); if (r) return r } }
  if (T.length && /scorer|goleador|who scores|quien marca/.test(q)) return aScorers(T[0])
  if (/card|tarjeta|yellow|amarilla/.test(q) && !T.length) return aCards()
  if (/over|under|goal|gol|mas de|menos de|total/.test(q) && !T.length) return aGoals(q)
  if (T.length) { const r = aTeam(T, eid && M.S(eid).state !== 'post' ? eid : null); if (r) return r }
  if (eid) return aMatch(eid)
  const pl = findScorer(q0); if (pl) return { node: <div className="abox"><b>{pl.n}</b> – {pl.c} goals for <b>{pl.t}</b> since 2022{pl.rank === 1 ? ' (their top scorer)' : ''}.</div>, chips: [pl.t + ' form', pl.t + ' scorers'] }
  if (/live|vivo|score|marcador|now|ahora|playing/.test(q)) return aLive()
  return { text: 'I didn’t get that. Try one of these, or type a team name (e.g. “Spain”, “Real Madrid”):', chips: CHIPS }
}

export function Assistant() {
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState(() => [{ who: 'bot', ...aHelp(), text: 'Hi! Ask me about a team, a game or your tickets – e.g. “Spain”, “Spain v France”, “Fire 9” or “how strong is my ticket?”.' }]); const [inp, setInp] = useState('')
  const box = useRef(null)
  useEffect(() => { const f = () => setOpen(false); window.addEventListener('mb:builder', f); return () => window.removeEventListener('mb:builder', f) }, [])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs, open])
  const ask = q => { if (!q.trim()) return; let a; try { a = answer(q) } catch (e) { console.warn(e); a = { text: 'The numbers are still loading – try again in a few seconds.' } } setMsgs(m => [...m, { who: 'me', text: q }, { who: 'bot', ...a }]); setInp('') }
  return <>
    <button className={'abtn' + (open ? ' on' : '')} onClick={() => setOpen(!open)} aria-label="Assistant">{open ? '✕' : '💬'}</button>
    {open && <div className="apanel">
      <div className="ahd"><b>Assistant</b><span className="sub">our own numbers · {DBINFO.nt} countries · 5 big leagues</span></div>
      <div className="amsgs" ref={box}>{msgs.map((m, i) => <div key={i} className={'amsg ' + m.who}>
        {m.text && <div>{m.text}</div>}{m.node}
        {m.open && <button className="linkb" onClick={() => { M.selectMatch(m.open); window.dispatchEvent(new CustomEvent('mb:view', { detail: 'stadium' })); setOpen(false) }}>Open this game ›</button>}
        {m.chips && <div className="achips">{m.chips.map(c => <button key={c} onClick={() => ask(c)}>{c}</button>)}</div>}</div>)}</div>
      <form className="ain" onSubmit={e => { e.preventDefault(); ask(inp) }}><input value={inp} onChange={e => setInp(e.target.value)} placeholder="Try: Spain, Real Madrid, Fire 9, ¿qué es X2?" /><button className="cta">Send</button></form>
    </div>}
  </>
}
