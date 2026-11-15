import { offTheClock } from '../../content/profile.ts'
import { STAGES } from '../../game/engine/world.ts'
import { HOBBIES } from '../../game/icons.ts'
import { PixelSprite } from '../PixelSprite.tsx'

export function OffTheClock() {
  return (
    <section id="hobbies" className="stage" data-stage={STAGES.sideQuests} aria-labelledby="quests-title">
      <div className="panel stage__panel" data-solid>
        <p className="kicker">Off the clock</p>
        <h2 id="quests-title" className="pixel-title">
          When I’m not working
        </h2>
        <ul className="quests">
          {offTheClock.map((q) => (
            <li key={q.id} className="quest">
              <span className="quest__art">
                <PixelSprite sprite={HOBBIES[q.id as keyof typeof HOBBIES]} scale={4} />
              </span>
              <div>
                <h3 className="quest__title">{q.title}</h3>
                <p>{q.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
