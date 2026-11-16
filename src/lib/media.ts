/** Recognise sound and video files and YouTube/Vimeo links used with Markdown image syntax. */
export type Embed =
  | { kind: 'video'; src: string }
  | { kind: 'audio'; src: string }
  | { kind: 'iframe'; src: string; provider: 'youtube' | 'vimeo' }
  | { kind: 'image'; src: string }

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'] as const

export function classifyMedia(src: string): Embed {
  const clean = src.trim()
  if (/\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i.test(clean)) return { kind: 'video', src: clean }
  if (new RegExp(`\\.(${AUDIO_EXTENSIONS.join('|')})(\\?.*)?$`, 'i').test(clean)) return { kind: 'audio', src: clean }
  let url: URL | null = null
  try {
    url = new URL(clean, 'https://local.invalid')
  } catch {
    return { kind: 'image', src: clean }
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1]
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'iframe', provider: 'youtube', src: youtube(id, url) }
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    if (/^[\w-]{6,}$/.test(id)) return { kind: 'iframe', provider: 'youtube', src: youtube(id, url) }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{5,})/)?.[1]
    if (id) return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1` }
  }
  return { kind: 'image', src: clean }
}

function youtube(id: string, url: URL) {
  const start = url.searchParams.get('t') ?? url.searchParams.get('start')
  const seconds = start ? Number.parseInt(start, 10) : 0
  return `https://www.youtube-nocookie.com/embed/${id}${seconds > 0 ? `?start=${seconds}` : ''}`
}

/** "1:05" from seconds. */
export function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
