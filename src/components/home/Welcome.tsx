import { useEffect, useState } from 'react'
import { profile } from '../../content/profile.ts'
import { STAGES } from '../../game/engine/world.ts'
import { game, useGame } from '../../lib/store.ts'
import { HOW_TO } from '../../content/howto.ts'

const BOOT = ['BODNAR PERSONAL MICRO  64K RAM', 'LOAD "HUT TO HUT",8,1', 'READY.']

/** Decorative boot text that types itself in; never blocks the page. */
function BootLines() {
  const reduced = useGame((s) => s.reducedMotion)
  const full = BOOT.join('\n')
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= full.length) clearInterval(id)
        return Math.min(full.length, n + 2)
      })
    }, 28)
    return () => clearInterval(id)
  }, [full, reduced])
  return (
    <pre className="welcome__boot" aria-hidden="true">
      {full.slice(0, reduced ? full.length : shown)}
      <span className="welcome__cursor">█</span>
    </pre>
  )
}

export function Welcome() {
  const simple = useGame((s) => s.settings.simple)
  const onboarded = useGame((s) => s.onboarded)
  const reduced = useGame((s) => s.reducedMotion)

  // On small screens the guide starts folded so the beach (and the windsurfer) stays in view.
  const [compact] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches)

  const start = () => {
    game.setOnboarded()
    document.getElementById('about')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section id="welcome" className="stage stage--welcome" data-stage={STAGES.welcome} aria-labelledby="welcome-title">
      <div className="panel stage__panel welcome" data-solid>
        {!simple && <BootLines />}
        <p className="kicker">Hello, and welcome</p>
        <h1 id="welcome-title" className="welcome__title">
          Hi, I’m Peter.
        </h1>
        <p className="welcome__lead">
          {profile.role} in London, originally from Hungary — and happiest somewhere in the mountains.
        </p>
        <p>
          This site is a little journey from a Sardinian beach to an Alpine summit, with my story along the way. Take your
          time.
        </p>
        {!simple && (
          <details className="welcome__howto" open={!onboarded && !compact}>
            <summary>How it works — 30 seconds</summary>
            <ul>
              {HOW_TO.slice(0, 4).map((h) => (
                <li key={h.title}>
                  <span aria-hidden="true">{h.icon}</span>
                  <span>
                    <b>{h.title}.</b> {h.text}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="welcome__actions">
          <button type="button" className="btn" onClick={start}>
            {simple ? 'About me ↓' : 'Start the journey ↓'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => game.setSetting('simple', !simple)}>
            {simple ? 'Back to the journey' : 'Simple view'}
          </button>
        </div>
        {!simple && <p className="welcome__hint">Sound is off. You can turn it on in the Menu.</p>}
      </div>
    </section>
  )
}
