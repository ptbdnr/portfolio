/**
 * Loading the panoramas: a small preview first (it decodes in a moment, so you can look around
 * straight away), then the full photo, which fades in when it's ready. Decoding happens off the
 * main thread; textures no longer needed are freed, so phones keep enough memory.
 */
import { createPanoramaTexture } from './gl.ts'

export type Quality = 'preview' | 'full'

/**
 * The trail's photos (src/assets/trail, made by `npm run panoramas`). The build gives each file a
 * name with its content's fingerprint, so browsers can keep them for good and still see a new photo
 * the moment it changes.
 */
const FILES = import.meta.glob<string>('../assets/trail/*.webp', { eager: true, query: '?url', import: 'default' })
const fileUrl = (name: string) => FILES[`../assets/trail/${name}`] ?? `/src/assets/trail/${name}`

export const panoramaUrl = (key: string, quality: Quality) => fileUrl(`${key}${quality === 'preview' ? '.preview' : ''}.webp`)
export const cardUrl = (key: string) => fileUrl(`${key}.card.webp`)

/** Brightness across the photo (linear light), 64×32, for the camera's sense of exposure. */
export type LuminanceGrid = { data: Float32Array; width: number; height: number; mean: number }

type Entry = {
  texture: WebGLTexture | null
  promise: Promise<WebGLTexture>
  used: number
  bytes: number
}

async function decode(url: string, signal?: AbortSignal): Promise<ImageBitmap | HTMLImageElement> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`)
  const blob = await res.blob()
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    } catch {
      // Older Safari: no options. Fall through to an <img>.
    }
  }
  const img = new Image()
  img.decoding = 'async'
  img.src = URL.createObjectURL(blob)
  try {
    await img.decode()
  } finally {
    URL.revokeObjectURL(img.src)
  }
  return img
}

const srgbToLinear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminanceOf(image: ImageBitmap | HTMLImageElement): LuminanceGrid | null {
  const width = 64
  const height = 32
  try {
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height })
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, width, height)
    const px = ctx.getImageData(0, 0, width, height).data
    const data = new Float32Array(width * height)
    let sum = 0
    let weight = 0
    for (let i = 0; i < width * height; i++) {
      const l = 0.2126 * srgbToLinear(px[i * 4]) + 0.7152 * srgbToLinear(px[i * 4 + 1]) + 0.0722 * srgbToLinear(px[i * 4 + 2])
      data[i] = l
      // Rows near the poles cover less of the sphere.
      const w = Math.cos(((Math.floor(i / width) + 0.5) / height - 0.5) * Math.PI)
      sum += Math.log(l + 1e-3) * w
      weight += w
    }
    return { data, width, height, mean: Math.exp(sum / weight) }
  } catch {
    return null
  }
}

/** Average brightness of the photo around a set of directions (degrees), as a geometric mean. */
export function sampleLuminance(grid: LuminanceGrid, dirs: { yaw: number; pitch: number; weight: number }[]) {
  let sum = 0
  let weight = 0
  for (const { yaw, pitch, weight: w } of dirs) {
    const u = ((((yaw / 360 + 0.5) % 1) + 1) % 1) * grid.width
    const v = Math.min(grid.height - 1, Math.max(0, (0.5 - pitch / 180) * grid.height))
    const x = Math.floor(u) % grid.width
    const y = Math.floor(v)
    sum += Math.log(grid.data[y * grid.width + x] + 1e-3) * w
    weight += w
  }
  return weight ? Math.exp(sum / weight) : grid.mean
}

export function createTextureCache(gl: WebGL2RenderingContext, { anisotropy, budgetBytes }: { anisotropy: number; budgetBytes: number }) {
  const entries = new Map<string, Entry>()
  const luminance = new Map<string, LuminanceGrid>()
  let clock = 0

  function evict(keep: Set<string>) {
    let total = [...entries.values()].reduce((n, e) => n + e.bytes, 0)
    if (total <= budgetBytes) return
    const victims = [...entries.entries()].filter(([id, e]) => e.texture && !keep.has(id)).sort((a, b) => a[1].used - b[1].used)
    for (const [id, e] of victims) {
      if (total <= budgetBytes) break
      gl.deleteTexture(e.texture)
      entries.delete(id)
      total -= e.bytes
    }
  }

  return {
    /** The texture for a photo, loading it if needed. */
    load(key: string, quality: Quality): Promise<WebGLTexture> {
      const id = `${key}:${quality}`
      const known = entries.get(id)
      if (known) {
        known.used = ++clock
        return known.promise
      }
      const entry: Entry = { texture: null, promise: Promise.resolve(null as unknown as WebGLTexture), used: ++clock, bytes: 0 }
      entry.promise = decode(panoramaUrl(key, quality)).then(
        (image) => {
          if (gl.isContextLost()) throw new Error('WebGL context lost')
          if (quality === 'preview' && !luminance.has(key)) {
            const grid = luminanceOf(image)
            if (grid) luminance.set(key, grid)
          }
          const texture = createPanoramaTexture(gl, image, anisotropy)
          if ('close' in image) image.close()
          entry.texture = texture
          entry.bytes = Math.round(image.width * image.height * 4 * 1.34)
          return texture
        },
        (error: Error) => {
          entries.delete(id)
          throw error
        },
      )
      entries.set(id, entry)
      return entry.promise
    },
    /** The texture if it's ready now. */
    get(key: string, quality: Quality) {
      const e = entries.get(`${key}:${quality}`)
      if (e?.texture) e.used = ++clock
      return e?.texture ?? null
    },
    luminance: (key: string) => luminance.get(key) ?? null,
    /** Frees textures beyond the memory budget, except the ones in use. */
    trim(keys: string[]) {
      evict(new Set(keys.flatMap((k) => [`${k}:preview`, `${k}:full`])))
    },
    /** After the GPU lost its memory (context lost): everything has to be loaded again. */
    reset() {
      entries.clear()
    },
    /** Frees every texture (the engine is going away). */
    dispose() {
      for (const e of entries.values()) if (e.texture) gl.deleteTexture(e.texture)
      entries.clear()
    },
  }
}

export type TextureCache = ReturnType<typeof createTextureCache>
