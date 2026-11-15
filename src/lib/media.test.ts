import { describe, expect, it } from 'vitest'
import { camcorderDate, classifyMedia } from './media.ts'

describe('classifyMedia', () => {
  it('detects local video files', () => {
    expect(classifyMedia('/media/clip.mp4')).toEqual({ kind: 'video', src: '/media/clip.mp4' })
    expect(classifyMedia('https://cdn.example.com/a.webm?x=1').kind).toBe('video')
  })

  it('turns YouTube links into privacy-friendly embeds', () => {
    const expected = 'https://www.youtube-nocookie.com/embed/aircAruvnKk'
    expect(classifyMedia('https://www.youtube.com/watch?v=aircAruvnKk')).toMatchObject({ kind: 'iframe', src: expected })
    expect(classifyMedia('https://youtu.be/aircAruvnKk')).toMatchObject({ kind: 'iframe', src: expected })
    expect(classifyMedia('https://youtube.com/shorts/aircAruvnKk')).toMatchObject({ kind: 'iframe', src: expected })
    expect(classifyMedia('https://youtu.be/aircAruvnKk?t=42').src).toBe(`${expected}?start=42`)
  })

  it('turns Vimeo links into player embeds', () => {
    expect(classifyMedia('https://vimeo.com/76979871')).toMatchObject({
      kind: 'iframe',
      provider: 'vimeo',
      src: 'https://player.vimeo.com/video/76979871?dnt=1',
    })
  })

  it('treats everything else as an image', () => {
    expect(classifyMedia('/media/photo.png').kind).toBe('image')
    expect(classifyMedia('https://youtube.com/channel/abc').kind).toBe('image')
    expect(classifyMedia('javascript:alert(1)').kind).toBe('image')
  })
})

describe('camcorderDate', () => {
  it('formats like a 90s camcorder stamp', () => {
    expect(camcorderDate('2026-11-10')).toBe('NOV 10 2026')
    expect(camcorderDate('not a date')).toBe('')
  })
})
