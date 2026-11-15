import { facts, intro, profile } from '../../content/profile.ts'
import { STAGES } from '../../game/engine/world.ts'

export function About() {
  const links = profile.links.filter((l) => l.href)
  return (
    <section id="about" className="stage" data-stage={STAGES.about} aria-labelledby="about-title">
      <article className="panel stage__panel" data-solid>
        <p className="kicker">A bit about me</p>
        <h2 id="about-title" className="pixel-title">
          The short version
        </h2>
        {intro.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <dl className="facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
          {links.length > 0 && (
            <div>
              <dt>Find me</dt>
              <dd className="facts__links">
                {links.map((l) => (
                  <a key={l.label} href={l.href} rel="me noopener" target="_blank">
                    {l.label} <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </article>
    </section>
  )
}
