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

describe('plain words and stars', () => {
  it('explains over/under lines', () => {
    expect(M.nice('Over 2.5')).toBe('Over 2.5 · 3+ goals')
    expect(M.nice('Under 3.5')).toBe('Under 3.5 · 3 or fewer goals')
  })
  it('rates result bets easiest and total corners hardest', () => {
    expect(M.predictability('Germany win')).toBe(3)
    expect(M.predictability('Germany more corners')).toBe(2)
    expect(M.predictability('Over 9.5 corners')).toBe(1)
  })
})

describe('ready combinations', () => {
  it('every ready ticket reaches fair odds of 4 or more, one bet per game', () => {
    const C = M.combos('20261116')
    expect(C.length).toBeGreaterThan(0)
    for (const c of C) {
      expect(c.fair).toBeGreaterThanOrEqual(4)
      expect(new Set(c.legs.map(l => l.eid)).size).toBe(c.legs.length)
    }
  })
})
