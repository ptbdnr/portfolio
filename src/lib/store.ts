/**
 * The game's state: where you are, what you've found and read, your photos and settings. Progress
 * and settings are kept in this browser only (localStorage); nothing is sent anywhere.
 */
import { useSyncExternalStore } from 'react'
import { FIRST_SCENE, SCENES, SCENE_BY_ID, type NoteId, type SceneId } from '../content/trail.ts'
import { BADGES, earnedBadges, type BadgeId } from '../content/badges.ts'

export type Settings = {
  sound: boolean
  volume: number
  /** 'auto' follows the system's reduced-motion setting. */
  motion: 'auto' | 'full' | 'reduced'
  /** The plain page, without the 3D walk. */
  simple: boolean
}

export type Progress = {
  visited: SceneId[]
  notes: NoteId[]
  spots: string[]
  /** Posts read to the end, by slug: when. */
  stamps: Record<string, number>
  /** Times of day seen at places that have them (variant keys). */
  seen: string[]
  signed: boolean
  photos: number
  badges: BadgeId[]
}

export type Panel =
  | { kind: 'note'; id: NoteId }
  | { kind: 'place' }
  | { kind: 'map' }
  | { kind: 'guide' }
  | { kind: 'photos' }
  | { kind: 'menu' }
  | { kind: 'help' }

export type Toast = { id: number; title: string; body?: string; icon?: string }

export type GameState = {
  settings: Settings
  progress: Progress
  scene: SceneId
  variant: string | null
  /** Walking, travelling or the light changing. */
  moving: boolean
  /** The title screen has been dismissed. */
  started: boolean
  panel: Panel | null
  toasts: Toast[]
  /** Shown big in the middle while travelling ("Some time later…"). */
  caption: string | null
  systemReducedMotion: boolean
  /** The 3D view couldn't start (no WebGL 2): the simple view is used instead. */
  noWebgl: boolean
}

const STORAGE_KEY = 'hut2hut:v3'

export const DEFAULT_SETTINGS: Settings = { sound: false, volume: 0.8, motion: 'auto', simple: false }
const EMPTY_PROGRESS: Progress = { visited: [], notes: [], spots: [], stamps: {}, seen: [], signed: false, photos: 0, badges: [] }

const isScene = (id: unknown): id is SceneId => typeof id === 'string' && SCENE_BY_ID.has(id as SceneId)
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Saved state, checked field by field (it may come from an older version, or be edited by hand). */
export function parseSaved(raw: string | null): { settings: Settings; progress: Progress; scene: SceneId } {
  let saved: Record<string, unknown> = {}
  try {
    const value: unknown = raw ? JSON.parse(raw) : null
    if (value && typeof value === 'object') saved = value as Record<string, unknown>
  } catch {
    // A broken save starts afresh.
  }
  const s = (saved.settings ?? {}) as Partial<Settings>
  const p = (saved.progress ?? {}) as Partial<Progress>
  const stamps: Record<string, number> = {}
  if (p.stamps && typeof p.stamps === 'object') {
    for (const [slug, at] of Object.entries(p.stamps)) if (typeof at === 'number') stamps[slug] = at
  }
  return {
    settings: {
      sound: s.sound === true,
      volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_SETTINGS.volume,
      motion: s.motion === 'full' || s.motion === 'reduced' ? s.motion : 'auto',
      simple: s.simple === true,
    },
    progress: {
      visited: strings(p.visited).filter(isScene),
      notes: strings(p.notes) as NoteId[],
      spots: strings(p.spots),
      stamps,
      seen: strings(p.seen),
      signed: p.signed === true,
      photos: typeof p.photos === 'number' ? Math.max(0, Math.floor(p.photos)) : 0,
      badges: strings(p.badges).filter((b): b is BadgeId => BADGES.some((x) => x.id === b)),
    },
    scene: isScene(saved.scene) ? saved.scene : FIRST_SCENE,
  }
}

function readStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const media = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null)
const saved = parseSaved(readStorage())

let state: GameState = {
  settings: saved.settings,
  progress: saved.progress,
  scene: saved.scene,
  variant: null,
  moving: false,
  started: false,
  panel: null,
  toasts: [],
  caption: null,
  systemReducedMotion: media('(prefers-reduced-motion: reduce)')?.matches ?? false,
  noWebgl: false,
}

const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 0

function save() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: state.settings, progress: state.progress, scene: state.scene }))
    } catch {
      // Private mode or full storage: progress just isn't kept.
    }
  }, 250)
}

function set(patch: Partial<GameState> | ((s: GameState) => Partial<GameState>)) {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  if ('settings' in next || 'progress' in next || 'scene' in next) save()
  listeners.forEach((l) => l())
}

/** Records progress and announces any badge it earns. */
function progress(update: (p: Progress) => Partial<Progress>) {
  set((s) => {
    const next = { ...s.progress, ...update(s.progress) }
    const earned = earnedBadges(next).filter((b) => !next.badges.includes(b))
    if (!earned.length) return { progress: next }
    const toasts = [...s.toasts]
    for (const id of earned) {
      const badge = BADGES.find((b) => b.id === id)!
      toasts.push({ id: ++toastId, title: `Badge: ${badge.title}`, body: badge.done, icon: badge.icon })
    }
    return { progress: { ...next, badges: [...next.badges, ...earned] }, toasts: toasts.slice(-4) }
  })
}

const add = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item])

export const game = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  start: () => set({ started: true }),
  arrive(scene: SceneId, variant: string | null) {
    set({ scene, variant, moving: false })
    progress((p) => ({ visited: add(p.visited, scene), seen: variant ? add(p.seen, variant) : p.seen }))
  },
  setMoving: (moving: boolean) => set({ moving }),
  setVariant(variant: string | null) {
    set({ variant })
    if (variant) progress((p) => ({ seen: add(p.seen, variant) }))
  },
  open: (panel: Panel) => set({ panel }),
  close: () => set({ panel: null }),
  readNote(id: NoteId) {
    progress((p) => ({ notes: add(p.notes, id) }))
  },
  /** A thing spotted in the photos; true the first time. */
  spot(id: string) {
    if (state.progress.spots.includes(id)) return false
    progress((p) => ({ spots: add(p.spots, id) }))
    return true
  },
  stamp(slug: string) {
    if (state.progress.stamps[slug]) return
    progress((p) => ({ stamps: { ...p.stamps, [slug]: Date.now() } }))
  },
  signed: () => progress(() => ({ signed: true })),
  tookPhoto: () => progress((p) => ({ photos: p.photos + 1 })),
  toast(t: Omit<Toast, 'id'>) {
    set((s) => ({ toasts: [...s.toasts, { ...t, id: ++toastId }].slice(-4) }))
  },
  dismissToast: (id: number) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setCaption: (caption: string | null) => set({ caption }),
  settings: (patch: Partial<Settings>) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  noWebgl: () => set({ noWebgl: true }),
  setSystemReducedMotion: (on: boolean) => set({ systemReducedMotion: on }),
  /** Forget everything found and read (settings stay, and so does where you are). */
  resetProgress() {
    set({ progress: EMPTY_PROGRESS })
  },
}

export function useGame<T>(select: (s: GameState) => T): T {
  return useSyncExternalStore(game.subscribe, () => select(state), () => select(state))
}

export const reducedMotion = (s: GameState) => s.settings.motion === 'reduced' || (s.settings.motion === 'auto' && s.systemReducedMotion)

/** Every spot in the trail (for counting). */
export const ALL_SPOTS = SCENES.flatMap((s) => s.spots.map((spot) => ({ ...spot, scene: s.id })))
export const ALL_NOTES = SCENES.flatMap((s) => s.notes.map((n) => ({ ...n, scene: s.id })))

media('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', (e) => game.setSystemReducedMotion(e.matches))
