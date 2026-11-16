import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, matchPath, useLocation, useNavigate, useParams } from 'react-router'
import { ALTERNATE_ID, markdownAlternate } from '../shared/markdownAlternates.ts'
import { FIRST_SCENE, SCENE_BY_ID, type SceneId } from './content/trail.ts'
import type { Engine } from './engine/engine.ts'
import { api } from './lib/api.ts'
import { POSTS_BY_SLUG } from './lib/logbook.ts'
import { game, useGame, type Panel as PanelState } from './lib/store.ts'
import { BlogIndex } from './ui/blog/BlogIndex.tsx'
import { EngineContext, isTypingTarget, sound } from './ui/engineContext.ts'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { PLACEMENT, takePhoto } from './ui/helpers.ts'
import { Hotspots } from './ui/Hotspots.tsx'
import { Hud } from './ui/Hud.tsx'
import { AboutPanel, ContactPanel, NotFoundPanel } from './ui/Pages.tsx'
import { NotePanel } from './ui/panels/NotePanel.tsx'
import { GuidePanel, HelpPanel, MapPanel, MenuPanel, PhotosPanel, PlacePanel } from './ui/panels/Panels.tsx'
import { SimpleSite } from './ui/Simple.tsx'
import { Stage } from './ui/Stage.tsx'
import { Title } from './ui/Title.tsx'
import { Caption, Toasts } from './ui/Toasts.tsx'

const PostReader = lazy(() => import('./ui/blog/PostReader.tsx'))

const isScene = (id: string | undefined): id is SceneId => Boolean(id && SCENE_BY_ID.has(id as SceneId))

type Place = { kind: 'trail'; scene?: SceneId } | { kind: 'blog' } | { kind: 'post'; slug: string } | { kind: 'about' } | { kind: 'contact' } | { kind: 'missing' }

function routeOf(pathname: string): Place {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { kind: 'trail' }
  const trail = matchPath('/trail/:scene', path)?.params.scene
  if (trail !== undefined) return isScene(trail) ? { kind: 'trail', scene: trail } : { kind: 'missing' }
  if (path === '/blog') return { kind: 'blog' }
  const slug = matchPath('/blog/:slug', path)?.params.slug
  if (slug !== undefined) return POSTS_BY_SLUG.has(slug) ? { kind: 'post', slug } : { kind: 'missing' }
  if (path === '/about') return { kind: 'about' }
  if (path === '/contact') return { kind: 'contact' }
  return { kind: 'missing' }
}

function StorePanel({ panel }: { panel: PanelState }) {
  switch (panel.kind) {
    case 'note':
      return <NotePanel id={panel.id} />
    case 'place':
      return <PlacePanel />
    case 'map':
      return <MapPanel />
    case 'guide':
      return <GuidePanel />
    case 'photos':
      return <PhotosPanel />
    case 'menu':
      return <MenuPanel />
    case 'help':
      return <HelpPanel />
  }
}

/** Keeps the page's pointer to its Markdown version (for AI tools) in step as you browse. */
function MarkdownAlternate() {
  const { pathname } = useLocation()
  useEffect(() => {
    const href = markdownAlternate(pathname, (slug) => POSTS_BY_SLUG.has(slug))
    let link = document.getElementById(ALTERNATE_ID)
    if (!href) return void link?.remove()
    if (!link) {
      link = Object.assign(document.createElement('link'), { id: ALTERNATE_ID, rel: 'alternate', type: 'text/markdown' })
      document.head.append(link)
    }
    link.setAttribute('href', href)
  }, [pathname])
  return null
}

/** Sound is allowed to start only after a click or key press: if it's switched on, start it at the first one. */
function SoundSync() {
  const on = useGame((s) => s.settings.sound)
  const volume = useGame((s) => s.settings.volume)
  useEffect(() => {
    sound.setVolume(volume)
  }, [volume])
  useEffect(() => {
    if (!on || sound.enabled) return
    const wake = () => {
      void sound.enable()
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [on])
  return null
}

/** One-key shortcuts for the tools, when nothing else has the keyboard. */
function Shortcuts({ engine, enabled }: { engine: Engine | null; enabled: boolean }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'm') game.open({ kind: 'map' })
      else if (key === 'b' || key === 'j') navigate('/blog')
      else if (key === 'g') game.open({ kind: 'guide' })
      else if (key === 'h' || key === '?') game.open({ kind: 'help' })
      else if (key === 'p' && engine?.scene) void takePhoto(engine, engine.scene)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, engine, navigate])
  return null
}

/** Tells screen readers where they've arrived. */
function Arrival() {
  const scene = SCENE_BY_ID.get(useGame((s) => s.scene))!
  const started = useGame((s) => s.started)
  return (
    <p className="sr-only" aria-live="polite">
      {started ? `${scene.name}. ${scene.description}` : ''}
    </p>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const simple = useGame((s) => s.settings.simple || s.noWebgl)
  const started = useGame((s) => s.started)
  const panel = useGame((s) => s.panel)
  const sceneId = useGame((s) => s.scene)
  const [engine, setEngine] = useState<Engine | null>(null)
  const route = routeOf(pathname)
  const routeScene = route.kind === 'trail' ? route.scene : undefined

  // Where the view starts (read when it's created, so coming back from the simple view keeps your place):
  // the place in the address, the place a post is pinned, or where you are.
  const fromPost = route.kind === 'post' ? (PLACEMENT.sceneOf.get(route.slug) as SceneId | undefined) : undefined
  const start = { scene: routeScene || fromPost || game.get().scene || FIRST_SCENE }

  // An address like /trail/lake, followed from a link: go there. (Only when the address changes:
  // walking somewhere updates the address itself, a moment after the place.)
  useEffect(() => {
    if (!engine || !routeScene || routeScene === game.get().scene || engine.busy) return
    engine.jump(routeScene)
  }, [engine, routeScene])

  // Closing a page over the trail takes you back to the trail, where you were.
  useEffect(() => {
    if (route.kind !== 'trail') game.close()
  }, [route.kind])

  const closeRoute = () => navigate(`/trail/${sceneId}`)
  const overlay = route.kind !== 'trail' ? route.kind : null
  const showTitle = !started && !overlay
  const backdrop = overlay === 'post' || overlay === 'blog' ? 1 : overlay || panel ? 0.5 : 0
  const interactive = !showTitle && !overlay && !panel

  if (simple) {
    return (
      <>
        <SimpleSite />
        <MarkdownAlternate />
        <SoundSync />
      </>
    )
  }

  return (
    <EngineContext.Provider value={engine}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Stage start={start} onReady={setEngine} backdrop={backdrop} attract={showTitle} interactive={interactive}>
        {!showTitle && <Hotspots />}
      </Stage>
      {!showTitle && <Hud covered={Boolean(overlay || panel)} />}
      <main id="main" className="app-main" tabIndex={-1} key={overlay ? pathname : 'trail'}>
        {overlay === 'post' && route.kind === 'post' && (
          <Suspense fallback={<p className="loading" role="status">Opening the logbook…</p>}>
            <PostReader slug={route.slug} onClose={closeRoute} />
          </Suspense>
        )}
        {overlay === 'blog' && <BlogIndex onClose={closeRoute} />}
        {overlay === 'about' && <AboutPanel onClose={closeRoute} />}
        {overlay === 'contact' && <ContactPanel onClose={closeRoute} />}
        {overlay === 'missing' && <NotFoundPanel onClose={closeRoute} />}
        {!overlay && panel && <StorePanel panel={panel} />}
      </main>
      {showTitle && <Title />}
      <Toasts />
      <Caption />
      <Arrival />
      <Shortcuts engine={engine} enabled={interactive} />
      <MarkdownAlternate />
      <SoundSync />
    </EngineContext.Provider>
  )
}

function LegacyPost() {
  const { slug } = useParams()
  return <Navigate to={`/blog/${slug ?? ''}`} replace />
}

/** Counts the visit, anonymously (the server ignores repeat visits from the same address for a while). */
function CountVisit() {
  useEffect(() => {
    void api.visit()
  }, [])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <CountVisit />
      <BrowserRouter>
        <Routes>
          <Route path="/logbook" element={<Navigate to="/blog" replace />} />
          <Route path="/logbook/:slug" element={<LegacyPost />} />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
