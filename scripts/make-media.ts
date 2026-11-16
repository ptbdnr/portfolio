/**
 * Generates the original media used by the sample logbook posts (run with `npm run media`):
 *  - public/media/sandpile.mp4 + sandpile.png — a Bak–Tang–Wiesenfeld sandpile growing from one source
 *  - public/media/avalanche-sizes.svg — log-log histogram of avalanche sizes (the power law)
 *  - public/media/hut-graph.svg — a toy hut-to-hut network for the route-planning post
 *  - public/media/reliability.svg — reliability diagram for the calibration post
 *  - public/media/sandpile-crackle.mp3 — what a sandpile at the critical point sounds like: one
 *    click per toppling, so each avalanche is heard as a crackle as long as it is big
 * Requires ffmpeg on PATH for the video, the PNG and the sound.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('public/media')
const N = 96
const COLORS: [number, number, number][] = [
  [16, 20, 44],
  [59, 93, 201],
  [115, 239, 247],
  [244, 244, 244],
]

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Add one grain at (x, y) and relax; returns the avalanche size (number of topplings). */
function addGrain(grid: Uint8Array, n: number, x: number, y: number, stack: number[]) {
  let size = 0
  grid[y * n + x]++
  stack.length = 0
  if (grid[y * n + x] >= 4) stack.push(y * n + x)
  while (stack.length) {
    const i = stack.pop()!
    if (grid[i] < 4) continue
    grid[i] -= 4
    size++
    const cx = i % n
    const cy = (i / n) | 0
    if (grid[i] >= 4) stack.push(i)
    const nb = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ]
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue // grains fall off the edge
      const j = ny * n + nx
      grid[j]++
      if (grid[j] === 4) stack.push(j)
    }
  }
  return size
}

function frameOf(grid: Uint8Array) {
  const buf = Buffer.alloc(N * N * 3)
  for (let i = 0; i < N * N; i++) {
    const c = COLORS[Math.min(3, grid[i])]
    buf[i * 3] = c[0]
    buf[i * 3 + 1] = c[1]
    buf[i * 3 + 2] = c[2]
  }
  return buf
}

function ffmpeg(args: string[], input: Buffer[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'] })
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))))
    for (const chunk of input) proc.stdin.write(chunk)
    proc.stdin.end()
  })
}

async function sandpileVideo() {
  const grid = new Uint8Array(N * N)
  const stack: number[] = []
  const frames: Buffer[] = []
  const total = 16000
  const nFrames = 300
  let added = 0
  for (let f = 0; f < nFrames; f++) {
    // Ease-in: few grains per frame at first so the early growth is visible.
    const target = Math.round(total * Math.pow((f + 1) / nFrames, 1.6))
    while (added < target) {
      addGrain(grid, N, N >> 1, N >> 1, stack)
      added++
    }
    frames.push(frameOf(grid))
  }
  for (let i = 0; i < 45; i++) frames.push(frames[frames.length - 1])
  const size = `${N}x${N}`
  await ffmpeg(
    [
      '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', size, '-r', '30', '-i', '-',
      '-vf', `scale=${N * 4}:${N * 4}:flags=neighbor`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart',
      path.join(OUT, 'sandpile.mp4'),
    ],
    frames,
  )
  await ffmpeg(
    ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', size, '-i', '-', '-vf', `scale=${N * 4}:${N * 4}:flags=neighbor`, '-frames:v', '1', path.join(OUT, 'sandpile.png')],
    [frames[frames.length - 1]],
  )
}

function avalancheHistogram() {
  const n = 48
  const grid = new Uint8Array(n * n)
  const rand = mulberry32(1983)
  const stack: number[] = []
  // Drive to the critical state, then record.
  for (let i = 0; i < 40000; i++) addGrain(grid, n, (rand() * n) | 0, (rand() * n) | 0, stack)
  const sizes: number[] = []
  for (let i = 0; i < 120000; i++) {
    const s = addGrain(grid, n, (rand() * n) | 0, (rand() * n) | 0, stack)
    if (s > 0) sizes.push(s)
  }
  // Log-binned histogram.
  const bins = new Map<number, number>()
  for (const s of sizes) {
    const b = Math.floor(Math.log2(s) * 2)
    bins.set(b, (bins.get(b) ?? 0) + 1)
  }
  const points = [...bins.entries()]
    .map(([b, count]) => {
      const lo = Math.pow(2, b / 2)
      const hi = Math.pow(2, (b + 1) / 2)
      return { x: Math.sqrt(lo * hi), y: count / sizes.length / (hi - lo) }
    })
    .filter((p) => p.y > 0)
    .sort((a, b) => a.x - b.x)

  const W = 480
  const H = 300
  const pad = { l: 56, r: 16, t: 20, b: 44 }
  const lx = (v: number) => Math.log10(v)
  const xs = points.map((p) => lx(p.x))
  const ys = points.map((p) => lx(p.y))
  const [x0, x1] = [Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))]
  const [y0, y1] = [Math.floor(Math.min(...ys)), Math.ceil(Math.max(...ys))]
  const px = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const py = (v: number) => H - pad.b - ((v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  // Least-squares slope on the middle of the range (avoid finite-size cut-off).
  const mid = points.filter((p) => p.x > 2 && p.x < 300)
  const mx = mid.map((p) => lx(p.x))
  const my = mid.map((p) => lx(p.y))
  const ax = mx.reduce((a, b) => a + b, 0) / mx.length
  const ay = my.reduce((a, b) => a + b, 0) / my.length
  const slope = mx.reduce((a, x, i) => a + (x - ax) * (my[i] - ay), 0) / mx.reduce((a, x) => a + (x - ax) ** 2, 0)
  const icpt = ay - slope * ax

  const grid1: string[] = []
  for (let v = x0; v <= x1; v++) {
    grid1.push(`<line x1="${px(v)}" y1="${pad.t}" x2="${px(v)}" y2="${H - pad.b}" stroke="#333c57"/>`)
    grid1.push(`<text x="${px(v)}" y="${H - pad.b + 18}" text-anchor="middle">10^${v}</text>`)
  }
  for (let v = y0; v <= y1; v += 2) {
    grid1.push(`<line x1="${pad.l}" y1="${py(v)}" x2="${W - pad.r}" y2="${py(v)}" stroke="#333c57"/>`)
    grid1.push(`<text x="${pad.l - 8}" y="${py(v) + 4}" text-anchor="end">10^${v}</text>`)
  }
  const dots = points.map((p) => `<rect x="${px(lx(p.x)) - 3}" y="${py(lx(p.y)) - 3}" width="6" height="6" fill="#73eff7"/>`)
  const fx0 = lx(2)
  const fx1 = lx(300)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" font-family="monospace" font-size="12" fill="#c9d6e3">
<rect width="${W}" height="${H}" fill="#10142c"/>
${grid1.join('\n')}
<line x1="${px(fx0)}" y1="${py(icpt + slope * fx0)}" x2="${px(fx1)}" y2="${py(icpt + slope * fx1)}" stroke="#f9a31b" stroke-width="2" stroke-dasharray="6 4"/>
${dots.join('\n')}
<text x="${W - pad.r}" y="${pad.t + 14}" text-anchor="end" fill="#f9a31b">slope ≈ ${slope.toFixed(2)}</text>
<text x="${(W + pad.l) / 2}" y="${H - 8}" text-anchor="middle">avalanche size s (topplings)</text>
<text x="14" y="${H / 2}" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">P(s)</text>
</svg>`
  return { svg, slope }
}

function hutGraph() {
  const huts = [
    { id: 'Valley', x: 50, y: 250 },
    { id: 'Rif. A', x: 170, y: 150 },
    { id: 'Rif. B', x: 300, y: 210 },
    { id: 'Biv. C', x: 330, y: 90 },
    { id: 'Rif. D', x: 450, y: 160 },
    { id: 'Summit', x: 560, y: 50 },
  ]
  const edges: [number, number, string][] = [
    [0, 1, '3h'],
    [0, 2, '4h30'],
    [1, 2, '2h'],
    [1, 3, '3h30'],
    [2, 3, '2h15'],
    [2, 4, '3h'],
    [3, 5, '4h'],
    [4, 5, '3h15'],
  ]
  const best = new Set(['0-1', '1-3', '3-5'])
  const lines = edges.map(([a, b, t]) => {
    const A = huts[a]
    const B = huts[b]
    const on = best.has(`${a}-${b}`)
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${on ? '#d7263d' : '#566c86'}" stroke-width="${on ? 4 : 2}" ${on ? '' : 'stroke-dasharray="4 4"'}/>
<text x="${(A.x + B.x) / 2 + 6}" y="${(A.y + B.y) / 2 - 6}" fill="#f4ecd8">${t}</text>`
  })
  const nodes = huts.map(
    (h) => `<rect x="${h.x - 9}" y="${h.y - 9}" width="18" height="18" fill="${h.id === 'Summit' ? '#f4f4f4' : '#f2d14b'}" stroke="#1a1c2c" stroke-width="3"/>
<text x="${h.x}" y="${h.y + 28}" text-anchor="middle" fill="#f4ecd8">${h.id}</text>`,
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 300" width="620" height="300" shape-rendering="crispEdges" font-family="monospace" font-size="13">
<rect width="620" height="300" fill="#10142c"/>
<path d="M0 300 L120 180 L200 220 L320 60 L420 150 L560 20 L620 80 L620 300 Z" fill="#1d2b53"/>
${lines.join('\n')}
${nodes.join('\n')}
</svg>`
}

function reliability() {
  const rand = mulberry32(83)
  // Synthetic "summit or turn back" forecasts: an over-confident model vs. a calibrated one.
  const bins = 10
  const tally = (confFn: (p: number) => number) => {
    const sum = new Array(bins).fill(0)
    const hits = new Array(bins).fill(0)
    const cnt = new Array(bins).fill(0)
    for (let i = 0; i < 20000; i++) {
      const p = rand()
      const outcome = rand() < p ? 1 : 0
      const c = Math.min(0.999, Math.max(0, confFn(p)))
      const b = Math.min(bins - 1, Math.floor(c * bins))
      sum[b] += c
      hits[b] += outcome
      cnt[b]++
    }
    return cnt.map((n, b) => ({ conf: n ? sum[b] / n : (b + 0.5) / bins, acc: n ? hits[b] / n : 0, n }))
  }
  const over = tally((p) => 0.5 + (p - 0.5) * 1.8)
  const cal = tally((p) => p + (rand() - 0.5) * 0.05)
  const W = 480
  const H = 320
  const pad = 46
  const sx = (v: number) => pad + v * (W - pad * 2)
  const sy = (v: number) => H - pad - v * (H - pad * 2)
  const bars = (data: typeof over, color: string, offset: number) =>
    data
      .filter((d) => d.n > 50)
      .map((d, i) => {
        const x = sx(i / bins) + offset
        return `<rect x="${x}" y="${sy(d.acc)}" width="${(W - pad * 2) / bins / 2 - 2}" height="${sy(0) - sy(d.acc)}" fill="${color}"/>`
      })
      .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" font-family="monospace" font-size="12" fill="#c9d6e3">
<rect width="${W}" height="${H}" fill="#10142c"/>
<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(1)}" stroke="#f4f4f4" stroke-dasharray="5 5"/>
${bars(over, '#d7263d', 1)}
${bars(cal, '#38b764', (W - pad * 2) / bins / 2)}
<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(0)}" stroke="#94b0c2"/>
<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(0)}" y2="${sy(1)}" stroke="#94b0c2"/>
<text x="${W / 2}" y="${H - 10}" text-anchor="middle">predicted probability of a good summit day</text>
<text x="14" y="${H / 2}" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">observed frequency</text>
<rect x="${pad + 10}" y="${pad - 24}" width="10" height="10" fill="#d7263d"/><text x="${pad + 26}" y="${pad - 15}">over-confident</text>
<rect x="${pad + 150}" y="${pad - 24}" width="10" height="10" fill="#38b764"/><text x="${pad + 166}" y="${pad - 15}">calibrated</text>
</svg>`
}

/**
 * The sandpile, listened to. Grains drop at random on a 48×48 table already at its critical point;
 * every toppling is a short click, in the order the avalanche spreads, so a small avalanche is a
 * single tick and a big one a long crackle. Louder towards the middle of the table, and panned by
 * where on it the toppling happens.
 */
async function sandpileSound() {
  const n = 48
  const rate = 44100
  const seconds = 24
  const grid = new Uint8Array(n * n)
  const rand = mulberry32(2026)
  const stack: number[] = []
  for (let i = 0; i < 40000; i++) addGrain(grid, n, (rand() * n) | 0, (rand() * n) | 0, stack)

  const left = new Float32Array(rate * seconds)
  const right = new Float32Array(rate * seconds)
  // One click: a few milliseconds of a resonant knock, its pitch a little random.
  const click = (at: number, gain: number, pan: number) => {
    const f = 1800 + rand() * 2600
    const length = Math.floor(rate * 0.006)
    for (let i = 0; i < length && at + i < left.length; i++) {
      const env = Math.exp(-i / (rate * 0.0012))
      const v = Math.sin((2 * Math.PI * f * i) / rate) * env * gain
      left[at + i] += v * Math.cos(((pan + 1) * Math.PI) / 4)
      right[at + i] += v * Math.sin(((pan + 1) * Math.PI) / 4)
    }
  }

  let t = rate * 0.5
  const end = left.length - rate
  while (t < end) {
    const x = (rand() * n) | 0
    const y = (rand() * n) | 0
    // Relax by hand, noting where each toppling happens.
    grid[y * n + x]++
    const topples: number[] = []
    stack.length = 0
    if (grid[y * n + x] >= 4) stack.push(y * n + x)
    while (stack.length) {
      const i = stack.shift()!
      if (grid[i] < 4) continue
      grid[i] -= 4
      topples.push(i)
      const cx = i % n
      const cy = (i / n) | 0
      if (grid[i] >= 4) stack.push(i)
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
        const j = ny * n + nx
        if (++grid[j] === 4) stack.push(j)
      }
    }
    // The grain landing: a soft tick. Then the avalanche, at about 2,500 topplings a second.
    click(Math.floor(t), 0.05, (x / n) * 2 - 1)
    topples.forEach((i, k) => {
      const cx = i % n
      const cy = (i / n) | 0
      const centre = 1 - Math.hypot(cx - n / 2, cy - n / 2) / (n * 0.75)
      click(Math.floor(t + rate * 0.012 + k * rate * 0.0004 * (0.7 + rand() * 0.6)), 0.18 + 0.12 * centre, (cx / n) * 2 - 1)
    })
    t += rate * (0.035 + rand() * 0.05) + topples.length * rate * 0.0004
  }
  // Fade in and out, then write 16-bit stereo for ffmpeg.
  const pcm = Buffer.alloc(left.length * 4)
  for (let i = 0; i < left.length; i++) {
    const fade = Math.min(1, i / (rate * 0.3), (left.length - i) / (rate * 0.8))
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * fade)) * 26000), i * 4)
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * fade)) * 26000), i * 4 + 2)
  }
  await ffmpeg(
    ['-y', '-f', 's16le', '-ar', String(rate), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '128k', '-id3v2_version', '0', '-write_xing', '1', '-fflags', '+bitexact', path.join(OUT, 'sandpile-crackle.mp3')],
    [pcm],
  )
}

await mkdir(OUT, { recursive: true })
if (process.argv.includes('--sound')) {
  await sandpileSound()
  console.log('sandpile-crackle.mp3')
  process.exit(0)
}
const hist = avalancheHistogram()
await writeFile(path.join(OUT, 'avalanche-sizes.svg'), hist.svg)
console.log(`avalanche-sizes.svg (fitted slope ${hist.slope.toFixed(2)})`)
await writeFile(path.join(OUT, 'hut-graph.svg'), hutGraph())
await writeFile(path.join(OUT, 'reliability.svg'), reliability())
console.log('hut-graph.svg, reliability.svg')
await sandpileVideo()
console.log('sandpile.mp4, sandpile.png')
await sandpileSound()
console.log('sandpile-crackle.mp3')
