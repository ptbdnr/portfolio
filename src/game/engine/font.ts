/** A tiny 3×5 pixel font for signposts, labels and speech bubbles drawn inside the world canvas. */
const GLYPHS: Record<string, [string, string, string, string, string]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '^': ['.#.', '#.#', '...', '...', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
}

const FONT: Record<string, Uint8Array> = {}
for (const [ch, rows] of Object.entries(GLYPHS)) {
  FONT[ch] = Uint8Array.from(rows.join(''), (c) => (c === '#' ? 1 : 0))
}

export const GLYPH_H = 5
export const ADVANCE = 4

export function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function textWidth(text: string) {
  return Math.max(0, normalizeText(text).length * ADVANCE - 1)
}

const cache = new Map<string, HTMLCanvasElement>()

/** Bake text into a small canvas (cached) so it can be blitted cheaply every frame. */
export function bakeText(text: string, color: string, shadow?: string): HTMLCanvasElement {
  const key = `${text}|${color}|${shadow ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const t = normalizeText(text)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, textWidth(t) + (shadow ? 1 : 0))
  canvas.height = GLYPH_H + (shadow ? 1 : 0)
  const ctx = canvas.getContext('2d')!
  const draw = (fill: string, ox: number, oy: number) => {
    ctx.fillStyle = fill
    for (let i = 0; i < t.length; i++) {
      const glyph = FONT[t[i]] ?? FONT['?']
      for (let p = 0; p < 15; p++) {
        if (glyph[p]) ctx.fillRect(i * ADVANCE + (p % 3) + ox, Math.floor(p / 3) + oy, 1, 1)
      }
    }
  }
  if (shadow) draw(shadow, 1, 1)
  draw(color, 0, 0)
  if (cache.size > 400) cache.clear()
  cache.set(key, canvas)
  return canvas
}
