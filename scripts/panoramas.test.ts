import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHOTOS, SCENES } from '../src/content/trail.ts'
import { findMetadata } from './media-privacy.ts'

describe('the trail’s photographs', () => {
  it('has a photo (with its credit) for every place and time of day', () => {
    expect(PHOTOS.length).toBe(SCENES.length + SCENES.reduce((n, s) => n + (s.variants?.length ?? 0), 0))
    for (const job of PHOTOS) {
      expect(job.photo.authors.length, job.key).toBeGreaterThan(0)
      for (const file of [`${job.key}.webp`, `${job.key}.preview.webp`, ...(job.card ? [`${job.key}.card.webp`] : [])]) {
        expect(existsSync(path.resolve('src/assets/trail', file)), file).toBe(true)
        expect(findMetadata(readFileSync(path.resolve('src/assets/trail', file)), '.webp'), file).toEqual([])
      }
    }
  })

})
