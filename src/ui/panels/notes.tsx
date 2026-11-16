/** The notes I left along the trail: who I am, where I've lived, what I do, and what I do for fun. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { chapters, chatTopics, facts, intro, offTheClock, profile, rucksack, skiLines, summits, work } from '../../content/profile.ts'
import { SCENES, type NoteId } from '../../content/trail.ts'
import { HutNote, Ideas, Links, Places } from './NoteParts.tsx'

const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
const off = (id: string) => offTheClock.find((o) => o.id === id)!

type NoteContent = { kicker: string; title: string; body: () => ReactNode }

export const NOTES: Record<Exclude<NoteId, 'logbook' | 'summit-book'>, NoteContent> = {
  hello: {
    kicker: 'A note on the sand',
    title: `Hello, I’m ${profile.name.split(' ')[0]}`,
    body: () => (
      <>
        <p className="note-role">
          {profile.role} · {profile.home.split(',')[0]} <span lang="hu">({profile.nativeName})</span>
        </p>
        <p className="lead">{profile.tagline}</p>
        {intro.map((p) => (
          <p key={p.slice(0, 20)}>{p}</p>
        ))}
        <dl className="facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <p>
          This is a walk from the sea to a summit, and home. Look around, follow the arrows, and open the notes I’ve left on the way. My blog posts are pinned along
          the trail like waymarks — <span className="blaze blaze--inline" aria-hidden="true" /> — and they all live in the hut’s logbook.
        </p>
        <Links />
        <div className="note-actions">
          <Link className="btn" to="/blog">
            Read the blog
          </Link>
          <Link className="btn btn--ghost" to="/contact">
            Say hello
          </Link>
        </div>
      </>
    ),
  },
  sardinia: {
    kicker: 'Why the sea',
    title: 'Sardinia',
    body: () => (
      <>
        <p className="lead">{off('sardinia').text}</p>
        <p>
          So the walk starts on a Mediterranean beach. This one is Mondello, near Palermo: Sardinia’s big neighbour, and the same warm sand, stone pines and
          sea.
        </p>
      </>
    ),
  },
  windsurf: {
    kicker: 'On the water',
    title: 'Windsurfing',
    body: () => (
      <>
        <p className="lead">{off('windsurf').text}</p>
        <p>On calm days the board stays on the beach and I go snorkelling instead: a cove like this, with clear water over pale sand, is perfect for it.</p>
      </>
    ),
  },
  places: { kicker: 'A note on a fence post', title: 'Places that shaped me', body: () => <Places /> },
  gravel: {
    kicker: 'Two wheels',
    title: off('gravel').title,
    body: () => (
      <>
        <p className="lead">{off('gravel').text}</p>
        <p>The kind of ride that goes past an orchard like this one.</p>
      </>
    ),
  },
  work: {
    kicker: 'What I do',
    title: `${work.now.role} at ${work.now.org}`,
    body: () => (
      <>
        <p className="lead">{work.now.text}</p>
        <h3 className="note-sub">Before</h3>
        {work.before.map((b) => (
          <p key={b.org}>
            <b>
              {b.role}, {b.org}.
            </b>{' '}
            {b.text}
          </p>
        ))}
        <h3 className="note-sub">Study</h3>
        <ul className="plain-list">
          {work.study.map((s) => (
            <li key={s.degree}>
              <b>{s.degree}</b>, {s.where}
              {s.note ? ` (${s.note})` : ''}
            </li>
          ))}
        </ul>
        <p>The tools I use are in my rucksack, a little further on, in the forest.</p>
      </>
    ),
  },
  rucksack: {
    kicker: 'What’s in my rucksack',
    title: 'Tools of the trade',
    body: () => (
      <ul className="rucksack">
        {rucksack.map((item) => (
          <li key={item.id}>
            <span className="rucksack__item">{item.item}</span>
            <span className="rucksack__skill">{item.skill}</span>
            <p>{item.note}</p>
          </li>
        ))}
      </ul>
    ),
  },
  ideas: { kicker: 'By the stream', title: 'Ideas I keep coming back to', body: () => <Ideas /> },
  hut: { kicker: 'On the hut wall', title: 'The hut', body: () => <HutNote /> },
  talk: {
    kicker: 'Pull up a chair',
    title: 'Happy to talk about',
    body: () => (
      <>
        <ul className="plain-list">
          {chatTopics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p>
          The summit book is at the top of the walk, or <Link to="/contact">sign it from here</Link>.
        </p>
      </>
    ),
  },
  rock: {
    kicker: 'On the rock',
    title: off('rock').title,
    body: () => (
      <>
        <p className="lead">{off('rock').text}</p>
        <p>Slabs like these are where most of us start: friction, good feet, and a view that makes you forget to be nervous.</p>
      </>
    ),
  },
  ski: {
    kicker: 'On the ice',
    title: off('ski').title,
    body: () => (
      <>
        <p className="lead">{off('ski').text}</p>
        <h3 className="note-sub">Favourite lines</h3>
        <ul className="plain-list">
          {skiLines.map((s) => (
            <li key={s.name}>
              <b>{s.name}</b>, {s.where}. {s.note}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  summits: {
    kicker: 'Summit log',
    title: 'Tops I’ve stood on',
    body: () => (
      <>
        <p className="lead">Five tops so far, from Bolivia to Japan. I’m not fast; I just like being out there.</p>
        <ol className="summits">
          {summits.map((s) => (
            <li key={s.name}>
              <span className="summits__flag" aria-hidden="true">
                {flag(s.cc)}
              </span>
              <span className="summits__name">{s.name}</span>
              <span className="summits__height">{s.height.toLocaleString('en-GB')} m</span>
              <span className="summits__where">
                {s.where}, {s.country}
              </span>
            </li>
          ))}
        </ol>
        <p>
          The summit book is on the flagpole: <Link to="/contact">leave me a message</Link>.
        </p>
      </>
    ),
  },
  night: {
    kicker: 'Before you go',
    title: 'Thanks for walking with me',
    body: () => (
      <>
        <p className="lead">A quiet spot to finish: the light going, the stars coming out, and nothing to do but watch.</p>
        <p>
          Press <b>Stay the night</b> at the bottom of the screen to wait for the stars (and then the sunrise). Every time of day here is a real photograph, taken
          from the same spot.
        </p>
        <p>
          When you’re ready, the path leads home to London. Or read <Link to="/blog">the blog</Link>, or <Link to="/contact">say hello</Link>.
        </p>
        <h3 className="note-sub">The photographs</h3>
        <p className="small">
          Every place on this walk is a 360° photograph from{' '}
          <a href="https://polyhaven.com/hdris" target="_blank" rel="noopener noreferrer">
            Poly Haven
          </a>
          , free for anyone to use (CC0), by {[...new Set(SCENES.flatMap((s) => [s.photo, ...(s.variants ?? []).map((v) => v.photo)]).flatMap((p) => p.authors))].join(', ')}
          . Thank you.
        </p>
      </>
    ),
  },
  home: {
    kicker: 'Home',
    title: 'London',
    body: () => (
      <>
        <p className="lead">{chapters.find((c) => c.id === 'london')?.text}</p>
        <p>
          {off('hills').text} Kettle’s on. If you’d like to talk about AI, mountains or anything in between, <Link to="/contact">send me a message</Link>.
        </p>
        <Links />
      </>
    ),
  },
}

