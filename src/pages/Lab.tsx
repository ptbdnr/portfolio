import { useEffect } from 'react'
import { worldBus } from '../game/worldBus.ts'
import { game, type Theme } from '../lib/store.ts'
import type { Route } from '../game/engine/world.ts'

/**
 * DEV-only test bench: /lab?f=0.42&theme=night&route=lake&hut=inside pins the trail position and
 * settings so the scenery can be screenshotted anywhere along the journey.
 */
export default function Lab() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const theme = q.get('theme') as Theme | null
    if (theme) game.setSetting('theme', theme)
    const route = q.get('route') as Route | null
    if (route) game.setChoice('route', route)
    if (q.get('hut')) game.setChoice('hut', q.get('hut') === 'inside' ? 'inside' : 'outside')
    if (q.get('wildlife') === '0') game.setSetting('wildlife', false)
    const season = q.get('season')
    if (season) game.setSetting('season', season as never)
    worldBus.setTarget(Number(q.get('f') ?? 0.022))
    const w = window as unknown as Record<string, unknown>
    w.__bus = worldBus
    w.__game = game
  }, [])
  return null
}
