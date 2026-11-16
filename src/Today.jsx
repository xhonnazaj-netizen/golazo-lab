import React, { useEffect, useState } from 'react'
import * as M from './engine.js'
import { chanceCls, Stars, LiveAdvisor } from './Tickets.jsx'
import { Vs, Strength } from './Bits.jsx'
const { E } = M
const pct = M.pct

const dayOff = k => { const d = new Date(); d.setDate(d.getDate() + k); return M.ymdOf(d) }
const nice = (eid, n) => { const m = M.byE[eid]; return M.nice(n, m).replace(m.h, m.hA).replace(m.a, m.aA) }
const when = eid => { const s = M.S(eid); return s.state === 'in' ? s.clock : s.state === 'post' ? 'Final' : s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }
const hda = eid => { const R = M.simOf(eid); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), D = M.frac(R, (R, n) => R.GH[n] === R.GA[n]); return [H, D, 1 - H - D] }
const go = (lg, date, eid) => { M.setCompetition(lg, date).then(() => M.selectMatch(eid)); window.dispatchEvent(new CustomEvent('mb:view', { detail: 'stadium' })) }

function Pick({ x, showMatch = true }) {
  const m = M.byE[x.eid]; const on = M.inDraft(x.eid, x.n)
  return <div className={'tpick' + (on ? ' on' : '')}>
    <div className="tp-l" onClick={() => go(x.lg, E.DAY, x.eid)}><b>{nice(x.eid, x.n)} <Stars n={x.n} /></b>{showMatch && <span className="sub">{m.h} v {m.a} · {when(x.eid)} <Vs v={x.v} /></span>}</div>
    <b className={'pchip ' + chanceCls(x.p)}>{pct(x.p)}</b>
    <button className="tp-add" onClick={() => M.addPick(x.eid, x.n)}>{on ? '✓' : '＋'}</button></div>
}

function Combo({ c, i, open }) {
  if (c.wait) return <div className="combo wait" style={{ animationDelay: i * 70 + 'ms' }}><div className="cb-h"><div><b>{c.title}</b><div className="sub">{c.desc}</div></div></div>
    <div className="cb-wait"><div className="big">{c.have}/9</div><div>Only {c.have} game{c.have === 1 ? '' : 's'} left with a safe bet today. Fire 9 comes back when there are 9 – try <b>Tomorrow</b> at the top.</div></div>
    {c.rec && <div className="cb-rec">📊 Tested on {c.rec[0]} past match days: won <b>{c.rec[1]}</b> (<b>{Math.round(c.rec[1] / c.rec[0] * 100)}%</b>)</div>}</div>
  return <div className="combo" style={{ animationDelay: i * 70 + 'ms' }}>
    <div className="cb-h"><div><b>{c.title}</b><div className="sub">{c.desc} · {c.legs.length} games</div></div><div className="cb-o"><span className="sub">our odds</span><b>{c.fair.toFixed(2)}</b></div></div>
    <Strength st={c.st} small />
    <div className="cb-legs">{c.legs.map(x => { const m = M.byE[x.eid]; return <div key={x.eid + x.n} className="cb-leg"><span><b>{nice(x.eid, x.n)}</b> <Stars n={x.n} /><span className="sub"> {m.hA}–{m.aA}</span></span><b className={'pchip ' + chanceCls(x.p)}>{pct(x.p)}</b></div> })}</div>
    {c.rec ? <div className="cb-rec">📊 Tested on {c.rec[0]} past match days: won <b>{c.rec[1]}</b> (<b>{Math.round(c.rec[1] / c.rec[0] * 100)}%</b>)</div> : <div className="cb-rec sub">📊 No past record yet</div>}
    <button className="cta" onClick={() => { M.useCombo(c.legs); open() }}>Use this ticket</button>
    <div className="sub" style={{ marginTop: 6 }}>Good deal if {M.bookName()} gives total odds above {c.fair.toFixed(2)}.</div></div>
}

export function TodayView({ openBuilder }) {
  const [day, setDay] = useState(E.DAY || dayOff(0)); const [kind, setKind] = useState('safe'); const [lgf, setLgf] = useState('')
  useEffect(() => { M.loadDay(day) }, [day])
  const games = M.dayGames(day); const lgs = [...new Set(games.map(g => g.lg))]
  const shown = lgf ? games.filter(g => g.lg === lgf) : games
  const live = games.filter(g => M.S(g.eid).state === 'in').length, done = games.filter(g => M.S(g.eid).state === 'post').length
  const myOpen = E.MY.filter(t => (t.real || !t.preset) && !M.settled(t.legs.map(M.legState))).length
  const combos = M.combos(day).filter(c => c.wait || !lgf || c.legs.every(x => x.lg === lgf))
  const picks = M.pickList(day, kind, .5, .97, lgf || undefined).slice(0, 10)
  const d = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8))
  const sorted = shown.slice().sort((a, b) => ({ in: 0, pre: 1, post: 2 })[M.S(a.eid).state] - ({ in: 0, pre: 1, post: 2 })[M.S(b.eid).state] || new Date(M.S(a.eid).date) - new Date(M.S(b.eid).date))
  const byLg = {}; sorted.forEach(g => (byLg[g.name] = byLg[g.name] || []).push(g))
  return <section className="today">
    <div className="td-top">
      <div><h2>{d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h2><div className="sub">Daily numbers for every game · tap a bet to add it to your ticket</div></div>
      <div className="daychips">{[[-1, 'Yesterday'], [0, 'Today'], [1, 'Tomorrow'], [2, d2label(2)]].map(([k, l]) => <button key={k} className={day === dayOff(k) ? 'on' : ''} onClick={() => setDay(dayOff(k))}>{l}</button>)}</div>
    </div>
    <div className="tsum">
      <div><span className="sub">Games</span><b>{games.length}</b></div><div><span className="sub">Live now</span><b className={live ? 'cy' : ''}>{live}</b></div>
      <div><span className="sub">Finished</span><b>{done}</b></div><div><span className="sub">My open tickets</span><b>{myOpen}</b></div></div>
    {lgs.length > 1 && <div className="lgchips"><button className={!lgf ? 'on' : ''} onClick={() => setLgf('')}>All</button>{lgs.map(lg => <button key={lg} className={lgf === lg ? 'on' : ''} onClick={() => setLgf(lg)}>{(M.LEAGUES.find(x => x[0] === lg) || [])[1]}</button>)}</div>}
    {!games.length ? <div className="emptyc"><div className="big">📅</div><p>Loading games… If nothing shows, there are no games in these competitions on this day.</p></div> : <>
      {live > 0 && <><h3 className="td-h">🔴 Live now – best bets</h3><div className="la-grid">{games.filter(g => M.S(g.eid).state === 'in').map(g => <LiveAdvisor key={g.eid} eid={g.eid} compact onOpen={() => go(g.lg, day, g.eid)} />)}</div></>}
      <h3 className="td-h">Ready combinations</h3>
      {combos.length ? <div className="combos">{combos.map((c, i) => <Combo key={c.id} c={c} i={i} open={openBuilder} />)}</div> : <p className="sub">All games are finished – try Tomorrow.</p>}
      <div className="td-two">
        <div className="card"><div className="td-ph"><h3>Top % today</h3><div className="kinds">{[['safe', 'Safest'], ['goals', 'Total goals'], ['teams', '1X2'], ['cards', 'Cards']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div></div>
          {picks.length ? picks.map(x => <Pick key={x.eid + x.n} x={x} />) : <p className="sub">No open games left.</p>}<div className="sub" style={{ marginTop: 6 }}>Our own % for the best bet of each game. ★★★ = easy to call, ★ = hard to call. 💰 = the bookies pay more than it is worth.</div></div>
        <div className="card"><h3>All games</h3>{Object.entries(byLg).map(([name, L]) => <div key={name} className="td-lg"><div className="td-lgn">{name}</div>{L.map(({ eid, lg }) => { const m = M.byE[eid], s = M.S(eid); const [H, D, A] = hda(eid); const b = M.bestPicks(eid); const top = b && [...b.h, ...b.a, ...b.x].sort((p, q) => q.p - p.p)[0]
          return <div key={eid} className={'td-g' + (s.state === 'in' ? ' live' : '')} onClick={() => go(lg, day, eid)}>
            <span className="td-t">{s.state === 'in' && <span className="live-dot" />}{when(eid)}</span>
            <span className="td-tm"><span>{m.h}</span><span>{m.a}</span></span>
            <span className="td-sc">{s.state === 'pre' ? '' : <><b>{s.h}</b><b>{s.a}</b></>}</span>
            <span className="td-p"><span>{pct(H)}</span><span className="sub">{pct(D)}</span><span>{pct(A)}</span></span>
            {top && s.state !== 'post' ? <span className="td-best" onClick={e => { e.stopPropagation(); M.addPick(eid, top.n) }}>{nice(eid, top.n)} <b className={'pchip ' + chanceCls(top.p)}>{pct(top.p)}</b></span> : <span />}
          </div> })}</div>)}
          <div className="sub">W1 · X · W2 – our own %. Tap a game to open it.</div></div>
      </div></>}
  </section>
}
function d2label(k) { const d = new Date(); d.setDate(d.getDate() + k); return d.toLocaleDateString([], { weekday: 'short', day: 'numeric' }) }
