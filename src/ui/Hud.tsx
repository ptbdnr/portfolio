/**
 * What sits on top of the view: where you are, a compass, the tools (map, blog, field guide,
 * camera, sound, menu), the way on, the time of day where you can change it, and a few hints.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { SCENE_BY_ID, nextLink, type Scene, type TimeOfDay } from '../content/trail.ts'
import { wrap } from '../engine/math.ts'
import { POSTS } from '../lib/logbook.ts'
import { ALL_NOTES, ALL_SPOTS, game, reducedMotion, useGame } from '../lib/store.ts'
import { useEngine } from './engineContext.ts'
import { useNearSpot } from './gaze.ts'
import { metres, takePhoto, toggleSound } from './helpers.ts'
import { Icon } from './icons.tsx'

const TIME_LABEL: Record<TimeOfDay, string> = {
  sunrise: 'Sunrise',
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  sunset: 'Sunset',
  dusk: 'Dusk',
  night: 'Night',
  evening: 'Evening',
}

const SEASON_LABEL = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }

function PlaceTitle({ scene, variant }: { scene: Scene; variant: string | null }) {
  const time = scene.variants?.find((v) => v.key === variant)?.time ?? scene.time
  return (
    <div className="hud-place">
      <h1 className="hud-place__name">{scene.name}</h1>
      <p className="hud-place__meta">
        <span>{metres(scene.elevation)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {SEASON_LABEL[scene.season]} {TIME_LABEL[time].toLowerCase()}
        </span>
        <button type="button" className="hud-place__info" onClick={() => game.open({ kind: 'place' })} aria-label={`About this place and its photo`}>
          <Icon.info />
        </button>
      </p>
    </div>
  )
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const PX_PER_DEG = 2

/** A strip compass like a camera's: the direction you face in the middle, paths and notes marked. */
function Compass({ scene }: { scene: Scene }) {
  const engine = useEngine()
  const strip = useRef<HTMLDivElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!engine) return
    let last = ''
    return engine.onFrame(({ cam }) => {
      const bearing = wrap(cam.yaw - scene.north)
      if (strip.current) strip.current.style.transform = `translateX(${(-(bearing + 540) * PX_PER_DEG).toFixed(1)}px)`
      const b = Math.round((bearing + 360) % 360)
      const text = `${POINTS[Math.round(b / 45) % 8]} ${b}°`
      if (readout.current && text !== last) {
        readout.current.textContent = text
        last = text
      }
    })
  }, [engine, scene])
  const ticks = []
  for (let deg = -540; deg <= 540; deg += 15) {
    const major = deg % 45 === 0
    const name = major ? POINTS[(((deg / 45) % 8) + 8) % 8] : null
    ticks.push(
      <span key={deg} className={`compass__tick${major ? ' is-major' : ''}`} style={{ left: (deg + 540) * PX_PER_DEG }}>
        {name && <b>{name}</b>}
      </span>,
    )
  }
  const marks = [
    ...scene.links.map((l) => ({ yaw: l.yaw, kind: 'link' as const, title: l.label })),
    ...scene.notes.map((n) => ({ yaw: n.at.yaw, kind: 'note' as const, title: n.label })),
  ]
  for (const m of marks) {
    const bearing = wrap(m.yaw - scene.north)
    for (const k of [-360, 0, 360]) {
      ticks.push(<span key={`${m.kind}${m.yaw}${k}${m.title}`} className={`compass__mark compass__mark--${m.kind}`} style={{ left: (bearing + k + 540) * PX_PER_DEG }} title={m.title} />)
    }
  }
  return (
    <div className="compass" aria-hidden="true">
      <div className="compass__window">
        <div ref={strip} className="compass__strip">
          {ticks}
        </div>
      </div>
      <span ref={readout} className="compass__readout" />
    </div>
  )
}

function ToolButton({ label, shortcut, onClick, children, active }: { label: string; shortcut?: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" className={`icon-btn${active ? ' is-active' : ''}`} onClick={onClick} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} aria-pressed={active}>
      {children}
    </button>
  )
}

function Tools({ scene }: { scene: Scene }) {
  const engine = useEngine()
  const navigate = useNavigate()
  const soundOn = useGame((s) => s.settings.sound)
  return (
    <div className="hud-tools" role="toolbar" aria-label="Tools">
      <ToolButton label="Trail map" shortcut="M" onClick={() => game.open({ kind: 'map' })}>
        <Icon.map />
      </ToolButton>
      <ToolButton label="Blog" shortcut="B" onClick={() => navigate('/blog')}>
        <Icon.book />
      </ToolButton>
      <ToolButton label="Field guide" shortcut="G" onClick={() => game.open({ kind: 'guide' })}>
        <Icon.binoculars />
      </ToolButton>
      <ToolButton label="Take a photo" shortcut="P" onClick={() => void takePhoto(engine, scene)}>
        <Icon.camera />
      </ToolButton>
      <ToolButton label={soundOn ? 'Sound on' : 'Sound off'} onClick={toggleSound} active={soundOn}>
        {soundOn ? <Icon.sound /> : <Icon.muted />}
      </ToolButton>
      <ToolButton label="Menu" onClick={() => game.open({ kind: 'menu' })}>
        <Icon.menu />
      </ToolButton>
    </div>
  )
}

function WayOn({ scene }: { scene: Scene }) {
  const engine = useEngine()
  const visited = useGame((s) => s.progress.visited)
  const link = nextLink(scene, new Set(visited))
  if (!link) return null
  const to = SCENE_BY_ID.get(link.to)!
  return (
    <button type="button" className="way-on" onClick={() => engine?.walk(link)}>
      <span className="way-on__arrow" aria-hidden="true">
        <Icon.arrowUp />
      </span>
      <span className="way-on__text">
        <small>{link.kind === 'travel' ? 'Journey' : 'Next'}</small>
        {link.label}
      </span>
      <span className="sr-only"> ({to.name})</span>
    </button>
  )
}

/** At places photographed at several times of day: the light, and staying the night. */
function TimeOfDayControl({ scene, variant }: { scene: Scene; variant: string | null }) {
  const engine = useEngine()
  const moving = useGame((s) => s.moving)
  const [watching, setWatching] = useState(false)
  const options = useMemo(
    () => [{ key: null as string | null, label: TIME_LABEL[scene.time] }, ...(scene.variants ?? []).map((v) => ({ key: v.key as string | null, label: v.label }))],
    [scene],
  )
  const index = Math.max(0, options.findIndex((o) => o.key === variant))
  const last = index >= options.length - 1
  const playing = watching && !last

  useEffect(() => {
    if (!playing || moving) return
    // Linger on the night sky; the rest goes by more quickly.
    const linger = options[index].key?.includes('night') ? 14000 : 5000
    const timer = setTimeout(() => engine?.setVariant(options[index + 1].key), linger)
    return () => clearTimeout(timer)
  }, [playing, moving, index, options, engine])

  if (!scene.variants?.length) return null
  return (
    <div className="time-of-day" role="group" aria-label="Time of day">
      {options.map((o, i) => (
        <button key={o.label} type="button" className={i === index ? 'is-active' : ''} aria-pressed={i === index} disabled={moving} onClick={() => engine?.setVariant(o.key)}>
          {o.label}
        </button>
      ))}
      <button
        type="button"
        className="time-of-day__watch"
        onClick={() => {
          if (playing) return setWatching(false)
          if (last) engine?.setVariant(options[0].key)
          setWatching(true)
        }}
        aria-pressed={playing}
      >
        {playing ? <Icon.pause /> : <Icon.play />}
        <span>{playing ? 'Stop' : 'Stay the night'}</span>
      </button>
    </div>
  )
}

function Progress() {
  const notes = useGame((s) => s.progress.notes.length)
  const spots = useGame((s) => s.progress.spots.length)
  const read = useGame((s) => Object.keys(s.progress.stamps).filter((slug) => POSTS.some((p) => p.slug === slug)).length)
  return (
    <button type="button" className="hud-progress" onClick={() => game.open({ kind: 'guide' })} aria-label={`Progress: ${notes} of ${ALL_NOTES.length} notes read, ${spots} of ${ALL_SPOTS.length} things spotted, ${read} of ${POSTS.length} posts read. Open the field guide.`}>
      <span>
        <b>{notes}</b>/{ALL_NOTES.length} notes
      </span>
      <span>
        <b>{spots}</b>/{ALL_SPOTS.length} spotted
      </span>
      <span>
        <b>{read}</b>/{POSTS.length} read
      </span>
    </button>
  )
}

function Hints() {
  const near = useNearSpot()
  const walked = useGame((s) => s.progress.visited.length > 1)
  const [dismissed, setDismissed] = useState(false)
  if (near && (walked || dismissed)) {
    return (
      <p className="hud-hint is-gaze" role="status">
        <Icon.binoculars /> Something here is worth a closer look: zoom in (scroll, pinch or +).
      </p>
    )
  }
  if (walked || dismissed) return null
  return (
    <p className="hud-hint" role="status">
      <span>
        <b>Drag</b> to look around · <b>click an arrow</b> on the ground to walk · <b>pins</b> are notes from me
      </span>
      <button type="button" className="hud-hint__close" onClick={() => setDismissed(true)} aria-label="Hide this hint">
        <Icon.close />
      </button>
    </p>
  )
}

export function Hud({ covered = false }: { covered?: boolean }) {
  const sceneId = useGame((s) => s.scene)
  const variant = useGame((s) => s.variant)
  const moving = useGame((s) => s.moving)
  const scene = SCENE_BY_ID.get(sceneId)!
  const reduced = useGame(reducedMotion)
  return (
    <div className={`hud${moving ? ' is-moving' : ''}${reduced ? ' is-reduced' : ''}${covered ? ' is-covered' : ''}`} aria-hidden={covered || undefined}>
      <div className="hud__top">
        <PlaceTitle scene={scene} variant={variant} />
        <Compass scene={scene} />
        <Tools scene={scene} />
      </div>
      <div className="hud__bottom">
        <Progress />
        <div className="hud__centre">
          <Hints />
          <TimeOfDayControl scene={scene} variant={variant} />
          <WayOn scene={scene} />
        </div>
      </div>
    </div>
  )
}

