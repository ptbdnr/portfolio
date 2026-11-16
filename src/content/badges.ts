/** Badges: small rewards for exploring, all worked out from what you've done. */
import { SCENES } from './trail.ts'

export type BadgeId =
  | 'first-steps'
  | 'beachcomber'
  | 'hut-guest'
  | 'both-ways'
  | 'summit'
  | 'night-sky'
  | 'home'
  | 'reader'
  | 'naturalist'
  | 'photographer'
  | 'messenger'
  | 'explorer'

export type Badge = { id: BadgeId; title: string; icon: string; done: string; hint: string }

export const BADGES: Badge[] = [
  { id: 'first-steps', title: 'First steps', icon: '🥾', done: 'You walked to a new place.', hint: 'Click an arrow on the ground.' },
  { id: 'beachcomber', title: 'Beachcomber', icon: '🐚', done: 'You found the cove.', hint: 'There’s a cove along the shore.' },
  { id: 'hut-guest', title: 'Hut guest', icon: '🛖', done: 'You stepped inside the hut.', hint: 'The hut’s door is open.' },
  { id: 'both-ways', title: 'Both ways', icon: '🔀', done: 'You took the rocks and the lake.', hint: 'At the fork, try both paths.' },
  { id: 'summit', title: 'Summit', icon: '⛰️', done: 'You reached the top.', hint: 'Keep going up.' },
  { id: 'night-sky', title: 'Night sky', icon: '🌌', done: 'You stayed up for the stars.', hint: 'Spend a night at the bivouac.' },
  { id: 'home', title: 'Home', icon: '🏠', done: 'You came home to London.', hint: 'The walk ends where I live.' },
  { id: 'reader', title: 'Reader', icon: '📖', done: 'You read a blog post to the end.', hint: 'Read a post all the way down.' },
  { id: 'naturalist', title: 'Naturalist', icon: '🔭', done: 'You spotted ten things in the field guide.', hint: 'Zoom in on things that catch your eye.' },
  { id: 'photographer', title: 'Photographer', icon: '📷', done: 'You took a photo.', hint: 'There’s a camera in the top bar.' },
  { id: 'messenger', title: 'Messenger', icon: '✉️', done: 'You signed the summit book.', hint: 'Leave me a message at the summit.' },
  { id: 'explorer', title: 'Explorer', icon: '🧭', done: 'You’ve been everywhere on the trail.', hint: 'Visit every place.' },
]

type Done = { visited: string[]; seen: string[]; stamps: Record<string, number>; spots: string[]; photos: number; signed: boolean }

export function earnedBadges(p: Done): BadgeId[] {
  const been = (id: string) => p.visited.includes(id)
  const rules: Record<BadgeId, boolean> = {
    'first-steps': p.visited.length >= 2,
    beachcomber: been('cove'),
    'hut-guest': been('inside'),
    'both-ways': been('rocks') && been('lake'),
    summit: been('summit'),
    'night-sky': p.seen.includes('bivouac-night'),
    home: been('home'),
    reader: Object.keys(p.stamps).length > 0,
    naturalist: p.spots.length >= 10,
    photographer: p.photos > 0,
    messenger: p.signed,
    explorer: SCENES.every((s) => been(s.id)),
  }
  return BADGES.filter((b) => rules[b.id]).map((b) => b.id)
}
