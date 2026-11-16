import type { NoteId } from '../../content/trail.ts'
import { game } from '../../lib/store.ts'
import { Panel } from '../Panel.tsx'
import { NOTES } from './notes.tsx'

export function NotePanel({ id }: { id: NoteId }) {
  if (id === 'logbook' || id === 'summit-book') return null
  const note = NOTES[id]
  return (
    <Panel id={`note-${id}`} kicker={note.kicker} title={note.title} onClose={game.close} className="note">
      {note.body()}
    </Panel>
  )
}
