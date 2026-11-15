import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { About } from '../components/home/About.tsx'
import { ChallengeCard } from '../components/home/ChallengeCard.tsx'
import { Fork } from '../components/home/Fork.tsx'
import { HomeBase } from '../components/home/HomeBase.tsx'
import { Hut } from '../components/home/Hut.tsx'
import { LifeMap } from '../components/home/LifeMap.tsx'
import { OffTheClock } from '../components/home/OffTheClock.tsx'
import { Stretch } from '../components/home/Stretch.tsx'
import { SummitBook } from '../components/home/SummitBook.tsx'
import { SummitLog } from '../components/home/SummitLog.tsx'
import { Welcome } from '../components/home/Welcome.tsx'
import { Work } from '../components/home/Work.tsx'
import { TrailProgress } from '../components/TrailProgress.tsx'
import { STAGES } from '../game/engine/world.ts'
import { useDocumentTitle } from '../lib/hooks.ts'
import { useGame } from '../lib/store.ts'
import { useJourney } from '../lib/useJourney.ts'

/** Empty stretches of trail between sections, so the scenery (and wildlife) gets a moment. */
function Gap({ size = 'm', note }: { size?: 's' | 'm' | 'l'; note?: string }) {
  return (
    <div className={`trail-gap trail-gap--${size}`} aria-hidden="true">
      {note && <span className="trail-gap__note">{note}</span>}
    </div>
  )
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()
  const route = useGame((s) => s.choices.route)
  const simple = useGame((s) => s.settings.simple)
  useDocumentTitle('')
  useJourney(root)

  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
  }, [hash])

  const rocks = route === 'rocks'
  return (
    <div ref={root} className="journey">
      <Welcome />
      <Gap size="l" note="Keep scrolling — next stop, the beach ↓" />
      <About />
      <Gap size="l" note="On the bike now: inland and uphill" />
      <Gap size="l" note="Into the forest" />
      <Work />
      <Gap size="m" note="The hut is just ahead" />
      <Hut />
      <Gap size="s" />
      <Fork />
      {/* The rocks pin the trail for the climb and the abseil; the lake path just flows on. */}
      <Stretch
        from={STAGES.climbIn}
        to={STAGES.climbOut}
        pinned={rocks}
        note={rocks ? 'Rock climb — tap the glowing holds (optional)' : 'A quiet mountain lake. Deer come here to drink.'}
      />
      <Gap size={rocks ? 'l' : 's'} note={rocks ? 'Along the top of the crag' : undefined} />
      <Stretch
        from={STAGES.abseilIn}
        to={STAGES.abseilOut}
        pinned={rocks}
        note={rocks ? 'Abseil — try the Bounce button (optional)' : 'Round the lake, nice and easy'}
      />
      <Gap size="m" note="Into the golden larches" />
      <OffTheClock />
      <Gap size="s" note="Up onto the moraine" />
      <LifeMap />
      <Gap size="s" note="Skins on — the glacier starts here" />
      <SummitLog />
      <Gap size="m" note="Careful: crevasses about" />
      <Stretch from={STAGES.crevasseIn} to={STAGES.crevasseOut} note="Ladder or jump? Your call." />
      <Gap size="m" note="Nearly at the top…" />
      <SummitBook />
      <Gap size="s" />
      <HomeBase />
      {!simple && <ChallengeCard />}
      {!simple && <TrailProgress />}
    </div>
  )
}
