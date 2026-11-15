declare module 'virtual:blog' {
  import type { Post } from './lib/logbookCore.ts'
  /** Every post's details, without its text (drafts only while developing). See scripts/vite-plugin-blog.ts. */
  export const POSTS: Omit<Post, 'page'>[]
  /** Fetches a post's Markdown source (frontmatter included), by slug. */
  export const BODIES: Record<string, () => Promise<string>>
}
