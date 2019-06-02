import { statsEquals } from './statsEquals'
import { StatsModifyOptions } from '../interfaces'

describe('statsEquals', () => {
  it('return true if stats equals', () => {
    expect(statsEquals({ mode: 1 }, { mode: 1 })).toBe(true)
  })

  it('return false if stats equals', () => {
    expect(statsEquals({ mode: 2 }, { mode: 1 })).toBe(false)
  })

  it('ignore unknown properties', () => {
    expect(
      statsEquals({ mode: 1, isFile: () => true } as StatsModifyOptions, {
        mode: 1,
      }),
    ).toBe(true)
  })
})
