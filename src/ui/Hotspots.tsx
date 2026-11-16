/**
 * Everything you can interact with in the view, pinned to directions in the photo: arrows on the
 * ground to walk, notes from me, blog posts as waymarks, and (once found) things in the field guide.
 * The engine moves these elements every frame; React only adds and removes them.
 */
import { useEffect, useId, useMemo, useRef, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { SCENE_BY_ID, type Link, type Note, type Scene, type Spot } from '../content/trail.ts'
import type { OverlayInfo, Placement } from '../engine/engine.ts'
import type { Post } from '../lib/logbookCore.ts'
import { game, useGame } from '../lib/store.ts'
import { sound, useEngine } from './engineContext.ts'
import { setNear } from './gaze.ts'
import { PLACEMENT, discover, spotsHere } from './helpers.ts'

/** Names show when you look towards a pin (as well as on hover and focus). */
const lookedAt = (el: HTMLElement | null, info: OverlayInfo) => el?.classList.toggle('is-near', info.visible && info.angle < Math.min(28, info.fov * 0.34))

function useOverlay(ref: RefObject<HTMLElement | null>, place: Placement, update?: (info: OverlayInfo) => void) {
  const engine = useEngine()
  const id = useId()
  const latest = useRef(update)
  useEffect(() => {
    latest.current = update
  })
  useEffect(() => {
    const el = ref.current
    if (!engine || !el) return
    engine.addOverlay(id, { el, place, update: (info) => latest.current?.(info) })
    return () => engine.removeOverlay(id)
  }, [engine, id, place, ref])
}

function LinkArrow({ link }: { link: Link }) {
  const engine = useEngine()
  const arrow = useRef<HTMLButtonElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const ground = useMemo<Placement>(() => ({ kind: 'ground', yaw: link.yaw, distance: link.kind === 'door' ? 4 : 5.5, width: 140, height: 140 }), [link])
  const above = useMemo<Placement>(() => ({ kind: 'dir', dir: { yaw: link.yaw, pitch: link.kind === 'door' ? -13 : -9.5 } }), [link])
  useOverlay(arrow, ground)
  useOverlay(label, above)
  const to = SCENE_BY_ID.get(link.to)
  const icon = link.kind === 'door' ? 'door' : link.kind === 'travel' ? 'travel' : 'path'
  return (
    <>
      <button
        ref={arrow}
        type="button"
        className={`hs-link hs-link--${icon}`}
        aria-label={`${link.label}${to ? ` (${to.name})` : ''}`}
        onClick={() => engine?.walk(link)}
        onPointerEnter={() => engine?.prefetch(link.to, true)}
        onFocus={() => {
          engine?.prefetch(link.to, true)
          engine?.lookAt({ yaw: link.yaw, pitch: Math.min(engine.camera.pitch, -8) })
        }}
      >
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <path className="hs-link__shadow" d="M70 18 L118 96 L70 74 L22 96 Z" />
          <path className="hs-link__shape" d="M70 14 L116 92 L70 70 L24 92 Z" />
        </svg>
      </button>
      <span ref={label} className="hs-link__label" data-label={link.label} aria-hidden="true" />
    </>
  )
}

function NotePin({ note }: { note: Note }) {
  const ref = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const place = useMemo<Placement>(() => ({ kind: 'dir', dir: note.at }), [note])
  useOverlay(ref, place, (info) => lookedAt(ref.current, info))
  const read = useGame((s) => s.progress.notes.includes(note.id))
  const open = () => {
    game.readNote(note.id)
    sound.ui('open')
    if (note.id === 'logbook') navigate('/blog')
    else if (note.id === 'summit-book') navigate('/contact')
    else game.open({ kind: 'note', id: note.id })
  }
  return (
    <button ref={ref} type="button" className={`hs-pin hs-note${read ? ' is-read' : ''}`} onClick={open} aria-label={`A note from Peter: ${note.label}`}>
      <span className="hs-pin__dot" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 19l1-4L16.5 4.5a2.1 2.1 0 013 3L9 18l-4 1z" />
        </svg>
      </span>
      <span className="hs-pin__label">{note.label}</span>
    </button>
  )
}

function Waymark({ post, at }: { post: Post; at: Note['at'] }) {
  const ref = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const place = useMemo<Placement>(() => ({ kind: 'dir', dir: at }), [at])
  useOverlay(ref, place, (info) => lookedAt(ref.current, info))
  const read = useGame((s) => Boolean(s.progress.stamps[post.slug]))
  return (
    <button
      ref={ref}
      type="button"
      className={`hs-pin hs-post${read ? ' is-read' : ''}`}
      onClick={() => {
        sound.ui('page')
        navigate(`/blog/${post.slug}`)
      }}
      aria-label={`Blog post: ${post.title}`}
    >
      <span className="blaze" aria-hidden="true" />
      <span className="hs-pin__label">
        <small>Blog post{read ? ' · read' : ''}</small>
        {post.title}
      </span>
    </button>
  )
}

function Register({ scene, at, count }: { scene: Scene; at: Note['at']; count: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const place = useMemo<Placement>(() => ({ kind: 'dir', dir: at }), [at])
  useOverlay(ref, place, (info) => lookedAt(ref.current, info))
  return (
    <button ref={ref} type="button" className="hs-pin hs-post hs-register" onClick={() => navigate(`/blog?place=${scene.id}`)} aria-label={`Trail register: ${count} blog posts`}>
      <span className="blaze blaze--stack" aria-hidden="true" />
      <span className="hs-pin__label">
        <small>Trail register</small>
        {count} more posts
      </span>
    </button>
  )
}

function SpotMarker({ spot, scene }: { spot: Spot; scene: Scene }) {
  const ref = useRef<HTMLButtonElement>(null)
  const found = useGame((s) => s.progress.spots.includes(spot.id))
  const place = useMemo<Placement>(() => ({ kind: 'dir', dir: spot.at }), [spot])
  const dwell = useRef(0)
  const last = useRef(0)
  useOverlay(ref, place, (info) => {
    const now = performance.now()
    const dt = last.current ? Math.min(0.1, (now - last.current) / 1000) : 0
    last.current = now
    if (found) return
    const near = info.visible && info.angle < spot.radius * 1.8
    setNear(spot.id, near)
    const looking = info.visible && info.angle < spot.radius && info.fov <= 55
    dwell.current = looking ? dwell.current + dt : 0
    if (dwell.current > 0.7) {
      dwell.current = 0
      setNear(spot.id, false)
      discover(scene, spot.id)
    }
  })
  useEffect(() => () => setNear(spot.id, false), [spot.id])
  return (
    <button
      ref={ref}
      type="button"
      className={`hs-spot${found ? ' is-found' : ''}`}
      tabIndex={found ? 0 : -1}
      aria-hidden={!found}
      aria-label={found ? `Field guide: ${spot.name}` : undefined}
      onClick={() => found && game.open({ kind: 'guide' })}
    >
      {found && <span className="hs-spot__label">{spot.name}</span>}
    </button>
  )
}

export function Hotspots() {
  const sceneId = useGame((s) => s.scene)
  const variant = useGame((s) => s.variant)
  const moving = useGame((s) => s.moving)
  const scene = SCENE_BY_ID.get(sceneId)!
  const posts = PLACEMENT.byScene.get(scene.id)
  return (
    <div className={`hotspots${moving ? ' is-moving' : ''}`} key={`${scene.id}:${variant ?? ''}`}>
      {spotsHere(scene, variant).map((s) => (
        <SpotMarker key={s.id} spot={s} scene={scene} />
      ))}
      {posts?.pins.map((p) => (
        <Waymark key={p.post.slug} post={p.post} at={p.at} />
      ))}
      {posts?.register && scene.waymarks.length > 0 && <Register scene={scene} at={posts.register.at} count={posts.register.posts.length} />}
      {scene.notes.map((n) => (
        <NotePin key={n.id} note={n} />
      ))}
      {scene.links.map((l) => (
        <LinkArrow key={`${l.to}:${l.yaw}`} link={l} />
      ))}
    </div>
  )
}
