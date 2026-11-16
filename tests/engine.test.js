// Unit tests for the Golazo Lab maths. Run: npm test
import { describe, it, expect } from 'vitest'
import * as M from '../src/engine.js'

const eid = M.DATA.M[0].eid
const m = M.byE[eid]
const P = n => { const x = M.markets(m).find(k => k.n === n); return M.frac(M.simOf(eid), x.f) }

describe('match probabilities', () => {
  it('home + draw + away = 100%', () => {
    expect(P(`${m.h} win`) + P('Draw') + P(`${m.a} win`)).toBeCloseTo(1, 6)
  })
  it('over and under on the same line add up to 100%', () => {
    for (const l of [0.5, 1.5, 2.5, 3.5]) expect(P(`Over ${l}`) + P(`Under ${l}`)).toBeCloseTo(1, 6)
  })
  it('double chance = win + draw', () => {
    expect(P(`${m.h} or draw`)).toBeCloseTo(P(`${m.h} win`) + P('Draw'), 6)
  })
  it('half-time goals never exceed full-time goals', () => {
    const R = M.simOf(eid)
    for (let n = 0; n < R.N; n += 97) { expect(R.H1H[n]).toBeLessThanOrEqual(R.GH[n]); expect(R.H1A[n]).toBeLessThanOrEqual(R.GA[n]) }
  })
  it('about 44% of goals fall in the first half (measured on 19,760 games)', () => {
    const R = M.simOf(eid); let h1 = 0, ft = 0
    for (let n = 0; n < R.N; n++) { h1 += R.H1H[n] + R.H1A[n]; ft += R.GH[n] + R.GA[n] }
    expect(h1 / ft).toBeGreaterThan(0.40); expect(h1 / ft).toBeLessThan(0.48)
  })
  it('win to nil is never more likely than the win', () => {
    expect(P(`${m.h} win to nil`)).toBeLessThanOrEqual(P(`${m.h} win`))
  })
})

describe('team ratings', () => {
  it('knows national teams and their aliases', () => {
    expect(M.eloOf('Germany')).toBeGreaterThan(1800)
    expect(M.eloOf('Türkiye')).toBe(M.eloOf('Turkey'))
    expect(M.eloOf('Not A Team')).toBeNull()
  })
})

describe('1win words and stars', () => {
  it('uses 1win names for the bets', () => {
    expect(M.nice('Over 2.5')).toBe('Total Over 2.5')
    expect(M.nice('Under 3.5 yellows')).toBe('Yellow cards Total Under 3.5')
    expect(M.nice(`${m.h} win`, m)).toBe('W1 · ' + m.h)
    expect(M.nice(`${m.a} or draw`, m)).toBe('X2 · ' + m.a + ' or draw')
    expect(M.nice('Draw')).toBe('X · Draw')
  })
  it('only suggests 1X2, Total Over/Under and cards', () => {
    expect(M.shown(`${m.h} win`)).toBe(true)
    expect(M.shown('Over 2.5')).toBe(true)
    expect(M.shown('Over 3.5 yellows')).toBe(true)
    expect(M.shown('Over 9.5 corners')).toBe(false)
    expect(M.shown('Both teams score')).toBe(false)
    expect(M.marketsShown(m).every(x => M.shown(x.n))).toBe(true)
  })
  it('rates result bets easiest', () => {
    expect(M.predictability('Germany win')).toBe(3)
    expect(M.predictability('Over 2.5')).toBe(1)
  })
})

describe('own model, not the bookies', () => {
  it('our % do not change when bookmaker odds change', () => {
    const before = P(`${m.h} win`)
    const old = m.odds; m.odds = { H: 1.2, D: 7, A: 15 }
    expect(P(`${m.h} win`)).toBeCloseTo(before, 6)
    m.odds = old
  })
  it('bookies % is shown separately, margin removed', () => {
    const old = m.odds; m.odds = { H: 2.0, D: 3.4, A: 3.8 }
    const b = M.bookOdds(m, `${m.h} win`)
    expect(b.o).toBe(2.0); expect(b.p).toBeGreaterThan(0.45); expect(b.p).toBeLessThan(0.5)
    m.odds = old
  })
})

describe('ticket strength and protection', () => {
  it('strength comes from each bet, safer bets score higher', () => {
    expect(M.strengthOf([0.9, 0.9, 0.9]).sc).toBeGreaterThan(M.strengthOf([0.6, 0.6, 0.6]).sc)
    expect(M.strengthOf([0.9, 0.9, 0.4]).sc).toBeLessThan(M.strengthOf([0.9, 0.9, 0.9]).sc)
    expect(M.strengthOf([0.95, 0.95]).sc).toBeLessThanOrEqual(10)
  })
  it('protection offers a safer bet in the same game', () => {
    const t = { id: 'x', stake: 2000, odds: 5, legs: [{ eid, lg: m.lg, date: '20261116', n: `${m.h} win`, o: null }, { eid: M.DATA.M[1].eid, lg: m.lg, date: '20261116', n: 'Over 1.5', o: null }] }
    const pr = M.protection(t)
    expect(pr).not.toBeNull()
    if (pr.swap) expect(pr.swap.p).toBeGreaterThan(pr.weakest.p)
    if (pr.cover) expect(pr.cover.stake).toBeGreaterThan(0)
  })
})

describe('ready combinations', () => {
  it('every ready ticket reaches our odds of 4 or more, one bet per game, only allowed bets', () => {
    const C = M.combos('20261116')
    expect(C.length).toBeGreaterThan(0)
    for (const c of C.filter(c => !c.wait)) {
      expect(c.fair).toBeGreaterThanOrEqual(4)
      expect(new Set(c.legs.map(l => l.eid)).size).toBe(c.legs.length)
      expect(c.legs.every(l => M.shown(l.n))).toBe(true)
      if (c.id === 'f9') expect(c.legs.length).toBe(9)
      if (c.id === 'b6') expect(c.legs.length).toBe(6)
    }
    expect(C.some(c => c.id === 'cor' || c.id === 'mix')).toBe(false)
  })
})

describe('Dixon-Coles blend (penaltyblog ratings)', () => {
  it('has Dixon-Coles ratings for the big national teams', async () => {
    const R = await import('../src/model/ratings.js')
    const m = { h: 'Germany', a: 'Netherlands', neu: false }
    const d = R.dcLam(m); expect(d).not.toBeNull()
    const e = R.eloLam(m); expect(e[0]).toBeGreaterThan(0.5); expect(e[0]).toBeLessThan(3.5)
  })
  it('neutral venue removes home advantage', async () => {
    const R = await import('../src/model/ratings.js')
    const a = R.dcLam({ h: 'Spain', a: 'France', neu: false }), b = R.dcLam({ h: 'Spain', a: 'France', neu: true })
    expect(b[0]).toBeLessThan(a[0]); expect(b[1]).toBeCloseTo(a[1], 6)
  })
})

describe('assistant team database', () => {
  it('finds teams in English and Spanish, and clubs', async () => {
    const D = await import('../src/model/teamdb.js')
    expect(D.findTeams('como viene Alemania')[0].name).toBe('Germany')
    expect(D.findTeams('Spain v France')[1].name).toBe('France')
    expect(D.findTeams('real madrid cards')[0]).toMatchObject({ name: 'Real Madrid', kind: 'cl' })
    expect(D.findTeams('Northern Ireland').map(t => t.name)).toEqual(['Northern Ireland'])
  })
  it('gives form, goals and head to head', async () => {
    const D = await import('../src/model/teamdb.js')
    const I = D.teamInfo('Spain', 'nt'); expect(I.last.length).toBe(10); expect(I.rank.rank).toBeLessThan(15)
    const H = D.h2h('Spain', 'France', 'nt'); expect(H.all).toBeGreaterThan(0)
    const C = D.teamInfo('Barcelona', 'cl'); expect(C.y).toBeGreaterThan(0)
    expect(D.glossary('what is X2?')[0].t).toBe('X2')
  })
})

describe('this season replay', () => {
  it('a national win after the snapshot raises the winner', async () => {
    const R = await import('../src/model/ratings.js')
    const before = R.eloOf('Germany')
    expect(R.applyNationalGames([{ d: '2099-01-01', h: 'Germany', a: 'Spain', hs: 3, as: 0, neu: true, t: 'qualification' }])).toBe(1)
    expect(R.eloOf('Germany')).toBeGreaterThan(before)
  })
  it('club season adds promoted teams and moves ratings', async () => {
    const R = await import('../src/model/ratings.js')
    const n = R.applyClubSeason('eng.1', [{ d: '2099-08-20', h: 'Arsenal', a: 'Brand New FC', hs: 4, as: 0, yh: 1, ya: 3 }])
    expect(n).toBe(1)
    expect(R.clubKey('eng.1', 'Brand New FC')).toBe('Brand New FC')
    expect(R.clubLam({ lg: 'eng.1', h: 'Arsenal', a: 'Brand New FC' })[0]).toBeGreaterThan(1.5)
  })
})
