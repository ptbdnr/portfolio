import { Link } from 'react-router'
import { ideas, rucksack, work } from '../../content/profile.ts'
import { STAGES } from '../../game/engine/world.ts'
import { ITEMS } from '../../game/icons.ts'
import { POSTS } from '../../lib/logbook.ts'
import { PixelSprite } from '../PixelSprite.tsx'

export function Work() {
  return (
    <section id="work" className="stage stage--wide" data-stage={STAGES.work} aria-labelledby="work-title">
      <div className="panel stage__panel" data-solid>
        <p className="kicker">What I do</p>
        <h2 id="work-title" className="pixel-title">
          Work I care about
        </h2>
        <p className="work__lead">
          In plain words: I help people work out where AI can genuinely help — and then build it so it is safe, useful and
          understood by the people who rely on it.
        </p>
        <div className="jobs">
          <article className="job job--now">
            <span className="job__badge">NOW</span>
            <h3 className="job__role">{work.now.role}</h3>
            <p className="job__org">{work.now.org}</p>
            <p>{work.now.text}</p>
          </article>
          {work.before.map((b) => (
            <article className="job" key={b.org}>
              <span className="job__badge">BEFORE</span>
              <h3 className="job__role">{b.role}</h3>
              <p className="job__org">{b.org}</p>
              <p>{b.text}</p>
            </article>
          ))}
          <article className="job">
            <span className="job__badge">STUDY</span>
            <h3 className="job__role">PhD &amp; MSc</h3>
            <p className="job__org">Aarhus, Denmark</p>
            <p>Including a PhD year in Delft, the Netherlands.</p>
          </article>
        </div>

        <h3 className="pixel-title section-sub">What’s in my rucksack</h3>
        <ul className="rucksack">
          {rucksack.map((item) => (
            <li key={item.id} className="rucksack__item">
              <span className="rucksack__slot">
                <PixelSprite sprite={ITEMS[item.id as keyof typeof ITEMS]} scale={4} />
              </span>
              <div>
                <b>{item.skill}</b> <span className="rucksack__gear">· {item.item}</span>
                <p>{item.note}</p>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="pixel-title section-sub">Ideas I keep coming back to (on the blog)</h3>
        <ul className="ideas">
          {ideas.map((idea) => {
            const post = POSTS.find((p) => p.tags.includes(idea.tag))
            return (
              <li key={idea.tag}>
                <Link to={post ? `/blog/${post.slug}` : `/blog?tag=${idea.tag}`}>{idea.title} →</Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
