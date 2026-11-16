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

![Birdsong at dawn](/media/dawn.mp3 "Recorded at the hut")

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
  it('renders pictures, sound, video, embeds, code, maths and tables', () => {
    const { container } = render(<Markdown source={source} />)

    const img = container.querySelector('figure.md-photo img')
    expect(img?.getAttribute('src')).toBe('/media/sandpile.png')
    expect(container.querySelector('figure.md-photo figcaption')?.textContent).toBe('Caption here')

    expect(container.querySelector('figure.md-video video')?.getAttribute('src')).toBe('/media/sandpile.mp4')

    const audio = container.querySelector('figure.md-audio audio')
    expect(audio?.getAttribute('src')).toBe('/media/dawn.mp3')
    expect(container.querySelector('figure.md-audio figcaption')?.textContent).toBe('Recorded at the hut')
    expect(container.querySelector('.audio__play')?.getAttribute('aria-label')).toBe('Play: Birdsong at dawn')
    expect(container.querySelector('.audio input[type="range"]')).not.toBeNull()
    expect(container.querySelector('.audio__download')?.getAttribute('href')).toBe('/media/dawn.mp3')

    expect(container.querySelector('figure.md-embed iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/aircAruvnKk')

    // Figures are not wrapped in paragraphs (invalid HTML).
    expect(container.querySelector('p figure')).toBeNull()

    expect(container.querySelector('.md-code pre code.hljs')).not.toBeNull()
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('.md-table table')).not.toBeNull()

    const link = container.querySelector('a[href="https://example.com"]')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('keeps players mounted when the page re-renders (so they don’t stop while you read)', () => {
    const md = '![v](/media/a.mp4)\n\n![s](/media/a.mp3)\n\n![t](https://youtu.be/aircAruvnKk)'
    const { container, rerender } = render(<Markdown source={md} />)
    const video = container.querySelector('video')
    const audio = container.querySelector('audio')
    const iframe = container.querySelector('iframe')
    rerender(<Markdown source={md} />)
    expect(container.querySelector('video')).toBe(video)
    expect(container.querySelector('audio')).toBe(audio)
    expect(container.querySelector('iframe')).toBe(iframe)
  })

  it('never renders raw HTML', () => {
    const { container } = render(<Markdown source={'<script>alert(1)</script><img src=x onerror=alert(1)><audio src=x autoplay>'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[onerror]')).toBeNull()
    expect(container.querySelector('audio[autoplay]')).toBeNull()
  })
})
