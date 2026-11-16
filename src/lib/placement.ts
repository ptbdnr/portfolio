/**
 * Where blog posts are pinned along the trail. A post says where with `scene:` in its frontmatter;
 * otherwise its `season` picks the part of the trail with that season, spreading posts evenly.
 * Posts are placed oldest first, so a new post never moves the older ones.
 */
import { SCENES, SCENE_BY_ID, type Dir, type SceneId } from '../content/trail.ts'
import type { Post } from './logbookCore.ts'

export type ScenePosts = {
  /** Posts with a waymark of their own in the photo. */
  pins: { post: Post; at: Dir }[]
  /** When there are more posts than waymarks, the rest share the last one: a trail register. */
  register: { at: Dir; posts: Post[] } | null
  all: Post[]
}

export type Placement = { byScene: Map<SceneId, ScenePosts>; sceneOf: Map<string, SceneId> }

const PINNABLE = SCENES.filter((s) => s.waymarks.length > 0)

export function placePosts(posts: Post[]): Placement {
  const sceneOf = new Map<string, SceneId>()
  const lists = new Map<SceneId, Post[]>(SCENES.map((s) => [s.id, []]))
  const oldestFirst = [...posts].sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug))
  for (const post of oldestFirst) {
    let id: SceneId
    if (post.scene && SCENE_BY_ID.has(post.scene as SceneId)) id = post.scene as SceneId
    else {
      const seasonal = PINNABLE.filter((s) => s.season === post.season)
      const candidates = seasonal.length ? seasonal : PINNABLE
      id = candidates.reduce((best, s) => (lists.get(s.id)!.length < lists.get(best.id)!.length ? s : best), candidates[0]).id
    }
    lists.get(id)!.push(post)
    sceneOf.set(post.slug, id)
  }
  const byScene = new Map<SceneId, ScenePosts>()
  for (const scene of SCENES) {
    const all = lists.get(scene.id)!
    const marks = scene.waymarks
    if (!marks.length) {
      byScene.set(scene.id, { pins: [], register: all.length ? { at: { yaw: 0, pitch: -10 }, posts: all } : null, all })
      continue
    }
    const overflow = all.length > marks.length
    const pinned = overflow ? all.slice(0, marks.length - 1) : all
    byScene.set(scene.id, {
      pins: pinned.map((post, i) => ({ post, at: marks[i] })),
      register: overflow ? { at: marks[marks.length - 1], posts: all.slice(marks.length - 1) } : null,
      all,
    })
  }
  return { byScene, sceneOf }
}
