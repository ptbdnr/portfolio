import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Element, ElementContent, Root } from 'hast'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import {
  LLMS_TXT,
  MARKDOWN_TYPE,
  markdownAlternate,
  markdownPath,
  plainPath,
  postPath,
  postSlugOf,
  prefersMarkdown,
} from '../shared/markdownAlternates.ts'
import { profile } from '../src/content/profile.ts'
import { buildPost, finalizePosts, withoutBody } from '../src/lib/logbookCore.ts'
import { classifyMedia } from '../src/lib/media.ts'

/**
 * The blog without its decoration, built from the same Markdown files as the site: each post as
 * plain Markdown for AI tools (its title and its text, none of the site's details like the date,
 * tags, reading time, grade or ascent), the same Markdown shown as a plain web page for people, and
 * /llms.txt, an index of the posts for AI tools.
 */

export type PlainPost = { slug: string; title: string; summary: string; body: string }

/** Every post with its text, newest first (drafts only when asked for: while developing). */
export function readPosts(dir: string, includeDrafts: boolean): PlainPost[] {
  const built = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => buildPost(path.join(dir, file), readFileSync(path.join(dir, file), 'utf8')))
  const bodies = new Map(built.map((p) => [p.slug, p.body]))
  return finalizePosts(built.map(withoutBody), includeDrafts).map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    body: bodies.get(p.slug) ?? '',
  }))
}

/** Plain text (a title or a summary) for Markdown: nothing in it may turn into formatting, a link, HTML or maths. */
const asMarkdownText = (text: string) => text.replace(/[\\`*_~[\]<&$]/g, '\\$&')

/** A post as plain Markdown: its title as the heading, then its text exactly as written. */
export function plainMarkdown({ title, body }: Pick<PlainPost, 'title' | 'body'>) {
  const text = body.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd()
  return /^# /.test(text) ? `${text}\n` : `# ${asMarkdownText(title)}\n\n${text}\n`
}

const element = (tagName: string, properties: Element['properties'], children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
})

/** Pictures, sound and video files and YouTube/Vimeo links (all written with the image syntax), as plain as they come. */
function media(img: Element): Element {
  const src = String(img.properties.src ?? '')
  const alt = String(img.properties.alt ?? '')
  const found = classifyMedia(src)
  if (found.kind === 'video') {
    return element('video', { src: found.src, controls: true, preload: 'metadata', playsInline: true, ariaLabel: alt || undefined })
  }
  if (found.kind === 'audio') {
    return element('audio', { src: found.src, controls: true, preload: 'metadata', ariaLabel: alt || undefined }, [
      element('a', { href: found.src }, [{ type: 'text', value: `Download the sound${alt ? `: ${alt}` : ''}` }]),
    ])
  }
  if (found.kind === 'iframe') {
    return element('iframe', {
      src: found.src,
      title: alt || 'Embedded video',
      loading: 'lazy',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      referrerPolicy: 'strict-origin-when-cross-origin',
      allowFullScreen: true,
    })
  }
  return element('img', { src: found.src, alt, loading: 'lazy', decoding: 'async' })
}

const blank = (node: ElementContent) => node.type === 'text' && !node.value.trim()

/** A picture, sound or video on its own line becomes a figure, captioned with its title (or else its description), as on the site. */
function rehypePlainMedia() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === undefined) return
      const only = node.tagName === 'p' ? node.children.filter((c) => !blank(c)) : []
      if (only.length === 1 && only[0].type === 'element' && only[0].tagName === 'img') {
        const img = only[0]
        const caption = String(img.properties.title || img.properties.alt || '')
        const figcaption = caption ? [element('figcaption', {}, [{ type: 'text', value: caption }])] : []
        parent.children[index] = element('figure', {}, [media(img), ...figcaption])
        return SKIP
      }
      if (node.tagName === 'img') {
        parent.children[index] = media(node)
        return SKIP
      }
      // Wide code and tables scroll sideways on a phone, and can be scrolled from the keyboard.
      if (node.tagName === 'pre') node.properties.tabIndex = 0
    })
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return
      parent.children[index] = element('div', { className: ['table'], role: 'region', tabIndex: 0, ariaLabel: 'Table' }, [node])
      return SKIP
    })
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  // MathML, which browsers draw themselves: no stylesheet or fonts needed.
  .use(rehypeKatex, { output: 'mathml' })
  .use(rehypePlainMedia)
  .use(rehypeStringify)

/** Markdown as HTML. Raw HTML in the Markdown is left out, as it is on the site. */
export function markdownToHtml(markdown: string) {
  return String(processor.processSync(markdown))
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Just enough style to read comfortably, in the browser's own light or dark colours. */
const STYLE = `
:root { color-scheme: light dark; background: Canvas; color: CanvasText; --rule: color-mix(in srgb, CanvasText 32%, Canvas); }
body { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 3rem; font: 1.0625rem/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; overflow-wrap: break-word; }
a, a:visited { color: #1a56c4; }
@media (prefers-color-scheme: dark) { a, a:visited { color: #8ab4f8; } }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1.5rem; }
h2, h3 { line-height: 1.3; margin: 2.2rem 0 0.8rem; }
img, video { max-width: 100%; height: auto; }
audio { display: block; width: 100%; }
iframe { width: 100%; height: auto; aspect-ratio: 16 / 9; border: 0; }
figure { margin: 1.75rem 0; }
figcaption { margin-top: 0.4rem; font-size: 0.9em; font-style: italic; }
pre, .table, .katex:has(> math[display="block"]) { overflow-x: auto; }
.katex:has(> math[display="block"]) { display: block; margin: 1rem 0; }
pre { padding: 0.75rem 1rem; background: color-mix(in srgb, CanvasText 6%, Canvas); }
code { font: 0.9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
table { border-collapse: collapse; }
th, td { padding: 0.35rem 0.7rem; border: 1px solid var(--rule); text-align: left; vertical-align: top; }
blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid var(--rule); }
.footnotes { margin-top: 3rem; padding-top: 0.5rem; border-top: 1px solid var(--rule); font-size: 0.9em; }
body > footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--rule); font-size: 0.9em; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`

/** A post's Markdown shown as a plain web page: nothing but its title and text, and links to the other versions. */
export function plainPage(post: PlainPost) {
  const page = postPath(post.slug)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${escape(post.title)} · ${escape(profile.name)}</title>
${post.summary ? `<meta name="description" content="${escape(post.summary)}">\n` : ''}<link rel="canonical" href="${escape(page)}">
<link rel="alternate" type="text/markdown" href="${escape(markdownPath(post.slug))}">
<style>${STYLE}</style>
</head>
<body>
<main>
<article>
${markdownToHtml(plainMarkdown(post))}
</article>
</main>
<footer>
<nav aria-label="Other versions"><a href="${escape(page)}">Read it on the site</a> · <a href="${escape(markdownPath(post.slug))}">Markdown</a></nav>
</footer>
</body>
</html>
`
}

/** The index for AI tools (https://llmstxt.org): who wrote the blog, and each post's Markdown. */
export function llmsTxt(posts: PlainPost[]) {
  const city = profile.home.split(',')[0]
  const list = posts.map((p) => `- [${asMarkdownText(p.title)}](${markdownPath(p.slug)})${p.summary ? `: ${asMarkdownText(p.summary)}` : ''}`)
  return [
    `# ${profile.name}`,
    '',
    `> ${profile.role} in ${city}. ${profile.tagline}`,
    '',
    "The blog's posts as plain Markdown, without the site's decoration (a first-person walk through 360° photographs):",
    '',
    '- `/blog/<post>.md` is a post as Markdown (each one is listed below).',
    '- `/blog/<post>/plain` is the same post as a plain web page.',
    '- `/blog/<post>` is the post on the site, which also returns its Markdown when asked for `text/markdown`.',
    '',
    '## Blog',
    '',
    ...(list.length ? list : ['No posts yet.']),
    '',
  ].join('\n')
}

/** Everything to publish alongside the site, by file name. */
export function plainFiles(posts: PlainPost[]): { fileName: string; source: string }[] {
  return [
    { fileName: 'llms.txt', source: llmsTxt(posts) },
    ...posts.flatMap((p) => [
      { fileName: `${markdownPath(p.slug).slice(1)}`, source: plainMarkdown(p) },
      { fileName: `${plainPath(p.slug).slice(1)}/index.html`, source: plainPage(p) },
    ]),
  ]
}

export type PlainResponse = { type: string; body: string; vary?: boolean }

/**
 * The dev server's answer for an address, if it's one of the plain versions (the built site serves
 * the same files; see server/app.ts). `posts` is only read when it's needed.
 */
export function plainResponse(pathname: string, accept: string | undefined, posts: () => PlainPost[]): PlainResponse | null {
  if (pathname === LLMS_TXT) return { type: 'text/plain; charset=utf-8', body: llmsTxt(posts()) }
  const md = /^\/blog\/([^/]+)\.md$/.exec(pathname)?.[1]
  const plain = /^\/blog\/([^/.]+)\/plain\/?$/.exec(pathname)?.[1]
  if (md !== undefined || plain !== undefined) {
    const post = posts().find((p) => p.slug === (md ?? plain))
    if (!post) return null
    return md !== undefined ? { type: MARKDOWN_TYPE, body: plainMarkdown(post) } : { type: 'text/html; charset=utf-8', body: plainPage(post) }
  }
  // The site's own pages hand AI tools that ask for Markdown the Markdown version instead.
  if (!prefersMarkdown(accept) || !(pathname === '/' || pathname.startsWith('/blog'))) return null
  const all = posts()
  const href = markdownAlternate(pathname, (slug) => all.some((p) => p.slug === slug))
  if (!href) return null
  const post = all.find((p) => p.slug === postSlugOf(pathname))
  return { type: MARKDOWN_TYPE, body: post ? plainMarkdown(post) : llmsTxt(all), vary: true }
}
