import { describe, expect, it } from 'vitest'
import { SCENE_BY_ID, SCENES } from '../content/trail.ts'
import { finalizePosts, type Post } from './logbookCore.ts'
import { placePosts } from './placement.ts'

const post = (slug: string, date: string, season: Post['season'], scene?: string): Omit<Post, 'page'> => ({
  slug,
  title: slug,
  date,
  summary: '',
  tags: [],
  season,
  draft: false,
  words: 100,
  minutes: 1,
  grade: 'F',
  ...(scene ? { scene } : {}),
})

describe('posts on the trail', () => {
  it('go where they say, else somewhere with their season', () => {
    const posts = finalizePosts([post('a', '2026-01-01', 'winter'), post('b', '2026-02-01', 'summer', 'forest'), post('c', '2026-03-01', 'autumn', 'nowhere')])
    const { sceneOf } = placePosts(posts)
    expect(SCENE_BY_ID.get(sceneOf.get('a')!)!.season).toBe('winter')
    expect(sceneOf.get('b')).toBe('forest')
    expect(SCENE_BY_ID.get(sceneOf.get('c')!)!.season).toBe('autumn')
  })

  it('spread out, and a new post never moves an older one', () => {
    const many = Array.from({ length: 30 }, (_, i) => post(`p${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`, 'summer'))
    const before = placePosts(finalizePosts(many)).sceneOf
    const after = placePosts(finalizePosts([...many, post('newest', '2026-12-31', 'summer')])).sceneOf
    for (const [slug, scene] of before) expect(after.get(slug)).toBe(scene)
    const counts = SCENES.filter((s) => s.season === 'summer' && s.waymarks.length).map((s) => [...before.values()].filter((x) => x === s.id).length)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('share a trail register when a place has more posts than waymarks', () => {
    const forest = SCENE_BY_ID.get('forest')!
    const posts = finalizePosts(Array.from({ length: forest.waymarks.length + 4 }, (_, i) => post(`f${i}`, `2026-05-${String(i + 1).padStart(2, '0')}`, 'summer', 'forest')))
    const here = placePosts(posts).byScene.get('forest')!
    expect(here.pins.length).toBe(forest.waymarks.length - 1)
    expect(here.register?.posts.length).toBe(5)
    expect(here.all.length).toBe(posts.length)
  })
})
