import React, { useEffect, useRef, useState } from 'react'
import * as M from './engine.js'
const { E } = M

/* Built-in assistant: understands set kinds of questions (English + Spanish)
   and answers only from the app's own live numbers. No outside service. */

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const ES = { alemania: 'germany', suiza: 'switzerland', escocia: 'scotland', holanda: 'netherlands', 'paises bajos': 'netherlands', grecia: 'greece', islandia: 'iceland', luxemburgo: 'luxembourg', lituania: 'lithuania', eslovaquia: 'slovakia', kazajistan: 'kazakhstan', 'islas feroe': 'faroe', feroe: 'faroe', moldavia: 'moldova', macedonia: 'macedonia', eslovenia: 'slovenia', dinamarca: 'denmark', noruega: 'norway', gales: 'wales', polonia: 'poland', suecia: 'sweden', hungria: 'hungary', irlanda: 'ireland', ucrania: 'ukraine', rumania: 'romania', espana: 'spain', francia: 'france', inglaterra: 'england', italia: 'italy', belgica: 'belgium', croacia: 'croatia', turquia: 'turkey', chequia: 'czech', 'republica checa': 'czech', serbia: 'serbia' }
const tr = s => { let x = norm(s); Object.keys(ES).forEach(k => { x = x.split(k).join(ES[k]) }); return x }
const clp = x => 'CLP ' + Math.round(x).toLocaleString('en-US')
const ymd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0') }
const P = (eid, n) => { const m = M.byE[eid]; const mk = M.markets(m).find(x => x.n === n); if (!mk) return null; const R = M.simOf(eid); return M.frac(R, mk.f) }

function pool() {
  const ids = new Set(M.BOARD[E.CUR.lg + '|' + E.CUR.date] || [])
  E.MY.forEach(t => t.legs.forEach(l => { const s = M.ST[l.eid]; if (s && s.state !== 'post') ids.add(l.eid) }))
  return [...ids].filter(e => M.byE[e])
}
const open = ids => ids.filter(e => M.S(e).state !== 'post')
const vs = m => m.h + ' v ' + m.a
const when = e => { const s = M.S(e); return s.state === 'in' ? `LIVE ${s.h}-${s.a} · ${s.clock}` : s.state === 'post' ? `FT ${s.h}-${s.a}` : s.date ? new Date(s.date).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '' }

function findMatch(q) {
  const words = tr(q).split(/[^a-z]+/).filter(w => w.length >= 3)
  const all = Object.keys(M.byE)
  const score = e => { const m = M.byE[e]; const names = [m.h, m.a, m.hA, m.aA].map(norm); let s = 0; words.forEach(w => names.forEach(n => { if (n === w || (w.length >= 4 && n.startsWith(w)) || (w.length >= 5 && n.includes(w))) s++ })); return s }
  let best = null, bs = 0; const st = { in: 3, pre: 2, post: 1 }
  all.forEach(e => { const s = score(e); if (s > bs || (s === bs && s > 0 && st[M.S(e).state] > st[M.S(best).state])) { best = e; bs = s } })
  return bs ? best : null
}

/* ---------- answers ---------- */
function aHelp() {
  return { text: 'I answer from this app’s live numbers. Try:', chips: ['Should I take the money?', 'Best goal bets', 'Make a safe ticket', 'What’s on now?', 'Next goal', 'How accurate are you?'] }
}

function aCash() {
  const mine = E.MY.filter(t => t.real || !t.preset)
  if (!mine.length) return { text: 'You have no tickets yet. Add one in Tickets → “＋ Add a ticket”.' }
  return { node: <>{mine.map(t => { const legs = t.legs.map(M.legState); const res = M.settled(legs); const Ev = M.ticketE(t); const sg = M.signal(t, M.ticketP(t), Ev, res, legs); const stake = t.stake || E.STAKE; const odds = M.tOdds(t)
    const won = legs.filter(l => l.s && l.s.state !== 'pre' && l.p === 1).length, live = legs.filter(l => l.s && l.s.state === 'in').length
    const started = legs.some(l => l.s && l.s.state !== 'pre'); const big = res || (!started ? 'WAITING' : sg.big)
    const txt = res === 'WON' ? `It won: ${clp(stake * odds)}.` : res === 'LOST' ? 'One pick lost, nothing to cash out.' : !started ? 'Not started yet – nothing to do.' : (/–/.test(sg.txt) ? 'Going well – keep it running.' : sg.txt)
    return <div key={t.id} className="abox"><b>{t.real ? 'bookie #' + (t.n.match(/#(\d+)/) || [])[1] : t.n}</b> <span className={'apill ' + big.toLowerCase().replace(/ /g, '')}>{big}</span>
      <div>{txt}</div><div className="sub">{won} of {legs.length} won{live ? ` · ${live} live` : ''}{started && !res && Ev != null ? ` · worth now ${clp(stake * Ev)}` : ''}</div></div> })}
    <div className="sub">Type what the bookie offers you on the ticket (My tickets) and I’ll tell you if it’s a good deal.</div></> }
}

function aLive() {
  const live = Object.keys(M.ST).filter(e => M.byE[e] && M.S(e).state === 'in')
  if (!live.length) { const nx = open(pool()).filter(e => M.S(e).date).sort((a, b) => new Date(M.S(a).date) - new Date(M.S(b).date))[0]; return { text: 'Nothing is live right now.' + (nx ? ` Next: ${vs(M.byE[nx])}, ${when(nx)}.` : '') } }
  return { node: <>{live.map(e => <MatchRow key={e} eid={e} />)}</>, chips: ['Next goal'] }
}

function MatchRow({ eid }) {
  const m = M.byE[eid], R = M.simOf(eid); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), D = M.frac(R, (R, n) => R.GH[n] === R.GA[n]), A = 1 - H - D
  return <div className="abox"><b>{vs(m)}</b> <span className="sub">{when(eid)}</span>
    <div className="atri"><span>{m.hA} <b>{M.pct(H)}</b></span><span>Draw <b>{M.pct(D)}</b></span><span>{m.aA} <b>{M.pct(A)}</b></span></div></div>
}

function aMatch(eid) {
  const m = M.byE[eid], s = M.S(eid); const g = n => P(eid, n)
  const rows = [['Over 1.5', g('Over 1.5')], ['Over 2.5', g('Over 2.5')], ['Under 3.5', g('Under 3.5')], ['Both score', g('Both teams score')], ['Over 8.5 corners', g('Over 8.5 corners')]]
  const R = M.simOf(eid); const H = M.frac(R, (R, n) => R.GH[n] > R.GA[n]), D = M.frac(R, (R, n) => R.GH[n] === R.GA[n]), A = 1 - H - D
  const fav = H > A ? m.h : m.a, fp = Math.max(H, A)
  return { node: <><MatchRow eid={eid} /><div className="abox">{rows.filter(r => r[1] != null).map(([n, p]) => <div key={n} className="arow"><span>{n}</span><b>{p > .995 ? '✓' : M.pct(p)}</b><span className="sub">{p > .995 ? 'done' : p < .005 ? 'lost' : 'our price ' + (1 / p).toFixed(2)}</span></div>)}</div>
    <div>{fp > .6 ? `${fav} are clear favourites.` : fp > .45 ? `${fav} are slight favourites.` : 'Close game – no clear favourite.'}{m.src ? <span className="sub"> Based on {m.src}.</span> : null}</div></>,
    chips: s.state === 'in' ? ['Next goal ' + m.hA, 'Should I take the money?'] : ['Make a safe ticket'] , open: eid }
}

function bestPicks(filter, k = 6, lo = .6, hi = .93) {
  const out = []
  open(pool()).forEach(e => { const m = M.byE[e], R = M.simOf(e); M.markets(m).forEach(x => { if (x.pu || !filter(x, m)) return; const p = M.frac(R, x.f); if (p >= lo && p <= hi) out.push({ eid: e, n: x.n, p }) }) })
  return out.sort((a, b) => b.p - a.p)
}
function onePerMatch(L, k) { const seen = new Set(), r = []; for (const x of L) { if (seen.has(x.eid)) continue; seen.add(x.eid); r.push(x); if (r.length >= k) break } return r }

function PickList({ L, add = true }) {
  return <div className="abox">{L.map((x, i) => { const m = M.byE[x.eid]; return <div key={i} className="arow"><span><b>{M.nice(x.n)}</b><span className="sub"> {m.hA}–{m.aA}</span></span><b>{M.pct(x.p)}</b><span className="sub">our price {(1 / x.p).toFixed(2)}</span>
    {add && <button className="aadd" title="Add to slip" onClick={() => addDraft([x])}>＋</button>}</div> })}</div>
}
function addDraft(L) {
  const d = E.DRAFT.slice(); L.forEach(x => { if (!d.some(l => l.eid === x.eid && l.n === x.n)) d.push({ eid: x.eid, lg: M.byE[x.eid].lg, date: M.S(x.eid).date ? ymd(M.S(x.eid).date) : E.CUR.date, n: x.n, o: null }) })
  M.setDraft(d); window.dispatchEvent(new Event('mb:builder'))
}

function aGoals(q) {
  const hasO = /over|mas de|altas/.test(q), hasU = /under|menos|bajas/.test(q); const wantO = hasO || !hasU, wantU = hasU || !hasO
  const O = onePerMatch(bestPicks(x => x.g === 'Goals' && /^Over \d\.5$/.test(x.n) && x.n !== 'Over 0.5', 0, .6, .9), 5)
  const U = onePerMatch(bestPicks(x => x.g === 'Goals' && /^Under \d\.5$/.test(x.n) && x.n !== 'Under 4.5', 0, .6, .9), 5)
  if (!O.length && !U.length) return { text: 'No open matches on this day. Change the date or competition at the top.' }
  return { node: <>{wantO && O.length > 0 && <><div className="ah">More goals (overs)</div><PickList L={O} /></>}{wantU && U.length > 0 && <><div className="ah">Fewer goals (unders)</div><PickList L={U} /></>}
    <div className="sub">Only bet if the bookie pays more than our price. ＋ adds it to your ticket.</div></> }
}

function aGroup(g, label) {
  const L = onePerMatch(bestPicks(x => x.g === g && !/offside/.test(x.n), 0, .6, .9), 6)
  if (!L.length) return { text: `No good ${label} picks on the open matches right now.` }
  return { node: <><div className="ah">Best {label} bets</div><PickList L={L} /></> }
}

function aNext(eid) {
  let ids = eid ? [eid] : Object.keys(M.ST).filter(e => M.byE[e] && M.S(e).state === 'in')
  ids = ids.filter(e => M.S(e).state === 'in')
  if (!ids.length) return { text: eid ? `${vs(M.byE[eid])} is not live yet (${when(eid)}).` : 'Nothing is live right now. Ask me again when a match starts.' }
  return { node: <>{ids.map(e => { const m = M.byE[e], s = M.S(e); const b = M.liveBets(m, s).slice(0, 4); const ng = [m.h, m.a].map(t => [t, P(e, 'Next goal: ' + t)]); const nm = P(e, 'No more goals')
    return <div key={e} className="abox"><b>{vs(m)}</b> <span className="sub">{when(e)}</span>
      <div className="atri">{ng.map(([t, p]) => <span key={t}>{t.split(' ')[0]} <b>{M.pct(p)}</b></span>)}<span>No goal <b>{M.pct(nm)}</b></span></div>
      <div className="sub" style={{ marginTop: 4 }}>Bets now: {b.map(x => `${M.nice(x.n)} ${M.pct(x.p)} (bet if the bookie pays ${x.min.toFixed(2)}+)`).join(' · ')}</div></div> })}</> }
}

function aBuild(q) {
  const n = +(q.match(/\b(\d{1,2})\b/) || [])[1] || (/safe|segur/.test(q) ? 5 : 4)
  const safe = /safe|segur/.test(q), risky = /high|big|alta|grande|risk|50|payout/.test(q)
  const lo = safe ? .8 : risky ? .35 : .65, hi = safe ? .95 : risky ? .6 : .85
  const ok = (x, m) => risky ? (x.g === 'Result' && !/next goal|no more|or draw|no draw/i.test(x.n)) || /^Over [23]\.5$/.test(x.n) : M.safeCands(m).includes(x.n)
  const L = onePerMatch(bestPicks(ok, 0, lo, hi), Math.min(Math.max(n, 2), 10))
  if (L.length < 2) return { text: 'Not enough open matches for a ticket on this day. Pick another date at the top.' }
  const pAll = L.reduce((a, x) => a * x.p, 1)
  return { node: <><div className="ah">{safe ? 'Safe' : risky ? 'Big payout' : 'Balanced'} ticket · {L.length} picks</div><PickList L={L} add={false} />
    <div>If the bookie’s total odds are above <b>{(1 / pAll).toFixed(2)}</b>, it’s a good deal.</div>
    <button className="cta" style={{ marginTop: 8 }} onClick={() => addDraft(L)}>Add these to my ticket</button></>, chips: ['Make a big payout ticket', 'Make a safe ticket'] }
}

function aAcc() {
  const a = M.accStats()
  return { node: <><div>Tested on 2,584 past Nations League and qualifier games, my team ratings scored <b>0.49</b> (lower is better; guessing scores 0.67, our old method 0.58).</div>
    {a.n ? <div className="abox">On your games: <b>{a.n}</b> finished · favourite won <b>{M.pct(a.fav)}</b> · over/under 2.5 right <b>{M.pct(a.ou)}</b></div> : <div className="sub">I save my % before every game and check them at the final whistle – your own results will show here soon.</div>}
    <div className="sub">No model wins every bet. Over many games, being a bit better than the bookie’s price is what counts.</div></> }
}
function answer(q0) {
  const q = norm(q0)
  if (!q.trim() || /^(help|ayuda|hi|hola|hello|hey)\b/.test(q)) return aHelp()
  const eid = findMatch(q0)
  if (/probabilidad|chance|odds of|quien gana|who wins/.test(q) && eid) return aMatch(eid)
  if (/accura|precis|how good|how often.*right|trust/.test(q)) return aAcc()
  if (/take (the )?money|cash|retir|cobr|my ticket|mis bolet|mi bolet|boleto|ticket.*(how|como)|how.*ticket/.test(q) && !/build|make|create|arma|crea|give me|dame/.test(q)) return aCash()
  if (/build|make|create|arma|crea|give me a ticket|dame un|combinada|parlay|safe ticket|high odds|big payout/.test(q)) return aBuild(q)
  if (/next goal|proximo gol|siguiente gol|who.*score|quien.*gol|live bet|apuesta en vivo/.test(q)) return aNext(eid)
  if (/corner/.test(q)) return eid ? aMatch(eid) : aGroup('Corners', 'corner')
  if (/card|tarjeta|yellow|amarilla/.test(q)) return aGroup('Cards', 'card')
  if (/over|under|goal|gol|mas de|menos de/.test(q) && !eid && !/next/.test(q)) return aGoals(q)
  if (eid) return aMatch(eid)
  if (/live|vivo|score|marcador|now|ahora|playing/.test(q)) return aLive()
  return { text: 'I didn’t get that. Try one of these, or type a team name:', chips: aHelp().chips }
}

export function Assistant() {
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState(() => [{ who: 'bot', ...aHelp(), text: 'Hi! Ask me about a game or your tickets – type a team name like “Germany” or tap a question.' }]); const [inp, setInp] = useState('')
  const box = useRef(null)
  useEffect(() => { const f = () => setOpen(false); window.addEventListener('mb:builder', f); return () => window.removeEventListener('mb:builder', f) }, [])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs, open])
  const ask = q => { if (!q.trim()) return; let a; try { a = answer(q) } catch (e) { a = { text: 'The numbers are still loading – try again in a few seconds.' } } setMsgs(m => [...m, { who: 'me', text: q }, { who: 'bot', ...a }]); setInp('') }
  return <>
    <button className={'abtn' + (open ? ' on' : '')} onClick={() => setOpen(!open)} aria-label="Assistant">{open ? '✕' : '💬'}</button>
    {open && <div className="apanel">
      <div className="ahd"><b>Assistant</b><span className="sub">uses the app’s own numbers</span></div>
      <div className="amsgs" ref={box}>{msgs.map((m, i) => <div key={i} className={'amsg ' + m.who}>
        {m.text && <div>{m.text}</div>}{m.node}
        {m.open && <button className="linkb" onClick={() => { M.selectMatch(m.open); window.dispatchEvent(new CustomEvent('mb:view', { detail: 'stadium' })); setOpen(false) }}>Open this game ›</button>}
        {m.chips && <div className="achips">{m.chips.map(c => <button key={c} onClick={() => ask(c)}>{c}</button>)}</div>}</div>)}</div>
      <form className="ain" onSubmit={e => { e.preventDefault(); ask(inp) }}><input value={inp} onChange={e => setInp(e.target.value)} placeholder="Try: Germany, take the money?, best unders" /><button className="cta">Send</button></form>
    </div>}
  </>
}
