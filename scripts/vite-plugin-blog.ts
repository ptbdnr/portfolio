import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { markdownAlternate, withMarkdownLink } from '../shared/markdownAlternates.ts'
import { buildPost, withoutBody } from '../src/lib/logbookCore.ts'
import { plainFiles, plainResponse, readPosts } from './blog-plain.ts'

const ID = 'virtual:blog'
const RESOLVED = `\0${ID}`

/**
 * The blog as a module: every post's details (title, date, tags, reading time…) worked out at
 * build time, plus a loader per post that fetches its text only when someone opens it. The site
 * stays light however many posts there are, and drafts never make it into a production build.
 *
 *   import { POSTS, BODIES } from 'virtual:blog'
 *
 * It also publishes the blog without its decoration (see blog-plain.ts): each post as plain
 * Markdown and as a plain web page, and /llms.txt, served straight from the Markdown files while
 * developing and written out as files by a build.
 */
export function blog(options: { dir?: string } = {}): Plugin {
  let root = ''
  let dir = ''
  let drafts = false
  return {
    name: 'blog',
    configResolved(config) {
      root = config.root
      dir = path.resolve(root, options.dir ?? 'src/content/logbook')
      drafts = config.command === 'serve'
    },
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? blogModule(dir, root, drafts) : null),
    configureServer(server) {
      // A post added, removed or edited: rebuild the index and reload.
      const changed = (file: string) => {
        if (!file.startsWith(dir) || !file.endsWith('.md')) return
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      for (const event of ['add', 'unlink', 'change'] as const) server.watcher.on(event, changed)

      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        let pathname = ''
        try {
          pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
        } catch {
          return next()
        }
        const found = plainResponse(pathname, req.headers.accept, () => readPosts(dir, drafts))
        if (!found) return next()
        res.setHeader('Content-Type', found.type)
        res.setHeader('Cache-Control', 'no-cache')
        if (found.vary) res.setHeader('Vary', 'Accept')
        res.end(req.method === 'HEAD' ? undefined : found.body)
      })
    },
    // While developing, each page says where its Markdown version is (the server does this for the built site).
    transformIndexHtml(html, ctx) {
      if (!ctx.server || !ctx.originalUrl) return html
      const { pathname } = new URL(ctx.originalUrl, 'http://localhost')
      const slugs = new Set(readPosts(dir, drafts).map((p) => p.slug))
      const href = markdownAlternate(pathname, (slug) => slugs.has(slug))
      return href ? withMarkdownLink(html, href) : html
    },
    generateBundle() {
      for (const file of plainFiles(readPosts(dir, drafts))) this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
    },
  }
}

/** The module's source: each post's details (drafts only while developing) and a lazy loader for its text. */
export function blogModule(dir: string, root: string, includeDrafts: boolean) {
  const posts = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const full = path.join(dir, file)
      return { meta: withoutBody(buildPost(full, readFileSync(full, 'utf8'))), url: `/${path.relative(root, full).split(path.sep).join('/')}` }
    })
    .filter((p) => includeDrafts || !p.meta.draft)
  const loaders = posts.map((p) => `  ${JSON.stringify(p.meta.slug)}: () => import(${JSON.stringify(`${p.url}?raw`)}).then((m) => m.default),`)
  return `export const POSTS = ${JSON.stringify(posts.map((p) => p.meta))}\nexport const BODIES = {\n${loaders.join('\n')}\n}\n`
}
