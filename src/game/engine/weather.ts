import { css, type RGB } from './color.ts'
import type { ScenePalette, WeatherParticle } from './palettes.ts'

type P = { x: number; y: number; vx: number; vy: number; phase: number; size: number; tone: number }

export type Wind = { sx: number; sy: number; vx: number; vy: number; active: boolean }

const BASE: Record<WeatherParticle, { fall: [number, number]; drift: [number, number]; density: number }> = {
  petal: { fall: [6, 12], drift: [4, 12], density: 1 / 2400 },
  seed: { fall: [-2, 4], drift: [3, 9], density: 1 / 3800 },
  leaf: { fall: [9, 17], drift: [4, 11], density: 1 / 2600 },
  snow: { fall: [9, 22], drift: [-3, 4], density: 1 / 1300 },
}

export class Weather {
  private ps: P[] = []
  private flies: P[] = []
  private kind: WeatherParticle = 'snow'

  private spawn(p: P, W: number, H: number, anywhere: boolean) {
    const cfg = BASE[this.kind]
    p.x = Math.random() * W
    p.y = anywhere ? Math.random() * H : -2 - Math.random() * 10
    p.vx = cfg.drift[0] + Math.random() * (cfg.drift[1] - cfg.drift[0])
    p.vy = cfg.fall[0] + Math.random() * (cfg.fall[1] - cfg.fall[0])
    p.phase = Math.random() * Math.PI * 2
    p.size = Math.random() < 0.18 ? 2 : 1
    p.tone = Math.random()
    if (this.kind === 'seed' && !anywhere) p.y = H * (0.3 + Math.random() * 0.7)
  }

  update(dt: number, W: number, H: number, camDx: number, kind: WeatherParticle, intensity: number, wind: Wind) {
    if (kind !== this.kind) {
      this.kind = kind
      for (const p of this.ps) this.spawn(p, W, H, true)
    }
    const target = Math.round(W * H * BASE[kind].density * intensity)
    while (this.ps.length < target) {
      const p = { x: 0, y: 0, vx: 0, vy: 0, phase: 0, size: 1, tone: 0 }
      this.spawn(p, W, H, true)
      this.ps.push(p)
    }
    if (this.ps.length > target) this.ps.length = target

    const t = performance.now() / 1000
    for (const p of this.ps) {
      let ax = 0
      let ay = 0
      if (wind.active) {
        const dx = p.x - wind.sx
        const dy = p.y - wind.sy
        const d2 = dx * dx + dy * dy
        if (d2 < 40 * 40) {
          const fall = 1 - Math.sqrt(d2) / 40
          ax += wind.vx * fall * 2.2 + (dx / 40) * 30 * fall
          ay += wind.vy * fall * 2.2 + (dy / 40) * 30 * fall
        }
      }
      p.vx += ax * dt
      p.vy += ay * dt
      const sway = kind === 'snow' ? Math.sin(t * 1.3 + p.phase) * 4 : Math.sin(t * 2.1 + p.phase) * 9
      const cfg = BASE[kind]
      // Ease back to the natural drift after a gust.
      p.vx += ((cfg.drift[0] + cfg.drift[1]) / 2 - p.vx) * dt * 0.6
      p.vy += ((cfg.fall[0] + cfg.fall[1]) / 2 - p.vy) * dt * 0.6
      p.x += (p.vx + sway) * dt - camDx * 0.85
      p.y += p.vy * dt
      if (p.y > H + 4 || p.y < -20 || p.x < -10 || p.x > W + 10) {
        this.spawn(p, W, H, false)
        if (p.x < 0) p.x += W
        if (camDx > 0.5) p.x = W - Math.random() * 20
        if (camDx < -0.5) p.x = Math.random() * 20
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, pal: ScenePalette) {
    const colors: Record<WeatherParticle, RGB[]> = {
      petal: [pal.blossom, [255, 255, 255]],
      seed: [[255, 250, 220], [250, 236, 170]],
      leaf: [pal.larch, pal.leaf, pal.larchLight],
      snow: [[255, 255, 255], [226, 238, 250]],
    }
    const palette = colors[this.kind].map((c) => css(c))
    const t = performance.now() / 1000
    for (const p of this.ps) {
      ctx.fillStyle = palette[Math.floor(p.tone * palette.length)]
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (this.kind === 'leaf') {
        const flat = Math.sin(t * 5 + p.phase) > 0
        ctx.fillRect(x, y, flat ? 2 : 1, flat ? 1 : 2)
      } else {
        ctx.fillRect(x, y, p.size, p.size)
      }
    }
  }

  /** Summer-night fireflies, drawn after the night tint so they glow. */
  fireflies(ctx: CanvasRenderingContext2D, dt: number, W: number, H: number, groundAt: (sx: number) => number, count: number) {
    while (this.flies.length < count) {
      this.flies.push({ x: Math.random() * W, y: 0, vx: 0, vy: 0, phase: Math.random() * 10, size: 1, tone: Math.random() })
    }
    if (this.flies.length > count) this.flies.length = count
    const t = performance.now() / 1000
    for (const f of this.flies) {
      f.x += Math.sin(t * 0.7 + f.phase) * 8 * dt
      if (f.x < 0) f.x += W
      if (f.x > W) f.x -= W
      const gy = groundAt(Math.round(f.x))
      f.y = gy - 6 - f.tone * 26 + Math.sin(t * 1.1 + f.phase * 3) * 4
      const glow = Math.max(0, Math.sin(t * 2.4 + f.phase * 5))
      if (glow < 0.2 || f.y < 0 || f.y > H) continue
      ctx.fillStyle = `rgba(214,255,120,${(glow * 0.9).toFixed(2)})`
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1)
      if (glow > 0.8) {
        ctx.fillStyle = 'rgba(214,255,120,0.25)'
        ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y), 3, 1)
        ctx.fillRect(Math.round(f.x), Math.round(f.y) - 1, 1, 3)
      }
    }
  }
}
