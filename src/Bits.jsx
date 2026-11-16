import React from 'react'
import * as M from './engine.js'
const pct = M.pct

/* our % vs the bookmaker's % (only when we have their odds) */
// "Bookies" = what the bookmakers' prices say (ESPN / The Odds API), shown only to compare with our own %
export function Vs({ v }) { if (!v) return null; return <span className={'vs' + (v.value ? ' val' : '')} title="What the bookmakers think, to compare with our %">Bookies {pct(v.book)}{v.odds ? ' · ' + v.odds.toFixed(2) : ''}{v.value ? ' 💰' : ''}</span> }
export function Strength({ st, small }) { if (!st) return null; return <div className={'strength s' + (st.sc >= 7 ? 'hi' : st.sc >= 5 ? 'md' : 'lo') + (small ? ' sm' : '')}><span className="sl">Ticket strength</span><span className="bar">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < st.sc ? 'on' : ''} />)}</span><b>{st.sc}/10 · {st.lab}</b></div> }
