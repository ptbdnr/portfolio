export type BadgeId =
  | 'climb'
  | 'abseil'
  | 'crevasse'
  | 'hut'
  | 'lake'
  | 'summit'
  | 'photographer'
  | 'botanist'
  | 'reader'
  | 'messenger'
  | 'nightwalker'
  | 'yeti'

export type BadgeInfo = {
  id: BadgeId
  title: string
  /** How it was earned, in plain words. */
  done: string
  /** A gentle hint shown before it's earned. */
  hint: string
  icon: string
  secret?: boolean
}

export const BADGES: BadgeInfo[] = [
  { id: 'climb', title: 'Rock climber', icon: '🧗', done: 'Helped me up the rock wall.', hint: 'Take the rocky path at the fork.' },
  { id: 'abseil', title: 'Abseiler', icon: '🪢', done: 'Bounced all the way down the cliff.', hint: 'Waits just after the climb.' },
  { id: 'crevasse', title: 'Crevasse jumper', icon: '🧊', done: 'Leapt over the big crevasse.', hint: 'Up on the glacier. The ladder is fine too.' },
  { id: 'hut', title: 'Hut guest', icon: '🛖', done: 'Stepped inside the mountain hut.', hint: 'There is soup at the hut.' },
  { id: 'lake', title: 'Lake wanderer', icon: '🏞️', done: 'Took the gentle path round the lake.', hint: 'One of the two paths at the fork.' },
  { id: 'summit', title: 'Summit!', icon: '⛰️', done: 'Made it all the way to the top.', hint: 'Keep going — it is worth the view.' },
  { id: 'photographer', title: 'Wildlife photographer', icon: '📷', done: 'Photographed five different animals.', hint: 'Tap animals to take their picture.' },
  { id: 'botanist', title: 'Edelweiss finder', icon: '🌼', done: 'Found all seven edelweiss.', hint: 'Small white flowers hide along the trail.' },
  { id: 'reader', title: 'Bookworm', icon: '📖', done: 'Read one of my blog posts.', hint: 'Open a post from the blog.' },
  { id: 'messenger', title: 'Pen pal', icon: '✉️', done: 'Sent me a message. Thank you!', hint: 'Say hello at the end of the trail.' },
  { id: 'nightwalker', title: 'Night owl', icon: '🔦', done: 'Walked the trail by torchlight.', hint: 'Try the moon button at the top.' },
  { id: 'yeti', title: 'Yeti spotter', icon: '👣', done: 'Typed the secret code. The yeti says hi.', hint: 'An old video-game cheat code…', secret: true },
]

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<BadgeId, BadgeInfo>
