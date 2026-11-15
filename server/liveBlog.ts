import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { llmsTxt, plainMarkdown, plainPage, type PlainPost } from '../scripts/blog-plain.ts'
import { buildPost, finalizePosts, withoutBody, type Post } from '../src/lib/logbookCore.ts'

type Logger = Pick<Console, 'info' | 'warn' | 'error'>

type Entry = { key: string; post: ReturnType<typeof buildPost>; page?: string }

/** Markdown files to read: not hidden ones, like the `._name.md` files macOS leaves on network shares. */
const isPostFile = (name: string) => name.endsWith('.md') && !name.startsWith('.')

/**
 * The blog, read live from a folder of Markdown files (the same files as src/content/logbook): add,
 * edit or delete a post and the site shows it within a couple of seconds, with no rebuild or restart.
 * The folder is looked at again at most every `ttlMs`, and only changed files are read again.
 * Drafts are never shown.
 */
export function createLiveBlog(dir: string, { now = Date.now, logger = console as Logger, ttlMs = 2000 } = {}) {
  const files = new Map<string, Entry>()
  let bySlug = new Map<string, Entry>()
  let published: Post[] = []
  let checked = -Infinity
  let missing = false

  function refresh() {
    if (now() - checked < ttlMs) return
    checked = now()
    let names: string[] = []
    try {
      names = readdirSync(dir).filter(isPostFile).sort()
      missing = false
    } catch (error) {
      if (!missing) logger.warn(`[blog] can't read ${dir}: ${(error as Error).message}`)
      missing = true
    }
    let changed = false
    const present = new Set(names)
    for (const name of files.keys()) {
      if (present.has(name)) continue
      files.delete(name)
      changed = true
    }
    for (const name of names) {
      const file = path.join(dir, name)
      try {
        const stats = statSync(file)
        const key = `${stats.mtimeMs}:${stats.size}`
        if (!stats.isFile() || files.get(name)?.key === key) continue
        files.set(name, { key, post: buildPost(file, readFileSync(file, 'utf8')) })
        changed = true
      } catch (error) {
        logger.warn(`[blog] skipped ${name}: ${(error as Error).message}`)
      }
    }
    if (!changed) return
    const live = [...files.values()].filter((e) => !e.post.draft)
    bySlug = new Map(live.map((e) => [e.post.slug, e]))
    if (bySlug.size < live.length) logger.warn('[blog] two posts have the same slug (file name); only the last is shown')
    published = finalizePosts(
      [...bySlug.values()].map((e) => withoutBody(e.post)),
      false,
    )
  }

  const entry = (slug: string) => {
    refresh()
    return bySlug.get(slug)
  }
  const plain = ({ post }: Entry): PlainPost => ({ slug: post.slug, title: post.title, summary: post.summary, body: post.body })

  return {
    /** Every published post's details, newest first. */
    posts() {
      refresh()
      return published
    },
    has: (slug: string) => entry(slug) !== undefined,
    /** A post's text, without its frontmatter. */
    body: (slug: string) => entry(slug)?.post.body ?? null,
    /** A post as plain Markdown (see scripts/blog-plain.ts). */
    markdown(slug: string) {
      const e = entry(slug)
      return e ? plainMarkdown(plain(e)) : null
    },
    /** A post as a plain web page, rendered once per version of the file. */
    plainPage(slug: string) {
      const e = entry(slug)
      if (!e) return null
      e.page ??= plainPage(plain(e))
      return e.page
    },
    llms() {
      refresh()
      return llmsTxt(published.map((p) => plain(bySlug.get(p.slug)!)))
    },
  }
}

export type LiveBlog = ReturnType<typeof createLiveBlog>

/**
 * On the first start, fills an empty content folder with the posts and pictures the site was built
 * with, so there's something to edit straight away. `marker` (in the data folder) records that it
 * has, so a blog you've emptied on purpose stays empty.
 */
export function seedContent({
  contentDir,
  posts,
  media,
  marker,
  logger = console as Logger,
}: {
  contentDir: string
  posts: string
  media: string | null
  marker: string
  logger?: Logger
}) {
  const blogDir = path.join(contentDir, 'blog')
  const mediaDir = path.join(contentDir, 'media')
  try {
    mkdirSync(blogDir, { recursive: true })
    mkdirSync(mediaDir, { recursive: true })
    if (existsSync(marker)) return
    let copied = 0
    if (!readdirSync(blogDir).some(isPostFile) && existsSync(posts)) {
      for (const name of readdirSync(posts).filter(isPostFile)) {
        copyFileSync(path.join(posts, name), path.join(blogDir, name))
        copied++
      }
      if (media && existsSync(media)) {
        for (const name of readdirSync(media)) {
          const from = path.join(media, name)
          if (statSync(from).isFile() && !existsSync(path.join(mediaDir, name))) copyFileSync(from, path.join(mediaDir, name))
        }
      }
      if (copied) logger.info(`[blog] copied ${copied} posts and their pictures into ${contentDir} to start with`)
    }
    mkdirSync(path.dirname(marker), { recursive: true })
    writeFileSync(marker, `${new Date().toISOString()}\n`)
  } catch (error) {
    logger.error(`[blog] couldn't set up ${contentDir}: ${(error as Error).message} (check the folder's permissions)`)
  }
}
