import { describe, expect, it } from 'vitest'
import { game, parseSaved } from './store.ts'

describe('saved progress', () => {
  it('starts afresh from nothing, or from something broken', () => {
    for (const raw of [null, '', 'not json', '[]', '{"settings": 5}']) {
      const s = parseSaved(raw)
      expect(s.scene).toBe('beach')
      expect(s.settings).toEqual({ sound: false, volume: 0.8, motion: 'auto', simple: false })
      expect(s.progress.visited).toEqual([])
    }
  })

  it('keeps what makes sense and drops what doesn’t', () => {
    const s = parseSaved(
      JSON.stringify({
        scene: 'summit',
        settings: { sound: true, volume: 3, motion: 'reduced', simple: 'yes' },
        progress: { visited: ['beach', 'atlantis', 7], stamps: { a: 1, b: 'x' }, photos: 2.7, badges: ['summit', 'wizard'], signed: true },
      }),
    )
    expect(s.scene).toBe('summit')
    expect(s.settings).toEqual({ sound: true, volume: 0.8, motion: 'reduced', simple: false })
    expect(s.progress.visited).toEqual(['beach'])
    expect(s.progress.stamps).toEqual({ a: 1 })
    expect(s.progress.photos).toBe(2)
    expect(s.progress.badges).toEqual(['summit'])
    expect(s.progress.signed).toBe(true)
    expect(parseSaved(JSON.stringify({ scene: 'atlantis' })).scene).toBe('beach')
  })
})

describe('starting afresh', () => {
  it('forgets what you found but leaves you where you are (the view doesn’t move)', () => {
    game.arrive('summit', null)
    game.spot('larch')
    game.signed()
    expect(game.get().progress.badges).toContain('summit')
    game.resetProgress()
    expect(game.get().scene).toBe('summit')
    expect(game.get().progress).toMatchObject({ visited: [], spots: [], signed: false, badges: [] })
  })
})
