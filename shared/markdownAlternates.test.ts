import { describe, expect, it } from 'vitest'
import { markdownAlternate, postSlugOf, prefersMarkdown, withMarkdownLink } from './markdownAlternates.ts'

describe('asking for Markdown', () => {
  it('is something AI tools do, never browsers', () => {
    expect(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8')).toBe(true)
    expect(prefersMarkdown('text/markdown')).toBe(true)
    expect(prefersMarkdown('text/html, text/markdown')).toBe(true)
    expect(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8')).toBe(false)
    expect(prefersMarkdown('*/*')).toBe(false)
    expect(prefersMarkdown(undefined)).toBe(false)
    expect(prefersMarkdown('')).toBe(false)
  })

  it('respects which the tool would rather have', () => {
    expect(prefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false)
    expect(prefersMarkdown('text/markdown;q=0.8, text/html;q=0.5')).toBe(true)
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false)
    expect(prefersMarkdown('TEXT/MARKDOWN; charset=utf-8')).toBe(true)
  })
})

describe('where a page’s Markdown version is', () => {
  const isPost = (slug: string) => slug === 'first-post'

  it('is a post’s .md for the post, and llms.txt for the home page and the blog index', () => {
    expect(markdownAlternate('/blog/first-post', isPost)).toBe('/blog/first-post.md')
    expect(markdownAlternate('/blog/first-post/', isPost)).toBe('/blog/first-post.md')
    for (const page of ['/', '/blog', '/blog/']) expect(markdownAlternate(page, isPost)).toBe('/llms.txt')
  })

  it('is nowhere for other pages, missing posts, or the plain versions themselves', () => {
    for (const page of ['/blog/missing', '/blog/first-post/plain', '/blog/first-post.md', '/logbook/first-post', '/lab']) {
      expect(markdownAlternate(page, isPost)).toBeNull()
    }
    expect(postSlugOf('/blog/first-post')).toBe('first-post')
    expect(postSlugOf('/blog')).toBeNull()
  })

  it('is written into a page’s head', () => {
    const html = withMarkdownLink('<html><head><title>x</title></head><body></body></html>', '/blog/a "b".md')
    expect(html).toBe(
      '<html><head><title>x</title>  <link rel="alternate" type="text/markdown" href="/blog/a%20%22b%22.md" id="markdown-alternate" />\n  </head><body></body></html>',
    )
  })
})
