// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Markdown } from './Markdown.tsx'

afterEach(cleanup)

const source = `
# Title

Intro with [a link](https://example.com) and \`code\`.

![A photo](/media/sandpile.png "Caption here")

![Clip](/media/sandpile.mp4)

![Talk](https://www.youtube.com/watch?v=aircAruvnKk)

\`\`\`python
print("hi")
\`\`\`

Inline $x^2$ maths.

| a | b |
|---|---|
| 1 | 2 |

<script>alert('nope')</script>
`

describe('Markdown', () => {
  it('renders media embeds, code, maths and tables', () => {
    const { container } = render(<Markdown source={source} date="2026-11-10" />)

    const img = container.querySelector('figure.md-photo img')
    expect(img?.getAttribute('src')).toBe('/media/sandpile.png')
    expect(container.querySelector('figure.md-photo figcaption')?.textContent).toBe('Caption here')

    const video = container.querySelector('figure.md-video video')
    expect(video?.getAttribute('src')).toBe('/media/sandpile.mp4')
    expect(container.querySelector('.camcorder__osd--date')?.textContent).toBe('NOV 10 2026')

    const iframe = container.querySelector('figure.md-embed iframe')
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/aircAruvnKk')

    // Figures are not wrapped in paragraphs (invalid HTML).
    expect(container.querySelector('p figure')).toBeNull()

    expect(container.querySelector('.terminal pre code.hljs')).not.toBeNull()
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('.md-table table')).not.toBeNull()

    const link = container.querySelector('a[href="https://example.com"]')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('keeps videos and embeds mounted when the page re-renders (e.g. while scrolling)', () => {
    const md = '![v](/media/a.mp4)\n\n![t](https://youtu.be/aircAruvnKk)'
    const { container, rerender } = render(<Markdown source={md} date="2026-01-01" />)
    const video = container.querySelector('video')
    const iframe = container.querySelector('iframe')
    rerender(<Markdown source={md} date="2026-01-01" />)
    expect(container.querySelector('video')).toBe(video)
    expect(container.querySelector('iframe')).toBe(iframe)
  })

  it('never renders raw HTML', () => {
    const { container } = render(<Markdown source={'<script>alert(1)</script><img src=x onerror=alert(1)>'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[onerror]')).toBeNull()
  })
})
