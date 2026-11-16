import { describe, expect, it } from 'vitest'
import { classifyMedia, clock } from './media.ts'

describe('classifyMedia', () => {
  it('detects local video files', () => {
    expect(classifyMedia('/media/clip.mp4')).toEqual({ kind: 'video', src: '/media/clip.mp4' })
    expect(classifyMedia('https://cdn.example.com/a.webm?x=1').kind).toBe('video')
    expect(classifyMedia('/media/phone.MOV').kind).toBe('video')
  })

  it('detects sound files', () => {
    expect(classifyMedia('/media/birdsong.mp3')).toEqual({ kind: 'audio', src: '/media/birdsong.mp3' })
    for (const ext of ['m4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'MP3']) expect(classifyMedia(`/media/a.${ext}`).kind).toBe('audio')
    expect(classifyMedia('https://cdn.example.com/talk.m4a?dl=1').kind).toBe('audio')
    expect(classifyMedia('/media/mp3-cover.png').kind).toBe('image')
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

describe('clock', () => {
  it('shows minutes and seconds', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(65.4)).toBe('1:05')
    expect(clock(3601)).toBe('60:01')
    expect(clock(Number.NaN)).toBe('0:00')
  })
})
