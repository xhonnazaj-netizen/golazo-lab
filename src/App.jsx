import React, { useEffect, useState } from 'react'
import * as M from './engine.js'
import { useEngine } from './useEngine.js'
import { MatchView, useTick } from './MatchView.jsx'
import { TicketsView, Builder, BestPicks, DraftBar } from './Tickets.jsx'
import { Assistant } from './Assistant.jsx'
import { TodayView } from './Today.jsx'
const { E } = M

function LayoutMenu() {
  const [open, setOpen] = useState(false)
  useEffect(() => { const f = () => setOpen(false); if (open) document.addEventListener('click', f); return () => document.removeEventListener('click', f) }, [open])
  const P = M.PREF; const items = [['mom', 'Who is attacking (chart)'], ['playing', 'How the game is going'], ['bets', 'Bets now'], ['pMk', 'All bets'], ['pSt', 'Stats'], ['pEv', 'What happened'], ['pLu', 'Who plays'], ['pCx', 'Recent games']]
  return <div className="layw"><button onClick={e => { e.stopPropagation(); setOpen(!open) }}>⚙ Settings</button>
    {open && <div className="laybox card show" onClick={e => e.stopPropagation()}>
      <div className="lt2">Field</div><div className="seg">{['large', 'compact', 'hidden'].map(v => <button key={v} className={P.pitch === v ? 'on' : ''} onClick={() => M.setPref('pitch', v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
      <div className="lt2">Match list</div><div className="seg">{[['all', 'All matches'], ['live', 'Live only']].map(([v, l]) => <button key={v} className={P.strip === v ? 'on' : ''} onClick={() => M.setPref('strip', v)}>{l}</button>)}</div>
      <div className="lt2">Extra live odds (optional, advanced)</div><input className="okey" type="password" placeholder="The Odds API key – leave empty" defaultValue={M.hasOddsKey() ? '••••••••' : ''} onBlur={e => { if (e.target.value !== '••••••••') M.setOddsKey(e.target.value) }} /><div className="sub" style={{ fontSize: 11, margin: '4px 0 8px' }}>{M.hasOddsKey() ? 'Saved on this device only.' : 'Not needed. The app works without it.'}</div>
      <div className="lt2">Show these parts</div>{items.map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={P[k] !== false} onChange={e => M.setPref(k, e.target.checked)} /> {l}</label>)}</div>}</div>
}

function LiveGrid() {
  const ids = new Set(M.BOARD[E.CUR.lg + '|' + E.CUR.date] || []); E.MY.forEach(t => t.legs.forEach(l => { if (M.ST[l.eid] && M.ST[l.eid].state === 'in') ids.add(l.eid) }))
  const order = { in: 0, pre: 1, post: 2 }; const arr = [...ids].filter(e => M.byE[e]).sort((a, b) => order[M.S(a).state] - order[M.S(b).state] || new Date(M.S(a).date) - new Date(M.S(b).date))
  return <section className="grid" style={{ display: 'grid', paddingTop: 12 }}>{arr.map(eid => {
    const m = M.byE[eid], s = M.S(eid), R = M.simOf(eid); const [c1, c2] = M.colors(m); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), D = M.frac(R, (R, n) => R.GH[n] === R.GA[n]), A = 1 - H - D
    let ph = '', pa = ''; if (s.state !== 'pre') { const end = s.state === 'post' ? 90 : Math.min(90, s.min || 0); ph = 'M0 20'; pa = 'M0 20'; for (let t = 0; t <= end; t += 2) { const p = M.pressureAt(s, t); ph += ` L${t * 2.2} ${20 - Math.min(18, p[0] * 20)}`; pa += ` L${t * 2.2} ${20 + Math.min(18, p[1] * 20)}` } ph += ` L${end * 2.2} 20Z`; pa += ` L${end * 2.2} 20Z` }
    const nt = new Set(E.MY.filter(t => (t.real || !t.preset) && t.legs.some(l => l.eid === eid)).map(t => t.id)).size
    return <div key={eid} className={'gcard' + (s.state === 'in' ? ' live' : '')} onClick={() => { M.selectMatch(eid); window.dispatchEvent(new CustomEvent('mb:view', { detail: 'stadium' })) }}>
      <div className="gt"><span>{s.state === 'in' ? <><span className="live-dot" />{s.clock}</> : s.state === 'post' ? 'Final' : s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span><span className="sub">{s.state !== 'pre' ? `chances ${s.xh.toFixed(1)}–${s.xa.toFixed(1)}` : ''}</span></div>
      <div className="gs"><span style={{ color: c1 }}>{m.hA}</span><b>{s.state === 'pre' ? 'v' : `${s.h} – ${s.a}`}</b><span style={{ color: c2 }}>{m.aA}</span></div>
      <div className="wbar"><div style={{ width: H * 100 + '%', background: c1 }} /><div style={{ width: D * 100 + '%', background: '#556' }} /><div style={{ width: A * 100 + '%', background: c2 }} /></div>
      <div className="wl"><span>{M.pct(H)}</span><span>{M.pct(D)}</span><span>{M.pct(A)}</span></div>
      <svg viewBox="0 0 198 40" className="gm"><line x1="0" x2="198" y1="20" y2="20" stroke="rgba(61,245,255,.3)" />{ph && <><path d={ph} fill={c1} fillOpacity=".5" /><path d={pa} fill={c2} fillOpacity=".5" /></>}</svg>
      <BestPicks eid={eid} compact />
      {nt > 0 && <div className="sub" style={{ fontSize: 11 }}>🎟 in {nt} of your tickets</div>}</div>
  })}</section>
}

function Toasts() { return <div id="toasts" aria-live="polite">{M.UI.toasts.slice().reverse().map(a => <div key={a.id} className={'toast ' + a.kind}>{a.msg}</div>)}</div> }
function GoalFlash() { useTick(500); const g = M.UI.goal; if (!g || Date.now() - g.t > 3200) return null; return <div className="flash"><div>GOAL</div></div> }

export function Logo({ size = 26 }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3df5ff" /><stop offset="1" stopColor="#ff3dc8" /></linearGradient></defs>
    <path d="M12 3h8v2h-1.5v6.2l7.6 12.6A3 3 0 0 1 23.5 28h-15a3 3 0 0 1-2.6-4.2l7.6-12.6V5H12z" fill="none" stroke="url(#gl)" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="16" cy="21.5" r="4.2" fill="url(#gl)" /><path d="M16 18.6l1.6 1.2-.6 1.9h-2l-.6-1.9z" fill="#04121c" /></svg>
}

function Help({ onClose }) {
  return <div className="help1"><button className="x linkb" onClick={onClose}>Got it ✕</button><h3>HOW IT WORKS</h3><ol>
    <li><b>Pick a game.</b> The big numbers are each team’s chance to win.</li>
    <li><b>Look at “Bets now”.</b> Only bet if the bookie pays at least the number shown.</li>
    <li><b>Add your bookie ticket</b> in My tickets. We follow it live and tell you when to keep it or take the money.</li>
    <li><b>Stuck?</b> Tap 💬 and ask, e.g. “Germany” or “take the money?”.</li></ol></div>
}

export default function App() {
  useEngine(); const [view, setView] = useState('today'); const [bOpen, setBOpen] = useState(false); const [help, setHelp] = useState(() => { try { return !localStorage.getItem('mb_help1') } catch (e) { return true } })
  const closeHelp = () => { setHelp(false); try { localStorage.setItem('mb_help1', '1') } catch (e) { } }
  useEffect(() => { const f = e => setView(e.detail); const g = () => setBOpen(true); window.addEventListener('mb:view', f); window.addEventListener('mb:builder', g); return () => { window.removeEventListener('mb:view', f); window.removeEventListener('mb:builder', g) } }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [view])
  const open = E.MY.filter(t => (t.real || !t.preset) && !M.settled(t.legs.map(M.legState))).length
  const dstr = d => d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6)
  return <>
    <header className="topbar"><div className="brand"><span className="logo"><Logo /></span><h1 className="orb">GOLAZO<span>LAB</span></h1></div>
      <div className={"pick" + (view === 'stadium' ? '' : ' pick-off')}><select aria-label="Competition" value={E.CUR.lg} onChange={e => M.setCompetition(e.target.value, E.CUR.date)}>{M.LEAGUES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <input type="date" aria-label="Date" value={dstr(E.CUR.date)} onChange={e => M.setCompetition(E.CUR.lg, e.target.value.replace(/-/g, ''))} /></div>
      <nav className="views">{[['today', 'Today'], ['stadium', 'Match'], ['tickets', 'My tickets']].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}{k === 'tickets' && open ? <span className="cnt">{open}</span> : null}</button>)}</nav>
      <button className="qbtn" title="How it works" onClick={() => setHelp(!help)}>?</button><LayoutMenu /><span id="upd" className={M.UI.ok ? '' : 'err'}>{M.UI.status}</span></header>
    {help && <Help onClose={closeHelp} />}{view === 'today' && <TodayView openBuilder={() => setBOpen(true)} />}{view === 'stadium' && <MatchView />}{view === 'grid' && <LiveGrid />}{view === 'tickets' && <TicketsView openBuilder={() => setBOpen(true)} />}
    {bOpen && <Builder onClose={() => setBOpen(false)} />}<Toasts /><GoalFlash /><Assistant />{!bOpen && <DraftBar openBuilder={() => setBOpen(true)} />}
  </>
}
