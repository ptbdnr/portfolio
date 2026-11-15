import path from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { seedContent } from './liveBlog.ts'
import { createMailer } from './mailer.ts'
import { createFileStore } from './store.ts'

const config = loadConfig()
if (config.contentDir) {
  seedContent({
    contentDir: config.contentDir,
    posts: path.resolve(import.meta.dirname, '../src/content/logbook'),
    media: config.staticDir && path.join(config.staticDir, 'media'),
    marker: path.join(config.dataDir, '.content-seeded'),
  })
}
const store = createFileStore(config.dataDir)
const mailer = createMailer(config)
const app = createApp({ config, store, mailer })

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.info(`[server] hut-to-hut API listening on http://localhost:${info.port}`)
  console.info(`[server] mail delivery: ${mailer.enabled ? 'SMTP' : 'off (messages saved to data/messages.jsonl)'}`)
  console.info(`[server] blog: ${config.contentDir ? `live from ${config.contentDir} (blog/ and media/)` : 'as built into the site'}`)
})

let stopping = false
const shutdown = async (signal: string) => {
  if (stopping) return
  stopping = true
  console.info(`[server] ${signal} received, flushing stats…`)
  await store.flush().catch((error) => console.error('[server] flush failed', error))
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
