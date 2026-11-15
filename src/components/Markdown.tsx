import { memo, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { camcorderDate, classifyMedia } from '../lib/media.ts'
import rehypeRetroHighlight from '../lib/rehypeRetroHighlight.ts'

type Props = { source: string; date?: string }

function Media({ src = '', alt = '', title, date }: { src?: string; alt?: string; title?: string; date?: string }) {
  const media = classifyMedia(src)
  const caption = title || alt
  if (media.kind === 'video') {
    return (
      <figure className="md-media md-video">
        <div className="camcorder">
          <video src={media.src} controls preload="metadata" playsInline aria-label={alt || title} />
          <span className="camcorder__osd camcorder__osd--rec" aria-hidden="true">
            ● REC
          </span>
          {date && (
            <span className="camcorder__osd camcorder__osd--date" aria-hidden="true">
              {camcorderDate(date)}
            </span>
          )}
        </div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }
  if (media.kind === 'iframe') {
    return (
      <figure className="md-media md-embed">
        <div className="crt-tv">
          <iframe
            src={media.src}
            title={alt || 'Embedded video'}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }
  return (
    <figure className="md-media md-photo">
      <img src={media.src} alt={alt} loading="lazy" decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function isExternal(href = '') {
  return /^https?:\/\//.test(href) && !href.startsWith(window.location.origin)
}

/** Built once per date so React keeps the same component types (and never remounts videos/iframes). */
function makeComponents(date?: string): Components {
  return {
    // Images (and video/YouTube links using image syntax) become figures; unwrap their paragraph.
    p({ node, children, ...rest }) {
      const only = node?.children.length === 1 ? node.children[0] : null
      if (only && only.type === 'element' && only.tagName === 'img') return <>{children}</>
      return <p {...rest}>{children}</p>
    },
    img({ src, alt, title }) {
      return <Media src={typeof src === 'string' ? src : ''} alt={alt} title={title} date={date} />
    },
    a({ href, children, node: _node, ...rest }) {
      const external = isExternal(href)
      return (
        <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {children}
          {external && <span className="sr-only"> (opens in a new tab)</span>}
        </a>
      )
    },
    table({ node: _node, ...rest }: ComponentPropsWithoutRef<'table'> & { node?: unknown }) {
      return (
        <div className="md-table" tabIndex={0} role="region" aria-label="Table">
          <table {...rest} />
        </div>
      )
    },
    pre({ node: _node, children, ...rest }: { node?: unknown; children?: ReactNode } & ComponentPropsWithoutRef<'pre'>) {
      return (
        <div className="terminal">
          <div className="terminal__bar" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <pre {...rest} tabIndex={0}>
            {children}
          </pre>
        </div>
      )
    },
  }
}

const REMARK = [remarkGfm, remarkMath]
const REHYPE = [rehypeKatex, rehypeRetroHighlight]

export const Markdown = memo(function Markdown({ source, date }: Props) {
  const components = useMemo(() => makeComponents(date), [date])
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
})
