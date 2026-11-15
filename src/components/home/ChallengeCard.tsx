import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Zone } from '../../game/engine/renderer.ts'
import { Z } from '../../game/engine/world.ts'
import { worldBus } from '../../game/worldBus.ts'
import { useGame } from '../../lib/store.ts'

const PERIOD = 1500
/** The marker swings 0 → 1 → 0; jumping while it's in the middle band succeeds. */
const GOOD: [number, number] = [0.38, 0.62]

function JumpMeter() {
  const reduced = useGame((s) => s.reducedMotion)
  const start = useRef(0)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    start.current = performance.now()
  }, [])

  const jump = () => {
    const t = ((performance.now() - start.current) % PERIOD) / PERIOD
    const p = t < 0.5 ? t * 2 : 2 - t * 2
    const ok = reduced || (p > GOOD[0] && p < GOOD[1])
    setResult(ok ? null : p < GOOD[0] ? 'A little early…' : 'A little late…')
    worldBus.send({ type: 'jump', ok })
  }

  return (
    <div className="meter-wrap">
      {!reduced && (
        <div className="meter" aria-hidden="true">
          <span className="meter__good" style={{ left: `${GOOD[0] * 100}%`, width: `${(GOOD[1] - GOOD[0]) * 100}%` }} />
          <span className="meter__marker" style={{ animationDuration: `${PERIOD / 2}ms` }} />
        </div>
      )}
      <button type="button" className="btn btn--big" onClick={jump}>
        Jump!
      </button>
      {!reduced && <p className="challenge__tip">Press when the marker is in the green.</p>}
      {result && <p className="challenge__tip">{result}</p>}
    </div>
  )
}

function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span className="dots" aria-label={`${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < done ? 'dot is-done' : 'dot'} aria-hidden="true" />
      ))}
    </span>
  )
}

/** Optional mini-challenges along the trail. Nothing here ever blocks scrolling on. */
export function ChallengeCard() {
  const zone = useGame((s) => s.live.zone)
  const mode = useGame((s) => s.live.mode)
  const f = useGame((s) => s.live.f)
  const progress = useGame((s) => s.progress)
  const simple = useGame((s) => s.settings.simple)
  const [hidden, setHidden] = useState<Zone>(null)
  const [jumping, setJumping] = useState(false)
  const [seenZone, setSeenZone] = useState(zone)
  if (zone !== seenZone) {
    setSeenZone(zone)
    setJumping(false)
  }

  if (simple || !zone || hidden === zone) return null

  let title = ''
  let body: ReactNode = null
  if (zone === 'climb') {
    const done = progress.holds >= progress.holdsTotal
    title = done ? 'Topped out — thank you!' : 'Rock climb (optional)'
    body = done ? (
      <p>Thanks for the spot. Onwards and upwards.</p>
    ) : (
      <>
        <p>Help me up: tap the three glowing holds on the rock, next to me.</p>
        <Dots done={progress.holds} total={progress.holdsTotal} />
      </>
    )
  } else if (zone === 'abseil') {
    const done = progress.bounces >= 3
    const onRope = mode === 'abseil'
    title = done ? 'Smooth abseil!' : 'Abseil (optional)'
    body = done ? (
      <p>Down safely. The rope’s pulled through — on we go.</p>
    ) : (
      <>
        <p>Push off the wall three times on the way down.</p>
        <div className="challenge__row">
          <button type="button" className="btn btn--big" disabled={!onRope} onClick={() => worldBus.send({ type: 'bounce' })}>
            Bounce!
          </button>
          <Dots done={Math.min(3, progress.bounces)} total={3} />
        </div>
        {!onRope && <p className="challenge__tip">Scroll a little further to get on the rope.</p>}
      </>
    )
  } else {
    const across = f > Z.crevasse[0] - 0.0004
    title = progress.jump === 'done' ? 'What a leap!' : 'Crevasse ahead!'
    if (progress.jump === 'done') body = <p>Cleared it. (Please don’t try this at home.)</p>
    else if (across) body = <p>Across safely on the ladder. Sensible choice.</p>
    else if (jumping)
      body = (
        <>
          {progress.jump === 'failed' && <p>Whoops — the rope caught you. Have another go?</p>}
          <JumpMeter />
        </>
      )
    else
      body = (
        <>
          <p>Cross on the ladder by simply scrolling on — or try to jump it.</p>
          <button type="button" className="btn btn--big" onClick={() => setJumping(true)}>
            Try the jump
          </button>
        </>
      )
  }

  return (
    <aside className="challenge panel" aria-labelledby="challenge-title" data-solid>
      <div className="challenge__head">
        <h2 id="challenge-title" className="challenge__title">
          {title}
        </h2>
        <button type="button" className="challenge__close" aria-label="Hide this challenge" onClick={() => setHidden(zone)}>
          ×
        </button>
      </div>
      <div aria-live="polite">{body}</div>
    </aside>
  )
}
