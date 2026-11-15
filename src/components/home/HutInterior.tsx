import { useEffect, useRef } from 'react'
import { useGame } from '../../lib/store.ts'

const W = 120
const H = 54

/** A tiny animated pixel scene of the hut's interior: stove, soup, bunks and a shelf of notebooks. */
export function HutInterior() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useGame((s) => s.reducedMotion)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let t = 0
    const px = (c: string, x: number, y: number, w = 1, h = 1) => {
      ctx.fillStyle = c
      ctx.fillRect(x, y, w, h)
    }
    const draw = () => {
      // Wooden walls and floor.
      px('#6b4a32', 0, 0, W, H)
      for (let y = 0; y < 40; y += 5) px('#5a3a22', 0, y, W, 1)
      px('#4a3020', 0, 40, W, H - 40)
      for (let x = 0; x < W; x += 9) px('#3c2618', x, 40, 1, H - 40)
      // Window with mountains.
      px('#2f2014', 8, 6, 26, 18)
      px('#9fd3f2', 9, 7, 24, 16)
      px('#f4f8fb', 14, 12, 6, 2)
      px('#c9d6e3', 12, 14, 10, 3)
      px('#8b8f99', 9, 17, 24, 6)
      px('#f4f8fb', 23, 13, 4, 2)
      px('#8b8f99', 21, 15, 8, 2)
      px('#2f2014', 20, 7, 1, 16)
      px('#2f2014', 9, 14, 24, 1)
      // Shelf of notebooks (the blog!).
      px('#3c2618', 44, 18, 30, 2)
      const spines = ['#b13e53', '#41a6f6', '#f9a31b', '#38b764', '#f4f4f4', '#7b4f9d', '#ef7d57', '#3b5dc9']
      spines.forEach((c, i) => px(c, 45 + i * 3 + (i > 4 ? 2 : 0), 10 + (i % 3 === 0 ? 1 : 0), 2, 8 - (i % 3 === 0 ? 1 : 0)))
      px('#f9a31b', 69, 12, 4, 6)
      // Bunks.
      px('#3c2618', 82, 8, 34, 2)
      px('#b13e53', 83, 6, 32, 2)
      px('#f4f4f4', 84, 5, 5, 2)
      px('#3c2618', 82, 26, 34, 2)
      px('#3b5dc9', 83, 24, 32, 2)
      px('#f4f4f4', 109, 23, 5, 2)
      px('#3c2618', 82, 8, 2, 32)
      px('#3c2618', 114, 8, 2, 32)
      // Table with soup and a candle.
      px('#8a5a3b', 40, 32, 34, 3)
      px('#5a3a22', 43, 35, 2, 8)
      px('#5a3a22', 69, 35, 2, 8)
      px('#f4f4f4', 48, 29, 8, 3)
      px('#d9a066', 49, 29, 6, 1)
      px('#f4f4f4', 62, 27, 2, 5)
      // Stove with a flickering fire.
      px('#333c57', 4, 30, 18, 12)
      px('#1a1c2c', 7, 33, 12, 6)
      px('#566c86', 11, 0, 4, 30)
      const f = reduced ? 1 : Math.floor(t * 8) % 3
      px('#f9a31b', 8, 36 - f, 10, 3 + f)
      px('#ffcd75', 10, 37 - (f % 2), 6, 2)
      px('#b13e53', 9, 38, 8, 1)
      // Steam from the soup.
      if (!reduced) {
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.6 + i / 3) % 1
          px('rgba(244,244,244,0.6)', 51 + Math.round(Math.sin(k * 6 + i) * 1.5), 27 - Math.round(k * 9), 1, 1)
        }
      }
      // Warm glow.
      const g = ctx.createRadialGradient(13, 37, 2, 13, 37, 46)
      g.addColorStop(0, 'rgba(255,170,80,0.28)')
      g.addColorStop(1, 'rgba(255,170,80,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
    const loop = (now: number) => {
      t = now / 1000
      draw()
      if (!reduced) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  return <canvas ref={ref} width={W} height={H} className="hut-interior" aria-hidden="true" />
}
