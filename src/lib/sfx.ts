/**
 * Tiny chiptune sound effects, synthesised with Web Audio (no audio files).
 * Sound is opt-in: nothing plays until the visitor enables it.
 */
export type SfxName =
  | 'blip'
  | 'select'
  | 'shutter'
  | 'whistle'
  | 'cowbell'
  | 'screech'
  | 'hoot'
  | 'chirp'
  | 'pop'
  | 'coin'
  | 'jump'
  | 'roar'
  | 'modem'
  | 'fanfare'
  | 'error'
  | 'flutter'
  | 'bark'
  | 'stamp'
  | 'splash'
  | 'boing'
  | 'clink'
  | 'slip'
  | 'bell'
  | 'baa'
  | 'gull'
  | 'honk'

type Ctx = { ac: AudioContext; out: GainNode }

let state: Ctx | null = null
let enabled = false
let lastPlayed = new Map<SfxName, number>()

function audio(): Ctx | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!state) {
    const ac = new AudioContext()
    const out = ac.createGain()
    out.gain.value = 0.22
    out.connect(ac.destination)
    state = { ac, out }
  }
  if (state.ac.state === 'suspended') void state.ac.resume()
  return state
}

type ToneOpts = {
  at?: number
  vol?: number
  type?: OscillatorType
  to?: number
  attack?: number
  vibrato?: number
}

function tone(c: Ctx, freq: number, dur: number, o: ToneOpts = {}) {
  const t0 = c.ac.currentTime + (o.at ?? 0)
  const osc = c.ac.createOscillator()
  const g = c.ac.createGain()
  osc.type = o.type ?? 'square'
  osc.frequency.setValueAtTime(freq, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur)
  if (o.vibrato) {
    const lfo = c.ac.createOscillator()
    const lg = c.ac.createGain()
    lfo.frequency.value = o.vibrato
    lg.gain.value = freq * 0.04
    lfo.connect(lg).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur)
  }
  const vol = o.vol ?? 0.5
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.out)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(c: Ctx, dur: number, o: { at?: number; vol?: number; filter?: number; type?: BiquadFilterType; am?: number } = {}) {
  const t0 = c.ac.currentTime + (o.at ?? 0)
  const len = Math.max(1, Math.floor(c.ac.sampleRate * dur))
  const buffer = c.ac.createBuffer(1, len, c.ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const am = o.am ? 0.5 + 0.5 * Math.sin((i / c.ac.sampleRate) * o.am * Math.PI * 2) : 1
    data[i] = (Math.random() * 2 - 1) * am
  }
  const src = c.ac.createBufferSource()
  src.buffer = buffer
  const filter = c.ac.createBiquadFilter()
  filter.type = o.type ?? 'highpass'
  filter.frequency.value = o.filter ?? 1000
  const g = c.ac.createGain()
  g.gain.setValueAtTime(o.vol ?? 0.3, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(g).connect(c.out)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

const DTMF: Record<string, [number, number]> = {
  '0': [941, 1336],
  '1': [697, 1209],
  '3': [697, 1477],
  '6': [770, 1477],
  '8': [852, 1336],
  '9': [852, 1477],
}

const SOUNDS: Record<SfxName, (c: Ctx) => void> = {
  blip: (c) => tone(c, 880, 0.05, { vol: 0.25 }),
  select: (c) => {
    tone(c, 660, 0.06, { vol: 0.25 })
    tone(c, 990, 0.08, { vol: 0.25, at: 0.06 })
  },
  shutter: (c) => {
    noise(c, 0.05, { vol: 0.5, filter: 3000 })
    noise(c, 0.04, { vol: 0.35, filter: 2000, at: 0.07 })
  },
  whistle: (c) => {
    tone(c, 1700, 0.12, { type: 'sine', to: 2700, vol: 0.45 })
    tone(c, 2700, 0.22, { type: 'sine', to: 2000, vol: 0.4, at: 0.12 })
  },
  cowbell: (c) => {
    tone(c, 540, 0.5, { vol: 0.25 })
    tone(c, 800, 0.45, { vol: 0.2 })
    tone(c, 540, 0.4, { vol: 0.15, at: 0.35 })
    tone(c, 800, 0.35, { vol: 0.12, at: 0.35 })
  },
  screech: (c) => tone(c, 2300, 0.45, { type: 'sawtooth', to: 1300, vol: 0.12, vibrato: 18 }),
  hoot: (c) => {
    tone(c, 360, 0.28, { type: 'sine', vol: 0.5, attack: 0.06 })
    tone(c, 330, 0.4, { type: 'sine', vol: 0.45, attack: 0.08, at: 0.38 })
  },
  chirp: (c) => {
    tone(c, 2500, 0.06, { to: 3300, vol: 0.18 })
    tone(c, 2700, 0.07, { to: 3500, vol: 0.16, at: 0.09 })
  },
  pop: (c) => tone(c, 300, 0.08, { type: 'triangle', to: 700, vol: 0.4 }),
  coin: (c) => {
    tone(c, 988, 0.08, { vol: 0.25 })
    tone(c, 1319, 0.28, { vol: 0.25, at: 0.08 })
  },
  jump: (c) => tone(c, 280, 0.16, { to: 760, vol: 0.25 }),
  roar: (c) => {
    noise(c, 0.7, { vol: 0.5, filter: 500, type: 'lowpass' })
    tone(c, 110, 0.7, { type: 'sawtooth', to: 70, vol: 0.25, vibrato: 9 })
  },
  modem: (c) => {
    // Dial a few digits, then the handshake chirps and hiss of a 2400 baud modem.
    const digits = '0036183'
    ;[...digits].forEach((d, i) => {
      const pair = DTMF[d] ?? DTMF['8']
      tone(c, pair[0], 0.07, { type: 'sine', vol: 0.18, at: i * 0.09 })
      tone(c, pair[1], 0.07, { type: 'sine', vol: 0.18, at: i * 0.09 })
    })
    const t = digits.length * 0.09 + 0.15
    tone(c, 2100, 0.35, { type: 'sine', vol: 0.15, at: t })
    tone(c, 1650, 0.2, { type: 'square', vol: 0.06, at: t + 0.4, to: 1850 })
    tone(c, 980, 0.18, { type: 'square', vol: 0.06, at: t + 0.62, to: 1180 })
    noise(c, 0.6, { vol: 0.12, filter: 1500, at: t + 0.85 })
  },
  fanfare: (c) => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(c, f, i === 3 ? 0.35 : 0.1, { vol: 0.22, at: i * 0.1 }))
  },
  error: (c) => {
    tone(c, 330, 0.12, { vol: 0.25 })
    tone(c, 220, 0.25, { vol: 0.25, at: 0.12, to: 110 })
  },
  flutter: (c) => noise(c, 0.3, { vol: 0.25, filter: 900, am: 16 }),
  bark: (c) => {
    tone(c, 520, 0.09, { type: 'sawtooth', to: 300, vol: 0.18 })
    noise(c, 0.08, { vol: 0.12, filter: 800 })
  },
  stamp: (c) => {
    noise(c, 0.06, { vol: 0.5, filter: 200, type: 'lowpass' })
    tone(c, 120, 0.1, { type: 'triangle', vol: 0.4 })
  },
  splash: (c) => {
    noise(c, 0.35, { vol: 0.35, filter: 1200, type: 'bandpass' })
    noise(c, 0.2, { vol: 0.2, filter: 3000, at: 0.05 })
  },
  boing: (c) => tone(c, 180, 0.3, { type: 'triangle', to: 520, vol: 0.35, vibrato: 12 }),
  clink: (c) => {
    tone(c, 2600, 0.05, { type: 'triangle', vol: 0.3 })
    tone(c, 3400, 0.09, { type: 'triangle', vol: 0.2, at: 0.04 })
  },
  slip: (c) => {
    tone(c, 900, 0.5, { type: 'square', to: 120, vol: 0.18 })
    noise(c, 0.3, { vol: 0.2, filter: 600, type: 'lowpass', at: 0.45 })
  },
  bell: (c) => {
    tone(c, 2100, 0.25, { type: 'sine', vol: 0.3 })
    tone(c, 2100, 0.3, { type: 'sine', vol: 0.25, at: 0.16 })
  },
  baa: (c) => tone(c, 420, 0.45, { type: 'sawtooth', to: 380, vol: 0.12, vibrato: 22 }),
  gull: (c) => {
    tone(c, 1500, 0.12, { type: 'sawtooth', to: 1900, vol: 0.1 })
    tone(c, 1700, 0.18, { type: 'sawtooth', to: 1200, vol: 0.1, at: 0.14 })
  },
  honk: (c) => {
    tone(c, 330, 0.14, { type: 'square', to: 300, vol: 0.18 })
    tone(c, 330, 0.16, { type: 'square', to: 280, vol: 0.16, at: 0.2 })
  },
}

export const sfx = {
  get enabled() {
    return enabled
  },
  setEnabled(value: boolean) {
    enabled = value
    // Creating/resuming the context inside the click that enabled sound satisfies autoplay rules.
    if (value) audio()
  },
  play(name: SfxName) {
    if (!enabled) return
    const now = performance.now()
    if (now - (lastPlayed.get(name) ?? 0) < 60) return
    lastPlayed.set(name, now)
    const c = audio()
    if (!c) return
    try {
      SOUNDS[name](c)
    } catch {
      // Audio is a nicety; never let it break the page.
    }
  },
  /** Test hook. */
  _reset() {
    lastPlayed = new Map()
  },
}
