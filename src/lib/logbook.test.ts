// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BLOG_INDEX_ID, withBlogIndex } from '../../shared/liveBlog.ts'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

const live = [
  { slug: 'gran-paradiso', title: 'Gran Paradiso', date: '2026-12-01', summary: '', tags: ['mountains'], season: 'summer', draft: false, words: 300, minutes: 2, grade: 'F' },
  { slug: 'older', title: 'Older </script><b>', date: '2026-01-01', summary: '', tags: [], season: 'winter', draft: false, words: 100, minutes: 1, grade: 'F' },
]

describe('the posts on the site', () => {
  it('are the ones the server put in the page, when it serves the blog live', async () => {
    document.documentElement.innerHTML = withBlogIndex('<head></head><body></body>', live)
    expect(document.getElementById(BLOG_INDEX_ID)).not.toBeNull()
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'Live words.' }))
    vi.stubGlobal('fetch', fetch)
    const blog = await import('./logbook.ts')
    expect(blog.POSTS.map((p) => [p.slug, p.page])).toEqual([
      ['gran-paradiso', 202],
      ['older', 201],
    ])
    expect(blog.POSTS[1].title).toBe('Older </script><b>')
    expect(await blog.loadBody('gran-paradiso')).toBe('Live words.')
    expect(fetch).toHaveBeenCalledWith('/api/blog/gran-paradiso')
  })

  it('says so when a post’s text can’t be fetched, so the page can offer to try again', async () => {
    document.documentElement.innerHTML = withBlogIndex('<head></head><body></body>', live)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, text: async () => '' })))
    const blog = await import('./logbook.ts')
    await expect(blog.loadBody('gran-paradiso')).rejects.toThrow('503')
  })

  it('are the ones built into the site otherwise', async () => {
    const blog = await import('./logbook.ts')
    expect(blog.POSTS_BY_SLUG.has('welcome-to-the-blog')).toBe(true)
    expect(await blog.loadBody('welcome-to-the-blog')).toContain('Every mountain hut has a logbook')
  })
})
