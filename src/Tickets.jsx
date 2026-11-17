import React, { useEffect, useMemo, useState } from 'react'
import * as M from './engine.js'
import { Vs, Strength } from './Bits.jsx'
const { E } = M
const pct = M.pct
const clp = x => 'CLP ' + Math.round(x).toLocaleString('en-US')

/* team chances line for one match (live when the match is on) */
export function MatchLine({ eid }) {
  const m = M.byE[eid]; if (!m) return null; const R = M.simOf(eid); const f = fn => pct(M.frac(R, fn)); const T = (R, n) => R.GH[n] + R.GA[n]
  return <div className="mline"><span>W1 {m.hA} <b>{f((R, n) => R.GH[n] > R.GA[n])}</b></span><span>X <b>{f((R, n) => R.GH[n] === R.GA[n])}</b></span><span>W2 {m.aA} <b>{f((R, n) => R.GH[n] < R.GA[n])}</b></span>
    <span>Over 1.5 <b>{f((R, n) => T(R, n) > 1.5)}</b></span><span>Over 2.5 <b>{f((R, n) => T(R, n) > 2.5)}</b></span><span>Under 3.5 <b>{f((R, n) => T(R, n) < 3.5)}</b></span><span>Cards Over 3.5 <b>{f((R, n) => R.Y[n] > 3.5)}</b></span></div>
}

export function Stars({ n }) { const k = M.predictability(n); return <span className={'stars s' + k} title={['', 'Hard to predict', 'Medium', 'Easy to predict'][k]}>{'★'.repeat(k)}<span className="st-off">{'★'.repeat(3 - k)}</span></span> }
export function chanceCls(p) { return p >= .7 ? 'hi' : p >= .45 ? 'md' : 'lo' }
export function BestPicks({ eid, compact }) {
  const b = M.bestPicks(eid); const m = M.byE[eid]; if (!b || b.done) return null
  const Row = ({ x }) => { const on = M.inDraft(eid, x.n); return <button className={'bp' + (on ? ' on' : '')} onClick={e => { e.stopPropagation(); M.addPick(eid, x.n) }} title={on ? 'Remove from my new ticket' : 'Add to my new ticket'}>
    <span className="bn">{M.nice(x.n, m).replace(m.h, m.hA).replace(m.a, m.aA)} <Stars n={x.n} />{!compact && <Vs v={x.v} />}</span><b className={'pchip ' + chanceCls(x.p)}>{pct(x.p)}</b><span className="bplus">{on ? '✓' : '＋'}</span></button> }
  if (compact) { const top = [b.h[0], b.a[0], b.x[0]].filter(Boolean); return <div className="bpc">{top.map(x => <Row key={x.n} x={x} />)}</div> }
  return <div className="card bestp"><div className="bph"><h3>{b.live ? 'Best % right now' : 'Best % for each team'}</h3><span className="sub">Our own % · tap a bet to add it to your ticket</span></div>
    <div className="bpcols">
      <div><div className="bpt">{m.h}</div>{b.h.map(x => <Row key={x.n} x={x} />)}</div>
      <div><div className="bpt">{m.a}</div>{b.a.map(x => <Row key={x.n} x={x} />)}</div>
      <div><div className="bpt">The match</div>{b.x.map(x => <Row key={x.n} x={x} />)}</div></div></div>
}
export function LiveAdvisor({ eid, compact, onOpen }) {
  const a = M.liveAdvice(eid); if (!a) return null; const m = M.byE[eid]
  const Pk = ({ x }) => { const on = M.inDraft(eid, x.n); return <div className="la-pick"><div className="la-pl"><b>{M.nice(x.n, m).replace(m.h, m.hA).replace(m.a, m.aA)}</b> <Stars n={x.n} />{x.why && <span className="sub"> · {x.why}</span>}{x.need && <span className="need"> · {x.need.txt}</span>}</div>
    <b className={'pchip ' + chanceCls(x.p)}>{pct(x.p)}</b><span className="la-min">bet if {M.bookName()} pays <b>{x.min.toFixed(2)}+</b></span><button className="tp-add" onClick={e => { e.stopPropagation(); M.addPick(eid, x.n) }}>{on ? '✓' : '＋'}</button></div> }
  if (compact) return <div className="la-c" onClick={onOpen}><div className="la-ch"><span className="live-dot" /><b>{m.hA} {M.S(eid).h}–{M.S(eid).a} {m.aA}</b><span className="sub">{M.S(eid).clock}</span></div>
    <div className="sub la-why">{a.lines[1]}</div>{a.picks[0] ? <Pk x={a.picks[0]} /> : <div className="sub">No strong live bet right now.</div>}</div>
  return <div className="card ladv"><div className="la-h"><h3><span className="live-dot" /> Live advisor</h3><span className="sub">updates every 30 s</span></div>
    <ul className="la-lines">{a.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    <div className="la-t">Best live bets now</div>{a.picks.length ? a.picks.map(x => <Pk key={x.n} x={x} />) : <p className="sub">No strong live bet right now – wait a few minutes.</p>}
    <div className="sub" style={{ marginTop: 6 }}>Only bet if {M.bookName()}’s live odds are at least the number shown. Live odds move fast.</div></div>
}

export function DraftBar({ openBuilder }) {
  const D = E.DRAFT; if (!D.length) return null
  return <div className="draftbar" onClick={openBuilder}><span className="db-ic">🎟</span><span><b>My new ticket</b> · {D.length} bet{D.length > 1 ? 's' : ''}</span><span className="db-go">Open ›</span></div>
}

function Tools({ t, legs, fair, stake, odds }) {
  const [pc, setPc] = useState(50); const [hg, setHg] = useState('')
  const W = stake * odds; const offer = parseFloat(M.CO[t.id]); const O = offer > 0 ? offer : fair * 0.9; const est = !(offer > 0); const f = pc / 100
  const open = legs.filter(l => l.s && !(l.s.state !== 'pre' && (l.p === 0 || l.p === 1)))
  let hedge
  if (open.length !== 1) hedge = <div className="sub">{open.length ? `This works when only 1 bet is left (${open.length} still open).` : ''}</div>
  else { const l = open[0], h = parseFloat(hg)
    if (!(h > 1)) hedge = <div className="sub">Last open bet: <b>{l.m.hA}–{l.m.aA} {l.lab}</b>. Type the odds for it <i>not</i> happening.</div>
    else { const H = W / h, lock = W - H, cost = H * (1 - (1 - (l.p || 0)) * h)
      hedge = <div>Bet <b>{clp(H)}</b> on the opposite at {h.toFixed(2)}. Whatever happens you end with <b>{clp(lock)}</b> (profit {clp(lock - stake)}). Compared with {est ? 'an estimated' : M.bookName() + '’s'} cash-out of {clp(O)}: the hedge is {lock >= O ? <span className="ok">better by {clp(lock - O)}</span> : <span className="ko">worse by {clp(O - lock)}</span>}. The hedge bet costs about {clp(Math.max(0, cost))} on average.</div> } }
  return <details className="tools"><summary>Take some money now (advanced)</summary>
    <div className="tl"><div className="sub">Take part of the money now, keep the rest running</div><input type="range" min="0" max="100" step="10" value={pc} onChange={e => setPc(+e.target.value)} />
      <div>Cash out <b>{pc}%</b>: get {clp(f * O)} now{est ? ' (if ' + M.bookName() + ' offers about 90%)' : ''}. If the ticket then wins you also get {clp((1 - f) * W)}; if it loses you keep {clp(f * O)}. Average {clp(f * O + (1 - f) * fair)}, {clp(Math.abs(f * (fair - O)))} {O < fair ? 'less' : 'more'} than holding.</div></div>
    <div className="tl"><div className="sub">Lock in money: bet against your last open bet</div><input type="number" step="0.01" min="1.01" placeholder="odds for the opposite" value={hg} onChange={e => setHg(e.target.value)} />{hedge}</div></details>
}

/* protection for a placed ticket: a small cover bet that gives the stake back if the weakest bet fails */
function Protect({ t }) {
  const [op, setOp] = useState(false); const pr = M.protection(t); if (!pr || !pr.weakest || pr.weakest.p >= .8 || !pr.cover) return null
  const m = pr.m, w = pr.weakest, c = pr.cover; const B = M.bookName()
  return <div className={'protect' + (op ? ' open' : '')}><button className="pr-h" onClick={() => setOp(!op)}>🛡 Protect this ticket <span className="sub">weakest bet: {M.nice(w.n, m)} {pct(w.p)}</span><span className="pr-ar">{op ? '▴' : '▾'}</span></button>
    {op && <div className="pr-b"><div className="pr-o"><b>Cover bet</b><div>Bet <b>CLP {c.stake.toLocaleString('en-US')}</b> on <b>{M.nice(c.n, m)}</b> ({pct(c.p)}) if {B} pays about <b>{c.o.toFixed(2)}</b>{c.oursOnly ? ' or more' : ''}. If {M.nice(w.n, m)} fails, this gives your ticket money back.</div>
      {!c.worth ? <div className="ko">Not worth it here: the cover eats most of the win.</div> : <div className="sub">If everything goes well you win a bit less, but a loss on the weak bet no longer costs you.</div>}</div></div>}</div>
}
/* in the ticket builder: swap the weakest bet for a safer one in the same game */
function SaferSwap({ D }) {
  const pr = D.length ? M.protection({ id: 'draft', stake: E.STAKE, legs: D }) : null; if (!pr || !pr.swap || pr.weakest.p >= .75 || pr.swap.p > .99) return null
  const m = pr.m, w = pr.weakest
  return <div className="protect open"><div className="pr-b" style={{ paddingTop: 10 }}><div className="pr-o">🛡 Weakest bet: <b>{M.nice(w.n, m)}</b> ({pct(w.p)}). Safer: <b>{M.nice(pr.swap.n, m)}</b> ({pct(pr.swap.p)}) – pays a bit less, wins more often.
    <div><button className="linkb" onClick={() => M.setDraft(D.map(l => l.eid === w.eid && l.n === w.n ? { ...l, n: pr.swap.n, o: null } : l))}>Swap it</button></div></div></div></div>
}

function Exposure() {
  const open = E.MY.filter(t => (t.real || !t.preset) && !M.settled(t.legs.map(M.legState))); const by = {}
  open.forEach(t => t.legs.forEach(l => { const k = l.eid + '|' + l.n; (by[k] = by[k] || { l, ts: [] }).ts.push(t) }))
  const rows = Object.values(by).filter(x => x.ts.length >= 2); if (!rows.length) return null
  return <details className="card" style={{ marginBottom: 12, borderColor: 'rgba(255,210,90,.4)' }}><summary className="sub" style={{ cursor: 'pointer' }}>⚠ <b style={{ color: 'var(--gd)' }}>{rows.length} bet{rows.length > 1 ? 's are' : ' is'} on more than one of your tickets</b>. If one fails, all those tickets lose. Show</summary>
    {rows.map((r, i) => { const m = M.byE[r.l.eid]; return <div key={i} className="ev"><span className="c ko">!</span><span><b>{m ? m.hA + '–' + m.aA : ''} {M.nice(r.l.n)}</b> is on {r.ts.length} tickets ({r.ts.map(t => t.n).join(', ')}). If it fails, {clp(r.ts.reduce((a, t) => a + (t.stake || E.STAKE), 0))} of your money loses together.</span></div> })}</details>
}

function SafeBuilder({ onUse }) {
  const [st, setSt] = useState('safe'); const [n, setN] = useState(6)
  const [lo, hi] = M.SAFE_STYLE[st]; const ids = (M.BOARD[E.CUR.lg + '|' + E.CUR.date] || []).filter(e => M.byE[e] && M.S(e).state === 'pre')
  const picks = []; ids.forEach(e => { const m = M.byE[e], R = M.simOf(e); let best = null; M.markets(m).filter(x => M.safeCands(m).includes(x.n)).forEach(x => { const p = M.frac(R, x.f); if (p >= lo && p <= hi && (!best || p > best.p)) best = { eid: e, lg: m.lg, date: E.CUR.date, n: x.n, p, m } }); if (best) picks.push(best) })
  picks.sort((a, b) => b.p - a.p); const L = picks.slice(0, n); const est = L.reduce((a, x) => a / Math.min(.99, x.p * 1.04), 1)
  return <details className="card safe"><summary><b className="orb" style={{ fontSize: 12, letterSpacing: '.12em', color: 'var(--cy)' }}>SAFE TICKET MAKER</b> <span className="sub">safe bets for the day you picked at the top</span></summary>
    <div className="row2" style={{ alignItems: 'end', marginTop: 10 }}><label className="sub">Style<select className="inp" value={st} onChange={e => setSt(e.target.value)}><option value="ultra">Very safe</option><option value="safe">Safe</option><option value="fire">Pays more</option></select></label>
      <label className="sub">How many bets<input className="inp" type="number" min="2" max="12" value={n} onChange={e => setN(+e.target.value || 2)} style={{ width: 80 }} /></label></div>
    {!L.length ? <p className="empty">No matches still to play for this competition and date.</p> : <>
      <div className="sfsum" style={{ marginTop: 10 }}><span>Total odds about <b className="orb">{est.toFixed(2)}</b></span></div>
      {L.map(x => <div key={x.eid} className="leg2"><span className="i sub">○</span><div className="lt"><div>{x.m.hA}–{x.m.aA} · <b>{M.nice(x.n, x.m)}</b></div><MatchLine eid={x.eid} /></div></div>)}
      <p className="sub" style={{ lineHeight: 1.5 }}>Very safe bets pay little. Check {M.bookName()}’s odds before playing.</p>
      <button className="cta" onClick={() => onUse(L.map(x => ({ eid: x.eid, lg: x.lg, date: x.date, n: x.n, o: null })))}>Use these picks</button></>}</details>
}

export function Builder({ onClose }) {
  const [lg, setLg] = useState(E.CUR.lg); const [dt, setDt] = useState(E.CUR.date); const [eid, setEid] = useState(E.SEL); const [, force] = useState(0)
  const [tot, setTot] = useState(''); const [st, setSt] = useState(String(E.STAKE)); const [err, setErr] = useState(''); const [more, setMore] = useState(false)
  useEffect(() => { M.pollBoard(lg, dt).then(() => { const ids = M.BOARD[lg + '|' + dt] || []; if (!ids.includes(eid)) setEid(ids[0] || ''); force(x => x + 1) }) }, [lg, dt])
  const ids = (M.BOARD[lg + '|' + dt] || []).filter(e => M.byE[e]); const m = M.byE[eid]; const D = E.DRAFT
  const dstr = d => d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6)
  const has = n => D.some(l => l.eid === eid && l.n === n)
  const toggle = n => { setErr(''); if (has(n)) M.setDraft(D.filter(l => !(l.eid === eid && l.n === n))); else M.setDraft([...D.filter(l => l.eid !== eid || !sameGroup(l.n, n)), { eid, lg, date: dt, n, o: null }]) }
  const sameGroup = (a, b) => { const g = x => /win$|^Draw$/.test(x) ? 'res' : /^(Over|Under) (\d\.\d)$/.test(x) ? 'ou' + x.split(' ')[1] : /both|Not both/i.test(x) ? 'btts' : x; return g(a) === g(b) }
  let sections = []
  if (m) { const R = M.simOf(eid); const P = {}; M.markets(m).forEach(x => P[x.n] = { p: M.frac(R, x.f) + (x.pu ? M.frac(R, x.pu) : 0), g: x.g })
    sections = [['1X2', [`${m.h} win`, 'Draw', `${m.a} win`]], ['Double chance', [`${m.h} or draw`, `${m.a} or draw`, 'No draw']], ['Total goals', ['Over 1.5', 'Under 1.5', 'Over 2.5', 'Under 2.5', 'Over 3.5', 'Under 3.5']], ['Team total', [`${m.h} over 0.5`, `${m.h} over 1.5`, `${m.a} over 0.5`, `${m.a} over 1.5`]], ['Yellow cards', ['Over 3.5 yellows', 'Under 3.5 yellows', 'Over 4.5 yellows', 'Under 4.5 yellows']]]
    if (more) { const G = {}; M.marketsShown(m).forEach(x => (G[x.g] = G[x.g] || []).push(x.n)); sections = Object.entries(G) }
    sections = sections.map(([g, ns]) => [g, ns.filter(n => P[n]).map(n => [n, P[n].p])]) }
  const save = () => { const T = parseFloat(tot), S = parseFloat(st); if (!D.length) return setErr('Tap at least one bet.'); if (!(T > 1)) return setErr('Type the total odds from ' + M.bookName() + '.'); if (!(S > 0)) return setErr('Type how much you bet.')
    const t = { id: 'u' + Date.now(), n: 'My ticket ' + (E.MY.filter(x => !x.preset).length + 1) + ' (' + D.length + ' bets)', odds: T, stake: S, legs: D.slice() }; M.addTicket(t); M.setDraft([]); M.alertMsg('good', 'Saved. We’ll follow it live.'); onClose() }
  return <div className="modalbg" onClick={e => { if (e.target === e.currentTarget) onClose() }}><div className="slipwrap card">
    <button className="x" onClick={onClose} aria-label="Close">✕</button>
    <div className="sw-l"><div className="sw-h">1 · Pick a game</div>
      <div className="row2" style={{ marginTop: 0 }}><select className="inp" value={lg} onChange={e => setLg(e.target.value)}>{M.LEAGUES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select><input className="inp" type="date" value={dstr(dt)} onChange={e => setDt(e.target.value.replace(/-/g, ''))} /></div>
      <div className="sw-list">{ids.length ? ids.map(e => { const x = M.byE[e], s = M.S(e); const n = D.filter(l => l.eid === e).length; return <button key={e} className={'mrow' + (e === eid ? ' on' : '')} onClick={() => { setEid(e); setMore(false) }}>
        <span className="mt">{s.state === 'in' ? <><span className="live-dot" />{s.clock}</> : s.state === 'post' ? 'FT' : s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span><span className="mn"><span>{x.h}</span><span>{x.a}</span></span><span className="ms">{s.state !== 'pre' && <><b>{s.h}</b><b>{s.a}</b></>}</span>{n ? <span className="cnt2">{n}</span> : <span />}</button> }) : <p className="empty">No matches on this date.</p>}</div></div>
    <div className="sw-m"><div className="sw-h">2 · Tap your bets {m && <span className="sub">{m.h} v {m.a}</span>}</div>
      {m ? <>{sections.map(([g, ns]) => ns.length ? <div key={g} className="pgrp"><div className="pg">{g}</div><div className="pbtns">{ns.map(([n, p]) => <button key={n} className={'pbtn' + (has(n) ? ' on' : '')} onClick={() => toggle(n)}><span>{M.nice(n, m)} <Stars n={n} /></span><b>{pct(p)}</b></button>)}</div></div> : null)}
        <button className="linkb" onClick={() => setMore(!more)}>{more ? '← Main bets only' : 'All lines (more Over / Under) →'}</button></> : <p className="empty">Choose a match on the left.</p>}</div>
    <div className="sw-r"><div className="sw-h">3 · Your ticket</div>
      {D.length ? D.map((l, i) => { const x = M.byE[l.eid]; return <div key={i} className="slipleg"><div><div className="sub">{x ? x.hA + ' – ' + x.aA : ''}</div><b>{M.nice(l.n)}</b></div>{(() => { const ls = M.legState(l); return ls.p != null ? <b className={'pchip ' + chanceCls(ls.p)} style={{ marginLeft: 'auto', marginRight: 8 }}>{pct(ls.p)}</b> : null })()}<button className="rm" aria-label="Remove" onClick={() => M.setDraft(D.filter((_, j) => j !== i))}>✕</button></div> }) : <p className="empty">Your bets show up here.</p>}
      <label className="sl">Total odds (from your {M.bookName()} ticket)<input className="inp big" type="number" step="0.01" min="1.01" placeholder="e.g. 5.40" value={tot} onChange={e => setTot(e.target.value)} /></label>
      <label className="sl">How much you bet (CLP)<input className="inp big" type="number" step="1000" min="100" value={st} onChange={e => setSt(e.target.value)} /></label>
      {parseFloat(tot) > 1 && parseFloat(st) > 0 && <div className="sub" style={{ margin: '6px 0' }}>You can win <b style={{ color: 'var(--tx)' }}>{clp(parseFloat(tot) * parseFloat(st))}</b></div>}
      <Advice D={D} tot={parseFloat(tot)} st={parseFloat(st)} setSt={setSt} />
      <p className="err">{err}</p><button className="cta wide" onClick={save}>Save ticket</button>{D.length > 0 && <button className="linkb" onClick={() => M.setDraft([])}>Clear all</button>}</div>
  </div></div>
}

function ResultsLog() {
  const L = E.LOG; const [c, setC] = useState(false)
  if (!L.length) return <p className="empty">Finished tickets show here with win or loss. Saved on this device only.</p>
  const w = L.filter(x => x.res === 'WON').length; const prof = L.reduce((a, x) => a + (x.odds ? (x.res === 'WON' ? x.stake * (x.odds - 1) : -x.stake) : 0), 0); const cl = L.filter(x => x.clv != null); const avg = cl.length ? cl.reduce((a, x) => a + x.clv, 0) / cl.length : null
  return <div><div className="big3" style={{ marginBottom: 10 }}><div><div className="v">{w}/{L.length}</div><div className="l">tickets won</div></div><div><div className={'v ' + (prof >= 0 ? 'ok' : 'ko')}>{prof >= 0 ? '+' : ''}{Math.round(prof).toLocaleString('en-US')}</div><div className="l">CLP won or lost</div></div><div><div className={'v ' + (avg == null ? '' : avg >= 0 ? 'ok' : 'ko')}>{avg == null ? '–' : (avg >= 0 ? '+' : '') + (avg * 100).toFixed(1) + '%'}</div><div className="l">your odds vs {M.bookName()}’s last odds</div></div></div>
    {L.map((x, i) => <div key={i} className="ev"><span className="c">{x.d.slice(5)}</span><span className={x.res === 'WON' ? 'ok' : 'ko'}>{x.res}</span><span>{x.n}{x.odds ? ' @ ' + x.odds.toFixed(2) : ''}{x.clv != null ? ' · vs last odds ' + (x.clv >= 0 ? '+' : '') + (x.clv * 100).toFixed(1) + '%' : ''}</span></div>)}
    <div className="row2" style={{ marginTop: 8 }}><button onClick={() => { if (c) { E.LOG = []; setC(false) } else setC(true) }}>{c ? 'Click again to clear' : 'Clear log'}</button></div></div>
}

function BankSim() {
  const [b, setB] = useState(E.BANK); const [s, setS] = useState(5); const [o, setO] = useState(5); const [p, setP] = useState(18); const [n, setN] = useState(100)
  const res = useMemo(() => { const bank = +b, pc = +s / 100, odds = +o, pr = +p / 100, N = +n; if (!(bank > 0 && pc > 0 && pc < 1 && odds > 1 && pr > 0 && pr < 1 && N > 0 && N <= 1000)) return null
    const P = 3000, fin = []; let up = 0, half = 0; for (let k = 0; k < P; k++) { let x = bank, mn = bank; for (let i = 0; i < N; i++) { const stv = x * pc; x += Math.random() < pr ? stv * (odds - 1) : -stv; if (x < mn) mn = x } fin.push(x); if (x > bank) up++; if (mn < bank / 2) half++ }
    fin.sort((a, b) => a - b); const q = v => fin[Math.floor(v * (P - 1))]; return { up: up / P, half: half / P, med: q(.5), lo: q(.1), hi: q(.9), ev: pr * odds - 1 } }, [b, s, o, p, n])
  return <div><div className="bgrid">{[['Money you start with (CLP)', b, setB], ['Bet per ticket (% of money)', s, setS], ['Usual odds', o, setO], ['How often you win (%)', p, setP], ['How many tickets', n, setN]].map(([l, v, f]) => <label key={l}>{l}<input className="inp" type="number" value={v} onChange={e => f(e.target.value)} /></label>)}</div>
    {!res ? <p className="err">Check the numbers.</p> : <><div className="big3" style={{ marginTop: 10 }}><div><div className={'v ' + (res.up > .5 ? 'ok' : 'ko')}>{pct(res.up)}</div><div className="l">end with more money</div></div><div><div className="v">{clp(res.med)}</div><div className="l">usual money at the end</div></div><div><div className="v ko">{pct(res.half)}</div><div className="l">lose half at some point</div></div></div>
      <p className="sub" style={{ lineHeight: 1.5 }}>{res.ev >= 0 ? '+' : ''}{(res.ev * 100).toFixed(1)}% per ticket on average. Most likely you end between {clp(res.lo)} and {clp(res.hi)}.</p></>}</div>
}

const Logo1w = () => <span className="w1">{M.bookName()}</span>
function legRowState(l) { return !l.s ? 'wait' : l.s.state !== 'pre' && l.p === 1 ? 'won' : l.s.state !== 'pre' && l.p === 0 ? 'lost' : l.s.state === 'in' ? 'live' : 'wait' }
const ICON = { won: '✓', lost: '✕', live: '●', wait: '' }

function TicketStub({ t, i }) {
  const [open, setOpen] = useState(false); const [, force] = useState(0); const [confirm, setConfirm] = useState(false)
  const legs = t.legs.map(M.legState); const res = M.settled(legs); const Ev = M.ticketE(t); const stake = t.stake || E.STAKE, odds = M.tOdds(t)
  const sg = M.signal(t, M.ticketP(t), Ev, res, legs); const fair = Ev != null ? stake * Ev : null; const started = legs.some(l => l.s && l.s.state !== 'pre')
  const st = legs.map(legRowState); const nWon = st.filter(x => x === 'won').length, nLive = st.filter(x => x === 'live').length
  const first = legs.filter(l => l.s && l.s.state === 'pre' && l.s.date).map(l => new Date(l.s.date)).sort((a, b) => a - b)[0]
  const status = res === 'WON' ? 'WON' : res === 'LOST' ? 'LOST' : !started ? 'WAITING' : sg.big
  const msg = res === 'WON' ? `Paid ${clp(stake * odds)} 🎉` : res === 'LOST' ? 'One bet lost.' : !started ? (first ? 'Starts ' + first.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not started') : /–/.test(sg.txt) ? 'Going well – keep it running.' : sg.txt
  const cls = status.toLowerCase().replace(/ /g, '')
  // order: live first, then lost/won, then waiting – so the action is on top
  const order = legs.map((l, j) => j).sort((a, b) => ({ live: 0, lost: 1, won: 2, wait: 3 })[st[a]] - ({ live: 0, lost: 1, won: 2, wait: 3 })[st[b]])
  const shown = open ? order : order.slice(0, 3)
  const no = t.real ? (t.n.match(/#(\d+)/) || [])[1] : null
  return <article className={'stub s-' + cls} style={{ animationDelay: i * 80 + 'ms' }}>
    <div className="stub-top">
      <div className="stub-id">{t.real ? <Logo1w /> : <span className="w1 mine">MINE</span>}<div><div className="stub-n">{no ? 'Ticket #' + no : t.n}</div><div className="sub">{legs.length} bets · odds {odds ? odds.toFixed(2) : '–'} · you bet {clp(stake)}</div></div></div>
      <div className="stub-win"><div className="sub">{res === 'WON' ? 'You won' : res === 'LOST' ? 'Could have won' : 'You can win'}</div><div className="big">{odds ? clp(stake * odds) : '–'}</div></div>
    </div>
    {!res && <Strength st={M.ticketStrength(t)} small />}
    <div className="stub-prog"><div className="seg">{st.map((x, j) => <i key={j} className={x} style={{ animationDelay: (i * 80 + j * 45) + 'ms' }} />)}</div><span className="sub">{nWon}/{legs.length} won{nLive ? ` · ${nLive} live` : ''}</span></div>
    <div className="stub-legs">{shown.map(j => { const l = legs[j], s = l.s, x = st[j]; const m = l.m
      const sc = !s ? '' : s.state === 'pre' ? (s.date ? new Date(s.date).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '') : `${s.h}-${s.a}${s.state === 'in' ? ' · ' + s.clock : ' · final'}`
      return <div key={j} className={'leg ' + x}><span className="li">{ICON[x]}</span><div className="lt"><b>{M.nice(l.lab, m)}</b><span className="sub">{m ? m.h + ' v ' + m.a : 'loading…'}{(() => { const nd = x === 'live' && M.needInfo(t.legs[j].eid, l.lab); return nd ? <span className="need"> · {nd.txt}</span> : null })()}</span>{open && <MatchLine eid={t.legs[j].eid} />}</div><div className="lr">{x === 'won' || x === 'lost' ? null : l.p != null ? <b className={'pchip ' + chanceCls(l.p)}>{pct(l.p)}</b> : null}<span className={'sc ' + x}>{sc}</span>{t.legs[j].o ? <span className="sub">@{(+t.legs[j].o).toFixed(2)}</span> : null}</div></div> })}
      {!open && legs.length > 3 && <button className="more" onClick={() => setOpen(true)}>+ {legs.length - 3} more bets · team chances ▾</button>}
      {open && <button className="more" onClick={() => setOpen(false)}>Show less ▴</button>}</div>
    <div className="perf"><span /></div>
    <div className="stub-foot">
      <div className="stamp-wrap"><span key={status} className="stamp">{status}</span></div>
      <div className="stub-msg">{msg}</div>
      {!res && started && odds && <div className="co"><span className="sub">{M.bookName()} cash-out offer</span><input type="number" step="100" min="0" placeholder="type amount" defaultValue={M.CO[t.id] || ''} onChange={e => { M.CO[t.id] = e.target.value; force(x => x + 1) }} /><span className="sub">worth now <b style={{ color: 'var(--tx)' }}>{fair != null ? clp(fair) : '–'}</b></span></div>}
      {!res && <Protect t={t} />}
      {open && !res && started && odds && <Tools t={t} legs={legs} fair={fair} stake={stake} odds={odds} />}
      {open && <button className="rmT" onClick={() => { if (confirm) M.removeTicket(t); else setConfirm(true) }}>{confirm ? 'Tap again to remove' : 'Remove ticket'}</button>}
    </div>
  </article>
}

function Summary({ list }) {
  const open = list.filter(t => !M.settled(t.legs.map(M.legState)))
  const inMoney = open.reduce((a, t) => a + (t.stake || E.STAKE), 0), canWin = open.reduce((a, t) => a + (M.tOdds(t) ? (t.stake || E.STAKE) * M.tOdds(t) : 0), 0)
  const live = open.filter(t => t.legs.some(l => M.S(l.eid).state === 'in')).length
  return <div className="tsum"><div><span className="sub">Open tickets</span><b>{open.length}</b></div><div><span className="sub">Money in</span><b>{clp(inMoney)}</b></div><div><span className="sub">Can win</span><b className="ok">{clp(canWin)}</b></div><div><span className="sub">Live now</span><b className={live ? 'cy' : ''}>{live}</b></div></div>
}

function Advice({ D, tot, st, setSt }) {
  if (!D.length) return null; const a = M.stakeAdvice(D, tot); const left = M.SAFE.budget - M.weekSpent()
  return <div className="advice">
    {a && a.fair && a.fair < 4 && <div className="ko">Total odds under 4 – usually not worth a ticket. Add more bets.</div>}
    <Strength st={M.strengthOf(D.map(l => M.legState(l).p))} /><SaferSwap D={D} />
    {a && a.fair && <div>Our odds for these bets: <b>{a.fair.toFixed(2)}</b>{tot > 1 && <> · {M.bookName()} gives {tot.toFixed(2)} → {a.price >= 0 ? <span className="ok">good price (+{Math.round(a.price * 100)}%)</span> : <span className="ko">{Math.round(-a.price * 100)}% too low</span>}</>}</div>}
    {a && tot > 1 && <div>Smart bet size: {a.stake > 0 ? <><b>{clp(a.stake)}</b> <button className="linkb" onClick={() => setSt(String(a.stake))}>use it</button></> : <b>keep it very small (or skip)</b>}<span className="sub"> · from your money of {clp(E.BANK)}</span></div>}
    <div className="sub">Left this week: <b style={{ color: left > 0 ? 'var(--tx)' : 'var(--bad)' }}>{clp(Math.max(0, left))}</b> of {clp(M.SAFE.budget)}{st > M.SAFE.max ? <span className="ko"> · above your limit of {clp(M.SAFE.max)} per ticket</span> : null}{st > left ? <span className="ko"> · more than you have left this week</span> : null}</div>
  </div>
}

function WhatWins() {
  const L = M.myBetStats()
  return <div className="card"><h3>What wins for you</h3>
    {!L.length ? <p className="sub">When your games finish, your bets are grouped here by type (W1/W2, 1X/X2, Total Over…), so you can see what works for you.</p> : <>
      {L.map(g => { const ex = g.ne ? g.exp * g.n / g.ne : null; return <div key={g.k}><div className="ww"><span>{g.k}</span><span className="wwbar"><i style={{ width: (g.w / g.n * 100) + '%' }} className={g.w / g.n >= .7 ? 'hi' : g.w / g.n >= .5 ? 'md' : 'lo'} /></span><b>{g.w}/{g.n}</b></div>
        {ex != null && g.ne >= 3 && <div className="sub ww2">we expected about {Math.round(ex)} · {g.w >= ex + 1 ? <span className="ok">better than expected ✓</span> : g.w <= ex - 1 ? <span className="ko">worse than expected</span> : 'as expected'}{g.ne >= 6 ? ' · the app now ranks this type ' + (g.w > ex ? 'a bit higher' : g.w < ex ? 'a bit lower' : 'the same') + ' for you' : ''}</div>}</div> })}
      <p className="sub">{L.filter(g => g.n >= 5).length ? 'Types with many losses: play them less, or only when the app shows 💰.' : 'Small numbers so far – wait for more games before changing anything.'}</p></>}</div>
}

function Limits() {
  const [, f] = useState(0)
  return <div className="card"><h3>My limits</h3><p className="sub">Small limits keep betting fun. The app warns you when a new ticket goes over them.</p>
    <label className="sl">Money for betting each week (CLP)<input className="inp" type="number" step="1000" defaultValue={M.SAFE.budget} onBlur={e => { M.setSafe('budget', +e.target.value || 0); f(x => x + 1) }} /></label>
    <label className="sl">Most per ticket (CLP)<input className="inp" type="number" step="500" defaultValue={M.SAFE.max} onBlur={e => { M.setSafe('max', +e.target.value || 0); f(x => x + 1) }} /></label>
    <label className="sl">All my betting money (CLP)<input className="inp" type="number" step="10000" defaultValue={E.BANK} onBlur={e => { M.setBank(+e.target.value || 0); f(x => x + 1) }} /></label>
    <p className="sub">Spent this week: {clp(M.weekSpent())}.</p></div>
}

function Accuracy() {
  const a = M.accStats()
  return <div className="card"><h3>How accurate is the app?</h3>
    <p>Our % come from our own team ratings, tested on thousands of past games (national teams and the top 5 leagues). {M.bookName()}’s odds are only used to compare.</p>
    {a.n ? <><p>Your games so far: <b>{a.n}</b> finished. Our favourite won <b>{M.pct(a.fav)}</b>. Total Over/Under 2.5 right <b>{M.pct(a.ou)}</b>.</p>
      <div className="acclist">{a.list.map((x, i) => { const [h, aw] = x.out; const r = h > aw ? 0 : h === aw ? 1 : 2; const fi = x.p.indexOf(Math.max(...x.p)); return <div key={i} className="arow2"><span>{x.n}</span><b>{h}-{aw}</b><span className={fi === r ? 'ok' : 'ko'}>{fi === r ? '✓ called it' : '✗ missed'}</span></div> })}</div></>
      : <p className="sub">The app saves its % before every game and checks them at the final whistle. Results show here after the first games finish.</p>}
    {a.n > 0 && a.n < 50 && <p className="sub">Still a small number of games – don’t read too much into it yet.</p>}</div>
}

function MoveBox() {
  const [code, setCode] = useState(''); const [msg, setMsg] = useState(''); const [inp, setInp] = useState('')
  return <div className="card movebox">
    <div className="mv"><b>1. On the device that has the tickets</b><button onClick={() => { const c = M.exportCode(); setCode(c); navigator.clipboard && navigator.clipboard.writeText(c).then(() => setMsg('Code copied ✓'), () => setMsg('Select the code and copy it')) }}>Make my code</button>
      {code && <textarea readOnly value={code} onFocus={e => e.target.select()} />}</div>
    <div className="mv"><b>2. On the other device</b><textarea placeholder="Paste the code here" value={inp} onChange={e => setInp(e.target.value)} />
      <button onClick={() => { try { const n = M.importCode(inp); setMsg(n ? `Added ${n} ticket${n > 1 ? 's' : ''} ✓` : 'Done – nothing new to add'); setInp('') } catch (e) { setMsg('That code did not work – copy it again') } }}>Add tickets</button></div>
    {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}
    <div className="sub" style={{ marginTop: 6 }}>Send the code to yourself on WhatsApp or e-mail.</div></div>
}


/* ---------- the app's own suggestions, by date, with won / lost ---------- */
const dLabel = d => new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
const RES = { WON: '✓ WON', LOST: '✗ LOST', LIVE: '● LIVE', WAITING: 'waiting' }
function SugHistory() {
  const [openId, setOpenId] = useState(null); const [all, setAll] = useState(false)
  useEffect(() => { M.loadHistory() }, [])
  const H = M.sugHistory(); const rec = M.sugRecord()
  if (!H.length) return null
  const byDate = {}; H.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x))
  const dates = Object.keys(byDate).sort().reverse(); const shown = all ? dates : dates.slice(0, 5)
  return <div className="card sugh"><h3>Our suggested tickets – results</h3>
    {rec.n > 0 && <div className="sugrec"><div><b>{rec.won}</b><span>won</span></div><div><b>{rec.lost}</b><span>lost</span></div><div><b>{rec.n}</b><span>finished</span></div>
      <div><b className={rec.back >= rec.staked ? 'ok' : 'ko'}>{Math.round(rec.back * 1000).toLocaleString('en-US')}</b><span>back from {(rec.staked * 1000).toLocaleString('en-US')} (1,000 on each)</span></div></div>}
    {shown.map(d => <div key={d} className="sugday"><div className="sugd">{dLabel(d)}</div>
      {byDate[d].map(x => <div key={x.id} className={'sugt r' + x.res.toLowerCase()}>
        <button className="sugrow" onClick={() => setOpenId(openId === x.id ? null : x.id)}><span className="sugn">{x.title}</span><span className="sub">{x.legs.length} bets · our odds {x.fair.toFixed(2)}</span><span className={'sugres ' + x.res.toLowerCase()}>{RES[x.res]}</span></button>
        {openId === x.id && <div className="suglegs">{x.legs.map((l, i) => { const m = M.byE[l.eid]; return <div key={i} className={'sgl ' + l.st}><span className="ic">{l.st === 'won' ? '✓' : l.st === 'lost' ? '✗' : l.st === 'live' ? '●' : '·'}</span><span>{M.nice(l.n, m)}{m ? <span className="sub"> · {m.h} v {m.a}{M.S(l.eid).state !== 'pre' ? ` ${M.S(l.eid).h}-${M.S(l.eid).a}` : ''}</span> : null}</span><b>{M.pct(l.p)}</b></div> })}</div>}
      </div>)}</div>)}
    {dates.length > 5 && <button className="linkb" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${dates.length} days`}</button>}
    <p className="sub" style={{ marginTop: 8 }}>Saved before kick-off, checked at the final whistle. “Back” uses our odds minus about 5% per bet (the bookie’s cut), so it is close to what 1win pays.</p></div>
}

/* ---------- AI challenge: play money only ---------- */
const CH_ODDS = { steady: 'Tested: kept the money about level in most months; never 10x.', bold: 'Tested: doubled in about 1 month of 100, ended up in about 1 of 4.', chase: 'Tested: reached 10x in about 6–7 months of 100 – the other 9 of 10 lost everything.' }
function Challenge() {
  const st = M.challengeState(); const [start, setStart] = useState(50000); const [mode, setMode] = useState('steady')
  if (!st) return <div className="card chal"><h3>🤖 AI money challenge</h3>
    <p className="sub">Give the AI play money for 30 days. Every day it bets on its own suggested ticket by a fixed rule – you watch the money go up or down. No real money is used.</p>
    <div className="chopts">{[5000, 10000, 20000, 50000].map(v => <button key={v} className={start === v ? 'on' : ''} onClick={() => setStart(v)}>{v.toLocaleString('en-US')}</button>)}</div>
    <div className="chmodes">{Object.entries(M.CH_MODES).map(([k, v]) => <button key={k} className={'chm' + (mode === k ? ' on' : '')} onClick={() => setMode(k)}><b>{v.name}</b><span>{v.desc}</span><span className="sub">{CH_ODDS[k]}</span></button>)}</div>
    <button className="cta" onClick={() => M.startChallenge(start, mode)}>Start the 30-day challenge</button></div>
  const pctc = st.bank / st.start; const goal = st.start * 10
  return <div className="card chal on"><h3>🤖 AI challenge · {st.mode.name}</h3>
    <div className="chbank"><div><span className="sub">Started with</span><b>CLP {st.start.toLocaleString('en-US')}</b></div><div className="arrow">→</div><div><span className="sub">Now</span><b className={pctc >= 1 ? 'ok' : 'ko'}>CLP {st.bank.toLocaleString('en-US')}</b></div><div><span className="sub">x</span><b>{pctc.toFixed(2)}</b></div></div>
    <div className="chbar"><i style={{ width: Math.min(100, st.bank / goal * 100) + '%' }} /><span>goal 10x = CLP {goal.toLocaleString('en-US')}</span></div>
    {st.done && <div className={'chdone ' + st.done.toLowerCase()}>{st.done === 'GOAL' ? '🏆 10x reached!' : st.done === 'BUST' ? '💥 Money gone – the challenge is over.' : '🏁 30 days are over.'}</div>}
    {st.pending && <div className="chpend">Today: <b>{st.pending.title}</b> · stake CLP {st.pending.stake.toLocaleString('en-US')} · about {st.pending.odds.toFixed(2)} · {RES[st.pending.res]}</div>}
    {!st.pending && !st.done && <div className="sub">Waiting for the next {st.mode.cid === 'fav' ? 'Favourites 4+' : 'Safe 3'} ticket (it is saved before kick-off).</div>}
    {st.log.length > 0 && <div className="chlog">{st.log.slice().reverse().map((x, i) => <div key={i}><span>{dLabel(x.date)}</span><span>{x.title}</span><span>CLP {x.stake.toLocaleString('en-US')} @ {x.odds.toFixed(2)}</span><b className={x.res === 'WON' ? 'ok' : 'ko'}>{x.res === 'WON' ? '✓' : '✗'} {x.bank.toLocaleString('en-US')}</b></div>)}</div>}
    <p className="sub">Runs until {dLabel(st.end)}. Play money only. {CH_ODDS[st.key]}</p>
    <button className="linkb" onClick={() => M.stopChallenge()}>End challenge</button></div>
}

export function TicketsView({ openBuilder }) {
  const [sug, setSug] = useState(false); const [tools, setTools] = useState(false); const [move, setMove] = useState(false); const [tab, setTab] = useState('open')
  const rank = t => { const L = t.legs.map(M.legState); const r = M.settled(L); return r ? 3 : L.some(l => l.s && l.s.state === 'in') ? 0 : L.some(l => l.s && l.s.state !== 'pre') ? 1 : 2 }
  const mine = E.MY.filter(t => t.real || !t.preset).slice().sort((a, b) => rank(a) - rank(b)), suggested = E.MY.filter(t => t.preset && !t.real)
  const openT = mine.filter(t => rank(t) < 3), doneT = mine.filter(t => rank(t) === 3); const list = tab === 'open' ? openT : doneT
  return <section className="tickets3">
    <div className="th3"><h2>My tickets</h2><button className="cta" onClick={openBuilder}>＋ Add ticket</button></div>
    <Summary list={mine} />
    <div className="ttabs"><button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open <span>{openT.length}</span></button><button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Finished <span>{doneT.length}</span></button></div>
    <div className="t3list">{list.length ? list.map((t, i) => <TicketStub key={t.id} t={t} i={i} />) : <div className="emptyc"><div className="big">🎟</div><p>{tab === 'open' ? 'No open tickets.' : 'No finished tickets yet.'}</p>{tab === 'open' && <button className="cta" onClick={openBuilder}>＋ Add ticket</button>}</div>}</div>
    <Challenge />
    <SugHistory />
    {suggested.length > 0 && <button className="fold" onClick={() => setSug(!sug)}>{sug ? '▴' : '▾'} Suggested tickets ({suggested.length})</button>}
    {sug && suggested.length > 0 && <div className="t3list">{suggested.map((t, i) => <TicketStub key={t.id} t={t} i={i} />)}</div>}
    <button className="fold" onClick={() => setMove(!move)}>{move ? '▴' : '▾'} Send my tickets to my phone or PC</button>
    {move && <MoveBox />}
    <button className="fold" onClick={() => setTools(!tools)}>{tools ? '▴' : '▾'} More: what wins for you, safe ticket maker, past tickets, “what if” money test, my limits</button>
    {tools && <><Exposure /><SafeBuilder onUse={L => { const d = E.DRAFT.slice(); L.forEach(x => { if (!d.some(l => l.eid === x.eid && l.n === x.n)) d.push(x) }); M.setDraft(d); openBuilder() }} />
      <div className="two"><WhatWins /><Accuracy /></div><div className="two"><Limits /><div /></div><div className="two"><div className="card"><h3>Past tickets</h3><ResultsLog /></div><div className="card"><h3>“What if” money test</h3><BankSim /></div></div></>}
  </section>
}
