/** The engine and the sound, shared by the parts of the interface that drive them. */
import { createContext, useContext } from 'react'
import { createSoundscape } from '../engine/audio/soundscape.ts'
import type { Engine } from '../engine/engine.ts'

export const EngineContext = createContext<Engine | null>(null)

export const useEngine = () => useContext(EngineContext)

/** One soundscape for the whole visit; it makes no sound (and no AudioContext) until sound is turned on. */
export const sound = createSoundscape()

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

export { typing as isTypingTarget }
