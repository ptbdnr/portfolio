import { Suspense, lazy, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { ALTERNATE_ID, markdownAlternate } from '../shared/markdownAlternates.ts'
import { HelpDialog } from './components/HelpDialog.tsx'
import { Hud } from './components/Hud.tsx'
import { Crt, VhsTransition } from './components/Overlays.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { PhotoAlbum } from './components/PhotoAlbum.tsx'
import { Toasts } from './components/Toasts.tsx'
import { WorldCanvas } from './game/WorldCanvas.tsx'
import { useKonami } from './lib/hooks.ts'
import { POSTS_BY_SLUG } from './lib/logbook.ts'
import { isNight, useGame } from './lib/store.ts'
import Home from './pages/Home.tsx'
import NotFound from './pages/NotFound.tsx'
import './styles/home.css'
import './styles/logbook.css'

const Logbook = lazy(() => import('./pages/Logbook.tsx'))
const Lab = import.meta.env.DEV ? lazy(() => import('./pages/Lab.tsx')) : null
const Post = lazy(() => import('./pages/Post.tsx'))

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useLayoutEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])
  return null
}

/** Keeps <html> in sync with the day/night theme and simple view, so CSS can follow. */
function ThemeSync() {
  const night = useGame(isNight)
  const simple = useGame((s) => s.settings.simple)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = night ? 'night' : 'day'
    root.classList.toggle('simple', simple)
  }, [night, simple])
  return null
}

function LegacyPost() {
  const { slug } = useParams()
  return <Navigate to={`/blog/${slug ?? ''}`} replace />
}

/**
 * Keeps the page's pointer to its Markdown version (for AI tools) in step as you browse: the server
 * writes one into the page it sends, and this takes over from there.
 */
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

function Loading() {
  return (
    <div className="page page--loading" role="status">
      <p className="panel loading">LOADING…</p>
    </div>
  )
}

function Shell() {
  useKonami()
  const { pathname } = useLocation()
  if (Lab && pathname === '/lab') {
    return (
      <>
        <WorldCanvas />
        <Suspense>
          <Lab />
        </Suspense>
      </>
    )
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <WorldCanvas />
      <Hud />
      <main id="main" className="app-main" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/blog" element={<Logbook />} />
            <Route path="/blog/:slug" element={<Post />} />
            <Route path="/logbook" element={<Navigate to="/blog" replace />} />
            <Route path="/logbook/:slug" element={<LegacyPost />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <SettingsPanel />
      <PhotoAlbum />
      <HelpDialog />
      <Toasts />
      <VhsTransition />
      <Crt />
      <ScrollManager />
      <ThemeSync />
      <MarkdownAlternate />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
