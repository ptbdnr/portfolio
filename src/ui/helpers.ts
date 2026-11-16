/** Small shared pieces of the interface that aren't components. */
import { useEffect } from 'react'
import type { Ambience, Scene } from '../content/trail.ts'
import type { Engine } from '../engine/engine.ts'
import { api } from '../lib/api.ts'
import { POSTS } from '../lib/logbook.ts'
import { savePhoto } from '../lib/photos.ts'
import { placePosts } from '../lib/placement.ts'
import { game } from '../lib/store.ts'
import { sound } from './engineContext.ts'

/** Where every blog post is pinned on the trail. */
export const PLACEMENT = placePosts(POSTS)

export const metres = (m: number) => `${m.toLocaleString('en-GB')} m`

export function ambienceOf(scene: Scene, variant: string | null): Ambience {
  const v = scene.variants?.find((x) => x.key === variant)
  return v?.ambience ? { ...scene.ambience, ...v.ambience } : scene.ambience
}

/** The spots you can find where you stand, at this time of day. */
export const spotsHere = (scene: Scene, variant: string | null) => scene.spots.filter((s) => !s.variant || s.variant === variant)

/** Found something in the field guide: tell the visitor, once. */
export function discover(scene: Scene, id: string) {
  const spot = scene.spots.find((s) => s.id === id)
  if (!spot || !game.spot(id)) return
  sound.ui('chime')
  game.toast({ title: `Spotted: ${spot.name}`, body: spot.fact, icon: '🔭' })
  void api.sighting(id)
}

export async function takePhoto(engine: Engine | null, scene: Scene) {
  if (!engine) return
  document.documentElement.classList.remove('flash')
  void document.documentElement.offsetWidth
  document.documentElement.classList.add('flash')
  sound.ui('shutter')
  const blob = await engine.capture()
  if (!blob) return game.toast({ title: 'The photo didn’t work', icon: '⚠️' })
  try {
    await savePhoto(blob, scene.id)
    game.tookPhoto()
    game.toast({ title: 'Photo saved', body: `${scene.name}. Find it under Menu → Your photos.`, icon: '📷' })
  } catch {
    game.toast({ title: 'Couldn’t keep the photo', body: 'This browser has no room for it.', icon: '⚠️' })
  }
}

export function toggleSound() {
  const on = !game.get().settings.sound
  game.settings({ sound: on })
  if (on) void sound.enable()
  else sound.disable()
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · Peter Bodnar` : 'Peter Bodnar — Hut to Hut'
    return () => {
      document.title = previous
    }
  }, [title])
}
