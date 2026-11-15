import { useSyncExternalStore } from 'react'
import type { SpeciesId } from '../../shared/species.ts'
import { BADGE_BY_ID, type BadgeId } from '../content/badges.ts'
import { EDELWEISS_TOTAL, SPECIES, SPECIES_BY_ID } from '../content/species.ts'
import type { ClimberMode } from '../game/engine/actors.ts'
import type { Season } from '../game/engine/palettes.ts'
import type { Zone } from '../game/engine/renderer.ts'
import type { Biome, Route } from '../game/engine/world.ts'
import { api } from './api.ts'
import { sfx } from './sfx.ts'

export type Theme = 'auto' | 'day' | 'night'

export type Settings = {
  sound: boolean
  /** Old-TV scanlines over the scenery. */
  crt: boolean
  wildlife: boolean
  season: 'auto' | Season
  theme: Theme
  /** Plain reading layout without the game. */
  simple: boolean
}

export type Choices = {
  route: Route
  hut: 'inside' | 'outside' | null
}

export type Toast = {
  id: number
  kind: 'spot' | 'badge' | 'info'
  title: string
  body?: string
  species?: SpeciesId
  icon?: string
}

export type Live = {
  altitude: number
  f: number
  season: Season
  biome: Biome
  daylight: number
  zone: Zone
  mode: ClimberMode
}

/** Progress inside the current challenges (not saved: they can be replayed). */
export type Progress = {
  holds: number
  holdsTotal: number
  bounces: number
  jump: 'idle' | 'failed' | 'done'
}

export type Panel = null | 'album' | 'settings' | 'help'

export type GameState = {
  settings: Settings
  choices: Choices
  badges: Partial<Record<BadgeId, number>>
  spotted: Partial<Record<SpeciesId, number>>
  edelweiss: number[]
  stamps: Record<string, number>
  onboarded: boolean
  live: Live
  progress: Progress
  toasts: Toast[]
  panel: Panel
  reducedMotion: boolean
  systemDark: boolean
  hoverInteractive: boolean
}

const STORAGE_KEY = 'hut2hut:v2'
const LEGACY_KEY = 'hut2hut:v1'

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  crt: true,
  wildlife: true,
  season: 'auto',
  theme: 'auto',
  simple: false,
}

type Persisted = Pick<GameState, 'settings' | 'choices' | 'badges' | 'spotted' | 'edelweiss' | 'stamps' | 'onboarded'>

function readJSON(key: string): Record<string, unknown> | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    const value: unknown = raw ? JSON.parse(raw) : null
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Loads saved progress, upgrading the first version's format if that's all there is. */
export function load(): Partial<Persisted> {
  const saved = readJSON(STORAGE_KEY)
  if (saved) return saved as Partial<Persisted>
  const old = readJSON(LEGACY_KEY)
  if (!old) return {}
  const oldSettings = (old.settings ?? {}) as Record<string, unknown>
  const sky = oldSettings.sky
  const badges: Partial<Record<BadgeId, number>> = {}
  const secrets = (old.secrets ?? {}) as Record<string, number>
  if (secrets.konami) badges.yeti = secrets.konami
  if (secrets.signed) badges.messenger = secrets.signed
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      sound: oldSettings.sound === true,
      crt: oldSettings.crt !== false,
      wildlife: oldSettings.wildlife !== false,
      season: (oldSettings.season as Settings['season']) ?? 'auto',
      theme: sky === 'day' || sky === 'night' ? sky : 'auto',
    },
    spotted: (old.spotted ?? {}) as Persisted['spotted'],
    edelweiss: Array.isArray(old.edelweiss) ? (old.edelweiss as number[]) : [],
    stamps: (old.stamps ?? {}) as Persisted['stamps'],
    badges,
  }
}

const media = (q: string) => typeof window !== 'undefined' && window.matchMedia?.(q).matches === true

function initial(): GameState {
  const saved = load()
  return {
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    choices: { route: 'rocks', hut: null, ...saved.choices },
    badges: saved.badges ?? {},
    spotted: saved.spotted ?? {},
    edelweiss: Array.isArray(saved.edelweiss) ? saved.edelweiss : [],
    stamps: saved.stamps ?? {},
    onboarded: saved.onboarded === true,
    live: { altitude: 0, f: 0, season: 'summer', biome: 'sea', daylight: 1, zone: null, mode: 'surf' },
    progress: { holds: 0, holdsTotal: 3, bounces: 0, jump: 'idle' },
    toasts: [],
    panel: null,
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    systemDark: media('(prefers-color-scheme: dark)'),
    hoverInteractive: false,
  }
}

let state = initial()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 1

function persist() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const { settings, choices, badges, spotted, edelweiss, stamps, onboarded } = state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, choices, badges, spotted, edelweiss, stamps, onboarded }))
    } catch {
      // Private mode or storage full: progress simply won't persist.
    }
  }, 250)
}

function set(patch: Partial<GameState> | ((s: GameState) => Partial<GameState>), save = true) {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  if (save) persist()
  for (const l of listeners) l()
}

/** Whether the scene should be at night right now. */
export const isNight = (s: GameState) => s.settings.theme === 'night' || (s.settings.theme === 'auto' && s.systemDark)

const PHOTOGRAPHER_AT = 5

export const game = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    set((s) => ({ settings: { ...s.settings, [key]: value } }))
    if (key === 'sound') {
      sfx.setEnabled(Boolean(value))
      if (value) sfx.play('select')
    }
  },

  /** Flip between day and night, from whatever is showing now. */
  toggleNight() {
    const night = !isNight(state)
    // Matching the system preference means "auto" keeps following it later.
    const theme: Theme = night === state.systemDark ? 'auto' : night ? 'night' : 'day'
    game.setSetting('theme', theme)
    if (night) game.badge('nightwalker')
  },

  setChoice<K extends keyof Choices>(key: K, value: Choices[K]) {
    if (state.choices[key] === value) return
    set((s) => ({ choices: { ...s.choices, [key]: value } }))
    if (key === 'hut' && value === 'inside') game.badge('hut')
    if (key === 'route' && value === 'lake') game.badge('lake')
  },

  setOnboarded() {
    if (!state.onboarded) set({ onboarded: true })
  },

  setLive(live: Live) {
    const prev = state.live
    if (
      prev.altitude === live.altitude &&
      prev.season === live.season &&
      prev.biome === live.biome &&
      prev.zone === live.zone &&
      prev.mode === live.mode &&
      Math.abs(prev.daylight - live.daylight) < 0.05 &&
      Math.abs(prev.f - live.f) < 0.002
    ) {
      return
    }
    set({ live }, false)
    if (live.f > 0.978 && !state.badges.summit) game.badge('summit')
  },

  setProgress(patch: Partial<Progress>) {
    set((s) => ({ progress: { ...s.progress, ...patch } }), false)
  },

  setHover(hoverInteractive: boolean) {
    if (state.hoverInteractive !== hoverInteractive) set({ hoverInteractive }, false)
  },

  /** Record a sighting; returns true if this species is new to the visitor's photo album. */
  spot(id: SpeciesId, edelweissIndex?: number) {
    const isNew = !state.spotted[id]
    if (id === 'edelweiss' && edelweissIndex !== undefined && !state.edelweiss.includes(edelweissIndex)) {
      const edelweiss = [...state.edelweiss, edelweissIndex]
      set({ edelweiss })
      if (!isNew) {
        game.toast({
          kind: 'spot',
          species: 'edelweiss',
          title: `Edelweiss ${edelweiss.length} of ${EDELWEISS_TOTAL}`,
          body: 'Photographed, not picked.',
        })
      }
      if (edelweiss.length >= EDELWEISS_TOTAL) game.badge('botanist')
    }
    if (!isNew) return false
    set((s) => ({ spotted: { ...s.spotted, [id]: Date.now() } }))
    const info = SPECIES_BY_ID[id]
    const count = SPECIES.filter((sp) => !sp.secret && state.spotted[sp.id]).length
    game.toast({ kind: 'spot', species: id, title: info.name, body: `Added to your photo album (${count} so far)` })
    sfx.play('coin')
    void api.sighting(id)
    if (count >= PHOTOGRAPHER_AT) game.badge('photographer')
    return true
  },

  /** A post was read to the end. */
  stamp(slug: string) {
    if (state.stamps[slug]) return
    set((s) => ({ stamps: { ...s.stamps, [slug]: Date.now() } }))
    game.badge('reader')
  },

  badge(id: BadgeId) {
    if (state.badges[id]) return false
    set((s) => ({ badges: { ...s.badges, [id]: Date.now() } }))
    const info = BADGE_BY_ID[id]
    game.toast({ kind: 'badge', icon: info.icon, title: `Badge: ${info.title}`, body: info.done })
    sfx.play('fanfare')
    return true
  },

  toast(t: Omit<Toast, 'id'>) {
    const toast = { ...t, id: toastId++ }
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }), false)
  },

  dismiss(id: number) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }), false)
  },

  openPanel(panel: Panel) {
    set({ panel }, false)
  },

  setReducedMotion(reducedMotion: boolean) {
    set({ reducedMotion }, false)
  },

  setSystemDark(systemDark: boolean) {
    set({ systemDark }, false)
  },

  resetProgress() {
    set({ spotted: {}, edelweiss: [], stamps: {}, badges: {}, choices: { route: 'rocks', hut: null } })
  },
}

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => game.setReducedMotion(e.matches))
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => game.setSystemDark(e.matches))
}
sfx.setEnabled(state.settings.sound)

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(
    game.subscribe,
    () => selector(state),
    () => selector(state),
  )
}
