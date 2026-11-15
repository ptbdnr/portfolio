import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveBlog, seedContent } from './liveBlog.ts'

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

const temp = () => (root = mkdtempSync(path.join(tmpdir(), 'live-blog-')))
const post = (dir: string, file: string, front: string, body = 'Some text.') => {
  const full = path.join(dir, file)
  writeFileSync(full, `---\n${front}\n---\n${body}\n`)
  return full
}
const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

describe('the blog, live from a folder', () => {
  it('shows the published posts, newest first, but not drafts or the files macOS leaves on shares', () => {
    const dir = path.join(temp(), 'blog')
    mkdirSync(dir)
    post(dir, '2026-01-01-first.md', 'title: First\ndate: 2026-01-01')
    post(dir, '2026-02-01-second.md', 'title: Second\ndate: 2026-02-01\nsummary: The second one.')
    post(dir, '2026-03-01-secret.md', 'title: Secret\ndate: 2026-03-01\ndraft: true   # not yet')
    writeFileSync(path.join(dir, '._2026-01-01-first.md'), Buffer.from([0, 5, 22, 7, 0, 2, 0, 0]))
    writeFileSync(path.join(dir, 'notes.txt'), 'not a post')
    const blog = createLiveBlog(dir, { logger: logger() })
    expect(blog.posts().map((p) => [p.slug, p.page])).toEqual([
      ['second', 202],
      ['first', 201],
    ])
    expect(blog.body('first')).toBe('Some text.\n')
    expect(blog.markdown('second')).toBe('# Second\n\nSome text.\n')
    expect(blog.plainPage('second')).toContain('<h1>Second</h1>')
    expect(blog.llms()).toContain('- [Second](/blog/second.md): The second one.')
    for (const shown of [blog.has('secret'), blog.body('secret'), blog.markdown('secret'), blog.plainPage('secret')]) expect(shown).toBeFalsy()
    expect(blog.llms()).not.toContain('Secret')
  })

  it('picks up new, changed and deleted posts within a couple of seconds, with no restart', () => {
    const dir = path.join(temp(), 'blog')
    mkdirSync(dir)
    let t = 0
    const blog = createLiveBlog(dir, { now: () => t, logger: logger() })
    expect(blog.posts()).toEqual([])

    const file = post(dir, '2026-01-01-hello.md', 'title: Hello\ndate: 2026-01-01\ndraft: true', 'First words.')
    t += 2500
    expect(blog.posts()).toEqual([])

    // Published: the draft flag comes off.
    post(dir, '2026-01-01-hello.md', 'title: Hello\ndate: 2026-01-01', 'First words.')
    utimesSync(file, new Date(), new Date(Date.now() + 5000))
    expect(blog.posts()).toEqual([])
    t += 2500
    expect(blog.posts().map((p) => p.title)).toEqual(['Hello'])
    expect(blog.plainPage('hello')).toContain('<p>First words.</p>')

    post(dir, '2026-01-01-hello.md', 'title: Hello again\ndate: 2026-01-01', 'Second thoughts, at more length.')
    utimesSync(file, new Date(), new Date(Date.now() + 10_000))
    t += 2500
    expect(blog.posts()[0].title).toBe('Hello again')
    expect(blog.body('hello')).toBe('Second thoughts, at more length.\n')
    expect(blog.plainPage('hello')).toContain('<p>Second thoughts, at more length.</p>')

    unlinkSync(file)
    t += 2500
    expect(blog.posts()).toEqual([])
    expect(blog.plainPage('hello')).toBeNull()
  })

  it("copes with a folder that isn't there (yet), and says so once", () => {
    let t = 0
    const log = logger()
    const blog = createLiveBlog(path.join(temp(), 'missing'), { now: () => t, logger: log })
    expect(blog.posts()).toEqual([])
    t += 5000
    expect(blog.posts()).toEqual([])
    expect(log.warn).toHaveBeenCalledTimes(1)
  })
})

describe('the first start', () => {
  function setup() {
    const base = temp()
    const samples = path.join(base, 'samples')
    const pictures = path.join(base, 'pictures')
    mkdirSync(samples)
    mkdirSync(pictures)
    post(samples, '2026-01-01-sample.md', 'title: Sample\ndate: 2026-01-01')
    writeFileSync(path.join(samples, '._2026-01-01-sample.md'), 'junk')
    writeFileSync(path.join(pictures, 'sandpile.png'), 'png')
    const options = { contentDir: path.join(base, 'content'), posts: samples, media: pictures, marker: path.join(base, 'data', '.content-seeded'), logger: logger() }
    return { ...options, blog: path.join(options.contentDir, 'blog'), media: path.join(options.contentDir, 'media'), options }
  }

  it('fills an empty content folder with the posts and pictures the site was built with', () => {
    const s = setup()
    seedContent(s.options)
    expect(readdirSync(s.blog)).toEqual(['2026-01-01-sample.md'])
    expect(readdirSync(s.media)).toEqual(['sandpile.png'])
    expect(existsSync(s.options.marker)).toBe(true)
  })

  it('only once: a blog emptied on purpose stays empty', () => {
    const s = setup()
    seedContent(s.options)
    rmSync(path.join(s.blog, '2026-01-01-sample.md'))
    seedContent(s.options)
    expect(readdirSync(s.blog)).toEqual([])
  })

  it('leaves a folder that already has posts alone', () => {
    const s = setup()
    mkdirSync(s.blog, { recursive: true })
    post(s.blog, '2026-05-05-mine.md', 'title: Mine\ndate: 2026-05-05')
    seedContent(s.options)
    expect(readdirSync(s.blog)).toEqual(['2026-05-05-mine.md'])
    expect(existsSync(s.options.marker)).toBe(true)
  })

  it("says what's wrong when it can't use the folder", () => {
    const s = setup()
    writeFileSync(s.options.contentDir, 'a file, not a folder')
    seedContent(s.options)
    expect(s.options.logger.error).toHaveBeenCalledWith(expect.stringContaining("check the folder's permissions"))
  })
})
