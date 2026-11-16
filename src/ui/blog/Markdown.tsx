/**
 * A blog post's Markdown as the site shows it. Pictures, sound and video files, and YouTube or
 * Vimeo links all use the image syntax: ![caption](/media/file "title"). Raw HTML is never rendered.
 */
import { memo, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { classifyMedia, clock } from '../../lib/media.ts'
import rehypeHighlight from '../../lib/rehypeHighlight.ts'
import { sound } from '../engineContext.ts'
import { Icon } from '../icons.tsx'

/** While a post's own sound or video plays, the trail's soundscape steps back. */
function useDuck() {
  const on = useRef(false)
  useEffect(() => () => void (on.current && sound.duck(false)), [])
  return (playing: boolean) => {
    if (playing === on.current) return
    on.current = playing
    sound.duck(playing)
  }
}

export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(Number.NaN)
  const [failed, setFailed] = useState(false)
  const duck = useDuck()
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) void a.play().catch(() => setFailed(true))
    else a.pause()
  }
  const progress = Number.isFinite(duration) && duration > 0 ? time / duration : 0
  return (
    <div className={`audio${playing ? ' is-playing' : ''}`}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          duck(true)
        }}
        onPause={() => {
          setPlaying(false)
          duck(false)
        }}
        onEnded={() => {
          setPlaying(false)
          duck(false)
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <button type="button" className="audio__play" onClick={toggle} aria-label={`${playing ? 'Pause' : 'Play'}: ${label}`} disabled={failed}>
        {playing ? <Icon.pause /> : <Icon.play />}
      </button>
      <div className="audio__track" style={{ '--progress': progress } as CSSProperties}>
        <span className="audio__wave" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={Number.isFinite(duration) ? duration : 0}
          step={0.1}
          value={time}
          aria-label={`Position in ${label}`}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onChange={(e) => {
            const a = audio.current
            if (!a) return
            a.currentTime = Number(e.target.value)
            setTime(a.currentTime)
          }}
        />
      </div>
      <span className="audio__time">{failed ? 'Can’t play this here' : `${clock(time)} / ${clock(duration)}`}</span>
      <a className="audio__download" href={src} download aria-label={`Download ${label}`}>
        <Icon.download />
      </a>
    </div>
  )
}

function Video({ src, label }: { src: string; label: string }) {
  const duck = useDuck()
  return <video src={src} controls preload="metadata" playsInline aria-label={label} onPlay={() => duck(true)} onPause={() => duck(false)} onEnded={() => duck(false)} />
}

function Media({ src = '', alt = '', title }: { src?: string; alt?: string; title?: string }) {
  const media = classifyMedia(src)
  const caption = title || alt
  const label = alt || title || 'Media'
  if (media.kind === 'audio') {
    return (
      <figure className="md-media md-audio">
        <AudioPlayer src={media.src} label={label} />
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }
  if (media.kind === 'video') {
    return (
      <figure className="md-media md-video">
        <Video src={media.src} label={label} />
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }
  if (media.kind === 'iframe') {
    return (
      <figure className="md-media md-embed">
        <div className="md-embed__frame">
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

function CodeBlock({ children, ...rest }: { children?: ReactNode } & ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  return (
    <div className="md-code">
      <button
        type="button"
        className="md-code__copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(ref.current?.innerText ?? '')
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // No clipboard access: nothing to do.
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={ref} {...rest} tabIndex={0}>
        {children}
      </pre>
    </div>
  )
}

/** Built once, so React keeps the same component types (and never remounts players while you read). */
const COMPONENTS: Components = {
  // Pictures, sound and video become figures; unwrap their paragraph.
  p({ node, children, ...rest }) {
    const only = node?.children.length === 1 ? node.children[0] : null
    if (only && only.type === 'element' && only.tagName === 'img') return <>{children}</>
    return <p {...rest}>{children}</p>
  },
  img({ src, alt, title }) {
    return <Media src={typeof src === 'string' ? src : ''} alt={alt} title={title} />
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
    return <CodeBlock {...rest}>{children}</CodeBlock>
  },
}

const REMARK = [remarkGfm, remarkMath]
const REHYPE = [rehypeKatex, rehypeHighlight]

export const Markdown = memo(function Markdown({ source }: { source: string }) {
  const components = useMemo(() => COMPONENTS, [])
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
})
