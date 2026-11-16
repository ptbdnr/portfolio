import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { llmsTxt, markdownToHtml, plainFiles, plainMarkdown, plainPage, plainResponse, readPosts, type PlainPost } from './blog-plain.ts'

const root = mkdtempSync(path.join(tmpdir(), 'plain-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const BODY = `
Intro with [a link](https://example.com), \`code\` and maths $e^{i\\pi} + 1 = 0$.

## Pictures

![A photo](/media/sandpile.png "Caption here")

![A clip](/media/sandpile.mp4)

![Crackling](/media/sandpile-crackle.mp3 "One click per toppling")

![A talk](https://www.youtube.com/watch?v=aircAruvnKk)

\`\`\`python
print("hi")
\`\`\`

$$
P(s) \\propto s^{-\\tau}
$$

| a | b |
|---|---|
| 1 | 2 |

> A quote.

A note.[^n]

<script>alert('nope')</script>

[^n]: The footnote.
`

const SOURCE = `---
title: A <rich> post
date: 2026-03-04
summary: All the things, in one place.
tags: [ml, mountains]
season: winter
cover: /media/cover.png
---
${BODY}`

const dir = path.join(root, 'logbook')
mkdirSync(dir)
writeFileSync(path.join(dir, '2026-03-04-rich.md'), SOURCE)
writeFileSync(path.join(dir, '2025-01-02-older.md'), '---\ntitle: Older\ndate: 2025-01-02\nsummary: From before.\n---\nOld news.\n')
writeFileSync(path.join(dir, '2026-05-06-draft.md'), '---\ntitle: Not yet\ndate: 2026-05-06\ndraft: true\n---\nUnfinished.\n')

const posts = readPosts(dir, false)
const rich = posts.find((p) => p.slug === 'rich')!

/** Everything the site shows about a post besides its title and text. */
const METADATA = [/2026-03-04/, /4 Mar/i, /\bgrade\b/i, /\bPD\b|\bAD\b/, /ascent/i, /\d+h\d\d/, /\bmin(ute)?s?\b/i, /#?mountains/, /\bwinter\b/, /tags?:/i, /season/i, /cover\.png/]

describe('the blog as plain Markdown, for AI tools', () => {
  it('reads every published post, newest first, keeping drafts for development only', () => {
    expect(posts.map((p) => p.slug)).toEqual(['rich', 'older'])
    expect(readPosts(dir, true).map((p) => p.slug)).toEqual(['draft', 'rich', 'older'])
  })

  it('is the title as a heading and then the text exactly as written, with none of the post’s details', () => {
    const md = plainMarkdown(rich)
    expect(md).toBe(`# A \\<rich> post\n\n${BODY.trim()}\n`)
    expect(md).not.toContain('---\n')
    expect(md).not.toContain(rich.summary)
    for (const detail of METADATA) expect(md).not.toMatch(detail)
  })

  it('keeps the title as written: nothing in it turns into formatting, HTML or maths', () => {
    const title = 'Saving $5 *and* <b>[more]</b> with `x_y` ~~maybe~~ & C#'
    const html = markdownToHtml(plainMarkdown({ title, body: 'Text.' }))
    expect(html.split('\n')[0]).toBe('<h1>Saving $5 *and* &#x3C;b>[more]&#x3C;/b> with `x_y` ~~maybe~~ &#x26; C#</h1>')
  })

  it('does not repeat the title when the text already starts with one', () => {
    expect(plainMarkdown({ title: 'Ignored', body: '\n\n# Own title\n\nText.\n\n' })).toBe('# Own title\n\nText.\n')
  })

  it('lists the posts for AI tools in llms.txt, each with its Markdown', () => {
    const txt = llmsTxt(posts)
    expect(txt).toMatch(/^# Peter Bodnar\n\n> Lead AI Engineer in London\. /)
    expect(txt).toContain('## Blog\n\n- [A \\<rich> post](/blog/rich.md): All the things, in one place.\n- [Older](/blog/older.md): From before.\n')
    expect(txt).not.toContain('Not yet')
  })
})

describe('the same Markdown as a plain page, for people', () => {
  const html = plainPage(rich)
  const article = /<article>([\s\S]*)<\/article>/.exec(html)![1]

  it('shows the title and the text, and nothing else from the site', () => {
    expect(html).toContain('<title>A &lt;rich&gt; post · Peter Bodnar</title>')
    expect(article).toMatch(/^\s*<h1>A &#x3C;rich> post<\/h1>/)
    expect(article).toContain('<h2>Pictures</h2>')
    for (const detail of METADATA) expect(article).not.toMatch(detail)
    expect(html).not.toMatch(/<script|<img[^>]*pixel|class="(?:terminal|camcorder|crt-tv|hut-stamp|altimeter)/)
  })

  it('shows pictures, sound, videos and YouTube links as plain figures with their captions', () => {
    expect(article).toContain(
      '<figure><img src="/media/sandpile.png" alt="A photo" loading="lazy" decoding="async"><figcaption>Caption here</figcaption></figure>',
    )
    expect(article).toContain('<video src="/media/sandpile.mp4" controls preload="metadata" playsinline aria-label="A clip"></video><figcaption>A clip</figcaption>')
    expect(article).toContain(
      '<figure><audio src="/media/sandpile-crackle.mp3" controls preload="metadata" aria-label="Crackling"><a href="/media/sandpile-crackle.mp3">Download the sound: Crackling</a></audio><figcaption>One click per toppling</figcaption></figure>',
    )
    expect(article).toMatch(/<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/aircAruvnKk" title="A talk"[^>]*><\/iframe>/)
    expect(article).not.toContain('<p><figure>')
  })

  it('keeps code, maths, tables, quotes and footnotes, and leaves out raw HTML', () => {
    expect(article).toContain('<pre tabindex="0"><code class="language-python">print("hi")')
    // MathML only, which browsers draw themselves: KaTeX's HTML version would need its stylesheet, and show up twice without it.
    expect(article.match(/<math /g)).toHaveLength(2)
    expect(article).toContain('display="block"')
    expect(article).not.toContain('katex-html')
    expect(article).toMatch(/<div class="table" role="region" tabindex="0" aria-label="Table">\s*<table>/)
    expect(article).toContain('<blockquote>')
    expect(article).toContain('<section data-footnotes class="footnotes">')
    expect(article).not.toContain('alert(')
  })

  it('links to the post on the site and to its Markdown', () => {
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/blog/rich.md">')
    expect(html).toContain('<a href="/blog/rich">Read it on the site</a> · <a href="/blog/rich.md">Markdown</a>')
  })

  it('renders plain Markdown without any page around it too', () => {
    expect(markdownToHtml('Hello *there*')).toBe('<p>Hello <em>there</em></p>')
  })
})

describe('publishing', () => {
  it('writes each post’s Markdown and plain page, and llms.txt', () => {
    expect(plainFiles(posts).map((f) => f.fileName)).toEqual([
      'llms.txt',
      'blog/rich.md',
      'blog/rich/plain/index.html',
      'blog/older.md',
      'blog/older/plain/index.html',
    ])
  })

  it('serves them while developing, and hands Markdown to AI tools that ask for it', () => {
    const all = () => posts
    const at = (pathname: string, accept?: string) => plainResponse(pathname, accept, all)
    expect(at('/blog/rich.md')).toEqual({ type: 'text/markdown; charset=utf-8', body: plainMarkdown(rich) })
    expect(at('/blog/rich/plain')).toMatchObject({ type: 'text/html; charset=utf-8', body: plainPage(rich) })
    expect(at('/blog/rich/plain/')?.body).toBe(plainPage(rich))
    expect(at('/llms.txt')).toEqual({ type: 'text/plain; charset=utf-8', body: llmsTxt(posts) })
    expect(at('/blog/rich', 'text/markdown')).toEqual({ type: 'text/markdown; charset=utf-8', body: plainMarkdown(rich), vary: true })
    expect(at('/blog', 'text/markdown')?.body).toBe(llmsTxt(posts))
    expect(at('/', 'text/markdown')?.body).toBe(llmsTxt(posts))
    // Everything else is the site's business.
    for (const [pathname, accept] of [
      ['/blog/rich', 'text/html'],
      ['/blog/missing.md', undefined],
      ['/blog/missing/plain', undefined],
      ['/blog/missing', 'text/markdown'],
      ['/src/main.tsx', 'text/markdown'],
    ] as const) {
      expect(at(pathname, accept)).toBeNull()
    }
  })

  it('only reads the posts for the addresses it serves', () => {
    const read = vi.fn((): PlainPost[] => posts)
    for (const pathname of ['/src/main.tsx', '/media/sandpile.png', '/blog', '/']) plainResponse(pathname, 'text/html', read)
    expect(read).not.toHaveBeenCalled()
  })
})
