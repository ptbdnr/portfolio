import { STAGES } from '../../game/engine/world.ts'
import { game, useGame } from '../../lib/store.ts'

const PATHS = [
  { id: 'rocks', icon: '⛰️', title: 'Over the rocks', text: 'A short rock climb and an abseil — two optional mini-challenges.' },
  { id: 'lake', icon: '🏞️', title: 'Round the lake', text: 'Gentle and quiet. A good place to spot deer.' },
] as const

export function Fork() {
  const route = useGame((s) => s.choices.route)
  const simple = useGame((s) => s.settings.simple)
  if (simple) return <span id="fork" data-stage={STAGES.fork} />
  return (
    <section id="fork" className="stage" data-stage={STAGES.fork} aria-labelledby="fork-title">
      <div className="panel stage__panel fork" data-solid>
        <p className="kicker">Signpost · your choice</p>
        <h2 id="fork-title" className="pixel-title">
          Which way?
        </h2>
        <p>Both paths meet again in the larch valley. Pick whichever you fancy — you can always come back and try the other.</p>
        <div className="fork__options">
          {PATHS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="fork__option"
              aria-pressed={route === p.id}
              onClick={() => game.setChoice('route', p.id)}
            >
              <span className="fork__icon" aria-hidden="true">
                {p.icon}
              </span>
              <span>
                <b>{p.title}</b>
                <span className="fork__text">{p.text}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
