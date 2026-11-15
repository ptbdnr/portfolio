export type RGB = readonly [number, number, number]

export function hex(value: string): RGB {
  const v = value.replace('#', '')
  const n = Number.parseInt(v.length === 3 ? v.replace(/./g, (c) => c + c) : v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]

export function css(c: RGB, alpha = 1) {
  const r = Math.round(c[0])
  const g = Math.round(c[1])
  const b = Math.round(c[2])
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

/** Quantise a colour so sprite caches stay bounded while palettes blend. */
export const quant = (c: RGB, step = 6): RGB => [
  Math.round(c[0] / step) * step,
  Math.round(c[1] / step) * step,
  Math.round(c[2] / step) * step,
]
