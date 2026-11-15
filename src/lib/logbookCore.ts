import { parseFrontmatter } from './frontmatter.ts'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export const GRADES = ['F', 'PD', 'AD', 'D', 'TD', 'ED'] as const
export type Grade = (typeof GRADES)[number]

export const GRADE_NAMES: Record<Grade, string> = {
  F: 'Facile — an easy stroll',
  PD: 'Peu difficile — a little effort',
  AD: 'Assez difficile — fairly demanding',
  D: 'Difficile — bring snacks',
  TD: 'Très difficile — long and technical',
  ED: 'Extrêmement difficile — rope up',
}

export type Post = {
  slug: string
  title: string
  date: string
  summary: string
  tags: string[]
  season: Season
  cover?: string
  coverAlt?: string
  draft: boolean
  words: number
  minutes: number
  grade: Grade
  /** Teletext page number, e.g. 201. */
  page: number
}

export type Frontmatter = Record<string, unknown>

export function splitFrontmatter(source: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return { data: {}, body: source }
  return { data: parseFrontmatter(match[1]), body: source.slice(match[0].length) }
}

export function countWords(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Alpine-style grade from reading time plus how technical the route is (code, maths). */
export function gradeFor(markdown: string, minutes: number): Grade {
  const code = (markdown.match(/```/g)?.length ?? 0) / 2
  const math = (markdown.match(/\$\$/g)?.length ?? 0) / 2
  const score = minutes + code * 1.5 + math * 2
  if (score < 4) return 'F'
  if (score < 7) return 'PD'
  if (score < 11) return 'AD'
  if (score < 16) return 'D'
  if (score < 22) return 'TD'
  return 'ED'
}

/** CAI signpost style walking time: 7 → "0h07". */
export function signTime(minutes: number) {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

function asString(value: unknown, fallback = '') {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value)
}

export function slugFromPath(path: string) {
  return (
    path
      .split('/')
      .pop()
      ?.replace(/\.md$/, '')
      .replace(/^\d{4}-\d{2}-\d{2}-/, '') ?? path
  )
}

/** Reading time: prose at ~200 wpm, code at half weight, ~10 s per figure or video. */
export function readingMinutes(markdown: string, words = countWords(markdown)) {
  const code = (markdown.match(/```[\s\S]*?```/g) ?? []).join(' ').split(/\s+/).filter(Boolean).length
  const figures = markdown.match(/!\[[^\]]*\]\([^)]*\)/g)?.length ?? 0
  return Math.max(1, Math.round((words + code * 0.5) / 200 + figures / 6))
}

/** A post's details and its text (the text is loaded separately on the site; see `withoutBody`). */
export function buildPost(path: string, source: string): Omit<Post, 'page'> & { body: string } {
  const { data, body } = splitFrontmatter(source)
  const words = countWords(body)
  const minutes = readingMinutes(body, words)
  const tags = Array.isArray(data.tags) ? data.tags.map((t) => asString(t).toLowerCase()).filter(Boolean) : []
  const season = SEASONS.includes(data.season as Season) ? (data.season as Season) : 'summer'
  return {
    slug: asString(data.slug) || slugFromPath(path),
    title: asString(data.title, slugFromPath(path)),
    date: asString(data.date, '1970-01-01'),
    summary: asString(data.summary),
    tags,
    season,
    cover: data.cover ? asString(data.cover) : undefined,
    coverAlt: data.coverAlt ? asString(data.coverAlt) : undefined,
    draft: data.draft === true,
    body,
    words,
    minutes,
    grade: gradeFor(body, minutes),
  }
}

/** A post's details for the index, leaving its text to be fetched when it's opened. */
export function withoutBody<T extends { body: string }>({ body, ...meta }: T): Omit<T, 'body'> {
  void body
  return meta
}

/** Sort newest first and assign stable teletext page numbers (oldest = P201). */
export function finalizePosts(posts: Omit<Post, 'page'>[], includeDrafts = false): Post[] {
  const visible = posts.filter((p) => includeDrafts || !p.draft)
  const oldestFirst = [...visible].sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug))
  const pages = new Map(oldestFirst.map((p, i) => [p.slug, 201 + i]))
  return visible
    .map((p) => ({ ...p, page: pages.get(p.slug)! }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}

export type Related = { post: Post; shared: string[]; score: number }

/** Nearby routes: shared tags matter most, then season, then recency. */
export function relatedPosts(post: Post, all: Post[], limit = 3): Related[] {
  const newest = Math.max(...all.map((p) => Date.parse(p.date) || 0))
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const shared = p.tags.filter((t) => post.tags.includes(t))
      const ageDays = (newest - (Date.parse(p.date) || 0)) / 86_400_000
      const score = shared.length * 3 + (p.season === post.season ? 1 : 0) + Math.max(0, 1 - ageDays / 365) * 0.5
      return { post: p, shared, score }
    })
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
    .slice(0, limit)
}

export function allTags(posts: Post[]) {
  const counts = new Map<string, number>()
  for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
