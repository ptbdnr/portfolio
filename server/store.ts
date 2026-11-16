import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ContactMessage } from '../shared/contact.ts'
import { SIGHTING_IDS, type StatsSnapshot } from '../shared/sightings.ts'

export type StoredMessage = ContactMessage & {
  id: string
  receivedAt: string
  ip?: string
  userAgent?: string
}

export interface Store {
  saveMessage(message: StoredMessage): Promise<void>
  recordVisit(): Promise<number>
  recordSighting(spot: string): Promise<number>
  getStats(): Promise<StatsSnapshot>
  flush(): Promise<void>
}

function emptyStats(): StatsSnapshot {
  return { visitors: 0, sightings: {} }
}

function sanitizeStats(raw: unknown): StatsSnapshot {
  const stats = emptyStats()
  if (!raw || typeof raw !== 'object') return stats
  const value = raw as Partial<StatsSnapshot>
  if (typeof value.visitors === 'number' && value.visitors >= 0) stats.visitors = Math.floor(value.visitors)
  for (const id of SIGHTING_IDS) {
    const count = value.sightings?.[id]
    if (typeof count === 'number' && count > 0) stats.sightings[id] = Math.floor(count)
  }
  return stats
}

export function createMemoryStore(): Store & { messages: StoredMessage[] } {
  const stats = emptyStats()
  const messages: StoredMessage[] = []
  return {
    messages,
    async saveMessage(message) {
      messages.push(message)
    },
    async recordVisit() {
      return ++stats.visitors
    },
    async recordSighting(spot) {
      stats.sightings[spot] = (stats.sightings[spot] ?? 0) + 1
      return stats.sightings[spot]
    },
    async getStats() {
      return structuredClone(stats)
    },
    async flush() {},
  }
}

/**
 * Stats live in data/stats.json (written atomically, debounced); messages are appended to
 * data/messages.jsonl so nothing is lost even without SMTP configured.
 */
export function createFileStore(dataDir: string, flushDelayMs = 400): Store {
  const statsFile = path.join(dataDir, 'stats.json')
  const messagesFile = path.join(dataDir, 'messages.jsonl')
  let stats: StatsSnapshot | null = null
  let loading: Promise<StatsSnapshot> | null = null
  let timer: NodeJS.Timeout | null = null
  let writing: Promise<void> = Promise.resolve()

  const ready = async () => {
    if (stats) return stats
    loading ??= (async () => {
      await mkdir(dataDir, { recursive: true })
      try {
        stats = sanitizeStats(JSON.parse(await readFile(statsFile, 'utf8')))
      } catch {
        stats = emptyStats()
      }
      return stats
    })()
    return loading
  }

  const writeNow = () => {
    writing = writing.then(async () => {
      if (!stats) return
      const tmp = `${statsFile}.${process.pid}.tmp`
      await writeFile(tmp, JSON.stringify(stats, null, 2))
      await rename(tmp, statsFile)
    })
    return writing
  }

  const scheduleWrite = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void writeNow().catch((error) => console.error('[store] failed to write stats', error))
    }, flushDelayMs)
    timer.unref?.()
  }

  return {
    async saveMessage(message) {
      await mkdir(dataDir, { recursive: true })
      await appendFile(messagesFile, `${JSON.stringify(message)}\n`, { mode: 0o600 })
    },
    async recordVisit() {
      const current = await ready()
      current.visitors += 1
      scheduleWrite()
      return current.visitors
    },
    async recordSighting(spot) {
      const current = await ready()
      current.sightings[spot] = (current.sightings[spot] ?? 0) + 1
      scheduleWrite()
      return current.sightings[spot]
    },
    async getStats() {
      return structuredClone(await ready())
    },
    async flush() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (stats) await writeNow()
      await writing
    },
  }
}
