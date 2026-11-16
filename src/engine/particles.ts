/**
 * Small things in the air around you, simulated around the camera so they drift past as you walk:
 * dust in sunbeams, seeds and pollen, swarms of midges, glittering ice crystals, drizzle, and now
 * and then a flock of birds far off. Positions are metres from the camera.
 */
import type { Particles } from '../content/trail.ts'
import { type Basis, type Camera, type Vec3, DEG, clamp, dot, mulberry32, projectVec, rotateYaw } from './math.ts'

/** Floats per particle: position + size (4), premultiplied colour (4), shape + angle (2). */
export const STRIDE = 10

type Mote = { p: Vec3; v: Vec3; size: number; phase: number; speed: number; swarm: number }

type Bird = { offset: Vec3; phase: number; rate: number; size: number }
type Flock = { p: Vec3; v: Vec3; birds: Bird[]; gull: boolean; age: number }

export type FlockKind = 'none' | 'dark' | 'gull'

export type AirOptions = { kind: Particles; wind: number; windYaw: number; flock: FlockKind; backlit: boolean; seed: number; density: number }

const SHAPE = { dot: 0, streak: 1, seed: 2, bird: 3 } as const

const COUNTS: Record<Particles, number> = {
  none: 0,
  dust: 150,
  pollen: 80,
  seeds: 36,
  midges: 75,
  'diamond-dust': 240,
  drizzle: 420,
  embers: 0,
  meteors: 0,
}

export function createAir(options: AirOptions) {
  const rnd = mulberry32(options.seed)
  const count = Math.round(COUNTS[options.kind] * options.density)
  const motes: Mote[] = []
  const swarms: Vec3[] = []
  const flocks: Flock[] = []
  let nextFlock = 8 + rnd() * 20
  let fadeIn = 0
  let time = 0
  const windSpeed = 0.15 + options.wind * 1.6
  const wind: Vec3 = rotateYaw([0, 0, -windSpeed], options.windYaw)

  const inSphere = (min: number, max: number): Vec3 => {
    const r = min + (max - min) * Math.cbrt(rnd())
    const yaw = rnd() * 360
    const pitch = Math.asin(rnd() * 1.4 - 0.6) / DEG
    const c = Math.cos(pitch * DEG)
    return [Math.sin(yaw * DEG) * c * r, Math.sin(pitch * DEG) * r, -Math.cos(yaw * DEG) * c * r]
  }

  if (options.kind === 'midges') {
    for (let i = 0; i < 3; i++) {
      const yaw = rnd() * 360
      const d = 2.5 + rnd() * 3.5
      swarms.push([Math.sin(yaw * DEG) * d, -0.4 + rnd() * 1.2, -Math.cos(yaw * DEG) * d])
    }
  }
  for (let i = 0; i < count; i++) motes.push(spawn(true))

  function spawn(initial: boolean): Mote {
    const phase = rnd() * Math.PI * 2
    switch (options.kind) {
      case 'drizzle': {
        const p: Vec3 = [(rnd() * 2 - 1) * 9, initial ? -1.6 + rnd() * 5 : 3.4, (rnd() * 2 - 1) * 9]
        return { p, v: [wind[0] * 0.5, -4.2 - rnd() * 1.2, wind[2] * 0.5], size: 0.1, phase, speed: 1, swarm: 0 }
      }
      case 'midges': {
        const swarm = Math.floor(rnd() * swarms.length)
        const s = swarms[swarm]
        return { p: [s[0] + (rnd() - 0.5) * 0.6, s[1] + (rnd() - 0.5) * 0.5, s[2] + (rnd() - 0.5) * 0.6], v: [0, 0, 0], size: 0.004 + rnd() * 0.002, phase, speed: 1 + rnd() * 2, swarm }
      }
      case 'diamond-dust':
        return { p: inSphere(1.2, 9), v: [wind[0] * 0.3, -0.06 - rnd() * 0.1, wind[2] * 0.3], size: 0.004 + rnd() * 0.004, phase, speed: 0.5 + rnd() * 3, swarm: 0 }
      case 'seeds':
        return { p: inSphere(2, 12), v: [wind[0], (rnd() - 0.4) * 0.15, wind[2]], size: 0.02 + rnd() * 0.02, phase, speed: 0.3 + rnd(), swarm: 0 }
      case 'pollen':
        return { p: inSphere(1.5, 11), v: [wind[0] * 0.7, (rnd() - 0.5) * 0.08, wind[2] * 0.7], size: 0.008 + rnd() * 0.01, phase, speed: 0.4 + rnd(), swarm: 0 }
      default:
        return { p: inSphere(1.2, 6), v: [(rnd() - 0.5) * 0.04, (rnd() - 0.45) * 0.03, (rnd() - 0.5) * 0.04], size: 0.006 + rnd() * 0.007, phase, speed: 0.3 + rnd() * 1.2, swarm: 0 }
    }
  }

  function launchFlock() {
    const gull = options.flock === 'gull'
    const n = gull ? 1 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 10)
    const yaw = rnd() * 360
    const dist = 70 + rnd() * 80
    const side = rnd() < 0.5 ? -1 : 1
    const start: Vec3 = rotateYaw([side * 160, 14 + rnd() * 30, -dist], yaw)
    const v: Vec3 = rotateYaw([-side * (gull ? 7 : 11 + rnd() * 4), (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 3], yaw)
    const birds: Bird[] = []
    for (let i = 0; i < n; i++) {
      birds.push({
        offset: [(rnd() - 0.5) * 2 * n, (rnd() - 0.5) * 0.6 * n, (rnd() - 0.5) * 2 * n],
        phase: rnd() * 10,
        rate: gull ? 1.6 + rnd() * 0.6 : 4 + rnd() * 3,
        size: gull ? 1.3 + rnd() * 0.3 : 0.35 + rnd() * 0.2,
      })
    }
    flocks.push({ p: start, v, birds, gull, age: 0 })
  }

  return {
    kind: options.kind,
    /** `move`: how far the camera stepped this frame, in the current frame of reference. */
    update(dt: number, move: Vec3) {
      time += dt
      fadeIn = Math.min(1, fadeIn + dt / 1.5)
      for (const m of motes) {
        m.p[0] -= move[0]
        m.p[1] -= move[1]
        m.p[2] -= move[2]
        switch (options.kind) {
          case 'drizzle':
            m.p[0] += m.v[0] * dt
            m.p[1] += m.v[1] * dt
            m.p[2] += m.v[2] * dt
            if (m.p[1] < -1.7) Object.assign(m, spawn(false))
            break
          case 'midges': {
            const s = swarms[m.swarm]
            const t = time * m.speed + m.phase
            m.p[0] += (Math.sin(t * 3.1) * 0.9 + (s[0] - move[0] - m.p[0]) * 2) * dt
            m.p[1] += (Math.cos(t * 2.3) * 0.7 + (s[1] - m.p[1]) * 2) * dt
            m.p[2] += (Math.sin(t * 2.7 + 1) * 0.9 + (s[2] - move[2] - m.p[2]) * 2) * dt
            break
          }
          default: {
            const wobble = Math.sin(time * m.speed + m.phase)
            m.p[0] += (m.v[0] + wobble * 0.05) * dt
            m.p[1] += (m.v[1] + Math.cos(time * m.speed * 0.7 + m.phase) * 0.03) * dt
            m.p[2] += (m.v[2] + wobble * 0.04) * dt
          }
        }
        if (options.kind !== 'drizzle') {
          const r = Math.hypot(m.p[0], m.p[1], m.p[2])
          const max = options.kind === 'dust' || options.kind === 'midges' ? 7 : 13
          if (r > max || m.p[1] < -1.65) {
            const fresh = spawn(false)
            // Come back in on the far side, so the air stays evenly filled.
            if (r > max) fresh.p = [-m.p[0] * 0.92, fresh.p[1], -m.p[2] * 0.92]
            Object.assign(m, fresh)
          }
        }
      }
      for (const s of swarms) {
        s[0] -= move[0]
        s[2] -= move[2]
      }
      if (options.flock !== 'none') {
        nextFlock -= dt
        if (nextFlock <= 0) {
          launchFlock()
          nextFlock = 25 + rnd() * 45
        }
        for (const f of flocks) {
          f.age += dt
          f.p[0] += f.v[0] * dt - move[0]
          f.p[1] += f.v[1] * dt
          f.p[2] += f.v[2] * dt - move[2]
        }
        for (let i = flocks.length - 1; i >= 0; i--) if (flocks[i].age > 40) flocks.splice(i, 1)
      }
    },
    /** Turns everything with the camera's frame of reference (after arriving somewhere new). */
    reframe(deg: number) {
      for (const m of motes) m.p = rotateYaw(m.p, deg)
      for (let i = 0; i < swarms.length; i++) swarms[i] = rotateYaw(swarms[i], deg)
      for (const f of flocks) {
        f.p = rotateYaw(f.p, deg)
        f.v = rotateYaw(f.v, deg)
      }
    },
    /** Writes the particles into `out`; returns how many. */
    write(out: Float32Array, b: Basis, cam: Camera): number {
      let n = 0
      const put = (p: Vec3, size: number, r: number, g: number, bl: number, a: number, shape: number, angle: number) => {
        if (n * STRIDE + STRIDE > out.length) return
        out.set([p[0], p[1], p[2], size, r, g, bl, a, shape, angle], n * STRIDE)
        n++
      }
      const k = fadeIn
      for (const m of motes) {
        const tw = 0.5 + 0.5 * Math.sin(time * m.speed * 2 + m.phase)
        switch (options.kind) {
          case 'dust': {
            const add = (0.12 + 0.3 * tw) * k
            put(m.p, m.size, add, add * 0.92, add * 0.78, 0, SHAPE.dot, 0)
            break
          }
          case 'pollen': {
            const add = (0.2 + 0.25 * tw) * k
            put(m.p, m.size, add, add * 0.97, add * 0.85, 0, SHAPE.dot, 0)
            break
          }
          case 'seeds': {
            const a = 0.55 * k
            put(m.p, m.size, 0.95 * a, 0.95 * a, 0.9 * a, a, SHAPE.seed, 0)
            break
          }
          case 'midges': {
            if (options.backlit) {
              const add = 0.5 * k
              put(m.p, m.size, add, add * 0.8, add * 0.5, 0, SHAPE.dot, 0)
            } else {
              const a = 0.6 * k
              put(m.p, m.size, 0.04 * a, 0.04 * a, 0.03 * a, a, SHAPE.dot, 0)
            }
            break
          }
          case 'diamond-dust': {
            const flash = Math.pow(0.5 + 0.5 * Math.sin(time * m.speed * 3 + m.phase), 24)
            const add = (0.06 + 1.1 * flash) * k
            put(m.p, m.size * (1 + flash), add * 0.92, add * 0.96, add, 0, SHAPE.dot, 0)
            break
          }
          case 'drizzle': {
            // Point the streak the way the drop moves on screen.
            const a0 = projectVec(b, cam, m.p)
            const a1 = projectVec(b, cam, [m.p[0] + m.v[0] * 0.05, m.p[1] + m.v[1] * 0.05, m.p[2] + m.v[2] * 0.05])
            const angle = a0.visible && a1.visible ? Math.atan2(a1.x - a0.x, a1.y - a0.y) : 0
            const add = 0.16 * k
            put(m.p, m.size, add * 0.85, add * 0.88, add * 0.92, add * 0.4, SHAPE.streak, angle)
            break
          }
        }
      }
      for (const f of flocks) {
        const life = clamp(Math.min(f.age / 3, (40 - f.age) / 3), 0, 1)
        for (const bird of f.birds) {
          const p: Vec3 = [f.p[0] + bird.offset[0], f.p[1] + bird.offset[1], f.p[2] + bird.offset[2]]
          if (dot(p, b.fwd) < 1) continue
          const glide = f.gull ? (Math.sin(f.age * 0.4 + bird.phase) > 0.3 ? 0.15 : 1) : 1
          const phase = (f.age * bird.rate + bird.phase) * Math.PI * 2
          const wing = f.gull ? Math.sin(phase) * glide + (1 - glide) * 0.4 : Math.sin(phase)
          const a = 0.85 * life * k
          const c = f.gull ? 0.62 : 0.06
          put(p, bird.size, c * a, c * a, c * 1.05 * a, a, SHAPE.bird, Math.asin(clamp(wing, -1, 1)))
        }
      }
      return n
    },
  }
}

export type Air = ReturnType<typeof createAir>

/** Shooting stars on clear nights: one now and then, somewhere up in the sky. */
export function createMeteors(seed: number) {
  const rnd = mulberry32(seed)
  let wait = 3 + rnd() * 6
  let active: { tail: Vec3; head: Vec3; from: Vec3; to: Vec3; t: number; duration: number; brightness: number } | null = null
  const slerp = (a: Vec3, b: Vec3, t: number): Vec3 => {
    const d = clamp(dot(a, b), -1, 1)
    const th = Math.acos(d)
    if (th < 1e-5) return a
    const s = Math.sin(th)
    const ka = Math.sin((1 - t) * th) / s
    const kb = Math.sin(t * th) / s
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]
  }
  const dirVec = (yaw: number, pitch: number): Vec3 => [Math.sin(yaw * DEG) * Math.cos(pitch * DEG), Math.sin(pitch * DEG), -Math.cos(yaw * DEG) * Math.cos(pitch * DEG)]
  return {
    update(dt: number) {
      if (!active) {
        wait -= dt
        if (wait > 0) return null
        const yaw = rnd() * 360
        const pitch = 25 + rnd() * 45
        const from = dirVec(yaw, pitch)
        const to = dirVec(yaw + (rnd() - 0.5) * 30, pitch - 8 - rnd() * 18)
        active = { tail: from, head: from, from, to, t: 0, duration: 0.45 + rnd() * 0.5, brightness: 0.5 + rnd() * 0.9 }
        wait = 5 + rnd() * 12
      }
      active.t += dt / active.duration
      if (active.t >= 1.25) {
        active = null
        return null
      }
      const head = Math.min(1, active.t)
      const tail = Math.max(0, active.t - 0.35)
      active.head = slerp(active.from, active.to, head)
      active.tail = slerp(active.from, active.to, tail)
      const fade = active.t > 1 ? 1 - (active.t - 1) / 0.25 : Math.min(1, active.t * 4)
      return { tail: active.tail, head: active.head, brightness: active.brightness * fade }
    },
    reframe(deg: number) {
      if (!active) return
      active.from = rotateYaw(active.from, deg)
      active.to = rotateYaw(active.to, deg)
    },
  }
}
