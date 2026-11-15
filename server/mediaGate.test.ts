import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { box, jpeg, movie } from '../scripts/media-fixtures.ts'
import { findMetadata, stripJpeg } from '../scripts/media-privacy.ts'
import { createMediaGate, insideFolder } from './mediaGate.ts'

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

function setup() {
  root = mkdtempSync(path.join(tmpdir(), 'media-gate-'))
  const dir = path.join(root, 'media')
  const cache = path.join(root, 'cache')
  mkdirSync(dir)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const put = (name: string, bytes: Uint8Array | string) => {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), bytes)
  }
  return { dir, cache, logger, put, gate: createMediaGate(dir, cache, logger) }
}

const iphoneKeys = box('keys', [0, 0, 0, 0, 0, 0, 0, 1], box('mdta', 'com.apple.quicktime.location.ISO6709'))

describe('pictures and videos from the content folder', () => {
  it('sends files with nothing personal in them as they are', async () => {
    const { gate, put, dir } = setup()
    put('clean.jpg', stripJpeg(jpeg()))
    put('clip.webm', 'webm')
    expect(await gate.resolve('clean.jpg')).toMatchObject({ file: path.join(dir, 'clean.jpg') })
    expect(await gate.resolve('clip.webm')).toMatchObject({ file: path.join(dir, 'clip.webm') })
  })

  it('sends a copy of a phone photo without its location and camera details, leaving the original as it is', async () => {
    const { gate, put, dir, cache, logger } = setup()
    put('2026/ridge.jpg', jpeg(6))
    const sent = await gate.resolve('2026/ridge.jpg')
    if (!sent || !('file' in sent)) throw new Error('not sent')
    expect(path.dirname(sent.file)).toBe(cache)
    expect(findMetadata(readFileSync(sent.file), '.jpg')).toEqual([])
    expect(findMetadata(readFileSync(path.join(dir, '2026/ridge.jpg')), '.jpg')).toContain('GPS location')
    // Cleaned once, then the copy is reused.
    expect(await gate.resolve('2026/ridge.jpg')).toEqual(sent)
    expect(logger.info).toHaveBeenCalledTimes(1)
  })

  it('takes the location out of a phone video without moving anything, so it still plays', async () => {
    const { gate, put } = setup()
    const original = movie(box('udta', box('\u00a9xyz', '+51.5072-000.1276/')), box('meta', box('hdlr', Array(24).fill(0)), iphoneKeys))
    put('descent.mov', original)
    expect(findMetadata(original, '.mov')).toContain('GPS location')
    const sent = await gate.resolve('descent.mov')
    if (!sent || !('file' in sent)) throw new Error('not sent')
    const copy = readFileSync(sent.file)
    expect(findMetadata(copy, '.mov')).toEqual([])
    expect(copy.length).toBe(original.length)
    // Only the two boxes' names changed (to 'free', which players skip): 8 bytes in all.
    expect([...copy].filter((b, i) => b !== original[i])).toHaveLength(8)
  })

  it("doesn't send what it can't clean, like an iPhone HEIC photo, and says why once", async () => {
    const { gate, put, logger } = setup()
    put('IMG_0001.heic', 'heic')
    expect(await gate.resolve('IMG_0001.heic')).toEqual({ blocked: ['not a web format: convert to JPEG or WebP first'] })
    await gate.resolve('IMG_0001.heic')
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('cleans a photo again when it is replaced, and drops the old copy', async () => {
    const { gate, put, cache } = setup()
    put('ridge.jpg', jpeg(1))
    const first = await gate.resolve('ridge.jpg')
    put('ridge.jpg', jpeg(3))
    const second = await gate.resolve('ridge.jpg')
    if (!first || !second || !('file' in first) || !('file' in second)) throw new Error('not sent')
    expect(second.file).not.toBe(first.file)
    expect(readdirSync(cache)).toEqual([path.basename(second.file)])
  })

  it('only sends files inside the media folder, and never hidden ones', async () => {
    const { gate, put } = setup()
    put('.DS_Store', 'x')
    put('sub/.hidden.jpg', 'x')
    for (const rel of ['../secret.txt', 'sub/../../secret.txt', '/etc/passwd', '.DS_Store', 'sub/.hidden.jpg', 'a//b.jpg', 'a\\b.jpg', 'missing.jpg']) {
      expect(await gate.resolve(rel)).toBeNull()
    }
    expect(insideFolder('/content/media', 'sub/ok.jpg')).toBe('/content/media/sub/ok.jpg')
  })
})
