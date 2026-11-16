/**
 * The audio graph shared by every sound: a master volume and limiter, a reverb whose size follows
 * the place you're in, noise to build sounds from, and 3D panning that follows where you look.
 */
import type { Ambience } from '../../content/trail.ts'

export type Space = Ambience['space']

export type AudioRig = {
  ctx: BaseAudioContext
  /** Everything ends here: master volume, then a gentle limiter. */
  master: GainNode
  /** Send to the reverb. */
  wet: GainNode
  /** Dry sounds that should still sound "in" the place go here. */
  dry: GainNode
  noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }
  setSpace(space: Space): void
}

const SPACES: Record<Space, { seconds: number; wet: number; tone: number; echoes: number[] }> = {
  open: { seconds: 0.9, wet: 0.1, tone: 0.5, echoes: [] },
  forest: { seconds: 1.5, wet: 0.24, tone: 0.35, echoes: [] },
  valley: { seconds: 2.4, wet: 0.2, tone: 0.4, echoes: [0.32, 0.61] },
  room: { seconds: 0.8, wet: 0.3, tone: 0.55, echoes: [] },
  street: { seconds: 1.1, wet: 0.18, tone: 0.5, echoes: [0.09] },
}

function noiseBuffer(ctx: BaseAudioContext, kind: 'white' | 'pink' | 'brown', seconds = 4) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const d = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  let last = 0
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w * 0.5
    else if (kind === 'pink') {
      // Paul Kellet's filter.
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    } else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  // Crossfade the ends so the loop has no click.
  const fade = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    d[i] = d[i] * t + d[length - fade + i] * (1 - t)
  }
  return buffer
}

function impulse(ctx: BaseAudioContext, space: Space) {
  const { seconds, tone, echoes } = SPACES[space]
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate
      // Darker as it decays, like air and leaves soaking up the highs.
      const k = tone * (1 - (t / seconds) * 0.7)
      lp += (Math.random() * 2 - 1 - lp) * k
      d[i] = lp * Math.exp((-t * 6.9) / seconds)
    }
    for (const e of echoes) {
      const at = Math.floor((e + ch * 0.013) * ctx.sampleRate)
      for (let i = 0; i < 400 && at + i < length; i++) d[at + i] += (Math.random() * 2 - 1) * 0.35 * Math.exp(-i / 90)
    }
  }
  return buffer
}

/** `context` is for tests: an OfflineAudioContext renders the same sounds into a buffer. */
export function createRig(context?: BaseAudioContext): AudioRig {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = context ?? new Ctx({ latencyHint: 'interactive' })
  const master = ctx.createGain()
  master.gain.value = 0
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 8
  limiter.ratio.value = 6
  limiter.attack.value = 0.005
  limiter.release.value = 0.25
  master.connect(limiter).connect(ctx.destination)

  const dry = ctx.createGain()
  dry.connect(master)
  const wet = ctx.createGain()
  const reverbs = { a: ctx.createConvolver(), b: ctx.createConvolver() }
  const levels = { a: ctx.createGain(), b: ctx.createGain() }
  wet.connect(reverbs.a).connect(levels.a).connect(master)
  wet.connect(reverbs.b).connect(levels.b).connect(master)
  levels.a.gain.value = 0
  levels.b.gain.value = 0
  let active: 'a' | 'b' = 'a'
  let currentSpace: Space | null = null

  return {
    ctx,
    master,
    wet,
    dry,
    noise: { white: noiseBuffer(ctx, 'white'), pink: noiseBuffer(ctx, 'pink'), brown: noiseBuffer(ctx, 'brown') },
    setSpace(space) {
      if (space === currentSpace) return
      currentSpace = space
      // Two reverbs, crossfaded, so changing place doesn't click.
      const next = active === 'a' ? 'b' : 'a'
      reverbs[next].buffer = impulse(ctx, space)
      const now = ctx.currentTime
      levels[next].gain.setTargetAtTime(SPACES[space].wet * 3, now, 0.4)
      levels[active].gain.setTargetAtTime(0, now, 0.4)
      active = next
    },
  }
}

/** A source somewhere around you: a direction (yaw/pitch in the photo) and a distance. */
export function createPanner(rig: AudioRig, distance = 10) {
  const p = rig.ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  // Gentle fall-off: a cuckoo a hundred metres away should still carry, as it does outdoors.
  p.refDistance = 3
  p.maxDistance = 1000
  p.rolloffFactor = 0.35
  p.positionX.value = 0
  p.positionY.value = 0
  p.positionZ.value = -distance
  return p
}

export function placePanner(p: PannerNode, yaw: number, pitch: number, distance: number, frame: number, at: number, smooth = 0.05) {
  const y = ((yaw + frame) * Math.PI) / 180
  const pi = (pitch * Math.PI) / 180
  const x = Math.sin(y) * Math.cos(pi) * distance
  const yy = Math.sin(pi) * distance
  const z = -Math.cos(y) * Math.cos(pi) * distance
  if (smooth > 0) {
    p.positionX.setTargetAtTime(x, at, smooth)
    p.positionY.setTargetAtTime(yy, at, smooth)
    p.positionZ.setTargetAtTime(z, at, smooth)
  } else {
    p.positionX.setValueAtTime(x, at)
    p.positionY.setValueAtTime(yy, at)
    p.positionZ.setValueAtTime(z, at)
  }
}

/** A looping noise source, started at a random point so layers don't line up. */
export function noiseSource(rig: AudioRig, kind: 'white' | 'pink' | 'brown') {
  const src = rig.ctx.createBufferSource()
  src.buffer = rig.noise[kind]
  src.loop = true
  src.start(rig.ctx.currentTime, Math.random() * (src.buffer.duration - 0.1))
  return src
}
