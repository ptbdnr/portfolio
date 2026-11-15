/**
 * The blog without its decoration: each post as plain Markdown (for AI tools) and as a plain web
 * page (for people), plus /llms.txt, an index of the posts for AI tools. Shared by the server, the
 * dev server and the site itself.
 */

export const MARKDOWN_TYPE = 'text/markdown; charset=utf-8'
export const LLMS_TXT = '/llms.txt'

export const postPath = (slug: string) => `/blog/${slug}`
export const markdownPath = (slug: string) => `/blog/${slug}.md`
export const plainPath = (slug: string) => `/blog/${slug}/plain`

/** The slug of a post's page address (`/blog/<slug>`), or null for any other address. */
export function postSlugOf(pathname: string): string | null {
  return /^\/blog\/([^/.]+)\/?$/.exec(pathname)?.[1] ?? null
}

/**
 * Where a page's Markdown version is, if it has one: a post's `.md`, or /llms.txt for the home page
 * and the blog index.
 */
export function markdownAlternate(pathname: string, isPost: (slug: string) => boolean): string | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/blog') return LLMS_TXT
  const slug = postSlugOf(path)
  return slug && isPost(slug) ? markdownPath(slug) : null
}

/**
 * Whether a request would rather have Markdown than HTML, as AI tools ask with
 * `Accept: text/markdown` (browsers never ask for Markdown).
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  let markdown = 0
  let html = 0
  for (const range of (accept ?? '').toLowerCase().split(',')) {
    const [type, ...params] = range.split(';').map((s) => s.trim())
    const q = Number(params.find((p) => p.startsWith('q='))?.slice(2) ?? 1)
    if (!Number.isFinite(q)) continue
    if (type === 'text/markdown') markdown = Math.max(markdown, q)
    else if (type === 'text/html') html = Math.max(html, q)
  }
  return markdown > 0 && markdown >= html
}

/** The `<link>` in a page's head that points tools to its Markdown version (the site keeps it up to date as you browse). */
export const ALTERNATE_ID = 'markdown-alternate'

export function withMarkdownLink(html: string, href: string) {
  const link = `<link rel="alternate" type="text/markdown" href="${encodeURI(href)}" id="${ALTERNATE_ID}" />`
  return html.replace('</head>', `  ${link}\n  </head>`)
}
