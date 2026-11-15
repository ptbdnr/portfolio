import { describe, expect, it } from 'vitest'
import {
  buildPost,
  countWords,
  finalizePosts,
  gradeFor,
  readingMinutes,
  relatedPosts,
  signTime,
  slugFromPath,
  splitFrontmatter,
} from './logbookCore.ts'

const md = (front: string, body = 'Hello trail.') => `---\n${front}\n---\n${body}`

describe('frontmatter', () => {
  it('parses YAML and returns the body', () => {
    const { data, body } = splitFrontmatter(md('title: Hut\ntags: [ml, alps]'))
    expect(data).toEqual({ title: 'Hut', tags: ['ml', 'alps'] })
    expect(body).toBe('Hello trail.')
  })

  it('tolerates files without frontmatter', () => {
    expect(splitFrontmatter('# Just text')).toEqual({ data: {}, body: '# Just text' })
  })

  it('builds a post with defaults and normalised tags', () => {
    const post = buildPost('/x/2024-01-02-first-steps.md', md('title: First\ndate: 2024-01-02\ntags: [ML, Alps]'))
    expect(post).toMatchObject({ slug: 'first-steps', title: 'First', date: '2024-01-02', tags: ['ml', 'alps'], season: 'summer' })
  })
})

describe('reading metrics', () => {
  it('counts words but skips code, maths and link URLs', () => {
    const text = 'One two [three](http://a.b/c) ![img](x.png)\n```py\nprint(1)\n```\n$$x^2$$ four'
    expect(countWords(text)).toBe(4)
  })

  it('grades longer and more technical routes harder', () => {
    expect(gradeFor('plain', 2)).toBe('F')
    expect(gradeFor('```a```\n```b```\n$$x$$', 5)).toBe('AD')
    expect(gradeFor('plain', 30)).toBe('ED')
  })

  it('counts code at half weight and adds time for figures', () => {
    const prose = Array.from({ length: 400 }, () => 'word').join(' ')
    const code = '```\n' + Array.from({ length: 200 }, () => 'x').join(' ') + '\n```'
    expect(readingMinutes(prose)).toBe(2)
    expect(readingMinutes(`${prose}\n${code}\n![a](b.png) ![c](d.mp4) ![e](f.png)`)).toBe(3)
  })

  it('formats signpost times', () => {
    expect(signTime(7)).toBe('0h07')
    expect(signTime(75)).toBe('1h15')
  })

  it('strips date prefixes from slugs', () => {
    expect(slugFromPath('../content/logbook/2025-03-01-sandpiles.md')).toBe('sandpiles')
  })
})

describe('finalizePosts & related', () => {
  const raw = [
    buildPost('a.md', md('title: A\ndate: 2024-01-01\ntags: [ml, uncertainty]\nseason: winter')),
    buildPost('b.md', md('title: B\ndate: 2024-06-01\ntags: [ml, optimisation]\nseason: summer')),
    buildPost('c.md', md('title: C\ndate: 2025-01-01\ntags: [mountains]\nseason: winter')),
    buildPost('d.md', md('title: D\ndate: 2025-02-01\ntags: [ml, uncertainty]\nseason: autumn\ndraft: true')),
  ]

  it('hides drafts, sorts newest first and numbers pages oldest-first', () => {
    const posts = finalizePosts(raw)
    expect(posts.map((p) => p.slug)).toEqual(['c', 'b', 'a'])
    expect(posts.map((p) => p.page)).toEqual([203, 202, 201])
  })

  it('ranks related posts by shared tags first', () => {
    const posts = finalizePosts(raw, true)
    const a = posts.find((p) => p.slug === 'a')!
    const rel = relatedPosts(a, posts)
    expect(rel[0].post.slug).toBe('d')
    expect(rel[0].shared).toEqual(['ml', 'uncertainty'])
    expect(rel.map((r) => r.post.slug)).not.toContain('a')
  })
})
