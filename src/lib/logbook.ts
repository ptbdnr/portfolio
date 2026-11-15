import { BODIES, POSTS as BUILT } from 'virtual:blog'
import { readBlogIndex } from '../../shared/liveBlog.ts'
import { finalizePosts, splitFrontmatter, type Post } from './logbookCore.ts'

/**
 * The posts the server put in the page, when it serves the blog live from a folder (so new posts
 * appear without rebuilding the site; see server/liveBlog.ts). Otherwise the site uses the posts it
 * was built with (see scripts/vite-plugin-blog.ts).
 */
const LIVE = readBlogIndex(typeof document === 'undefined' ? undefined : document) as Omit<Post, 'page'>[] | null

/** Every post's details; the text of each is fetched when it's opened. */
export const POSTS: Post[] = LIVE ? finalizePosts(LIVE) : finalizePosts(BUILT, import.meta.env.DEV)

export const POSTS_BY_SLUG = new Map(POSTS.map((p) => [p.slug, p]))
export const POSTS_BY_PAGE = new Map(POSTS.map((p) => [p.page, p]))

/** A post's text (Markdown, without its frontmatter). */
export async function loadBody(slug: string) {
  if (LIVE) {
    const res = await fetch(`/api/blog/${encodeURIComponent(slug)}`)
    if (!res.ok) throw new Error(`Couldn't load "${slug}" (${res.status})`)
    return res.text()
  }
  const load = BODIES[slug]
  if (!load) throw new Error(`No post called "${slug}"`)
  return splitFrontmatter(await load()).body
}

export * from './logbookCore.ts'
