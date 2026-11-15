/** Recognise video files and YouTube/Vimeo links used with Markdown image syntax. */
export type Embed =
  | { kind: 'video'; src: string }
  | { kind: 'iframe'; src: string; provider: 'youtube' | 'vimeo' }
  | { kind: 'image'; src: string }

export function classifyMedia(src: string): Embed {
  const clean = src.trim()
  if (/\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(clean)) return { kind: 'video', src: clean }
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

/** 90s camcorder date stamp, e.g. "NOV 10 2026". */
export function camcorderDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).replace(',', '').toUpperCase()
}
