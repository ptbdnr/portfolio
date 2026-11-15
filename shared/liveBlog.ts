/**
 * The live blog: when the server reads the posts from a folder (see server/liveBlog.ts), it puts the
 * list of posts into each page it sends, and the site reads it from there instead of the posts that
 * were built in. Shared by the server and the site.
 */

export const BLOG_INDEX_ID = 'blog-index'

/** Adds the posts to a page's head, as data (not a script, so the Content-Security-Policy is happy). */
export function withBlogIndex(html: string, posts: unknown[]) {
  // `<` is escaped so nothing in a title or summary can close the tag.
  const json = JSON.stringify(posts).replace(/</g, '\\u003c')
  return html.replace('</head>', `  <script type="application/json" id="${BLOG_INDEX_ID}">${json}</script>\n  </head>`)
}

/** The posts the server put in the page, or null when there are none (the site then uses its built-in posts). */
export function readBlogIndex(doc: { getElementById(id: string): { textContent: string | null } | null } | undefined): unknown[] | null {
  const text = doc?.getElementById(BLOG_INDEX_ID)?.textContent
  if (!text) return null
  try {
    const posts: unknown = JSON.parse(text)
    return Array.isArray(posts) ? posts : null
  } catch {
    return null
  }
}
