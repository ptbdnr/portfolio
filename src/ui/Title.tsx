/** The title screen, over the first view drifting slowly. Starting is also when sound may begin. */
import { Link } from 'react-router'
import { profile } from '../content/profile.ts'
import { SCENE_BY_ID } from '../content/trail.ts'
import { game, useGame } from '../lib/store.ts'
import { sound } from './engineContext.ts'

function begin(withSound: boolean) {
  if (withSound) game.settings({ sound: true })
  if (game.get().settings.sound) void sound.enable()
  game.start()
}

export function Title() {
  const returning = useGame((s) => s.progress.visited.length > 1)
  const scene = SCENE_BY_ID.get(useGame((s) => s.scene))!
  return (
    <div className="title" role="dialog" aria-modal="true" aria-labelledby="title-name" aria-describedby="title-lead">
      <div className="title__inner">
        <p className="kicker">Hut to Hut</p>
        <h1 id="title-name" className="title__name">
          {profile.name}
        </h1>
        <p className="title__role">
          {profile.role} · {profile.home.split(',')[0]}
        </p>
        <p id="title-lead" className="title__lead">
          A walk from the sea to the summit, and home. Look around, follow the trail, and open the notes I left on the way: who I am, what I do, and my blog.
        </p>
        <div className="title__actions">
          <button type="button" className="btn btn--large" onClick={() => begin(true)} autoFocus>
            {returning ? `Carry on at ${scene.name.replace(/^The /, 'the ')}` : 'Start the walk'}
            <small>with sound</small>
          </button>
          <button type="button" className="btn btn--ghost btn--large" onClick={() => begin(false)}>
            Without sound
          </button>
        </div>
        <nav className="title__links" aria-label="Or go straight to">
          <Link to="/about">About me</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/contact">Contact</Link>
          <button type="button" className="link-btn" onClick={() => game.settings({ simple: true })}>
            Simple view
          </button>
        </nav>
        <p className="title__hint">Drag to look around · click the arrows on the ground to walk · headphones help</p>
      </div>
      <p className="title__credit">Every place is a real 360° photograph (Poly Haven, CC0). Every sound is made live in your browser.</p>
    </div>
  )
}
