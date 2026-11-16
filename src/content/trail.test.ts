import { describe, expect, it } from 'vitest'
import { BADGES, earnedBadges } from './badges.ts'
import { chapters, haunts } from './profile.ts'
import { FIRST_SCENE, SCENES, SCENE_BY_ID, nextLink, type SceneId } from './trail.ts'

const inBox = (yaw: number, pitch: number) => yaw > -180 && yaw <= 180 && pitch >= -90 && pitch <= 90

describe('the trail', () => {
  it('has unique places, and every path leads somewhere that leads back', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length)
    for (const scene of SCENES) {
      for (const link of scene.links) {
        const to = SCENE_BY_ID.get(link.to)
        expect(to, `${scene.id} → ${link.to}`).toBeDefined()
        expect(to!.links.some((l) => l.to === scene.id) || link.kind === 'travel', `${link.to} leads back to ${scene.id}`).toBe(true)
        expect(inBox(link.yaw, 0)).toBe(true)
      }
    }
  })

  it('can be walked from the beach to every place', () => {
    const seen = new Set<SceneId>([FIRST_SCENE])
    const queue: SceneId[] = [FIRST_SCENE]
    while (queue.length) {
      for (const l of SCENE_BY_ID.get(queue.shift()!)!.links) {
        if (seen.has(l.to)) continue
        seen.add(l.to)
        queue.push(l.to)
      }
    }
    expect([...seen].sort()).toEqual(SCENES.map((s) => s.id).sort())
  })

  it('always knows the way on, and suggests new places first', () => {
    for (const scene of SCENES) expect(nextLink(scene), scene.id).not.toBeNull()
    expect(nextLink(SCENE_BY_ID.get('hut')!)?.to).toBe('inside')
    expect(nextLink(SCENE_BY_ID.get('hut')!, new Set(['inside']))?.to).toBe('rocks')
    expect(nextLink(SCENE_BY_ID.get('summit')!)?.to).toBe('bivouac')
  })

  it('pins notes, spots and waymarks inside the photo, with ids that are unique', () => {
    const notes = SCENES.flatMap((s) => s.notes.map((n) => n.id))
    const spots = SCENES.flatMap((s) => s.spots.map((x) => x.id))
    expect(new Set(notes).size).toBe(notes.length)
    expect(new Set(spots).size).toBe(spots.length)
    for (const scene of SCENES) {
      for (const d of [...scene.notes.map((n) => n.at), ...scene.spots.map((x) => x.at), ...scene.waymarks, scene.view]) expect(inBox(d.yaw, d.pitch), scene.id).toBe(true)
      for (const spot of scene.spots) if (spot.variant) expect(scene.variants?.some((v) => v.key === spot.variant)).toBe(true)
    }
  })

  it('places the map’s points in Europe', () => {
    for (const p of [...chapters, ...haunts]) {
      expect(p.lon).toBeGreaterThan(-11)
      expect(p.lon).toBeLessThan(31)
      expect(p.lat).toBeGreaterThan(35.5)
      expect(p.lat).toBeLessThan(60.5)
    }
  })
})

describe('badges', () => {
  const none = { visited: [], seen: [], stamps: {}, spots: [], photos: 0, signed: false }

  it('are earned for what you did, and only that', () => {
    expect(earnedBadges(none)).toEqual([])
    expect(earnedBadges({ ...none, visited: ['beach', 'orchard'] })).toEqual(['first-steps'])
    expect(earnedBadges({ ...none, visited: ['beach', 'rocks', 'lake'] }).sort()).toEqual(['both-ways', 'first-steps'])
    expect(earnedBadges({ ...none, seen: ['bivouac-night'], stamps: { a: 1 }, photos: 1, signed: true }).sort()).toEqual(['messenger', 'night-sky', 'photographer', 'reader'])
    expect(earnedBadges({ ...none, visited: SCENES.map((s) => s.id) })).toContain('explorer')
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })
})

describe('what’s pinned in each photo', () => {
  it('never puts two things on top of each other', () => {
    const D = Math.PI / 180
    const vec = (yaw: number, pitch: number) => [Math.sin(yaw * D) * Math.cos(pitch * D), Math.sin(pitch * D), -Math.cos(yaw * D) * Math.cos(pitch * D)]
    const apart = (a: { yaw: number; pitch: number }, b: { yaw: number; pitch: number }) => {
      const [x, y] = [vec(a.yaw, a.pitch), vec(b.yaw, b.pitch)]
      return Math.acos(Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2])) / D
    }
    for (const scene of SCENES) {
      // Notes, posts, and each path's label and arrow.
      const items = [
        ...scene.notes.map((n) => ({ id: n.id, at: n.at, path: '' })),
        ...scene.waymarks.map((w, i) => ({ id: `post ${i}`, at: w, path: '' })),
        ...scene.links.flatMap((l) => [
          { id: `label to ${l.to}`, at: { yaw: l.yaw, pitch: l.kind === 'door' ? -13 : -9.5 }, path: l.to },
          { id: `arrow to ${l.to}`, at: { yaw: l.yaw, pitch: -16 }, path: l.to },
        ]),
      ]
      for (const [i, a] of items.entries()) {
        for (const b of items.slice(i + 1)) {
          if (a.path && a.path === b.path) continue
          expect(apart(a.at, b.at), `${scene.id}: ${a.id} and ${b.id}`).toBeGreaterThan(9)
        }
      }
    }
  })
})
