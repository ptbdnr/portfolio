import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { useGame } from '../lib/store.ts'

export function Crt() {
  const crt = useGame((s) => s.settings.crt && !s.settings.simple)
  const { pathname } = useLocation()
  if (!crt) return null
  const reading = /^\/blog(\/|$)/.test(pathname)
  return <div className={`crt${reading ? ' crt--reading' : ''}`} aria-hidden="true" />
}

/** A short VHS "tracking" sweep with an on-screen display when the route changes. */
export function VhsTransition() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const reduced = useGame((s) => s.reducedMotion)
  const first = useRef(true)
  const [key, setKey] = useState(0)
  const [label, setLabel] = useState('▶ PLAY')

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setLabel(navType === 'POP' ? '◀◀ REW' : '▶ PLAY')
    setKey((k) => k + 1)
  }, [pathname, navType])

  if (!key || reduced) return null
  return (
    <div key={key} className="vhs" aria-hidden="true">
      <div className="vhs__band" />
      <div className="vhs__osd">{label}</div>
    </div>
  )
}
