import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { blogModule } from './vite-plugin-blog.ts'

const root = mkdtempSync(path.join(tmpdir(), 'blog-'))
const dir = path.join(root, 'src/content/logbook')
const post = (file: string, front: string, body: string) => {
  writeFileSync(path.join(dir, file), `---\n${front}\n---\n${body}`)
}

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('the blog index built at build time', () => {
  mkdirSync(dir, { recursive: true })
  post('2025-01-02-published.md', 'title: Published\ndate: 2025-01-02\ntags: [ml]', 'The secret sauce of this post is long. '.repeat(50))
  post('2025-03-04-unfinished.md', 'title: Unfinished thoughts\ndate: 2025-03-04\ndraft: true', 'Not ready for anyone to read yet.')

  const exported = (source: string) => {
    const posts = JSON.parse(/export const POSTS = (.*)\n/.exec(source)![1]) as { slug: string; words: number; minutes: number }[]
    return { posts, loaders: [...source.matchAll(/"([^"]+)": \(\) => import\("([^"]+)"\)/g)].map((m) => [m[1], m[2]]) }
  }

  it('lists each post’s details, but not its text', () => {
    const source = blogModule(dir, root, false)
    const { posts } = exported(source)
    expect(posts.map((p) => p.slug)).toEqual(['published'])
    expect(posts[0].words).toBeGreaterThan(300)
    expect(posts[0].minutes).toBeGreaterThan(1)
    expect(source).not.toContain('secret sauce')
  })

  it('fetches each post’s text only when asked, from its own file', () => {
    const { loaders } = exported(blogModule(dir, root, false))
    expect(loaders).toEqual([['published', '/src/content/logbook/2025-01-02-published.md?raw']])
  })

  it('keeps drafts out of a production build entirely (shown only while developing)', () => {
    const prod = blogModule(dir, root, false)
    expect(prod).not.toContain('Unfinished')
    expect(prod).not.toContain('unfinished')
    const dev = exported(blogModule(dir, root, true))
    expect(dev.posts.map((p) => p.slug).sort()).toEqual(['published', 'unfinished'])
  })
})
