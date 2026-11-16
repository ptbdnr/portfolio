/**
 * The sound of each place, built from its `ambience` (src/content/trail.ts): wind and leaves, the
 * sea or a brook, birds, insects, cowbells, a fire. Sounds sit in the directions they come from in
 * the photo and turn as you look around (HRTF panning); walking crossfades one place into the next.
 * The audio clock schedules everything a moment ahead, so timing doesn't depend on frame rate.
 */
import type { Ambience, Bird, Ground } from '../../content/trail.ts'
import { createPanner, createRig, noiseSource, placePanner, type AudioRig } from './rig.ts'
import * as V from './voices.ts'

const r = (a: number, b: number) => a + Math.random() * (b - a)

type Source = { input: GainNode; panner: PannerNode; send: GainNode; yaw: number; pitch: number; distance: number; busyUntil: number }

/** Most panners a place may use at once for its passing sounds. */
const POOL_MAX = 24

type Timer = { next: number; fire: (t: number) => number }

type Layer = {
  out: GainNode
  frame: number
  fixed: Source[]
  pool: Source[]
  timers: Timer[]
  stoppers: (() => void)[]
  gust: number
  gustTarget: number
  gustChange: number
  gustParams: { param: AudioParam; base: number; depth: number }[]
}

export function createSoundscape({ context }: { context?: () => BaseAudioContext } = {}) {
  let rig: AudioRig | null = null
  let layers: Layer[] = []
  let enabled = false
  let volume = 0.8
  let ducked = 0
  let pending: { ambience: Ambience; frame: number } | null = null
  let ticker: ReturnType<typeof setInterval> | null = null
  let suspendTimer: ReturnType<typeof setTimeout> | null = null
  let view = { yaw: 0, pitch: 0 }

  function source(layer: Layer, yaw: number, pitch: number, distance: number, wet = 0.6): Source {
    const { ctx } = rig!
    const input = ctx.createGain()
    const panner = createPanner(rig!, distance)
    placePanner(panner, yaw, pitch, distance, layer.frame, ctx.currentTime, 0)
    input.connect(panner).connect(layer.out)
    const send = ctx.createGain()
    send.gain.value = wet
    input.connect(send).connect(rig!.wet)
    return { input, panner, send, yaw, pitch, distance, busyUntil: 0 }
  }

  /**
   * A panner for a passing sound (a bird, a drop, a car), moved to where it comes from and set to its
   * level. It's one nobody else is using: a call is never moved halfway through. The caller says how
   * long it needs it (`busyUntil`), once it knows.
   */
  function claim(layer: Layer, yaw: number, pitch: number, distance: number, t: number, level = 1, seconds = 1) {
    let s = layer.pool.find((p) => p.busyUntil <= t)
    if (!s && layer.pool.length < POOL_MAX) {
      s = source(layer, yaw, pitch, distance)
      layer.pool.push(s)
    }
    // All busy (a storm of sounds): take the one that's nearly done.
    s ??= layer.pool.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b))
    s.yaw = yaw
    s.pitch = pitch
    s.distance = distance
    s.busyUntil = t + seconds + 0.4
    placePanner(s.panner, yaw, pitch, distance, layer.frame, t, 0)
    s.input.gain.setValueAtTime(level, t)
    return s
  }

  /** A short sound somewhere around you. */
  function from(layer: Layer, yaw: number, pitch: number, distance: number, t: number, level = 1, seconds = 0.6) {
    return claim(layer, yaw, pitch, distance, t, level, seconds).input
  }

  function every(layer: Layer, first: number, fire: (t: number) => number) {
    layer.timers.push({ next: rig!.ctx.currentTime + first, fire })
  }

  function loop(layer: Layer, kind: 'white' | 'pink' | 'brown', nodes: AudioNode[], gain: number, out: AudioNode) {
    const { ctx } = rig!
    const src = noiseSource(rig!, kind)
    const g = ctx.createGain()
    g.gain.value = gain
    let node: AudioNode = src
    for (const n of nodes) node = node.connect(n)
    node.connect(g).connect(out)
    layer.stoppers.push(() => {
      src.stop()
      src.disconnect()
      g.disconnect()
      for (const n of nodes) n.disconnect()
    })
    return g
  }

  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = rig!.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    return f
  }

  /** A slow wobble on a parameter, from an oscillator. */
  function wobble(layer: Layer, param: AudioParam, rate: number, depth: number) {
    const { ctx } = rig!
    const lfo = ctx.createOscillator()
    lfo.frequency.value = rate
    const g = ctx.createGain()
    g.gain.value = depth
    lfo.connect(g).connect(param)
    lfo.start()
    layer.stoppers.push(() => {
      lfo.stop()
      lfo.disconnect()
      g.disconnect()
    })
  }

  /** How often each bird sings, from how far and how high, and how loud (set by ear… and by measurement). */
  const BIRDS: Record<Bird, { every: [number, number]; distance: [number, number]; pitch: [number, number]; level: number; sing: (out: AudioNode, t: number) => number }> = {
    songbird: { every: [5, 13], distance: [12, 35], pitch: [8, 35], level: 3, sing: (o, t) => V.songbird(rig!, o, t) },
    blackbird: { every: [7, 15], distance: [15, 40], pitch: [8, 30], level: 3, sing: (o, t) => V.blackbird(rig!, o, t) },
    cuckoo: { every: [22, 45], distance: [60, 110], pitch: [4, 14], level: 3.5, sing: (o, t) => V.cuckoo(rig!, o, t) },
    skylark: { every: [6, 10], distance: [35, 55], pitch: [45, 70], level: 5, sing: (o, t) => V.skylark(rig!, o, t, r(4, 8)) },
    gull: { every: [6, 14], distance: [25, 60], pitch: [10, 35], level: 4, sing: (o, t) => V.gull(rig!, o, t) },
    chough: { every: [9, 22], distance: [30, 80], pitch: [5, 30], level: 4, sing: (o, t) => V.chough(rig!, o, t) },
    woodpigeon: { every: [14, 28], distance: [18, 35], pitch: [10, 25], level: 1.5, sing: (o, t) => V.woodpigeon(rig!, o, t) },
    robin: { every: [7, 14], distance: [10, 25], pitch: [5, 20], level: 3, sing: (o, t) => V.robin(rig!, o, t) },
    owl: { every: [16, 32], distance: [60, 120], pitch: [5, 15], level: 4.5, sing: (o, t) => V.owl(rig!, o, t) },
    woodpecker: { every: [18, 40], distance: [30, 60], pitch: [8, 22], level: 1.5, sing: (o, t) => V.woodpecker(rig!, o, t) },
  }

  function build(a: Ambience, frame: number, fade: number): Layer {
    const { ctx } = rig!
    const out = ctx.createGain()
    out.gain.value = 0.0001
    out.connect(rig!.master)
    out.gain.setTargetAtTime(1, ctx.currentTime, Math.max(0.05, fade / 3))
    const layer: Layer = { out, frame, fixed: [], pool: [], timers: [], stoppers: [], gust: 0.5, gustTarget: 0.5, gustChange: 0, gustParams: [] }
    for (let i = 0; i < 8; i++) layer.pool.push(source(layer, 0, 0, 20))
    rig!.setSpace(a.space)

    // Wind, and grass and leaves moving with the gusts.
    if (a.wind > 0) {
      const bp = filter('bandpass', 500, 0.6)
      const g = loop(layer, 'pink', [bp], 0, out)
      layer.gustParams.push({ param: g.gain, base: 0.05 + a.wind * 0.18, depth: 0.7 }, { param: bp.frequency, base: 380, depth: 1.2 })
      if (a.wind >= 0.6) {
        const whistle = filter('bandpass', 900, 14)
        const w = loop(layer, 'pink', [whistle], 0, out)
        layer.gustParams.push({ param: w.gain, base: (a.wind - 0.5) * 0.5, depth: 1 }, { param: whistle.frequency, base: 760, depth: 0.5 })
      }
    }
    if (a.leaves) {
      const hp = filter('highpass', 2600)
      const g = loop(layer, 'white', [hp], 0, out)
      layer.gustParams.push({ param: g.gain, base: a.leaves * 0.05, depth: 1.4 })
    }

    if (a.waves) {
      const { at, level } = a.waves
      const rumble = source(layer, at, -3, 30, 0.3)
      layer.fixed.push(rumble)
      loop(layer, 'brown', [filter('lowpass', 260)], 0.25 * level, rumble.input)
      const sea = [source(layer, at - 25, -3, 20), source(layer, at + 25, -3, 20)]
      layer.fixed.push(...sea)
      let k = 0
      every(layer, r(0.5, 2), (t) => V.wave(rig!, sea[k++ % 2].input, t, 0.45 * level) * r(0.75, 1.15))
    }
    if (a.lapping) {
      const { at, level } = a.lapping
      every(layer, 0.4, (t) => {
        V.slap(rig!, from(layer, at + r(-35, 35), -12, r(3, 6), t, 1, 0.4), t, 0.25 * level)
        return r(0.35, 1.8)
      })
    }
    if (a.stream) {
      const { at, level } = a.stream
      const bed = source(layer, at, -20, 5)
      layer.fixed.push(bed)
      const g = loop(layer, 'pink', [filter('bandpass', 1100, 0.8)], 0.14 * level, bed.input)
      wobble(layer, g.gain, 3.1, 0.035 * level)
      wobble(layer, g.gain, 4.7, 0.026 * level)
      const banks = [source(layer, at - 30, -18, 5), source(layer, at, -25, 4), source(layer, at + 30, -18, 5)]
      layer.fixed.push(...banks)
      every(layer, 0.1, (t) => {
        V.bubble(rig!, banks[Math.floor(Math.random() * 3)].input, t, r(0.03, 0.09) * level)
        return r(0.01, 0.07) / Math.max(level, 0.3)
      })
    }
    for (const bird of a.birds ?? []) {
      const b = BIRDS[bird]
      const centre = bird === 'gull' && a.waves ? a.waves.at : null
      // The first call comes soon, so you hear who's about; then they take their time.
      every(layer, r(1.5, Math.min(10, b.every[0] + 4)), (t) => {
        const yaw = centre !== null ? centre + r(-80, 80) : r(-180, 180)
        const slot = claim(layer, yaw, r(...b.pitch), r(...b.distance), t, b.level, 12)
        const length = b.sing(slot.input, t)
        slot.busyUntil = t + length + 0.6
        return length + r(...b.every)
      })
    }
    for (const insect of a.insects ?? []) {
      if (insect === 'cicadas') {
        for (let i = 0; i < 2; i++) {
          const s = source(layer, r(-180, 180), r(5, 25), r(10, 20), 0.4)
          layer.fixed.push(s)
          const am = rig!.ctx.createGain()
          am.gain.value = 0.5
          const g = loop(layer, 'white', [filter('bandpass', r(5000, 6200), 5), am], 0.18, s.input)
          wobble(layer, am.gain, r(80, 120), 0.5)
          wobble(layer, g.gain, r(0.05, 0.11), 0.17)
        }
      } else if (insect === 'crickets') {
        for (let i = 0; i < 3; i++) {
          const s = source(layer, r(-180, 180), -15, r(3, 9), 0.3)
          layer.fixed.push(s)
          const f = r(4200, 4900)
          const period = r(0.45, 0.8)
          s.input.gain.value = 2.5
          every(layer, r(0, 1), (t) => {
            V.cricket(rig!, s.input, t, f)
            return period * r(0.95, 1.05)
          })
        }
      } else {
        every(layer, r(3, 10), (t) => {
          const yaw = r(-180, 180)
          const seconds = r(1.8, 3.2)
          const s = claim(layer, yaw, -5, 1.5, t, 1, seconds)
          placePanner(s.panner, yaw + r(50, 90) * (Math.random() < 0.5 ? -1 : 1), 0, 1.5, layer.frame, t + seconds * 0.9, seconds / 3)
          V.bee(rig!, s.input, t, seconds)
          return seconds + r(6, 16)
        })
      }
    }
    if (a.cowbells) {
      const { at, level } = a.cowbells
      for (let i = 0; i < 4; i++) {
        const s = source(layer, at + r(-55, 55), -2, r(50, 140), 0.9)
        layer.fixed.push(s)
        const f = r(520, 1100)
        let left = 0
        every(layer, r(0, 8), (t) => {
          V.bell(rig!, s.input, t, f, 0.06 * level)
          if (left <= 0) left = Math.floor(r(2, 7))
          left--
          return left > 0 ? r(0.25, 0.7) : r(3, 14)
        })
      }
    }
    if (a.marmots) {
      every(layer, r(6, 18), (t) => {
        V.marmot(rig!, from(layer, r(-180, 180), r(0, 10), r(60, 120), t, 3, 1), t)
        return r(22, 55)
      })
    }
    if (a.fire) {
      const { at, level } = a.fire
      const hearth = source(layer, at, -8, 4, 0.5)
      layer.fixed.push(hearth)
      const roar = loop(layer, 'brown', [filter('lowpass', 220)], 0.12 * level, hearth.input)
      wobble(layer, roar.gain, 0.3, 0.04 * level)
      every(layer, 0.2, (t) => {
        V.crackle(rig!, hearth.input, t, 0.12 * level)
        return Math.random() < 0.15 ? r(0.01, 0.04) : r(0.06, 0.45)
      })
    }
    if (a.hut) {
      loop(layer, 'brown', [filter('lowpass', 140)], 0.06, out)
      every(layer, r(2, 6), (t) => {
        V.clink(rig!, from(layer, r(-180, 180), -10, r(5, 10), t), t)
        return r(4, 12)
      })
      every(layer, r(5, 15), (t) => {
        V.creak(rig!, from(layer, r(-180, 180), -20, r(3, 8), t), t)
        return r(10, 25)
      })
    }
    if (a.rain) {
      loop(layer, 'pink', [filter('highpass', 900), filter('lowpass', 7000)], 0.1 * a.rain, out)
      every(layer, 0.1, (t) => {
        V.drop(rig!, from(layer, r(-180, 180), r(-40, 10), r(2, 6), t, 1, 0.08), t, r(0.02, 0.07) * a.rain!)
        return r(0.02, 0.08)
      })
    }
    if (a.traffic) {
      const far = source(layer, r(-180, 180), 0, 90, 0.8)
      layer.fixed.push(far)
      loop(layer, 'brown', [filter('lowpass', 180)], 0.2 * a.traffic, far.input)
      every(layer, r(4, 12), (t) => {
        const yaw = r(-180, 180)
        const seconds = r(4, 7)
        const s = claim(layer, yaw - 70, 0, 40, t, 1, seconds)
        placePanner(s.panner, yaw + 70, 0, 40, layer.frame, t + 0.1, seconds / 2.5)
        V.burst(rig!, s.input, t, { noise: 'brown', dur: seconds, gain: 0.25 * a.traffic!, filter: 'lowpass', freq: 500, to: 700, attack: seconds / 2 })
        return seconds + r(10, 25)
      })
    }
    return layer
  }

  function dropLayer(layer: Layer, fade: number) {
    const { ctx } = rig!
    layer.out.gain.cancelScheduledValues(ctx.currentTime)
    layer.out.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, fade / 3))
    layer.timers = []
    setTimeout(
      () => {
        for (const stop of layer.stoppers) {
          try {
            stop()
          } catch {
            // Already stopped.
          }
        }
        for (const s of [...layer.fixed, ...layer.pool]) {
          s.input.disconnect()
          s.panner.disconnect()
          s.send.disconnect()
        }
        layer.out.disconnect()
      },
      fade * 1000 + 600,
    )
  }

  function tick(now = rig?.ctx.currentTime ?? 0) {
    if (!rig) return
    for (const layer of layers) {
      for (const timer of layer.timers) {
        let guard = 0
        while (timer.next < now + 0.2 && guard++ < 50) {
          const t = Math.max(timer.next, now + 0.01)
          timer.next = t + Math.max(0.005, timer.fire(t))
        }
      }
      layer.gustChange -= 0.05
      if (layer.gustChange <= 0) {
        layer.gustTarget = r(0.15, 1)
        layer.gustChange = r(1.5, 6)
      }
      layer.gust += (layer.gustTarget - layer.gust) * 0.04
      for (const { param, base, depth } of layer.gustParams) {
        param.setTargetAtTime(Math.max(0.0001, base * (1 + (layer.gust - 0.5) * depth)), now, 0.25)
      }
    }
  }

  function startScene(ambience: Ambience, frame: number, fade: number) {
    for (const layer of layers) dropLayer(layer, fade)
    layers = [build(ambience, frame, fade)]
  }

  const level = () => volume * 2.4 * (ducked ? 0.15 : 1)

  function listen() {
    if (!rig) return
    const l = rig.ctx.listener
    const y = (view.yaw * Math.PI) / 180
    const p = (view.pitch * Math.PI) / 180
    const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)]
    const u = [-Math.sin(y) * Math.sin(p), Math.cos(p), Math.cos(y) * Math.sin(p)]
    const t = rig.ctx.currentTime
    if (l.forwardX) {
      l.forwardX.setTargetAtTime(f[0], t, 0.03)
      l.forwardY.setTargetAtTime(f[1], t, 0.03)
      l.forwardZ.setTargetAtTime(f[2], t, 0.03)
      l.upX.setTargetAtTime(u[0], t, 0.03)
      l.upY.setTargetAtTime(u[1], t, 0.03)
      l.upZ.setTargetAtTime(u[2], t, 0.03)
    } else {
      ;(l as unknown as { setOrientation: (...a: number[]) => void }).setOrientation(f[0], f[1], f[2], u[0], u[1], u[2])
    }
  }

  return {
    get enabled() {
      return enabled
    },
    /** Turns sound on. Call from a click or key press: browsers only allow sound after one. */
    async enable() {
      if (suspendTimer) clearTimeout(suspendTimer)
      suspendTimer = null
      if (!rig) {
        try {
          rig = createRig(context?.())
        } catch {
          return false
        }
      }
      enabled = true
      if (rig.ctx instanceof AudioContext) await rig.ctx.resume().catch(() => undefined)
      rig.master.gain.setTargetAtTime(level(), rig.ctx.currentTime, 0.4)
      ticker ??= setInterval(tick, 50)
      if (pending && !layers.length) startScene(pending.ambience, pending.frame, 2)
      listen()
      return true
    },
    disable() {
      enabled = false
      if (!rig) return
      rig.master.gain.setTargetAtTime(0, rig.ctx.currentTime, 0.15)
      suspendTimer = setTimeout(() => {
        if (rig?.ctx instanceof AudioContext) void rig.ctx.suspend()
        if (ticker) clearInterval(ticker)
        ticker = null
      }, 900)
    },
    setVolume(v: number) {
      volume = v
      if (rig && enabled) rig.master.gain.setTargetAtTime(level(), rig.ctx.currentTime, 0.1)
    },
    /** Quieter while something else plays (a sound or a video in a blog post). */
    duck(on: boolean) {
      ducked = Math.max(0, ducked + (on ? 1 : -1))
      if (rig && enabled) rig.master.gain.setTargetAtTime(level(), rig.ctx.currentTime, 0.3)
    },
    /** The sounds of a place; `frame` turns them (degrees) while still mid-walk in the previous photo's frame. */
    setScene(ambience: Ambience, { fade = 1.5, frame = 0 }: { fade?: number; frame?: number } = {}) {
      pending = { ambience, frame }
      if (rig && enabled) startScene(ambience, frame, fade)
      else if (rig) {
        // Silent for now: drop the old place's sounds, so turning sound back on starts this one.
        for (const layer of layers) dropLayer(layer, 0.05)
        layers = []
      }
    },
    /** Arrived: the camera's frame of reference is now the new photo's. */
    settle() {
      if (pending) pending.frame = 0
      const layer = layers[layers.length - 1]
      if (!rig || !layer || layer.frame === 0) return
      layer.frame = 0
      const t = rig.ctx.currentTime
      for (const s of [...layer.fixed, ...layer.pool]) placePanner(s.panner, s.yaw, s.pitch, s.distance, 0, t, 0)
    },
    listen(yaw: number, pitch: number) {
      view = { yaw, pitch }
      if (enabled) listen()
    },
    step(ground: Ground, side: -1 | 1, strength: number) {
      if (!rig || !enabled) return
      const { ctx } = rig
      const pan = ctx.createStereoPanner()
      pan.pan.value = side * 0.12
      pan.connect(rig.dry)
      V.footstep(rig, pan, ctx.currentTime + 0.01, ground, strength)
      setTimeout(() => pan.disconnect(), 800)
    },
    ui(sound: V.UiSound) {
      if (!rig || !enabled) return
      V.ui(rig, rig.dry, rig.ctx.currentTime + 0.01, sound)
    },
    /** Schedules everything up to `until` seconds on the audio clock, for rendering offline. */
    advance(until: number) {
      if (ticker) clearInterval(ticker)
      ticker = null
      for (let t = 0; t <= until; t += 0.05) tick(t)
    },
    dispose() {
      if (ticker) clearInterval(ticker)
      if (rig?.ctx instanceof AudioContext) void rig.ctx.close()
      rig = null
      layers = []
    },
  }
}

export type Soundscape = ReturnType<typeof createSoundscape>
