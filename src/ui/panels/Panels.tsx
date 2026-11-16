/** The side panels: the place you're in, the trail map, the field guide, your photos, the menu and help. */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { BADGES } from '../../content/badges.ts'
import { SCENES, SCENE_BY_ID, type Scene, type SceneId } from '../../content/trail.ts'
import { cardUrl } from '../../engine/textures.ts'
import { deletePhoto, listPhotos, photoFileName, type SavedPhoto } from '../../lib/photos.ts'
import { ALL_SPOTS, game, reducedMotion, useGame, type Settings } from '../../lib/store.ts'
import { sound, useEngine } from '../engineContext.ts'
import { PLACEMENT, metres, toggleSound } from '../helpers.ts'
import { Icon } from '../icons.tsx'
import { Panel } from '../Panel.tsx'

const photoCredit = (scene: Scene, variant: string | null) => scene.variants?.find((v) => v.key === variant)?.photo ?? scene.photo

export function PlacePanel() {
  const sceneId = useGame((s) => s.scene)
  const variant = useGame((s) => s.variant)
  const scene = SCENE_BY_ID.get(sceneId)!
  const photo = photoCredit(scene, variant)
  const posts = PLACEMENT.byScene.get(scene.id)?.all ?? []
  return (
    <Panel id="place" kicker={`${metres(scene.elevation)} on the trail`} title={scene.name} onClose={game.close}>
      <p className="lead">{scene.description}</p>
      <figure className="place-photo">
        <img src={cardUrl(scene.id)} alt="" loading="lazy" />
        <figcaption>
          Photo: “{photo.title}” by {photo.authors.join(' & ')}
          {photo.where ? `, taken in ${photo.where}` : ''}.{' '}
          {photo.polyhaven && (
            <a href={`https://polyhaven.com/a/${photo.polyhaven}`} target="_blank" rel="noopener noreferrer">
              Poly Haven, CC0
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </figcaption>
      </figure>
      <p className="small">
        The places on this walk stand in for the story (a Mediterranean beach, the Alps, home). Each photo is a real place, credited here, and free for anyone to
        use.
      </p>
      {posts.length > 0 && (
        <>
          <h3 className="note-sub">Blog posts pinned here</h3>
          <ul className="plain-list">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link to={`/blog/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function Profile() {
  const max = Math.max(...SCENES.map((s) => s.elevation))
  const main = SCENES.filter((s) => s.id !== 'cove' && s.id !== 'inside' && s.id !== 'lake')
  const x = (i: number) => 12 + (i / (main.length - 1)) * 476
  const y = (m: number) => 82 - (m / max) * 66
  const line = main.map((s, i) => `${x(i).toFixed(1)},${y(s.elevation).toFixed(1)}`).join(' ')
  return (
    <svg className="trail-profile" viewBox="0 0 500 96" aria-hidden="true">
      <polygon points={`12,90 ${line} 488,90`} className="trail-profile__fill" />
      <polyline points={line} className="trail-profile__line" />
      {main.map((s, i) => (
        <circle key={s.id} cx={x(i)} cy={y(s.elevation)} r="3.2" />
      ))}
    </svg>
  )
}

export function MapPanel() {
  const engine = useEngine()
  const here = useGame((s) => s.scene)
  const visited = useGame((s) => s.progress.visited)
  const go = (id: SceneId) => {
    game.close()
    if (id !== here) engine?.jump(id)
  }
  return (
    <Panel id="map" kicker="From the sea to the summit, and home" title="The trail" onClose={game.close} className="map-panel">
      <Profile />
      <ol className="trail-list">
        {SCENES.map((s) => {
          const been = visited.includes(s.id)
          const count = PLACEMENT.byScene.get(s.id)?.all.length ?? 0
          return (
            <li key={s.id} className={`${s.id === here ? 'is-here' : ''}${been ? ' is-visited' : ''}`}>
              <button type="button" onClick={() => go(s.id)} aria-current={s.id === here ? 'location' : undefined}>
                <img src={cardUrl(s.id)} alt="" loading="lazy" />
                <span className="trail-list__text">
                  <span className="trail-list__name">
                    {s.name}
                    {s.id === here && <em> · you are here</em>}
                  </span>
                  <span className="trail-list__blurb">{s.blurb}</span>
                  <span className="trail-list__meta">
                    {metres(s.elevation)}
                    {count ? ` · ${count} post${count === 1 ? '' : 's'}` : ''}
                    {been ? ' · visited' : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

export function GuidePanel() {
  const found = useGame((s) => s.progress.spots)
  const badges = useGame((s) => s.progress.badges)
  return (
    <Panel id="guide" kicker={`${found.length} of ${ALL_SPOTS.length} spotted`} title="Field guide" onClose={game.close} className="guide-panel">
      <p className="lead">Real things in the photographs, worth a closer look. Zoom in (scroll, pinch or +) and keep the view on something for a moment.</p>
      {SCENES.filter((s) => s.spots.length).map((scene) => (
        <section key={scene.id} className="guide-scene">
          <h3 className="note-sub">{scene.name}</h3>
          <ul className="guide-list">
            {scene.spots.map((spot) => {
              const got = found.includes(spot.id)
              return (
                <li key={spot.id} className={got ? 'is-found' : ''}>
                  {got ? (
                    <>
                      <p className="guide-list__name">
                        {spot.name} {spot.latin && <i>{spot.latin}</i>}
                      </p>
                      <p>{spot.fact}</p>
                    </>
                  ) : (
                    <>
                      <p className="guide-list__name">Not spotted yet</p>
                      <p className="small">Hint: {spot.hint}</p>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <h3 className="note-sub">Badges</h3>
      <ul className="badges">
        {BADGES.map((b) => {
          const got = badges.includes(b.id)
          return (
            <li key={b.id} className={got ? 'is-earned' : ''}>
              <span className="badges__icon" aria-hidden="true">
                {b.icon}
              </span>
              <span>
                <b>{b.title}</b>
                <small>{got ? b.done : b.hint}</small>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export function PhotosPanel() {
  const [photos, setPhotos] = useState<SavedPhoto[] | null>(null)
  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  useEffect(() => {
    listPhotos().then(setPhotos, () => setPhotos([]))
  }, [])
  return (
    <Panel id="photos" kicker="Kept in this browser only" title="Your photos" onClose={game.close}>
      {photos === null ? (
        <p role="status">Developing…</p>
      ) : photos.length === 0 ? (
        <p>No photos yet. Use the camera button at the top (or press P) to take one: you get the view without anything drawn over it.</p>
      ) : (
        <ul className="photo-grid">
          {photos.map((p) => (
            <li key={p.id}>
              <img src={urls.get(p.id)} alt={`Photo taken at ${SCENE_BY_ID.get(p.scene)?.name ?? p.scene}`} />
              <span className="photo-grid__meta">
                {SCENE_BY_ID.get(p.scene)?.name} · {new Date(p.takenAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="photo-grid__actions">
                <a className="icon-btn icon-btn--small" href={urls.get(p.id)} download={photoFileName(p)} aria-label="Download">
                  <Icon.download />
                </a>
                <button
                  type="button"
                  className="icon-btn icon-btn--small"
                  aria-label="Delete"
                  onClick={async () => {
                    await deletePhoto(p.id)
                    setPhotos((list) => (list ?? []).filter((x) => x.id !== p.id))
                  }}
                >
                  <Icon.trash />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function MenuPanel() {
  const settings = useGame((s) => s.settings)
  const reduced = useGame(reducedMotion)
  const set = (patch: Partial<Settings>) => game.settings(patch)
  return (
    <Panel id="menu" kicker="Peter Bodnar · Hut to Hut" title="Menu" onClose={game.close} className="menu-panel">
      <nav className="menu-links" aria-label="Pages">
        <Link to="/about" onClick={game.close}>
          About me
        </Link>
        <Link to="/blog" onClick={game.close}>
          Blog
        </Link>
        <Link to="/contact" onClick={game.close}>
          Contact
        </Link>
        <button type="button" onClick={() => game.open({ kind: 'photos' })}>
          Your photos
        </button>
        <button type="button" onClick={() => game.open({ kind: 'help' })}>
          How it works
        </button>
      </nav>
      <h3 className="note-sub">Settings</h3>
      <div className="settings">
        <label className="toggle">
          <input type="checkbox" checked={settings.sound} onChange={toggleSound} />
          <span>Sound</span>
          <small>Wind, water and birds, made up live in your browser. Headphones help.</small>
        </label>
        <label className="range">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={!settings.sound}
            onChange={(e) => {
              set({ volume: Number(e.target.value) })
              sound.setVolume(Number(e.target.value))
            }}
          />
        </label>
        <fieldset className="choice">
          <legend>Motion</legend>
          {(['auto', 'full', 'reduced'] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="motion" checked={settings.motion === m} onChange={() => set({ motion: m })} />
              {m === 'auto' ? `Like my device (${reduced ? 'reduced' : 'full'})` : m === 'full' ? 'Full' : 'Reduced: no walking motion, no particles'}
            </label>
          ))}
        </fieldset>
        <label className="toggle">
          <input type="checkbox" checked={settings.simple} onChange={(e) => set({ simple: e.target.checked })} />
          <span>Simple view</span>
          <small>A plain page with everything on it, and no 3D walk.</small>
        </label>
      </div>
      <h3 className="note-sub">Your progress</h3>
      <p className="small">Places, notes, finds, badges and photos are kept in this browser only. Nothing is sent anywhere.</p>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          if (window.confirm('Forget everything you’ve found and read? (Your photos and settings stay.)')) {
            game.resetProgress()
            game.toast({ title: 'Progress cleared', icon: '🧹' })
          }
        }}
      >
        Start afresh
      </button>
    </Panel>
  )
}

export function HelpPanel() {
  const rows: [string, string][] = [
    ['Look around', 'Drag (mouse or finger), or use ← → and Q/E on the keyboard.'],
    ['Walk', 'Click an arrow on the ground, click the ground towards it, or press ↑ / W to walk the way you face. “Next” at the bottom always knows the way.'],
    ['Turn round', '↓ / S.'],
    ['Zoom', 'Scroll, pinch, or + and −. Zooming in helps you spot things for the field guide.'],
    ['Notes', 'Pins with a pen are notes from me: who I am, where I’ve lived, what I do.'],
    ['Blog posts', 'Red and white trail marks are blog posts. They all live in the hut’s logbook too (B).'],
    ['Time of day', 'At the bivouac, stay the night: the light changes through real photographs of dusk, the stars and sunrise.'],
    ['Camera', 'P takes a photo of the view. Your photos stay in this browser.'],
    ['Map', 'M shows the whole trail; jump to any place on it.'],
    ['Simple view', 'Menu → Simple view gives you a plain page with everything on it.'],
  ]
  return (
    <Panel id="help" kicker="A walk you can read" title="How it works" onClose={game.close}>
      <dl className="help-list">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="small">Sound is off until you turn it on. If motion bothers you, Menu → Motion → Reduced.</p>
    </Panel>
  )
}
