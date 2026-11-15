import type { Glow, Light, View } from './view.ts'

export type Torch = {
  /** Head (lamp) position. */
  hx: number
  hy: number
  /** Where the beam points. */
  tx: number
  ty: number
}

export type Eye = { x: number; y: number; lit: boolean; color: string }

const SPREAD = 0.36
const beamLength = (t: Torch, W: number) => Math.min(W * 0.9, Math.max(46, Math.hypot(t.tx - t.hx, t.ty - t.hy) + 26))

/**
 * Night-time lighting: a darkness layer over the land (never the sky, so the stars stay crisp),
 * with light cut out of it — the climber's head torch following the pointer, lit windows,
 * the glowing hut door — and eyeshine from animals caught in the dark.
 */
export class Night {
  private mask: HTMLCanvasElement
  private m: CanvasRenderingContext2D

  constructor() {
    this.mask = document.createElement('canvas')
    this.m = this.mask.getContext('2d')!
  }

  resize(W: number, H: number) {
    this.mask.width = W
    this.mask.height = H
  }

  /** Whether a screen point is inside the torch beam. */
  static inBeam(t: Torch | null, x: number, y: number) {
    if (!t) return false
    const ax = t.tx - t.hx
    const ay = t.ty - t.hy
    const len = Math.hypot(ax, ay) || 1
    const bx = x - t.hx
    const by = y - t.hy
    const along = (bx * ax + by * ay) / len
    if (along < 0 || along > len + 30) return false
    const across = Math.abs(bx * ay - by * ax) / len
    return across < 6 + along * SPREAD
  }

  /**
   * Darkens the scene layer (everything except the sky, which lives on another canvas) and cuts
   * the torch beam and glows out of the darkness.
   */
  darken(scene: CanvasRenderingContext2D, v: View, amount: number, torch: Torch | null, glows: Glow[]) {
    const { W, H } = v
    const m = this.m
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, W, H)
    const grad = m.createLinearGradient(0, v.horizon - 30, 0, v.ground0 + 10)
    grad.addColorStop(0, `rgba(3,5,18,${(0.42 * amount).toFixed(3)})`)
    grad.addColorStop(1, `rgba(3,5,18,${(0.78 * amount).toFixed(3)})`)
    m.fillStyle = grad
    m.fillRect(0, 0, W, H)

    m.globalCompositeOperation = 'destination-out'
    if (torch) {
      const { hx, hy, tx, ty } = torch
      const ang = Math.atan2(ty - hy, tx - hx)
      const len = beamLength(torch, W)
      const cone = m.createRadialGradient(hx, hy, 2, hx, hy, len)
      cone.addColorStop(0, 'rgba(0,0,0,0.95)')
      cone.addColorStop(0.65, 'rgba(0,0,0,0.75)')
      cone.addColorStop(1, 'rgba(0,0,0,0)')
      m.fillStyle = cone
      m.beginPath()
      m.moveTo(hx, hy)
      m.arc(hx, hy, len, ang - SPREAD, ang + SPREAD)
      m.closePath()
      m.fill()
      const spot = m.createRadialGradient(tx, ty, 1, tx, ty, 16)
      spot.addColorStop(0, 'rgba(0,0,0,1)')
      spot.addColorStop(1, 'rgba(0,0,0,0)')
      m.fillStyle = spot
      m.fillRect(tx - 16, ty - 16, 32, 32)
      const halo = m.createRadialGradient(hx, hy, 1, hx, hy, 14)
      halo.addColorStop(0, 'rgba(0,0,0,0.85)')
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      m.fillStyle = halo
      m.fillRect(hx - 14, hy - 14, 28, 28)
    }
    for (const g of glows) {
      if (g.x < -g.r || g.x > W + g.r) continue
      const rg = m.createRadialGradient(g.x, g.y, 1, g.x, g.y, g.r)
      rg.addColorStop(0, `rgba(0,0,0,${g.strength.toFixed(2)})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      m.fillStyle = rg
      m.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
    }
    m.globalCompositeOperation = 'source-over'
    scene.globalCompositeOperation = 'source-atop'
    scene.drawImage(this.mask, 0, 0)
    scene.globalCompositeOperation = 'source-over'
  }

  /** Emissive things drawn over the composited frame: the beam's warmth, windows, eyes. */
  light(ctx: CanvasRenderingContext2D, v: View, amount: number, torch: Torch | null, glows: Glow[], lights: Light[], eyes: Eye[]) {
    const { W } = v
    // Warm light on top: the beam itself, then window and door glows.
    const glowAlpha = Math.min(1, amount * 1.2)
    ctx.globalCompositeOperation = 'lighter'
    if (torch) {
      const { hx, hy, tx, ty } = torch
      const ang = Math.atan2(ty - hy, tx - hx)
      const len = beamLength(torch, W)
      const beam = ctx.createRadialGradient(hx, hy, 2, hx, hy, len)
      beam.addColorStop(0, `rgba(255,226,160,${(0.2 * glowAlpha).toFixed(3)})`)
      beam.addColorStop(1, 'rgba(255,226,160,0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(hx, hy)
      ctx.arc(hx, hy, len, ang - SPREAD, ang + SPREAD)
      ctx.closePath()
      ctx.fill()
    }
    for (const g of glows) {
      if (!g.warm || g.x < -g.r || g.x > W + g.r) continue
      const rg = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, g.r * 0.8)
      rg.addColorStop(0, `rgba(255,170,80,${(0.22 * g.strength * glowAlpha).toFixed(3)})`)
      rg.addColorStop(1, 'rgba(255,170,80,0)')
      ctx.fillStyle = rg
      ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
    }
    ctx.globalCompositeOperation = 'source-over'

    ctx.globalAlpha = glowAlpha
    for (const l of lights) ctx.drawImage(l.c, l.x, l.y)
    ctx.globalAlpha = 1
    if (torch) {
      ctx.fillStyle = '#fff6c4'
      ctx.fillRect(Math.round(torch.hx), Math.round(torch.hy), 1, 1)
    }
    for (const e of eyes) {
      ctx.globalAlpha = (e.lit ? 1 : 0.55) * glowAlpha
      ctx.fillStyle = e.color
      ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1)
      if (e.lit) {
        ctx.globalAlpha = 0.35 * glowAlpha
        ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y), 3, 1)
        ctx.fillRect(Math.round(e.x), Math.round(e.y) - 1, 1, 3)
      }
    }
    ctx.globalAlpha = 1
  }
}
