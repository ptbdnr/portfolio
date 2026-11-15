import { describe, expect, it } from 'vitest'
import { box, jpeg, movie, png, scan, webp } from './media-fixtures.ts'
import { findMetadata, stripJpeg, stripMetadata, stripPng, stripWebp } from './media-privacy.ts'

describe('photos', () => {
  it('finds the GPS location, camera details and comments a phone leaves in a JPEG', () => {
    expect(findMetadata(jpeg(), '.jpg')).toEqual(expect.arrayContaining(['GPS location', 'EXIF (camera, time)', 'XMP', 'comment']))
  })

  it('removes them, leaving the picture itself untouched', () => {
    const clean = stripJpeg(jpeg())
    expect(findMetadata(clean, '.jpg')).toEqual([])
    expect(Buffer.from(clean).includes('taken at home')).toBe(false)
    expect(Buffer.from(clean).subarray(-scan.length)).toEqual(Buffer.from(scan))
    expect(Buffer.from(clean).includes('JFIF')).toBe(true)
  })

  it('keeps a portrait photo upright: only the orientation survives', () => {
    const clean = stripJpeg(jpeg(6))
    expect(findMetadata(clean, '.jpg')).toEqual([])
    const at = Buffer.from(clean).indexOf('Exif\0\0')
    expect(at).toBeGreaterThan(Buffer.from(clean).indexOf('JFIF'))
    // MM header, one entry: tag 0x0112 (Orientation) = 6.
    const tiff = clean.subarray(at + 6)
    expect([...tiff.subarray(8, 12)]).toEqual([0, 1, 0x01, 0x12])
    expect(tiff[19]).toBe(6)
  })

  it('cleans PNG and WebP too', () => {
    expect(findMetadata(png, '.png').sort()).toEqual(['EXIF', 'text'])
    const cleanPng = stripPng(png)
    expect(findMetadata(cleanPng, '.png')).toEqual([])
    expect(Buffer.from(cleanPng).includes('IDAT')).toBe(true)

    expect(findMetadata(webp(), '.webp').sort()).toEqual(['EXIF', 'XMP'])
    const cleanWebp = stripWebp(webp())
    expect(findMetadata(cleanWebp, '.webp')).toEqual([])
    expect(cleanWebp[20] & 0x0c).toBe(0)
    expect(new DataView(cleanWebp.buffer).getUint32(4, true)).toBe(cleanWebp.length - 8)
  })

  it('leaves clean files exactly as they are', () => {
    const clean = stripJpeg(jpeg())
    expect(stripMetadata(clean, '.jpg')).toEqual(clean)
  })

  it('refuses formats browsers can’t show (and that carry metadata), like iPhone HEIC', () => {
    expect(findMetadata(new Uint8Array(8), '.heic').length).toBe(1)
  })
})


describe('videos', () => {
  it('spots the location a phone or ffmpeg records in an MP4 or MOV', () => {
    // ffmpeg and some Android phones: a 3GPP 'loci' box; others: '©xyz' text; iPhones: ISO 6709 metadata keys.
    expect(findMetadata(movie(box('udta', box('loci', Array(18).fill(0)))), '.mp4')).toContain('GPS location')
    expect(findMetadata(movie(box('udta', box('\u00a9xyz', '+51.5072-000.1276/'))), '.mp4')).toContain('GPS location')
    const keys = box('keys', [0, 0, 0, 0, 0, 0, 0, 1], box('mdta', 'com.apple.quicktime.location.ISO6709'))
    expect(findMetadata(movie(box('meta', box('hdlr', Array(24).fill(0)), keys)), '.mov')).toContain('GPS location')
  })

  it('passes a clean video', () => {
    expect(findMetadata(movie(box('udta', box('\u00a9too', 'Lavf61'))), '.mp4')).toEqual([])
  })
})
