/**
 * The first-person engine: draws where you stand (a 360° photograph), walks you from one photo to
 * the next with a sense of depth, changes the light, and keeps the hotspots laid over the view in
 * place. React talks to it through the small API returned by `createEngine`.
 */
import { SCENE_BY_ID, type Ground, type Link, type Particles, type Scene, type SceneId, type TimeOfDay, type Variant } from '../content/trail.ts'
import { createBlankTexture, createProgram, maxAnisotropy, type Program } from './gl.ts'
import * as M from './math.ts'
import { STRIDE, createAir, createMeteors, type Air, type FlockKind } from './particles.ts'
import { FULLSCREEN_VERT, PANORAMA_FRAG, PARTICLE_FRAG, PARTICLE_VERT } from './shaders.ts'
import { createTextureCache, sampleLuminance, type LuminanceGrid } from './textures.ts'

export type Motion = 'full' | 'reduced'

export type EngineEvent =
  | { type: 'arrive'; scene: SceneId; variant: string | null; via: 'start' | 'walk' | 'jump' | 'travel' }
  /** `delta`: how the new place's photo is turned relative to the current one, mid-walk; `variant`: its time of day. */
  | { type: 'depart'; from: SceneId; to: SceneId; variant: string | null; kind: 'walk' | 'door' | 'jump' | 'travel'; seconds: number; delta: number }
  | { type: 'light'; scene: SceneId; variant: string | null; seconds: number }
  | { type: 'loaded'; key: string; quality: 'preview' | 'full' }
  | { type: 'step'; ground: Ground; side: -1 | 1; strength: number }
  | { type: 'error'; message: string }

export type Placement =
  | { kind: 'dir'; dir: M.Dir }
  | { kind: 'ground'; yaw: number; distance: number; width: number; height: number }

export type OverlayInfo = { visible: boolean; x: number; y: number; angle: number; fov: number }
export type Overlay = { el: HTMLElement; place: Placement; update?: (info: OverlayInfo) => void }

export type FrameInfo = { cam: M.Camera; basis: M.Basis; scene: Scene | null; moving: boolean; dt: number }

type Spot = { scene: Scene; variant: Variant | null }

const MIN_FOV = 25
const MAX_FOV = 100
const PARTICLE_CAP = 600

const keyOf = (s: Spot) => s.variant?.key ?? s.scene.id
const sunOf = (s: Spot) => (s.variant ? s.variant.sun : s.scene.sun)
const waterOf = (s: Spot) => s.variant?.weather?.water ?? s.scene.weather.water ?? []
const particlesOf = (s: Spot): Particles => s.variant?.weather?.particles ?? s.scene.weather.particles
const timeOf = (s: Spot): TimeOfDay => s.variant?.time ?? s.scene.time
const exposureOf = (s: Spot | undefined) => s?.variant?.grade?.exposure ?? 1
const saturationOf = (s: Spot | undefined) => s?.variant?.grade?.saturation ?? 1

const SUN_COLOUR: Record<TimeOfDay, M.Vec3> = {
  sunrise: [1, 0.72, 0.45],
  morning: [1, 0.93, 0.82],
  midday: [1, 0.97, 0.92],
  afternoon: [1, 0.92, 0.8],
  sunset: [1, 0.68, 0.4],
  dusk: [0.9, 0.7, 0.6],
  night: [0.7, 0.8, 1],
  evening: [1, 0.8, 0.6],
}

/** Which birds might fly past, far off. */
function flockOf(s: Spot): FlockKind {
  const t = timeOf(s)
  if (t === 'night' || t === 'evening' || s.scene.ambience.space === 'room') return 'none'
  const birds = s.variant?.ambience?.birds ?? s.scene.ambience.birds ?? []
  if (birds.includes('gull')) return 'gull'
  if (birds.some((b) => b === 'chough' || b === 'skylark' || b === 'songbird' || b === 'woodpigeon')) return 'dark'
  return 'none'
}

const hashString = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

export function createEngine(canvas: HTMLCanvasElement, options: { motion: Motion }) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  })
  if (!gl) throw new Error('This browser can’t show the 3D view (no WebGL 2).')

  let motion = options.motion
  const listeners = new Set<(e: EngineEvent) => void>()
  const frameListeners = new Set<(f: FrameInfo) => void>()
  const emit = (e: EngineEvent) => listeners.forEach((l) => l(e))

  /* ------------------------------------------------------------------ GPU resources */

  let pano: Program
  let particles: Program
  let emptyVao: WebGLVertexArrayObject
  let particleVao: WebGLVertexArrayObject
  let particleBuffer: WebGLBuffer
  let blank: WebGLTexture
  const particleData = new Float32Array(PARTICLE_CAP * STRIDE)
  const waterBoxes = new Float32Array(16)
  const waterStrength = new Float32Array(4)
  let cache = createTextureCache(gl, { anisotropy: 1, budgetBytes: 1 })

  function setupGpu() {
    pano = createProgram(gl!, FULLSCREEN_VERT, PANORAMA_FRAG)
    particles = createProgram(gl!, PARTICLE_VERT, PARTICLE_FRAG)
    emptyVao = gl!.createVertexArray()!
    particleVao = gl!.createVertexArray()!
    particleBuffer = gl!.createBuffer()!
    gl!.bindVertexArray(particleVao)
    gl!.bindBuffer(gl!.ARRAY_BUFFER, particleBuffer)
    gl!.bufferData(gl!.ARRAY_BUFFER, particleData.byteLength, gl!.DYNAMIC_DRAW)
    const bytes = STRIDE * 4
    gl!.enableVertexAttribArray(0)
    gl!.vertexAttribPointer(0, 4, gl!.FLOAT, false, bytes, 0)
    gl!.enableVertexAttribArray(1)
    gl!.vertexAttribPointer(1, 4, gl!.FLOAT, false, bytes, 16)
    gl!.enableVertexAttribArray(2)
    gl!.vertexAttribPointer(2, 2, gl!.FLOAT, false, bytes, 32)
    gl!.bindVertexArray(null)
    blank = createBlankTexture(gl!)
    const small = Math.min(screen.width, screen.height) < 820 || navigator.hardwareConcurrency <= 4
    cache = createTextureCache(gl!, { anisotropy: maxAnisotropy(gl!), budgetBytes: (small ? 150 : 320) * 1024 * 1024 })
  }
  setupGpu()

  /* ------------------------------------------------------------------ state */

  const cam: M.Camera = { yaw: 0, pitch: 0, roll: 0, fov: 80, width: 1, height: 1 }
  const spin = { yaw: 0, pitch: 0 }
  const keys = { yaw: 0, pitch: 0, zoom: 0 }
  let lookTarget: { yaw: number; pitch: number; fov?: number } | null = null
  let current: Spot | null = null
  const variantOf = new Map<SceneId, Variant | null>()

  type Walk = {
    link: Link
    from: Spot
    to: Spot
    t: number
    duration: number
    distance: number
    delta: number
    startYaw: number
    startPitch: number
    turnBy: number
    stepPhase: number
    ready: boolean
  }
  let walk: Walk | null = null
  type Fade = { to: Spot; kind: 'jump' | 'travel'; phase: 'out' | 'hold' | 'in'; t: number; view?: M.Dir & { fov?: number }; ready: boolean; switched: boolean }
  let fade: Fade | null = null
  let light: { from: Variant | null; to: Variant | null; t: number; duration: number; swapped: boolean } | null = null
  let fadeIn = 1
  let updateFadeAmount = 0
  let backdrop = 0
  let backdropTarget = 0
  let attract = false
  let exposure = 1
  const hiMix = new Map<string, number>()
  let air: Air | null = null
  let airKind: string | null = null
  let meteors: ReturnType<typeof createMeteors> | null = null
  let meteor: { tail: M.Vec3; head: M.Vec3; brightness: number } | null = null
  let time = 0
  let swayT = Math.random() * 100
  const overlays = new Map<string, Overlay>()
  let captureRequest: ((blob: Blob | null) => void) | null = null
  let resScale = 1
  let slowFor = 0
  let fastFor = 0
  let frameEma = 16
  let raf = 0
  let last = performance.now()
  let lost = false
  let disposed = false
  let hidden = document.visibilityState === 'hidden'

  const chosen = (scene: Scene): Spot => ({ scene, variant: variantOf.get(scene.id) ?? null })

  function loadKey(key: string) {
    return cache.load(key, 'preview').then(() => emit({ type: 'loaded', key, quality: 'preview' }))
  }

  function loadFull(key: string) {
    cache
      .load(key, 'full')
      .then(() => emit({ type: 'loaded', key, quality: 'full' }))
      .catch((error: Error) => emit({ type: 'error', message: error.message }))
  }

  /** Gets the places you can walk to next ready, so walking there starts at once. */
  function prefetchAround(scene: Scene) {
    for (const link of scene.links) {
      const to = SCENE_BY_ID.get(link.to)
      if (to) void loadKey(keyOf(chosen(to))).catch(() => undefined)
    }
    for (const v of scene.variants ?? []) void loadKey(v.key).catch(() => undefined)
  }

  function arrive(spot: Spot, via: 'start' | 'walk' | 'jump' | 'travel') {
    current = spot
    const key = keyOf(spot)
    if (!hiMix.has(key)) hiMix.set(key, cache.get(key, 'full') ? 1 : 0)
    loadFull(key)
    setAir(spot)
    prefetchAround(spot.scene)
    cache.trim([key, ...spot.scene.links.map((l) => keyOf(chosen(SCENE_BY_ID.get(l.to)!)))])
    emit({ type: 'arrive', scene: spot.scene.id, variant: spot.variant?.key ?? null, via })
  }

  function setAir(spot: Spot) {
    const kind = particlesOf(spot)
    const flock = flockOf(spot)
    const id = `${spot.scene.id}:${kind}:${flock}`
    if (airKind === id && air) return
    airKind = id
    const density = motion === 'reduced' ? 0 : 1
    air =
      density > 0 && (kind !== 'none' || flock !== 'none')
        ? createAir({
            kind: kind === 'meteors' ? 'none' : kind,
            wind: spot.variant?.ambience?.wind ?? spot.scene.ambience.wind,
            windYaw: (hashString(spot.scene.id) % 360) - 180,
            flock,
            backlit: timeOf(spot) === 'sunset',
            seed: hashString(id),
            density,
          })
        : null
    meteors = kind === 'meteors' && motion === 'full' ? createMeteors(hashString(id)) : null
    meteor = null
  }

  /* ------------------------------------------------------------------ moving about */

  function startWalk(link: Link) {
    if (!current || walk || fade || light) return
    const to = SCENE_BY_ID.get(link.to)
    if (!to) return
    if (link.kind === 'travel') return startFade(to, 'travel')
    const back = to.links.find((l) => l.to === current!.scene.id)
    const arriveYaw = link.arrive ?? (back ? M.wrap(back.yaw + 180) : to.view.yaw)
    const door = link.kind === 'door'
    const distance = motion === 'reduced' ? 0 : (link.distance ?? (door ? 5 : 8))
    const duration = motion === 'reduced' ? 0.7 : door ? 1.5 : 1.25 + distance * 0.085
    const turnBy = M.turn(cam.yaw, link.yaw)
    const spot = chosen(to)
    walk = {
      link,
      from: current,
      to: spot,
      t: 0,
      duration,
      distance,
      delta: arriveYaw - link.yaw,
      startYaw: cam.yaw,
      startPitch: cam.pitch,
      turnBy,
      stepPhase: 0,
      ready: Boolean(cache.get(keyOf(spot), 'preview')),
    }
    lookTarget = null
    spin.yaw = spin.pitch = 0
    const w = walk
    if (!w.ready) {
      loadKey(keyOf(spot)).then(
        () => (w.ready = true),
        (error: Error) => {
          if (walk === w) walk = null
          emit({ type: 'error', message: error.message })
        },
      )
    }
    const key = keyOf(spot)
    if (!hiMix.has(key)) hiMix.set(key, cache.get(key, 'full') ? 1 : 0)
    loadFull(key)
    emit({ type: 'depart', from: current.scene.id, to: to.id, variant: spot.variant?.key ?? null, kind: door ? 'door' : 'walk', seconds: duration, delta: walk.delta })
  }

  function startFade(to: Scene, kind: 'jump' | 'travel', view?: M.Dir & { fov?: number }) {
    if (!current || walk || fade || light) return
    const spot = chosen(to)
    fade = { to: spot, kind, phase: 'out', t: 0, view, ready: Boolean(cache.get(keyOf(spot), 'preview')), switched: false }
    const f = fade
    if (!f.ready) {
      loadKey(keyOf(spot)).then(
        () => (f.ready = true),
        (error: Error) => {
          if (fade === f) fade = null
          emit({ type: 'error', message: error.message })
        },
      )
    }
    emit({ type: 'depart', from: current.scene.id, to: to.id, variant: spot.variant?.key ?? null, kind, seconds: kind === 'travel' ? 4 : 1.2, delta: 0 })
  }

  function finishWalk(w: Walk) {
    cam.yaw = M.wrap(cam.yaw + w.delta)
    air?.reframe(w.delta)
    meteors?.reframe(w.delta)
    cam.roll = 0
    walk = null
    arrive(w.to, 'walk')
  }

  function updateWalk(w: Walk, dt: number) {
    if (!w.ready) return { move: [0, 0, 0] as M.Vec3 }
    const before = M.easeInOut(M.clamp(w.t, 0, 1))
    w.t += dt / w.duration
    const t = M.clamp(w.t, 0, 1)
    const s = M.easeInOut(t)
    const turnK = M.easeInOut(M.smoothstep(0, motion === 'reduced' ? 0.2 : 0.5, t))
    cam.yaw = M.wrap(w.startYaw + w.turnBy * turnK)
    cam.pitch = M.lerp(w.startPitch, M.clamp(w.startPitch, -12, 6), turnK)
    // Footsteps: about two a second while moving.
    const speed = (s - before) / Math.max(dt, 1e-3)
    if (w.distance > 0) {
      const prev = w.stepPhase
      w.stepPhase += dt * Math.PI * 2 * 0.95 * M.clamp(speed * 1.6, 0, 1.4)
      if (Math.floor(prev / Math.PI) !== Math.floor(w.stepPhase / Math.PI)) {
        const ground = t < 0.5 ? w.from.scene.ground : w.to.scene.ground
        emit({ type: 'step', ground, side: Math.floor(w.stepPhase / Math.PI) % 2 ? 1 : -1, strength: M.clamp(speed, 0.3, 1) })
      }
      cam.roll = Math.sin(w.stepPhase * 0.5) * 0.35 * M.clamp(speed, 0, 1)
    }
    const fwd = M.dirToVec(w.link.yaw, 0)
    const move = M.scale(fwd, (s - before) * w.distance)
    if (w.t >= 1) finishWalk(w)
    return { move }
  }

  function updateFade(f: Fade, dt: number) {
    const outTime = f.kind === 'travel' ? 1.1 : 0.45
    const holdTime = f.kind === 'travel' ? 1.8 : 0.08
    const inTime = f.kind === 'travel' ? 1.4 : 0.6
    f.t += dt
    if (f.phase === 'out' && f.t >= outTime) {
      f.phase = 'hold'
      f.t = 0
    }
    if (f.phase === 'hold' && !f.switched && f.ready) {
      f.switched = true
      const view = f.view ?? f.to.scene.view
      cam.yaw = view.yaw
      cam.pitch = view.pitch
      if (view.fov) cam.fov = M.clamp(view.fov, MIN_FOV, MAX_FOV)
      spin.yaw = spin.pitch = 0
      lookTarget = null
      arrive(f.to, f.kind)
    }
    if (f.phase === 'hold' && f.switched && f.t >= holdTime) {
      f.phase = 'in'
      f.t = 0
    }
    if (f.phase === 'in' && f.t >= inTime) fade = null
    return f.phase === 'out' ? M.easeInOut(M.clamp(f.t / outTime, 0, 1)) : f.phase === 'hold' ? 1 : 1 - M.easeInOut(M.clamp(f.t / inTime, 0, 1))
  }

  /* ------------------------------------------------------------------ the camera */

  function updateCamera(dt: number) {
    if (walk || (fade && fade.phase !== 'in')) return
    if (attract) {
      cam.yaw = M.wrap(cam.yaw + dt * 1.6)
      cam.pitch = M.approach(cam.pitch, 3, 0.8, dt)
      return
    }
    if (backdrop > 0.5) return
    if (lookTarget) {
      const rate = motion === 'reduced' ? 12 : 3.2
      cam.yaw = M.wrap(cam.yaw + M.turn(cam.yaw, lookTarget.yaw) * (1 - Math.exp(-rate * dt)))
      cam.pitch = M.approach(cam.pitch, lookTarget.pitch, rate, dt)
      if (lookTarget.fov) cam.fov = M.approach(cam.fov, lookTarget.fov, rate, dt)
      if (Math.abs(M.turn(cam.yaw, lookTarget.yaw)) < 0.05 && Math.abs(cam.pitch - lookTarget.pitch) < 0.05) lookTarget = null
    }
    const keyRate = 75 * (cam.fov / 80)
    cam.yaw = M.wrap(cam.yaw + (spin.yaw + keys.yaw * keyRate) * dt)
    cam.pitch = M.clamp(cam.pitch + (spin.pitch + keys.pitch * keyRate * 0.7) * dt, -85, 85)
    if (keys.zoom) cam.fov = M.clamp(cam.fov * Math.exp(-keys.zoom * dt * 1.2), MIN_FOV, MAX_FOV)
    const decay = Math.exp(-4.5 * dt)
    spin.yaw *= decay
    spin.pitch *= decay
    if (Math.abs(spin.yaw) < 0.05) spin.yaw = 0
    if (Math.abs(spin.pitch) < 0.05) spin.pitch = 0
  }

  /** How the eye adjusts: a little darker looking into the bright sky, a little brighter in the shade. */
  function viewLuminance(grid: LuminanceGrid, b: M.Basis, yawOffset: number) {
    const dirs: { yaw: number; pitch: number; weight: number }[] = []
    for (let i = -2; i <= 2; i++) {
      for (let j = -1; j <= 1; j++) {
        const d = M.unproject(b, cam, cam.width * (0.5 + i * 0.2), cam.height * (0.5 + j * 0.3))
        dirs.push({ yaw: d.yaw + yawOffset, pitch: d.pitch, weight: i === 0 && j === 0 ? 3 : 1 })
      }
    }
    return { view: sampleLuminance(grid, dirs), mean: grid.mean }
  }

  /* ------------------------------------------------------------------ drawing */

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    cam.width = width
    cam.height = height
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale
    const w = Math.max(1, Math.round(width * dpr))
    const h = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }

  function bindSlot(suffix: 'A' | 'B', unit: number, spot: Spot, yaw: number, origin: M.Vec3) {
    const key = keyOf(spot)
    const lo = cache.get(key, 'preview')
    const hi = cache.get(key, 'full')
    gl!.activeTexture(gl!.TEXTURE0 + unit)
    gl!.bindTexture(gl!.TEXTURE_2D, lo ?? hi ?? blank)
    gl!.uniform1i(pano.uniform(`uLo${suffix}`), unit)
    gl!.activeTexture(gl!.TEXTURE0 + unit + 1)
    gl!.bindTexture(gl!.TEXTURE_2D, hi ?? blank)
    gl!.uniform1i(pano.uniform(`uHi${suffix}`), unit + 1)
    gl!.uniform1f(pano.uniform(`uHiMix${suffix}`), hi ? (lo ? (hiMix.get(key) ?? 1) : 1) : 0)
    gl!.uniform1f(pano.uniform(`uYaw${suffix}`), yaw * M.DEG)
    gl!.uniform3fv(pano.uniform(`uOrg${suffix}`), origin)
    gl!.uniform2f(pano.uniform(`uProxy${suffix}`), spot.scene.eye ?? 1.6, spot.scene.radius ?? 25)
    const water = waterOf(spot)
    const boxes = waterBoxes
    const strength = waterStrength
    boxes.fill(0)
    strength.fill(0)
    water.slice(0, 4).forEach((w, i) => {
      boxes.set([w.yaw[0], w.yaw[1], w.pitch[0], w.pitch[1]], i * 4)
      strength[i] = (w.strength ?? 1) * (motion === 'reduced' ? 0.15 : 1)
    })
    gl!.uniform4fv(pano.uniform(`uWater${suffix}[0]`), boxes)
    gl!.uniform4fv(pano.uniform(`uWaterStr${suffix}`), strength)
    const sun = sunOf(spot)
    const sunVec = sun ? M.rotateYaw(M.dirToVec(sun.yaw, sun.pitch), -yaw) : ([0, 1, 0] as M.Vec3)
    gl!.uniform3fv(pano.uniform(`uSun${suffix}`), sunVec)
    gl!.uniform1f(pano.uniform(`uSunK${suffix}`), sun ? (sun.strength ?? 1) : 0)
    return { key, sun: sun ? { vec: sunVec, k: sun.strength ?? 1 } : null }
  }

  function render(dt: number) {
    resize()
    const scene = current?.scene ?? null
    let mix = 0
    let A: { spot: Spot; yaw: number; origin: M.Vec3 } | null = current ? { spot: current, yaw: 0, origin: [0, 0, 0] } : null
    let B: typeof A = null
    let fadeAmount = 1 - fadeIn
    const bob = walk && walk.distance > 0 ? Math.abs(Math.sin(walk.stepPhase)) * 0.03 : 0

    if (walk && walk.ready) {
      const t = M.clamp(walk.t, 0, 1)
      const s = M.easeInOut(t)
      mix = motion === 'reduced' ? M.smoothstep(0.1, 0.9, t) : M.smoothstep(0.36, 0.68, t)
      A = { spot: walk.from, yaw: 0, origin: M.add(M.scale(M.dirToVec(walk.link.yaw, 0), s * walk.distance), [0, bob, 0]) }
      B = { spot: walk.to, yaw: walk.delta, origin: M.add(M.scale(M.dirToVec(walk.link.yaw + walk.delta, 0), -(1 - s) * walk.distance), [0, bob, 0]) }
    } else if (light && current) {
      mix = M.easeInOut(M.clamp(light.t, 0, 1))
      A = { spot: { scene: current.scene, variant: light.from }, yaw: 0, origin: [0, 0, 0] }
      B = { spot: { scene: current.scene, variant: light.to }, yaw: 0, origin: [0, 0, 0] }
    }
    if (fade) fadeAmount = Math.max(fadeAmount, updateFadeAmount)

    const sway = motion === 'full' && !walk && !attract
    const view: M.Camera = {
      ...cam,
      yaw: cam.yaw + (sway ? M.noise1(swayT * 0.23, 1) * 0.09 : 0),
      pitch: cam.pitch + (sway ? M.noise1(swayT * 0.19, 2) * 0.06 : 0),
      roll: cam.roll,
    }
    const b = M.basis(view)

    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.disable(gl!.BLEND)
    gl!.useProgram(pano.program)
    gl!.bindVertexArray(emptyVao)
    gl!.uniform3fv(pano.uniform('uRight'), b.right)
    gl!.uniform3fv(pano.uniform('uUp'), b.up)
    gl!.uniform3fv(pano.uniform('uFwd'), b.fwd)
    gl!.uniform2f(pano.uniform('uTan'), b.tanX, b.tanY)
    gl!.uniform1f(pano.uniform('uAspect'), cam.width / cam.height)
    gl!.uniform1f(pano.uniform('uTime'), time)
    gl!.uniform1f(pano.uniform('uLod'), backdrop * 4.2)
    gl!.uniform1f(pano.uniform('uMix'), B ? mix : 0)

    let sunA: { vec: M.Vec3; k: number } | null = null
    let sunB: { vec: M.Vec3; k: number } | null = null
    let keyA = ''
    let keyB = ''
    if (A) ({ key: keyA, sun: sunA } = bindSlot('A', 0, A.spot, A.yaw, A.origin))
    if (B) ({ key: keyB, sun: sunB } = bindSlot('B', 2, B.spot, B.yaw, B.origin))
    else if (A) bindSlot('B', 2, A.spot, A.yaw, A.origin)

    // Exposure follows what you look at.
    let target = 1
    const gridA = keyA ? cache.luminance(keyA) : null
    if (gridA) {
      const a = viewLuminance(gridA, b, A!.yaw)
      let logView = Math.log(a.view)
      let logMean = Math.log(a.mean)
      const gridB = keyB ? cache.luminance(keyB) : null
      if (B && gridB) {
        const v = viewLuminance(gridB, b, B.yaw)
        logView = M.lerp(logView, Math.log(v.view), mix)
        logMean = M.lerp(logMean, Math.log(v.mean), mix)
      }
      target = M.clamp(Math.exp((logMean - logView) * 0.3), 0.8, 1.28)
    }
    exposure = M.approach(exposure, target, motion === 'reduced' ? 6 : 1.4, dt)
    const grade = B ? M.lerp(exposureOf(A?.spot), exposureOf(B.spot), mix) : exposureOf(A?.spot)
    const colour = B ? M.lerp(saturationOf(A?.spot), saturationOf(B.spot), mix) : saturationOf(A?.spot)
    gl!.uniform1f(pano.uniform('uExposure'), exposure * grade)

    // Glare and lens ghosts when the sun is in view.
    const sun = mix < 0.5 ? sunA : sunB
    let flare = 0
    let sunNdc: [number, number] = [0, 0]
    const spotNow = mix < 0.5 ? A?.spot : B?.spot
    if (sun && spotNow && backdrop < 0.5) {
      const p = M.projectVec(b, view, sun.vec)
      if (p.depth > 0) {
        sunNdc = [(p.x / cam.width) * 2 - 1, 1 - (p.y / cam.height) * 2]
        const onScreen = M.clamp(1.3 - Math.max(Math.abs(sunNdc[0]), Math.abs(sunNdc[1])), 0, 1)
        flare = timeOf(spotNow) === 'night' ? 0 : onScreen * sun.k
      }
    }
    gl!.uniform3fv(pano.uniform('uSunColor'), spotNow ? SUN_COLOUR[timeOf(spotNow)] : [1, 1, 1])
    gl!.uniform2f(pano.uniform('uSunNdc'), sunNdc[0], sunNdc[1])
    gl!.uniform1f(pano.uniform('uFlare'), flare * (1 - backdrop))

    gl!.uniform3fv(pano.uniform('uMeteorTail'), meteor?.tail ?? [0, 1, 0])
    gl!.uniform3fv(pano.uniform('uMeteorHead'), meteor?.head ?? [0, 1, 0])
    gl!.uniform1f(pano.uniform('uMeteor'), meteor && !walk ? meteor.brightness : 0)

    gl!.uniform1f(pano.uniform('uSaturation'), colour * (1 - backdrop * 0.25))
    gl!.uniform1f(pano.uniform('uDim'), backdrop * 0.38)
    gl!.uniform1f(pano.uniform('uVignette'), 0.32)
    gl!.uniform1f(pano.uniform('uGrain'), motion === 'reduced' ? 0.004 : 0.018)
    gl!.uniform4f(pano.uniform('uFade'), 0.02, 0.02, 0.025, M.clamp(fadeAmount, 0, 1))
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)

    if (air && fadeAmount < 0.98) {
      const n = air.write(particleData, b, view)
      if (n > 0) {
        gl!.useProgram(particles.program)
        gl!.bindVertexArray(particleVao)
        gl!.bindBuffer(gl!.ARRAY_BUFFER, particleBuffer)
        gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, particleData, 0, n * STRIDE)
        gl!.uniform3fv(particles.uniform('uRight'), b.right)
        gl!.uniform3fv(particles.uniform('uUp'), b.up)
        gl!.uniform3fv(particles.uniform('uFwd'), b.fwd)
        gl!.uniform2f(particles.uniform('uTan'), b.tanX, b.tanY)
        gl!.uniform1f(particles.uniform('uFocal'), b.focal * (canvas.width / cam.width))
        gl!.enable(gl!.BLEND)
        gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA)
        gl!.drawArrays(gl!.POINTS, 0, n)
        gl!.disable(gl!.BLEND)
      }
    }
    gl!.bindVertexArray(null)

    if (captureRequest) {
      const done = captureRequest
      captureRequest = null
      canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.92)
    }

    updateOverlays(b, view, scene)
    for (const l of frameListeners) l({ cam: view, basis: b, scene, moving: Boolean(walk || fade || light), dt })
  }

  function updateOverlays(b: M.Basis, view: M.Camera, scene: Scene | null) {
    const eye = scene?.eye ?? 1.6
    const centre = { yaw: view.yaw, pitch: view.pitch }
    for (const o of overlays.values()) {
      if (o.place.kind === 'dir') {
        const p = M.project(b, view, o.place.dir)
        if (p.visible) {
          o.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
          o.el.style.visibility = ''
        } else o.el.style.visibility = 'hidden'
        o.update?.({ visible: p.visible, x: p.x, y: p.y, angle: M.angleBetween(centre, o.place.dir), fov: view.fov })
      } else {
        const { yaw, distance, width, height } = o.place
        const m = M.groundMatrix(b, view, yaw, distance, eye, width, height, 0.0115)
        if (m) {
          o.el.style.transform = m
          o.el.style.visibility = ''
        } else o.el.style.visibility = 'hidden'
        o.update?.({ visible: Boolean(m), x: 0, y: 0, angle: Math.abs(M.turn(view.yaw, yaw)), fov: view.fov })
      }
    }
  }

  /* ------------------------------------------------------------------ the loop */

  function adaptResolution(dt: number) {
    frameEma = M.lerp(frameEma, dt * 1000, 0.05)
    if (frameEma > 24) {
      slowFor += dt
      fastFor = 0
    } else if (frameEma < 14) {
      fastFor += dt
      slowFor = 0
    } else {
      slowFor = fastFor = 0
    }
    if (slowFor > 1.5 && resScale > 0.55) {
      resScale = Math.max(0.55, resScale * 0.85)
      slowFor = 0
    }
    if (fastFor > 5 && resScale < 1) {
      resScale = Math.min(1, resScale * 1.1)
      fastFor = 0
    }
  }

  function frame(now: number) {
    raf = 0
    if (disposed || lost) return
    const dt = M.clamp((now - last) / 1000, 0, 0.1)
    last = now
    time += dt
    swayT += dt
    // Reading a post, the view behind only needs to look alive, not be smooth.
    const throttle = backdrop > 0.95 && !walk && !fade && !light
    if (!throttle || Math.floor(time * 24) !== Math.floor((time - dt) * 24)) {
      backdrop = M.approach(backdrop, backdropTarget, motion === 'reduced' ? 30 : 7, dt)
      if (Math.abs(backdrop - backdropTarget) < 0.002) backdrop = backdropTarget
      fadeIn = Math.min(1, fadeIn + dt / 0.9)
      let move: M.Vec3 = [0, 0, 0]
      if (walk) move = updateWalk(walk, dt).move
      updateFadeAmount = fade ? updateFade(fade, dt) : 0
      if (light) {
        light.t += dt / light.duration
        if (!light.swapped && light.t >= 0.5 && current) {
          light.swapped = true
          setAir({ scene: current.scene, variant: light.to })
        }
        if (light.t >= 1 && current) {
          current = { scene: current.scene, variant: light.to }
          variantOf.set(current.scene.id, light.to)
          emit({ type: 'light', scene: current.scene.id, variant: light.to?.key ?? null, seconds: 0 })
          light = null
        }
      }
      updateCamera(dt)
      for (const [key, value] of hiMix) if (value < 1 && cache.get(key, 'full')) hiMix.set(key, Math.min(1, value + dt / 0.7))
      air?.update(dt, move)
      meteor = meteors?.update(dt) ?? null
      render(dt)
      adaptResolution(dt)
    }
    schedule()
  }

  function schedule() {
    if (!raf && !disposed && !lost && !hidden) raf = requestAnimationFrame(frame)
  }

  const onVisibility = () => {
    hidden = document.visibilityState === 'hidden'
    last = performance.now()
    schedule()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
  const onRestored = () => {
    lost = false
    setupGpu()
    hiMix.clear()
    if (current) {
      const key = keyOf(current)
      void loadKey(key).then(() => loadFull(key))
    }
    last = performance.now()
    schedule()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  /* ------------------------------------------------------------------ the API */

  const linkTowards = (yaw: number, within: number) => {
    if (!current) return null
    let best: Link | null = null
    let bestTurn = within
    for (const l of current.scene.links) {
      const t = Math.abs(M.turn(yaw, l.yaw))
      if (t < bestTurn) {
        best = l
        bestTurn = t
      }
    }
    return best
  }

  return {
    get camera() {
      return cam
    },
    get scene() {
      return current?.scene ?? null
    },
    get variant() {
      return current?.variant ?? null
    },
    get busy() {
      return Boolean(walk || fade || light)
    },
    on(listener: (e: EngineEvent) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    onFrame(listener: (f: FrameInfo) => void) {
      frameListeners.add(listener)
      return () => void frameListeners.delete(listener)
    },
    /** Starts at a place (the first time, or after a jump from outside the walk). */
    async start(id: SceneId, view?: M.Dir & { fov?: number }, variant?: string | null) {
      const scene = SCENE_BY_ID.get(id)
      if (!scene) throw new Error(`No place called ${id}`)
      if (variant !== undefined) variantOf.set(id, scene.variants?.find((v) => v.key === variant) ?? null)
      const spot = chosen(scene)
      if (current) return startFade(scene, 'jump', view)
      const v = view ?? scene.view
      cam.yaw = v.yaw
      cam.pitch = v.pitch
      cam.fov = M.clamp(v.fov ?? scene.view.fov ?? 80, MIN_FOV, MAX_FOV)
      fadeIn = 0
      // The first photo has to arrive before there's anything to see: keep trying (a flaky connection, a deploy).
      for (let attempt = 0; !disposed; attempt++) {
        try {
          await loadKey(keyOf(spot))
          break
        } catch {
          if (attempt === 0) emit({ type: 'error', message: 'The photo didn’t load. Trying again…' })
          await new Promise((resolve) => setTimeout(resolve, Math.min(15000, 1500 * 2 ** attempt)))
        }
      }
      if (disposed || current) return
      fadeIn = 0
      arrive(spot, 'start')
      last = performance.now()
      schedule()
    },
    walk: startWalk,
    /** Walks to a neighbouring place by name, if there's a way there. */
    walkTo(id: SceneId) {
      const link = current?.scene.links.find((l) => l.to === id)
      if (link) startWalk(link)
      return Boolean(link)
    },
    jump(id: SceneId, view?: M.Dir & { fov?: number }) {
      const scene = SCENE_BY_ID.get(id)
      if (!scene || !current) return
      if (scene.id === current.scene.id && !view) return
      startFade(scene, 'jump', view)
    },
    /** Changes the time of day where you are (only where there are photos of it). */
    setVariant(key: string | null) {
      if (!current || walk || fade || light) return false
      const to = key ? (current.scene.variants?.find((v) => v.key === key) ?? null) : null
      if (to === current.variant) return false
      const k = to?.key ?? current.scene.id
      const seconds = motion === 'reduced' ? 0.6 : 3.2
      const scene = current.scene
      const begin = () => {
        // The photo took a while: only change the light if you're still there and nothing else has started.
        if (!current || current.scene !== scene || walk || fade || light) return
        light = { from: current.variant, to, t: 0, duration: seconds, swapped: false }
        if (!hiMix.has(k)) hiMix.set(k, cache.get(k, 'full') ? 1 : 0)
        loadFull(k)
        emit({ type: 'light', scene: current.scene.id, variant: to?.key ?? null, seconds })
      }
      if (cache.get(k, 'preview')) begin()
      else loadKey(k).then(begin, (error: Error) => emit({ type: 'error', message: error.message }))
      return true
    },
    walkForward() {
      const link = linkTowards(cam.yaw, 60)
      if (link) startWalk(link)
      return Boolean(link)
    },
    turnAround() {
      const link = linkTowards(cam.yaw + 180, 45)
      if (link) startWalk(link)
      else lookTarget = { yaw: M.wrap(cam.yaw + 180), pitch: cam.pitch }
    },
    /** A click or tap on the view: walks if it's on the ground towards a path. Returns the direction. */
    click(x: number, y: number) {
      const d = M.unproject(M.basis(cam), cam, x, y)
      if (!walk && !fade && d.pitch < -4) {
        const link = linkTowards(d.yaw, 18)
        if (link) startWalk(link)
      }
      return d
    },
    directionAt(x: number, y: number) {
      return M.unproject(M.basis(cam), cam, x, y)
    },
    rotateBy(dYaw: number, dPitch: number) {
      if (walk || attract) return
      lookTarget = null
      cam.yaw = M.wrap(cam.yaw + dYaw)
      cam.pitch = M.clamp(cam.pitch + dPitch, -85, 85)
    },
    fling(yawPerSecond: number, pitchPerSecond: number) {
      if (motion === 'reduced') return
      spin.yaw = M.clamp(yawPerSecond, -400, 400)
      spin.pitch = M.clamp(pitchPerSecond, -300, 300)
    },
    stopSpin() {
      spin.yaw = spin.pitch = 0
    },
    zoomBy(factor: number) {
      cam.fov = M.clamp(cam.fov * factor, MIN_FOV, MAX_FOV)
    },
    setKeys(k: Partial<typeof keys>) {
      Object.assign(keys, k)
      if (k.yaw || k.pitch) lookTarget = null
    },
    lookAt(dir: M.Dir & { fov?: number }) {
      lookTarget = { yaw: M.wrap(dir.yaw), pitch: M.clamp(dir.pitch, -85, 85), fov: dir.fov }
    },
    /** Hold the view still and drift slowly (behind the title screen). */
    setAttract(on: boolean) {
      attract = on
    },
    /** 0–1: blur and dim the view behind something you're reading. */
    setBackdrop(amount: number) {
      backdropTarget = M.clamp(amount, 0, 1)
    },
    setMotion(m: Motion) {
      if (m === motion) return
      motion = m
      airKind = null
      if (current) setAir(current)
    },
    prefetch(id: SceneId, full = false) {
      const scene = SCENE_BY_ID.get(id)
      if (!scene) return
      const key = keyOf(chosen(scene))
      void loadKey(key).catch(() => undefined)
      if (full) loadFull(key)
    },
    addOverlay(id: string, overlay: Overlay) {
      overlays.set(id, overlay)
      overlay.el.style.visibility = 'hidden'
    },
    removeOverlay(id: string) {
      overlays.delete(id)
    },
    /** The view as a photo (JPEG), without anything laid over it. */
    capture(): Promise<Blob | null> {
      return new Promise((resolve) => {
        captureRequest = resolve
        schedule()
      })
    },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      // The canvas (and its context) may be used again by the next engine, so free, don't lose, it.
      cache.dispose()
      gl!.deleteProgram(pano.program)
      gl!.deleteProgram(particles.program)
      gl!.deleteBuffer(particleBuffer)
      gl!.deleteVertexArray(emptyVao)
      gl!.deleteVertexArray(particleVao)
      gl!.deleteTexture(blank)
    },
  }
}

export type Engine = ReturnType<typeof createEngine>
