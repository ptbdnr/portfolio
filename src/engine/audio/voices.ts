/**
 * One-off sounds, synthesised: bird calls, water, bells, footsteps and a few interface sounds.
 * Each schedules its nodes at time `t` on the audio clock, sends them to `out`, and tidies up
 * after itself. Nothing here is recorded: it's all oscillators, filtered noise and envelopes.
 */
import type { Ground } from '../../content/trail.ts'
import type { AudioRig } from './rig.ts'

const r = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

function cleanup(node: AudioScheduledSourceNode, ...more: AudioNode[]) {
  node.onended = () => {
    node.disconnect()
    for (const m of more) m.disconnect()
  }
}

type ToneOptions = {
  from: number
  to?: number
  dur: number
  gain: number
  attack?: number
  type?: OscillatorType
  /** Vibrato: [rate Hz, depth as a fraction of the frequency]. */
  vibrato?: [number, number]
  /** Linear glide instead of exponential. */
  linear?: boolean
  /** Extra harmonics: [multiple, relative level]. */
  harmonics?: [number, number][]
}

/** A pitched note with a glide and a simple envelope. */
export function tone(rig: AudioRig, out: AudioNode, t: number, o: ToneOptions) {
  const { ctx } = rig
  const g = ctx.createGain()
  const attack = o.attack ?? 0.008
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  g.connect(out)
  const parts: [number, number][] = [[1, 1], ...(o.harmonics ?? [])]
  for (const [mult, level] of parts) {
    const osc = ctx.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(o.from * mult, t)
    if (o.to && o.to !== o.from) {
      if (o.linear) osc.frequency.linearRampToValueAtTime(o.to * mult, t + o.dur)
      else osc.frequency.exponentialRampToValueAtTime(o.to * mult, t + o.dur)
    }
    let level$: AudioNode = osc
    if (level !== 1) {
      const lg = ctx.createGain()
      lg.gain.value = level
      osc.connect(lg)
      level$ = lg
    }
    level$.connect(g)
    if (o.vibrato) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = o.vibrato[0]
      depth.gain.value = o.from * mult * o.vibrato[1]
      lfo.connect(depth).connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + o.dur + 0.05)
      cleanup(lfo, depth)
    }
    osc.start(t)
    osc.stop(t + o.dur + 0.05)
    cleanup(osc, level$, g)
  }
}

type BurstOptions = {
  noise?: 'white' | 'pink' | 'brown'
  dur: number
  gain: number
  attack?: number
  filter?: BiquadFilterType
  freq?: number
  to?: number
  q?: number
}

/** A short burst of filtered noise. */
export function burst(rig: AudioRig, out: AudioNode, t: number, o: BurstOptions) {
  const { ctx } = rig
  const src = ctx.createBufferSource()
  src.buffer = rig.noise[o.noise ?? 'white']
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.filter ?? 'bandpass'
  f.frequency.setValueAtTime(o.freq ?? 1000, t)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  f.Q.value = o.q ?? 1
  const g = ctx.createGain()
  const attack = o.attack ?? 0.004
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 3)
  src.stop(t + o.dur + 0.05)
  cleanup(src, f, g)
}

/* ------------------------------------------------------------------ birds */

/** A finch's song: an accelerating trill falling in pitch, then a flourish. Returns its length. */
export function songbird(rig: AudioRig, out: AudioNode, t: number) {
  const n = Math.floor(r(7, 12))
  const base = r(5200, 6600)
  let at = t
  for (let i = 0; i < n; i++) {
    const f = base * (1 - (i / n) * 0.42)
    const dur = r(0.05, 0.075)
    tone(rig, out, at, { from: f, to: f * 0.78, dur, gain: r(0.05, 0.09) })
    at += dur + r(0.012, 0.03) * (1 - i / n)
  }
  for (let i = 0; i < 2; i++) {
    tone(rig, out, at, { from: r(2600, 3200), to: r(4200, 5200), dur: 0.09, gain: 0.07 })
    at += 0.11
  }
  tone(rig, out, at, { from: 4800, to: 2600, dur: 0.16, gain: 0.08 })
  return at + 0.2 - t
}

/** A blackbird's warble: slow, fluting notes, ending in a squeaky twitter. */
export function blackbird(rig: AudioRig, out: AudioNode, t: number) {
  const scale = [1680, 1890, 2120, 2380, 2520, 2830, 3170]
  let at = t
  const n = Math.floor(r(4, 8))
  let f = pick(scale)
  for (let i = 0; i < n; i++) {
    const next = pick(scale)
    const dur = r(0.09, 0.26)
    tone(rig, out, at, { from: f, to: next, dur, gain: r(0.05, 0.09), attack: 0.02, vibrato: [r(25, 35), 0.012], harmonics: [[2, 0.12]] })
    f = next
    at += dur + r(0.01, 0.06)
  }
  for (let i = 0; i < Math.floor(r(3, 7)); i++) {
    tone(rig, out, at, { from: r(5000, 7200), to: r(4200, 6800), dur: 0.035, gain: 0.03 })
    at += 0.045
  }
  return at - t
}

/** Cu-ckoo, a few times over. */
export function cuckoo(rig: AudioRig, out: AudioNode, t: number) {
  const times = Math.floor(r(3, 7))
  const hi = r(660, 720)
  const lo = hi * 0.82
  let at = t
  for (let i = 0; i < times; i++) {
    tone(rig, out, at, { from: hi, to: hi * 0.97, dur: 0.2, gain: 0.11, attack: 0.03, harmonics: [[2, 0.08]] })
    tone(rig, out, at + 0.3, { from: lo, to: lo * 0.96, dur: 0.38, gain: 0.1, attack: 0.04, harmonics: [[2, 0.08]] })
    at += r(0.85, 1.05)
  }
  return at - t
}

/** A skylark high overhead: a long, fast, tumbling warble. */
export function skylark(rig: AudioRig, out: AudioNode, t: number, seconds: number) {
  let at = t
  while (at < t + seconds) {
    const f = r(2800, 6200)
    const dur = r(0.03, 0.08)
    tone(rig, out, at, { from: f, to: f * r(0.75, 1.3), dur, gain: r(0.02, 0.045) })
    at += dur + r(0.005, 0.03)
  }
  return seconds
}

/** A gull: a few rising-falling "kyow"s, sometimes laughing. */
export function gull(rig: AudioRig, out: AudioNode, t: number) {
  const { ctx } = rig
  const n = Math.random() < 0.4 ? Math.floor(r(4, 8)) : Math.floor(r(1, 3))
  const laugh = n > 3
  let at = t
  for (let i = 0; i < n; i++) {
    const dur = laugh ? r(0.12, 0.16) : r(0.32, 0.5)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const f0 = laugh ? r(850, 1000) : r(950, 1150)
    osc.frequency.setValueAtTime(f0 * 0.9, at)
    osc.frequency.linearRampToValueAtTime(f0 * 1.25, at + dur * 0.25)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.75, at + dur)
    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = 1700
    formant.Q.value = 2.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.11, at + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(formant).connect(g).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
    cleanup(osc, formant, g)
    at += dur + (laugh ? r(0.04, 0.08) : r(0.3, 0.6))
  }
  return at - t
}

/** Alpine choughs: high, ringing "chee-oo" calls, often several birds. */
export function chough(rig: AudioRig, out: AudioNode, t: number) {
  let at = t
  for (let i = 0; i < Math.floor(r(2, 5)); i++) {
    const f = r(2100, 2600)
    tone(rig, out, at, { from: f * 1.15, to: f * 0.7, dur: r(0.16, 0.24), gain: 0.06, type: 'triangle', attack: 0.015 })
    at += r(0.25, 0.7)
  }
  return at - t
}

/** A wood pigeon: coo-COO-coo, coo-coo, a few times. */
export function woodpigeon(rig: AudioRig, out: AudioNode, t: number) {
  const f = r(470, 520)
  const pattern: [number, number, number][] = [
    [0, 0.28, 0.7],
    [0.42, 0.5, 1],
    [1.05, 0.26, 0.65],
    [1.62, 0.22, 0.6],
    [1.95, 0.3, 0.55],
  ]
  const times = Math.floor(r(2, 5))
  for (let i = 0; i < times; i++) {
    for (const [at, dur, level] of pattern) {
      tone(rig, out, t + i * 2.7 + at, { from: f * 1.04, to: f * 0.96, dur, gain: 0.09 * level, attack: 0.06, harmonics: [[2, 0.06]] })
    }
  }
  return times * 2.7
}

/** A robin: thin, wistful phrases of pure notes and fast trills. */
export function robin(rig: AudioRig, out: AudioNode, t: number) {
  let at = t
  for (let i = 0; i < Math.floor(r(5, 10)); i++) {
    if (Math.random() < 0.35) {
      for (let k = 0; k < 5; k++) {
        tone(rig, out, at, { from: r(5500, 7500), to: r(4500, 6500), dur: 0.03, gain: 0.03 })
        at += 0.035
      }
    } else {
      const f = r(2600, 6800)
      const dur = r(0.08, 0.25)
      tone(rig, out, at, { from: f, to: f * r(0.85, 1.2), dur, gain: r(0.03, 0.05), attack: 0.02 })
      at += dur + r(0.03, 0.12)
    }
  }
  return at - t
}

/** A tawny owl: hoo… then a wavering hu-hu-hoooo. */
export function owl(rig: AudioRig, out: AudioNode, t: number) {
  const f = r(400, 450)
  tone(rig, out, t, { from: f, to: f * 0.93, dur: 0.75, gain: 0.08, attack: 0.08, harmonics: [[2, 0.05]] })
  const at = t + r(3, 4.5)
  tone(rig, out, at, { from: f * 0.95, to: f * 0.9, dur: 0.18, gain: 0.05, attack: 0.03 })
  tone(rig, out, at + 0.35, { from: f, to: f * 0.88, dur: 1.4, gain: 0.08, attack: 0.08, vibrato: [7, 0.025], harmonics: [[2, 0.05]] })
  return at + 1.9 - t
}

/** A woodpecker drumming on a dead branch. */
export function woodpecker(rig: AudioRig, out: AudioNode, t: number) {
  const n = Math.floor(r(12, 22))
  const rate = r(14, 19)
  const f = r(700, 1200)
  for (let i = 0; i < n; i++) {
    const at = t + i / (rate * (1 - (i / n) * 0.15))
    const k = 1 - i / n / 2
    // Each knock: the branch ringing briefly, and the click of the bill.
    tone(rig, out, at, { from: f, to: f * 0.92, dur: 0.035, gain: 0.16 * k, attack: 0.0008, harmonics: [[2.3, 0.3]] })
    burst(rig, out, at, { dur: 0.012, gain: 0.08 * k, filter: 'bandpass', freq: f * 2.5, q: 1.5, noise: 'white', attack: 0.0005 })
  }
  return n / rate
}

/* ------------------------------------------------------------------ insects, bells and other animals */

/** A cricket: a group of three or four quick pulses. */
export function cricket(rig: AudioRig, out: AudioNode, t: number, f: number) {
  const pulses = Math.random() < 0.5 ? 3 : 4
  for (let i = 0; i < pulses; i++) tone(rig, out, t + i * 0.03, { from: f, dur: 0.018, gain: 0.025, attack: 0.002 })
}

/** A cowbell clanking: an inharmonic set of partials, like struck metal. */
export function bell(rig: AudioRig, out: AudioNode, t: number, f: number, gain: number) {
  const partials: [number, number, number][] = [
    [1, 1, 0.9],
    [2.76, 0.45, 0.6],
    [5.4, 0.25, 0.35],
    [8.93, 0.12, 0.2],
  ]
  for (const [mult, level, decay] of partials) {
    tone(rig, out, t, { from: f * mult * r(0.995, 1.005), dur: decay * r(0.8, 1.2), gain: gain * level, attack: 0.002 })
  }
  burst(rig, out, t, { dur: 0.03, gain: gain * 0.5, filter: 'bandpass', freq: f * 3, q: 2, attack: 0.001 })
}

/** A marmot's alarm whistle. */
export function marmot(rig: AudioRig, out: AudioNode, t: number) {
  const f = r(2700, 3300)
  tone(rig, out, t, { from: f * 1.05, to: f * 0.82, dur: 0.24, gain: 0.08, attack: 0.006, harmonics: [[2, 0.08]] })
  if (Math.random() < 0.4) tone(rig, out, t + 0.5, { from: f * 1.04, to: f * 0.8, dur: 0.22, gain: 0.06, attack: 0.006 })
}

/** A bee buzzing past. */
export function bee(rig: AudioRig, out: AudioNode, t: number, seconds: number) {
  const { ctx } = rig
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const f = r(200, 250)
  osc.frequency.setValueAtTime(f * 1.04, t)
  osc.frequency.linearRampToValueAtTime(f * 0.96, t + seconds)
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = r(5, 9)
  depth.gain.value = f * 0.03
  lfo.connect(depth).connect(osc.frequency)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + seconds * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(lp).connect(g).connect(out)
  for (const o of [osc, lfo]) {
    o.start(t)
    o.stop(t + seconds + 0.05)
  }
  cleanup(osc, lp, g)
  cleanup(lfo, depth)
}

/* ------------------------------------------------------------------ water and weather */

/** One bubble in a brook: a tiny resonance whose pitch rises as it collapses. */
export function bubble(rig: AudioRig, out: AudioNode, t: number, gain: number) {
  const f = Math.exp(r(Math.log(380), Math.log(2600)))
  tone(rig, out, t, { from: f, to: f * r(1.4, 2.1), dur: r(0.025, 0.07), gain, attack: 0.002 })
}

/** A wave rolling in, breaking and running back. */
export function wave(rig: AudioRig, out: AudioNode, t: number, gain: number) {
  const { ctx } = rig
  const rise = r(1.6, 2.6)
  const fall = r(3, 4.5)
  for (const [noise, f0, f1, level, delay] of [
    ['brown', 260, 1300, 1, 0],
    ['pink', 1800, 5200, 0.35, 0.35],
  ] as const) {
    const src = ctx.createBufferSource()
    src.buffer = rig.noise[noise]
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(f0, t + delay)
    f.frequency.exponentialRampToValueAtTime(f1, t + delay + rise)
    f.frequency.exponentialRampToValueAtTime(f0, t + delay + rise + fall)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(gain * level, t + delay + rise)
    g.gain.exponentialRampToValueAtTime(gain * level * 0.4, t + delay + rise + 0.4)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + rise + fall)
    src.connect(f).connect(g).connect(out)
    src.start(t + delay, Math.random() * 2)
    src.stop(t + delay + rise + fall + 0.1)
    cleanup(src, f, g)
  }
  return rise + fall
}

/** Water slapping against a rock or the shore. */
export function slap(rig: AudioRig, out: AudioNode, t: number, gain: number) {
  burst(rig, out, t, { noise: 'pink', dur: r(0.12, 0.3), gain, filter: 'bandpass', freq: r(350, 900), to: r(200, 400), q: 1.4, attack: 0.01 })
  if (Math.random() < 0.5) bubble(rig, out, t + r(0.02, 0.08), gain * 0.5)
}

/** A fire: crackles and pops. */
export function crackle(rig: AudioRig, out: AudioNode, t: number, gain: number) {
  burst(rig, out, t, { noise: 'white', dur: r(0.004, 0.02), gain: gain * r(0.3, 1), filter: 'bandpass', freq: r(1200, 5200), q: r(0.8, 3), attack: 0.0008 })
}

/** A raindrop landing somewhere near. */
export function drop(rig: AudioRig, out: AudioNode, t: number, gain: number) {
  burst(rig, out, t, { noise: 'white', dur: r(0.008, 0.02), gain, filter: 'bandpass', freq: r(2500, 7000), q: 2, attack: 0.0005 })
  if (Math.random() < 0.08) tone(rig, out, t, { from: r(1200, 2400), to: r(1800, 3000), dur: 0.05, gain: gain * 0.6 })
}

/** Cutlery, a glass: a small clink somewhere in the room. */
export function clink(rig: AudioRig, out: AudioNode, t: number) {
  const f = r(2400, 4200)
  tone(rig, out, t, { from: f, dur: r(0.25, 0.5), gain: 0.025, attack: 0.001, harmonics: [[2.71, 0.4]] })
}

/** A wooden floorboard or chair creaking. */
export function creak(rig: AudioRig, out: AudioNode, t: number) {
  const { ctx } = rig
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const f = r(90, 160)
  osc.frequency.setValueAtTime(f, t)
  osc.frequency.linearRampToValueAtTime(f * r(1.2, 1.6), t + 0.35)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = r(700, 1300)
  bp.Q.value = 6
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.025, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  osc.connect(bp).connect(g).connect(out)
  osc.start(t)
  osc.stop(t + 0.45)
  cleanup(osc, bp, g)
}

/* ------------------------------------------------------------------ footsteps */

export function footstep(rig: AudioRig, out: AudioNode, t: number, ground: Ground, strength: number) {
  const k = 0.55 + 0.45 * strength
  const thump = (f: number, gain: number) => tone(rig, out, t, { from: f, to: f * 0.6, dur: 0.09, gain: gain * k, attack: 0.004 })
  switch (ground) {
    case 'sand':
      burst(rig, out, t, { noise: 'pink', dur: 0.16, gain: 0.16 * k, filter: 'lowpass', freq: 1400, to: 500, attack: 0.03 })
      break
    case 'grass':
      burst(rig, out, t, { noise: 'white', dur: 0.15, gain: 0.07 * k, filter: 'highpass', freq: 2200, attack: 0.02 })
      burst(rig, out, t, { noise: 'pink', dur: 0.1, gain: 0.08 * k, filter: 'bandpass', freq: 900, q: 0.8, attack: 0.01 })
      break
    case 'earth':
      thump(95, 0.12)
      for (let i = 0; i < 5; i++) burst(rig, out, t + r(0, 0.09), { dur: 0.012, gain: 0.05 * k, filter: 'bandpass', freq: r(1500, 3500), q: 2, attack: 0.001 })
      break
    case 'gravel':
      thump(110, 0.08)
      for (let i = 0; i < 10; i++) burst(rig, out, t + r(0, 0.13), { dur: 0.01, gain: 0.07 * k, filter: 'bandpass', freq: r(2200, 6000), q: 3, attack: 0.0005 })
      break
    case 'rock':
      thump(130, 0.12)
      burst(rig, out, t, { dur: 0.02, gain: 0.08 * k, filter: 'bandpass', freq: 3200, q: 2, attack: 0.001 })
      for (let i = 0; i < 3; i++) burst(rig, out, t + r(0.01, 0.06), { dur: 0.01, gain: 0.03 * k, filter: 'bandpass', freq: r(3000, 6000), q: 3, attack: 0.0005 })
      break
    case 'wood':
      thump(115, 0.2)
      burst(rig, out, t, { dur: 0.06, gain: 0.08 * k, filter: 'bandpass', freq: 320, q: 5, attack: 0.002 })
      if (Math.random() < 0.25) creak(rig, out, t + 0.05)
      break
    case 'tiles':
    case 'pavement':
      thump(140, 0.07)
      burst(rig, out, t, { dur: 0.03, gain: 0.1 * k, filter: 'bandpass', freq: ground === 'tiles' ? 2600 : 1900, q: 1.5, attack: 0.001 })
      burst(rig, out, t + 0.05, { noise: 'pink', dur: 0.06, gain: 0.03 * k, filter: 'highpass', freq: 2500, attack: 0.01 })
      break
  }
}

/* ------------------------------------------------------------------ the interface */

export type UiSound = 'shutter' | 'chime' | 'page' | 'pen' | 'open' | 'close'

export function ui(rig: AudioRig, out: AudioNode, t: number, sound: UiSound) {
  switch (sound) {
    case 'shutter':
      burst(rig, out, t, { dur: 0.025, gain: 0.25, filter: 'highpass', freq: 2000, attack: 0.001 })
      burst(rig, out, t + 0.06, { dur: 0.05, gain: 0.18, filter: 'bandpass', freq: 1400, q: 1.2, attack: 0.002 })
      break
    case 'chime':
      tone(rig, out, t, { from: 880, dur: 1.2, gain: 0.06, attack: 0.005, harmonics: [[2.01, 0.2]] })
      tone(rig, out, t + 0.12, { from: 1318.5, dur: 1.4, gain: 0.05, attack: 0.005, harmonics: [[2.01, 0.2]] })
      break
    case 'page':
      burst(rig, out, t, { noise: 'pink', dur: 0.28, gain: 0.09, filter: 'bandpass', freq: 900, to: 4000, q: 0.7, attack: 0.05 })
      break
    case 'pen':
      for (let i = 0; i < 9; i++) burst(rig, out, t + i * 0.06 + r(0, 0.02), { dur: 0.05, gain: 0.025, filter: 'bandpass', freq: r(2800, 4200), q: 3, attack: 0.01 })
      break
    case 'open':
      tone(rig, out, t, { from: 520, to: 780, dur: 0.12, gain: 0.03, attack: 0.01 })
      break
    case 'close':
      tone(rig, out, t, { from: 700, to: 480, dur: 0.12, gain: 0.025, attack: 0.01 })
      break
  }
}
