import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from './frontmatter.ts'

describe('parseFrontmatter', () => {
  it('parses the subset of YAML used by logbook entries', () => {
    const data = parseFrontmatter(
      [
        '# a comment',
        'title: "Calibration: a form of honesty"',
        'date: 2026-10-04',
        'summary: When they say 70%, they mean it.',
        'tags: [ml, "uncertainty", mountains]',
        'draft: false',
        'order: 3',
        'aliases:',
        '  - first',
        '  - "second one"',
        'empty:',
        'note: C# tips',
      ].join('\n'),
    )
    expect(data).toEqual({
      title: 'Calibration: a form of honesty',
      date: '2026-10-04',
      summary: 'When they say 70%, they mean it.',
      tags: ['ml', 'uncertainty', 'mountains'],
      draft: false,
      order: 3,
      aliases: ['first', 'second one'],
      empty: '',
      note: 'C# tips',
    })
  })

  it('ignores comments after a value, so a commented draft stays a draft', () => {
    const data = parseFrontmatter(
      [
        'season: winter        # spring | summer | autumn | winter',
        'draft: true           # not ready yet',
        'tags: [ml, mountains] # the first three become the coloured buttons',
        'aliases:   # block list',
        '  - first  # one',
        '  - "second # two"',
      ].join('\n'),
    )
    expect(data).toEqual({ season: 'winter', draft: true, tags: ['ml', 'mountains'], aliases: ['first', 'second # two'] })
  })

  it('keeps a # that is quoted, inside a word, or in an address', () => {
    expect(
      parseFrontmatter(
        [
          'title: "Episode #3: the descent"',
          "summary: It's C# time # but not this",
          'cover: https://example.com/photo.jpg#top',
          "note: 'single #quoted'",
        ].join('\n'),
      ),
    ).toEqual({
      title: 'Episode #3: the descent',
      summary: "It's C# time",
      cover: 'https://example.com/photo.jpg#top',
      note: 'single #quoted',
    })
  })

  it('handles empty inline lists and quoted commas', () => {
    expect(parseFrontmatter("tags: []\nlist: ['a, b', c]")).toEqual({ tags: [], list: ['a, b', 'c'] })
  })
})
