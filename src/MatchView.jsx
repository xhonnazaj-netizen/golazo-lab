import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as M from './engine.js'
import { BestPicks, LiveAdvisor } from './Tickets.jsx'
const { E } = M

/* ---------- small helpers ---------- */
const pct = M.pct, fo = M.fo
const f1 = (R, fn) => M.frac(R, fn)
export function useTick(ms){const[,s]=useState(0);useEffect(()=>{const i=setInterval(()=>s(x=>x+1),ms);return()=>clearInterval(i)},[ms])}

/* ---------- left match list ---------- */
export function MatchList(){
  const ids=(M.BOARD[E.CUR.lg+'|'+E.CUR.date]||[]).filter(e=>M.byE[e])
  if(!ids.length) return <aside id="side" className="card"><p className="empty">No games on this day. Change the date at the top.</p></aside>
  const grp={in:[],pre:[],post:[]};ids.forEach(e=>grp[M.S(e).state==='in'?'in':M.S(e).state==='post'?'post':'pre'].push(e))
  grp.pre.sort((a,b)=>new Date(M.S(a).date)-new Date(M.S(b).date))
  const liveOnly=M.PREF.strip==='live'
  const Row=({e})=>{const m=M.byE[e],s=M.S(e);const[c1,c2]=M.colors(m);const tk=M.inTickets(e)
    const t=s.state==='in'?<><span className="live-dot"/>{s.clock}</>:s.state==='post'?'FT':s.date?new Date(s.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''
    return <button className={'mrow'+(e===E.SEL?' on':'')} onClick={()=>M.selectMatch(e)}>
      <span className="mt">{t}</span>
      <span className="mn"><span><i style={{background:c1}}/>{m.h}</span><span><i style={{background:c2}}/>{m.a}</span></span>
      <span className="ms">{s.state!=='pre'&&<><b>{s.h}</b><b>{s.a}</b></>}</span>{tk?<span className="mtk">🎟</span>:<span/>}
    </button>}
  const Sec=({t,arr})=>arr.length?<><div className="sh">{t}</div>{arr.map(e=><Row key={e} e={e}/>)}</>:null
  return <aside id="side" className="card">
    <Sec t="Live" arr={grp.in}/>{!liveOnly&&<><Sec t="Upcoming" arr={grp.pre}/><Sec t="Finished" arr={grp.post}/></>}
    {liveOnly&&!grp.in.length&&<p className="empty">No live matches right now.</p>}
  </aside>
}

/* ---------- scoreboard ---------- */
export function Scoreboard(){
  const m=M.byE[E.SEL];if(!m)return null;const s=M.S(E.SEL),R=M.simOf(E.SEL);const[ch,ca]=M.colors(m)
  const H=f1(R,(R,n)=>R.GH[n]>R.GA[n]),D=f1(R,(R,n)=>R.GH[n]===R.GA[n]),A=1-H-D
  const st=s.state==='in'?<><span className="live-dot"/>LIVE · {s.clock}</>:s.state==='post'?'FINISHED':s.date?M.countdown(s.date):''
  return <div id="sb" className="scoreboard card">
    <div className="sbrow"><div className="sbt"><img src={M.logo(m,0)} alt=""/><span>{m.h}</span></div>
      <div className="sbs"><div className="sc">{s.state==='pre'?'VS':`${s.h} – ${s.a}`}</div><div className="st">{st}</div></div>
      <div className="sbt r"><span>{m.a}</span><img src={M.logo(m,1)} alt=""/></div></div>
    <div className="wbar big"><div style={{width:H*100+'%',background:ch}}/><div style={{width:D*100+'%',background:'#556'}}/><div style={{width:A*100+'%',background:ca}}/></div>
    <div className="wl big"><span><b className="tp">{pct(H)}</b> {m.hA} wins</span><span>Draw {pct(D)}</span><span>{m.aA} wins <b className="tp">{pct(A)}</b></span></div>
  </div>
}

/* ---------- pitch (stadium backdrop + players + shots + live pings) ---------- */
const {X0,Y0,PW,PH}=M
function backdrop(){let s='';let seed=7;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  s+=`<rect x="8" y="8" width="1184" height="744" rx="150" fill="#060a14" stroke="rgba(61,245,255,.35)" stroke-width="2"/>`
  const cols=['#2a3a55','#3b4d6b','#1d2a40']
  for(let ring=0;ring<7;ring++){const inset=24+ring*12,w=1200-2*inset,h=760-2*inset,rx=140-ring*12,per=2*(w+h),n=Math.floor(per/9)
    for(let k=0;k<n;k++){let t=k/n*per,x,y;if(t<w){x=inset+t;y=inset}else if(t<w+h){x=inset+w;y=inset+t-w}else if(t<2*w+h){x=inset+w-(t-w-h);y=inset+h}else{x=inset;y=inset+h-(t-2*w-h)}
      const cx=Math.min(Math.max(x,inset+rx*.3),inset+w-rx*.3),cy=Math.min(Math.max(y,inset+rx*.3),inset+h-rx*.3);if(Math.hypot(x-cx,y-cy)>2&&(x<inset+rx||x>inset+w-rx)&&(y<inset+rx||y>inset+h-rx))continue
      s+=`<rect x="${(x-2.5).toFixed(1)}" y="${(y-2.5).toFixed(1)}" width="5" height="5" rx="1.2" fill="${cols[Math.floor(r()*3)]}" opacity="${(.25+r()*.3).toFixed(2)}"/>`}}
  s+=`<rect x="112" y="76" width="976" height="608" rx="40" fill="#03060c" stroke="rgba(61,245,255,.25)"/><rect x="${X0-28}" y="${Y0-24}" width="${PW+56}" height="${PH+48}" rx="10" fill="#06301e"/>`
  s+=`<g clip-path="url(#pclip)"><rect x="${X0}" y="${Y0}" width="${PW}" height="${PH}" fill="url(#grass)"/>`
  for(let i=0;i<14;i+=2)s+=`<rect x="${X0+i*PW/14}" y="${Y0}" width="${PW/14}" height="${PH}" fill="rgba(255,255,255,.035)"/>`
  for(let i=1;i<20;i++)s+=`<line x1="${X0}" x2="${X0+PW}" y1="${Y0+i*PH/20}" y2="${Y0+i*PH/20}" stroke="rgba(61,245,255,.05)"/>`
  s+='</g>';const cx=X0+PW/2,cy=Y0+PH/2
  s+=`<g stroke="rgba(220,240,240,.75)" stroke-width="2" fill="none"><rect x="${X0}" y="${Y0}" width="${PW}" height="${PH}"/><line x1="${cx}" x2="${cx}" y1="${Y0}" y2="${Y0+PH}"/><circle cx="${cx}" cy="${cy}" r="73"/><circle cx="${cx}" cy="${cy}" r="3" fill="#cffff6"/>`
  ;[[X0,1],[X0+PW,-1]].forEach(([x,sg])=>{s+=`<rect x="${sg>0?x:x-135}" y="${cy-160}" width="135" height="320"/><rect x="${sg>0?x:x-45}" y="${cy-73}" width="45" height="146"/><circle cx="${x+sg*90}" cy="${cy}" r="2.5" fill="#cffff6"/><path d="M ${x+sg*135} ${cy-60} A 73 73 0 0 ${sg>0?1:0} ${x+sg*135} ${cy+60}"/><rect x="${sg>0?x-14:x}" y="${cy-29}" width="14" height="58" stroke="#3df5ff"/>`})
  s+='</g>';[[60,60],[1140,60],[60,700],[1140,700]].forEach(([x,y])=>{s+=`<circle cx="${x}" cy="${y}" r="200" fill="url(#flood)" opacity=".45" style="mix-blend-mode:screen"/><circle cx="${x}" cy="${y}" r="5" fill="#dfe9f3" opacity=".6"/>`})
  return s}
const DEFS=`<radialGradient id="flood" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e8fbff" stop-opacity=".55"/><stop offset="1" stop-color="#e8fbff" stop-opacity="0"/></radialGradient><linearGradient id="grass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0f5a3a"/><stop offset="1" stop-color="#083823"/></linearGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter><clipPath id="pclip"><rect x="${X0}" y="${Y0}" width="${PW}" height="${PH}"/></clipPath>`

function Players({onPick}){
  const m=M.byE[E.SEL],lu=M.LU[E.SEL];const[ch,ca]=M.colors(m);const s=M.S(E.SEL);const sh=M.sharesFor(E.SEL)||{};const[lh,la]=M.lamsNow(m,s)
  const out=[]
  ;['h','a'].forEach(side=>{const T=lu&&lu[side];if(!T||!T.players.length){out.push(<text key={side} x={side==='h'?X0+PW/4:X0+3*PW/4} y={Y0+PH/2} fill="#7f93ab" textAnchor="middle" fontFamily="Orbitron, Inter, sans-serif" fontSize="14">{lu?'Lineup not available yet':'Loading lineup…'}</text>);return}
    const col=side==='h'?ch:ca,tc=M.lum(col.slice(1))>.6?'#08101c':'#fff';const{gk,rows}=M.layout(T.players,T.f)
    const place=(p,x,y)=>{const gx=side==='h'?x:X0+PW-(x-X0),gy=side==='h'?y:Y0+PH-(y-Y0);const r=M.RT[p.id];const x2=sh[p.id];const pg=x2&&s.state!=='post'?1-Math.exp(-(side==='h'?lh:la)*x2.g):0
      out.push(<g key={p.id} className="plg" transform={`translate(${gx},${gy})`} opacity={p.subOut?.35:1} onClick={()=>onPick(p,side)}>
        <circle r="26" fill={col} opacity=".18" filter="url(#glow2)"/><circle className="body" r="18" fill={col} stroke="#fff" strokeOpacity=".85" strokeWidth="2" filter="url(#glow)"/>
        <text y="5" textAnchor="middle" fill={tc} fontFamily="Orbitron, Inter, sans-serif" fontWeight="700" fontSize="14">{p.jersey}</text>
        <text y="36" textAnchor="middle" fill="#e9f6ff" fontSize="12" fontWeight="600" style={{paintOrder:'stroke',stroke:'#02060c',strokeWidth:3}}>{p.short.slice(0,13)}</text>
        {r&&<g transform="translate(16,-18)"><polygon points="0,-10 9,-5 9,5 0,10 -9,5 -9,-5" fill={r.OVR>=80?'#ffd25a':r.OVR>=70?'#c9d6e3':'#d48a5a'} stroke="#02060c"/><text y="4" textAnchor="middle" fontFamily="Orbitron, Inter, sans-serif" fontWeight="900" fontSize="9" fill="#0a0f18">{r.OVR}</text></g>}
        {pg>=.18&&<text y="-26" textAnchor="middle" fontFamily="Orbitron, Inter, sans-serif" fontSize="10" fill="#a6ff4d">{Math.round(pg*100)}% ⚽</text>}
        {p.id===E.FLASH&&<circle className="pulse" r="18" fill="none" stroke="#ff3d9a" strokeWidth="3"/>}</g>)}
    if(gk)place(gk,X0+34,Y0+PH/2);const n=rows.length;rows.forEach((row,i)=>{const x=X0+110+i*((PW/2-150)/Math.max(n-1,1));row.forEach((p,j)=>place(p,x,Y0+PH*(j+1)/(row.length+1)))})})
  return <g opacity={E.VIEW==='shots'?.18:1}>{out}</g>
}
function Shots(){const s=M.S(E.SEL);const[ch,ca]=M.colors(M.byE[E.SEL]);if(E.VIEW==='players')return null
  if(!s.shots.length)return <text x={X0+PW/2} y={Y0+PH/2+110} textAnchor="middle" fill="#7f93ab" fontFamily="Orbitron, Inter, sans-serif" fontSize="13">Shots appear here during the match</text>
  return <g>{s.shots.map((z,i)=>{const[x,y]=M.shotXY(z);const r=5+Math.sqrt(z.xg)*22;const c=z.side?ca:ch
    return <g key={i} transform={`translate(${x},${y})`}><circle r={r} fill={c} fillOpacity={z.goal?.9:z.on?.45:.18} stroke={z.goal?'#ff3d9a':c} strokeWidth={z.goal?3:1.5}/><title>{`${z.mi}' ${z.who} · xG ${z.xg.toFixed(2)}${z.goal?' · GOAL':''}`}</title>{z.goal&&<text y="4" textAnchor="middle" fontSize="11" fill="#fff">⚽</text>}</g>})}</g>}
function Ball(){const ref=useRef();useEffect(()=>{let b={x:600,y:380,vx:0,vy:0},raf
  const step=()=>{const s=M.S(E.SEL);const pr=M.pressureAt(s,s.min||0);let bias=50;if(s.state==='in'){const t=pr[0]+pr[1];bias=t>.05?50+50*(pr[0]-pr[1])/t:(s.boxh&&s.boxh.possessionPct)||50}
    const tx=X0+PW/2+(bias-50)/50*PW*.38,live=s.state==='in';b.vx+=(tx-b.x)*.0008+(Math.random()-.5)*(live?.35:.1);b.vy+=(Y0+PH/2-b.y)*.0006+(Math.random()-.5)*(live?.35:.1);b.vx*=.95;b.vy*=.95
    b.x=M.clamp(b.x+b.vx,X0+20,X0+PW-20);b.y=M.clamp(b.y+b.vy,Y0+20,Y0+PH-20);if(ref.current)ref.current.setAttribute('transform',`translate(${b.x},${b.y})`);raf=requestAnimationFrame(step)}
  raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf)},[])
  if(E.VIEW==='shots')return null
  return <g ref={ref}><circle r="14" fill="#fff" opacity=".15" filter="url(#glow2)"/><circle r="6" fill="#fff" filter="url(#glow)"/></g>}
function Pings(){useTick(250);const now=Date.now();const P=M.PING.filter(p=>now-p.t<7000)
  return <g>{P.map((p,i)=>{const a=(now-p.t)/7000,r=10+40*((now-p.t)%1400)/1400;return <g key={i} opacity={(1-a).toFixed(2)}><circle cx={p.x} cy={p.y} r={r} fill="none" stroke={p.c} strokeWidth="2.5"/><circle cx={p.x} cy={p.y} r="6" fill={p.c}/><text x={M.clamp(p.x,X0+90,X0+PW-90)} y={p.y<Y0+60?p.y+34:p.y-18} textAnchor="middle" fontFamily="Orbitron, Inter, sans-serif" fontSize="13" fill="#fff" style={{paintOrder:'stroke',stroke:'#02060c',strokeWidth:4}}>{p.txt}</text></g>})}</g>}

export function Pitch({onPick}){
  const bg=useMemo(backdrop,[]);const tilt=false
  const vb=M.PREF.pitch==='large'?'0 0 1200 760':'128 70 944 620'
  if(M.PREF.pitch==='hidden')return null
  return <div className="stage" id="stage">
    <svg id="sv" viewBox={vb} style={{transition:'transform .8s',transform:tilt?'perspective(1400px) rotateX(38deg) scale(.92)':''}}>
      <defs dangerouslySetInnerHTML={{__html:DEFS}}/><g dangerouslySetInnerHTML={{__html:bg}}/>
      <Shots/><Players onPick={onPick}/><Ball/><Pings/></svg>
    <div className="toolbar">
      <button onClick={()=>{E.VIEW=E.VIEW==='players'?'shots':E.VIEW==='shots'?'both':'players'}}>Show: {({players:'players',shots:'shots',both:'both'})[E.VIEW]}</button>
            <button onClick={()=>{E.SOUND=!E.SOUND;if(E.SOUND)M.beep([700])}}>Sound: {E.SOUND?'on':'off'}</button>
            <button onClick={async()=>{const ok=await M.enableNotif();if(!ok)M.alertMsg('warn','Your browser blocked alerts. Sound still works.')}}>Alerts: {E.NOTIF?'on':'off'}</button>
    </div></div>
}

/* ---------- momentum ---------- */
export function Momentum(){
  if(!M.PREF.mom)return null
  const s=M.S(E.SEL),m=M.byE[E.SEL];const[ch,ca]=M.colors(m);const w=1200,h=170,mid=h/2,x=t=>40+t/90*(w-80)
  const grid=[0,15,30,45,60,75,90].map(t=><g key={t}><line x1={x(t)} x2={x(t)} y1="12" y2={h-12} stroke="rgba(61,245,255,.08)"/><text x={x(t)} y={h-2} textAnchor="middle" fill="#7f93ab" fontSize="10">{t}'</text></g>)
  let body
  if(s.state==='pre')body=<text x={w/2} y={mid-8} textAnchor="middle" fill="#7f93ab" fontSize="13">Chart starts when the match starts</text>
  else{const end=s.state==='post'?90:Math.min(90,s.min||0);let ph=`M ${x(0)} ${mid}`,pa=ph;const sc=70/.9
    for(let t=0;t<=end;t++){const p=M.pressureAt(s,t);ph+=` L ${x(t)} ${mid-Math.min(70,p[0]*sc)}`;pa+=` L ${x(t)} ${mid+Math.min(70,p[1]*sc)}`}
    ph+=` L ${x(end)} ${mid} Z`;pa+=` L ${x(end)} ${mid} Z`
    body=<><path d={ph} fill={ch} fillOpacity=".45" stroke={ch} strokeWidth="1.5"/><path d={pa} fill={ca} fillOpacity=".45" stroke={ca} strokeWidth="1.5"/>
      {s.shots.filter(z=>z.goal).map((z,i)=><text key={i} x={x(z.mi)} y={z.side?h-26:24} textAnchor="middle" fontSize="13">⚽</text>)}
      <line x1={x(end)} x2={x(end)} y1="10" y2={h-10} stroke="#ff3d9a" strokeWidth="1.5" strokeDasharray="3 3"/></>}
  return <svg id="mom" viewBox={`0 0 ${w} ${h}`}><line x1="40" x2={w-40} y1={mid} y2={mid} stroke="rgba(61,245,255,.35)"/>{grid}
    <text x="44" y="16" fill={ch} fontSize="11">{m.hA} pressure</text><text x="44" y={h-16} fill={ca} fontSize="11">{m.aA} pressure</text>{body}</svg>
}

/* ---------- how they're playing + live bets ---------- */
function Playing(){const m=M.byE[E.SEL],s=M.S(E.SEL);if(s.state!=='in'||!M.PREF.playing)return null;const[ch,ca]=M.colors(m)
  const el=1-M.remFrac(s),exH=m.lam[0]*el,exA=m.lam[1]*el
  const l15=[0,1].map(sd=>s.shots.filter(z=>z.side===sd&&z.mi>s.min-15).reduce((a,z)=>a+z.xg,0)),sot=[0,1].map(sd=>s.shots.filter(z=>z.side===sd&&z.on).length)
  const pr=M.pressureAt(s,s.min),tot=pr[0]+pr[1],share=tot>.05?pr[0]/tot:.5
  const V=({x,ex,name})=>x>ex*1.35&&x-ex>.35?<div><span className="ok">{name} creating more than expected</span> ({x.toFixed(2)} xG vs {ex.toFixed(2)})</div>:x<ex*.6&&ex-x>.35?<div><span className="ko">{name} creating less than expected</span> ({x.toFixed(2)} xG vs {ex.toFixed(2)})</div>:<div>{name} about as expected ({x.toFixed(2)} xG vs {ex.toFixed(2)})</div>
  return <div className="lvcard"><h3>How the game is going <span className="sub">{s.clock}</span></h3>
    <div className="pbar"><div style={{width:share*100+'%',background:ch}}/><div style={{width:(1-share)*100+'%',background:ca}}/></div>
    <div className="sub" style={{margin:'4px 0 8px'}}>{share>.65?<><b style={{color:ch}}>{m.h}</b> on top in the last 10 min</>:share<.35?<><b style={{color:ca}}>{m.a}</b> on top in the last 10 min</>:'Even in the last 10 min'}</div>
    <div className="pl3"><span/><b>{m.hA}</b><b>{m.aA}</b><span>Chances (last 15 min)</span><span>{s.xh.toFixed(2)} ({l15[0].toFixed(2)})</span><span>{s.xa.toFixed(2)} ({l15[1].toFixed(2)})</span><span>Shots on goal</span><span>{sot[0]}</span><span>{sot[1]}</span><span>Corners</span><span>{s.ch}</span><span>{s.ca}</span></div>
    <div className="sub" style={{marginTop:6,lineHeight:1.5}}><V x={s.xh} ex={exH} name={m.h}/><V x={s.xa} ex={exA} name={m.a}/></div></div>}
function Bets(){const m=M.byE[E.SEL],s=M.S(E.SEL);if(s.state==='post'||M.PREF.bets===false)return null
  const list=M.liveBets(m,s).slice(0,5);const lo=M.LO[E.SEL];const live=lo&&lo.live&&Date.now()-lo.t<360000
  return <div className="lvcard"><h3>{s.state==='in'?'Bets now':'Bets before the match'} <span className="sub">{m.hA}–{m.aA}</span></h3>
    <div className="lb lbh"><span>Bet</span><span>Chance</span><span>Bet if the bookie pays</span><span>{live?'bookie now':''}</span></div>
    {list.map(b=><div key={b.n} className={'lb'+(b.ev!=null&&b.ev>.03?' good':'')}><span>{M.nice(b.n)}</span><span className="orb">{pct(b.p)}</span><span className="orb">{b.min.toFixed(2)}+</span><span className={'orb '+(b.ev!=null&&b.ev>.03?'ok':'sub')}>{b.od?b.od.toFixed(2)+(b.ev>.03?' ✦':''):''}</span></div>)}
    <p className="sub" style={{margin:'8px 0 0',lineHeight:1.5}}>Only bet if the bookie pays at least that number. If it pays less, skip it.{live?' ✦ = the bookie pays more than we expect right now.':''}</p></div>}
export function LivePane({onPick}){return <div className="livegrid"><div className="lcol"><Pitch onPick={onPick}/><Momentum/></div><div className="rcol" id="livex"><LiveAdvisor eid={E.SEL}/><Playing/><Bets/></div></div>}

/* ---------- all markets ---------- */
export function MarketsPane({onPick}){const[tab,setTab]=useState('Result');const m=M.byE[E.SEL],s=M.S(E.SEL),R=M.simOf(E.SEL);const lo=M.LO[E.SEL];const[busy,setBusy]=useState(false)
  const G=['Result','Goals','Halves','Corners','Cards','Score','Players']
  let rows
  if(tab==='Players'){const lu=M.LU[E.SEL],sh=M.sharesFor(E.SEL);if(!lu||!sh)rows=<p className="empty">Loading players…</p>;else{const[lh,la]=M.lamsNow(m,s);const L=[]
    ;['h','a'].forEach(side=>(lu[side].players||[]).forEach(p=>{const x=sh[p.id];if(!x)return;const l=side==='h'?lh:la;L.push([p,side,1-Math.exp(-l*x.g),1-Math.exp(-l*x.a)])}));L.sort((a,b)=>b[2]-a[2])
    rows=L.slice(0,16).map(([p,side,pg,pa])=><div key={p.id} className="mk" style={{cursor:'pointer'}} onClick={()=>onPick(p,side)}><span>{p.name}<br/><span className="sub">{side==='h'?m.hA:m.aA} · assist {pct(pa)}</span></span><span className="p">{pct(pg)}</span><span className="o">{fo(pg)}</span><span className="b">–</span><span/></div>)}}
  else{let L=M.markets(m).filter(x=>x.g===tab).map(x=>({...x,p:M.frac(R,x.f)+(x.pu?M.frac(R,x.pu):0)}));if(tab==='Score')L=L.sort((a,b)=>b.p-a.p).slice(0,10)
    rows=L.map(x=>{const od=x.k&&((lo&&lo.o[x.k])||(!lo&&m.odds&&m.odds[x.k]));const ev=od?x.p*od-1:null
      return <div key={x.n} className="mk"><span>{x.n}</span><span className="p">{pct(x.p)}</span><span className="o">{fo(x.p)}</span><span className={'b '+(ev!=null&&ev>.03?'val':'neg')}>{od?od.toFixed(2)+(ev>.03?' ✦':''):'–'}</span>
        <button className="add" title="Add to a new ticket" onClick={()=>{if(!E.DRAFT.some(l=>l.eid===E.SEL&&l.n===x.n)){M.setDraft([...E.DRAFT,{eid:E.SEL,lg:m.lg,date:E.CUR.date,n:x.n,o:null}]);M.alertMsg('info','Added to your new ticket: '+m.hA+'–'+m.aA+' '+x.n)}}}>+</button></div>})}
  return <div><div className="tabs">{G.map(g=><button key={g} className={g===tab?'on':''} onClick={()=>setTab(g)}>{g}</button>)}</div>
    <div className="mk" style={{color:'var(--mut)',fontSize:11,border:0}}><span>Pick</span><span style={{textAlign:'right'}}>Chance</span><span style={{textAlign:'right'}}>Fair</span><span style={{textAlign:'right'}}>{lo?`Bookie (${lo.live?'live':'pre-match'})`:'Bookie'}</span><span/></div>
    {rows}
    <p className="sub" style={{margin:'8px 0 0'}}>{M.hasOddsKey()&&<button style={{fontSize:11,padding:'3px 8px'}} disabled={busy} onClick={async()=>{setBusy(true);await M.refreshOdds();setBusy(false)}}>{busy?'Loading…':'Refresh live odds'}</button>} {M.hasOddsKey()&&E.LOC!=null?`Live odds credits left: ${E.LOC} · `:''} ✦ the bookmaker pays more than our fair price · + adds a pick to a new ticket</p></div>}

/* ---------- stats / events / lineups ---------- */
export function StatsPane(){const s=M.S(E.SEL),m=M.byE[E.SEL],[ch,ca]=M.colors(m),h=s.boxh,a=s.boxa
  if(!h||!a||s.state==='pre'){const R=M.simOf(E.SEL);let c=0,y=0;for(let n=0;n<R.N;n++){c+=R.CH[n]+R.CA[n];y+=R.Y[n]}c/=R.N;y/=R.N
    return <div><p className="sub" style={{margin:'0 0 6px'}}>Stats appear at kick-off. The model expects:</p><div className="big3"><div><div className="v">{m.lam[0].toFixed(1)}–{m.lam[1].toFixed(1)}</div><div className="l">Goals</div></div><div><div className="v">{c.toFixed(1)}</div><div className="l">Corners</div></div><div><div className="v">{y.toFixed(1)}</div><div className="l">Yellow cards</div></div></div></div>}
  const Row=({lb,k,pc,vh,va})=>{const x=vh!=null?vh:(h[k]||0),y=va!=null?va:(a[k]||0),t=x+y||1;return <div className="stat"><div className="lb">{lb}</div><span className="n">{pc?x+'%':x}</span><div className="bar"><div style={{width:x/t*100+'%',background:ch}}/><div style={{width:y/t*100+'%',background:ca}}/></div><span className="n">{pc?y+'%':y}</span></div>}
  return <div><Row lb="Expected goals (our xG)" vh={+s.xh.toFixed(2)} va={+s.xa.toFixed(2)}/><Row lb="Possession" k="possessionPct" pc/><Row lb="Shots" k="totalShots"/><Row lb="On target" k="shotsOnTarget"/><Row lb="Corners" k="wonCorners"/><Row lb="Yellow cards" k="yellowCards"/><Row lb="Red cards" k="redCards"/><Row lb="Offsides" k="offsides"/><Row lb="Fouls" k="foulsCommitted"/><Row lb="Saves" k="saves"/></div>}
export function EventsPane(){const s=M.S(E.SEL);if(!s.ev.length)return <p className="empty">Goals, cards and substitutions appear here live.</p>
  return <div>{s.ev.slice().reverse().map((e,i)=>{const ic=/own/.test(e.ty)?'⚽ (og)':/goal|penalty---scored/.test(e.ty)?'⚽':/red/.test(e.ty)?'🟥':/yellow/.test(e.ty)?'🟨':/substitution/.test(e.ty)?'🔁':'•';return <div key={i} className="ev"><span className="c">{e.c}</span><span>{ic}</span><span>{e.tx||e.pl.join(', ')}</span></div>})}</div>}
export function LineupsPane({onPick}){const lu=M.LU[E.SEL],m=M.byE[E.SEL];if(!lu)return <p className="empty">Loading lineups…</p>
  return <div><p className="sub" style={{margin:'0 0 8px'}}>{lu.h.f||'?'} vs {lu.a.f||'?'} · {m.hA}: {lu.h.src} · {m.aA}: {lu.a.src}</p>
    <div className="lineups">{['h','a'].map(side=>{const T=lu[side];const sorted=T.players.slice().sort((x,y)=>(y.starter-x.starter)||M.depth(x)-M.depth(y));return <div key={side}><b className="orb" style={{fontSize:12}}>{side==='h'?m.h:m.a}</b>
      {sorted.map((p,i)=><React.Fragment key={p.id}>{!p.starter&&(i===0||sorted[i-1].starter)&&<div className="sub" style={{marginTop:6}}>Bench</div>}
        <div className="pl" onClick={()=>onPick(p,side)}><span className="r">{M.RT[p.id]?M.RT[p.id].OVR:'··'}</span><span>{p.jersey} {p.name}</span><span className="sub">{p.pos}{p.subIn?' ↑':''}{p.subOut?' ↓':''}</span></div></React.Fragment>)}</div>})}</div></div>}

/* ---------- form & context ---------- */
export function ContextPane(){const m=M.byE[E.SEL];const[,force]=useState(0);const c=M.CTX[E.SEL],f=M.FORM[E.SEL],lu=M.LU[E.SEL]
  useEffect(()=>{let on=true;Promise.all([M.loadContext(m),M.loadForm(m)]).then(()=>on&&force(x=>x+1));return()=>{on=false}},[E.SEL])
  const Line=({side,name})=>{const st=lu&&lu.str&&lu.str[side];const ev=(f&&f[side])||[];const pts=ev.reduce((a,e)=>a+(e.r==='W'?3:e.r==='D'?1:0),0)
    return <div style={{marginBottom:12}}><b className="orb" style={{fontSize:12}}>{name}</b>
      <div className="sub">{c?(c[side]||'No table position found'):'Loading…'}{c&&c['r'+side]!=null?` · ${c['r'+side]} days since last match`:''}</div>
      {st&&<div className={st.now-st.prev<-1.5?'ko':st.now-st.prev>1.5?'ok':'sub'}>Lineup rating {st.now.toFixed(1)} vs {st.prev.toFixed(1)} last match{st.out.length?' · out: '+st.out.slice(0,4).join(', '):''}</div>}
      {ev.length>0&&<><div className="form">{ev.map((e,i)=><span key={i} className={'fr '+e.r} title={`${(e.d||'').slice(0,10)} ${e.at||''} ${e.op||''} ${e.sc||''}`}>{e.r||'?'}</span>)}<span className="sub" style={{marginLeft:6}}>{pts} pts from last {ev.length}</span></div>
        <div className="sub" style={{fontSize:11}}>{ev.map(e=>`${e.at==='@'?'@':'v'} ${e.op} ${e.sc}`).join(' · ')}</div></>}</div>}
  const a=M.OH[E.SEL]||[];const[c1,c2]=M.colors(m)
  let chart=<p className="sub">Odds movement: {a.length?'1 snapshot so far':'no snapshots yet'}. A point is saved each time prices load.</p>
  if(a.length>=2){const W=320,H=90,t0=a[0].t,t1=a[a.length-1].t,x=t=>8+(t-t0)/Math.max(1,t1-t0)*(W-16),y=p=>H-8-p*(H-16);const line=(k,col)=><path d={a.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(1)+' '+y(p[k]).toFixed(1)).join(' ')} fill="none" stroke={col} strokeWidth="2"/>
    chart=<><svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:520,height:'auto'}}>{line('h',c1)}{line('d','#8899aa')}{line('a',c2)}</svg><div className="sub" style={{fontSize:11}}>{a.length} snapshots of the implied chances ({m.hA}, draw, {m.aA})</div></>}
  return <div><Line side="h" name={m.h}/><Line side="a" name={m.a}/>{f&&f.h2h&&f.h2h.length>0&&<><h3>Head to head this season</h3>{f.h2h.map((x,i)=><div key={i} className="sub">{(x.d||'').slice(0,10)} · {x.sc}</div>)}</>}
    <h3 style={{marginTop:14}}>Odds movement</h3>{chart}{m.note&&<p className="sub">{m.note}</p>}</div>}

/* ---------- player card ---------- */
export function PlayerCard({p,side,onClose}){const[r,setR]=useState(M.RT[p.id]||null);useEffect(()=>{M.rate(p).then(setR).catch(()=>setR(false))},[p.id])
  const m=M.byE[E.SEL];const sh=(M.sharesFor(E.SEL)||{})[p.id];const[lh,la]=M.lamsNow(m,M.S(E.SEL));const l=side==='h'?lh:la;const pg=sh?1-Math.exp(-l*sh.g):0,pa=sh?1-Math.exp(-l*sh.a):0
  const myShots=M.S(E.SEL).shots.filter(x=>x.who&&p.name.includes(x.who.split(' ').slice(-1)[0]))
  return <div className="modalbg" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>{r===null?<div className="pc"><p className="sub" style={{textAlign:'center',margin:'40px 0'}}>Loading player…</p></div>:r===false?<div className="pc"><button className="x" onClick={onClose}>✕</button><p className="err">Could not load this player.</p></div>:
    <div className={'pc '+(r.OVR>=80?'t1':r.OVR>=70?'t2':'t3')}><div className="glow"/><button className="x" onClick={onClose} aria-label="Close">✕</button>
      <div className="top"><div><div className="ov">{r.OVR}</div><div className="ps">{({G:'GK',D:'DEF',M:'MID',AM:'AM',F:'FWD'})[r.role]} · {p.pos}</div></div>{r.flag&&<img src={r.flag} alt="" style={{width:46,height:32,objectFit:'cover',borderRadius:4,marginLeft:'auto',marginRight:24}}/>}</div>
      <div className="nm">{p.name}</div><div className="cl">#{p.jersey} · {r.club||'Club unknown'}{r.age?' · '+r.age:''}</div>
      <div className="at">{[['ATK','ATK'],['CRE','CRE'],['SHT','SHT'],['DIS','DIS'],['EXP','EXP'],['FORM','FRM']].map(([l,k])=><div key={k}><span>{l}</span><b>{r[k]}</b></div>)}</div>
      <div className="sl">{r.has?r.seasons.map((s,i)=><div key={i}>{s[0]}: {s[1]} starts, {s[2]} goals, {s[3]} assists</div>):'No club stats found, rating uses defaults.'}{myShots.length>0&&<div>This match: {myShots.length} shots, {myShots.reduce((a,x)=>a+x.xg,0).toFixed(2)} xG</div>}</div>
      <div className="live"><div>Scores {M.S(E.SEL).state==='in'?'from now':'this match'}<b>{pct(pg)}</b></div><div>Assists<b>{pct(pa)}</b></div></div>
      <p className="sub" style={{margin:'10px 0 0',fontSize:10}}>Our model's ratings from club stats, not official game ratings.</p></div>}</div>}

/* ---------- the match view ---------- */
export function MatchView(){const[tab,setTab]=useState('pLive');const[pick,setPick]=useState(null)
  const T=[['pLive','Live'],['pMk','All bets'],['pSt','Stats'],['pEv','What happened'],['pLu','Who plays'],['pCx','Recent games']].filter(([k])=>k==='pLive'||M.PREF[k]!==false)
  const cur=T.find(t=>t[0]===tab)?tab:'pLive';const onPick=(p,side)=>setPick({p,side})
  if(!M.byE[E.SEL])return <main className="app"><MatchList/><section id="center"><p className="empty">Loading matches…</p></section></main>
  return <main className="app"><MatchList/><section id="center"><Scoreboard/><BestPicks eid={E.SEL}/>
    <div className="card ctr"><div className="tabs">{T.map(([k,l])=><button key={k} className={k===cur?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {cur==='pLive'&&<LivePane onPick={onPick}/>}{cur==='pMk'&&<MarketsPane onPick={onPick}/>}{cur==='pSt'&&<StatsPane/>}{cur==='pEv'&&<EventsPane/>}{cur==='pLu'&&<LineupsPane onPick={onPick}/>}{cur==='pCx'&&<ContextPane/>}</div></section>
    {pick&&<PlayerCard p={pick.p} side={pick.side} onClose={()=>setPick(null)}/>}</main>}
