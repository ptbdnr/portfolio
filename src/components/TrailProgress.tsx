import { STAGES } from '../game/engine/world.ts'
import { useGame } from '../lib/store.ts'

const STOPS = [
  { id: 'welcome', label: 'Beach', f: STAGES.welcome },
  { id: 'about', label: 'About me', f: STAGES.about },
  { id: 'work', label: 'Work', f: STAGES.work },
  { id: 'hut', label: 'Hut & blog', f: STAGES.hut },
  { id: 'fork', label: 'Fork', f: STAGES.fork },
  { id: 'hobbies', label: 'Hobbies', f: STAGES.sideQuests },
  { id: 'places', label: 'Places', f: STAGES.places },
  { id: 'summits', label: 'Summits', f: STAGES.summits },
  { id: 'contact', label: 'Contact', f: STAGES.contact },
]

/** A slim map of the whole trail: where you are, and a shortcut to every stop. */
export function TrailProgress() {
  const f = useGame((s) => s.live.f)
  const reduced = useGame((s) => s.reducedMotion)
  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }
  return (
    <nav className="progress" aria-label="Trail map" data-solid>
      <div className="progress__track" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${Math.min(100, f * 100)}%` }} />
      </div>
      <ol className="progress__stops">
        {STOPS.map((s) => (
          <li key={s.id} style={{ left: `${s.f * 100}%` }}>
            <button
              type="button"
              className={f + 0.004 >= s.f ? 'progress__stop is-past' : 'progress__stop'}
              onClick={() => go(s.id)}
              title={s.label}
            >
              <span className="sr-only">Go to {s.label}</span>
            </button>
            <span className="progress__label" aria-hidden="true">
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      <span className="progress__me" style={{ left: `${Math.min(100, f * 100)}%` }} aria-hidden="true" />
    </nav>
  )
}
