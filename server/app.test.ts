import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import type { Mailer } from './mailer.ts'
import { formatEmail } from './mailer.ts'
import { createFileStore, createMemoryStore, type StoredMessage } from './store.ts'

const T0 = 1_700_000_000_000

// oxlint-disable-next-line typescript/no-explicit-any
const json = async (res: Response): Promise<any> => res.json()

function setup(options: { mailer?: Mailer; now?: () => number } = {}) {
  const config = { ...loadConfig({ STATIC_DIR: 'false', TRUST_PROXY: '1' }), minFormMs: 2000 }
  const store = createMemoryStore()
  const sent: StoredMessage[] = []
  const mailer: Mailer = options.mailer ?? {
    enabled: true,
    async send(message) {
      sent.push(message)
    },
  }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const app = createApp({ config, store, mailer, logger, now: options.now ?? (() => T0) })
  return { app, store, sent, logger }
}

const validBody = {
  name: 'Reinhold',
  email: 'reinhold@example.com',
  topic: 'mountains',
  message: 'Fancy a hut-to-hut tour in the Ortler group next spring?',
  website: '',
  startedAt: T0 - 60_000,
}

function post(app: ReturnType<typeof setup>['app'], url: string, body: unknown, ip = '203.0.113.7') {
  return app.request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  it('stores and mails a valid message', async () => {
    const { app, store, sent } = setup()
    const res = await post(app, '/api/contact', validBody)
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.ok).toBe(true)
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]).toMatchObject({ name: 'Reinhold', topic: 'mountains', ip: '203.0.113.7' })
    expect(sent).toHaveLength(1)
  })

  it('returns field errors for invalid input', async () => {
    const { app, store } = setup()
    const res = await post(app, '/api/contact', { ...validBody, email: 'nope', message: 'hi' })
    expect(res.status).toBe(422)
    const body = await json(res)
    expect(body.ok).toBe(false)
    expect(Object.keys(body.fieldErrors)).toEqual(expect.arrayContaining(['email', 'message']))
    expect(store.messages).toHaveLength(0)
  })

  it('rejects malformed JSON as a validation error', async () => {
    const { app } = setup()
    const res = await post(app, '/api/contact', '{not json')
    expect(res.status).toBe(422)
  })

  it('silently drops honeypot and too-fast submissions', async () => {
    const { app, store, sent } = setup()
    const honeypot = await post(app, '/api/contact', { ...validBody, website: 'http://spam.example' })
    const tooFast = await post(app, '/api/contact', { ...validBody, startedAt: T0 - 500 })
    expect((await json(honeypot)).ok).toBe(true)
    expect((await json(tooFast)).ok).toBe(true)
    expect(store.messages).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it('rate limits bursts from one address', async () => {
    const { app } = setup()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await post(app, '/api/contact', validBody)).status)
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(statuses[5]).toBe(429)
    expect((await post(app, '/api/contact', validBody, '198.51.100.1')).status).toBe(200)
  })

  it('still succeeds when mail fails but the message was stored', async () => {
    const { app, store, logger } = setup({
      mailer: {
        enabled: true,
        async send() {
          throw new Error('smtp down')
        },
      },
    })
    const res = await post(app, '/api/contact', validBody)
    expect(res.status).toBe(200)
    expect(store.messages).toHaveLength(1)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('stats API', () => {
  it('counts a visit once per address per window', async () => {
    const { app } = setup()
    const first = await json(await post(app, '/api/stats/visit', {}))
    const again = await json(await post(app, '/api/stats/visit', {}))
    const other = await json(await post(app, '/api/stats/visit', {}, '198.51.100.9'))
    expect([first.visitors, again.visitors, other.visitors]).toEqual([1, 1, 2])
  })

  it('records sightings only for known species', async () => {
    const { app } = setup()
    expect((await post(app, '/api/stats/sighting', { species: 'marmot' })).status).toBe(200)
    expect((await post(app, '/api/stats/sighting', { species: 'marmot' }, '198.51.100.2')).status).toBe(200)
    expect((await post(app, '/api/stats/sighting', { species: 'dragon' })).status).toBe(400)
    const stats = await json(await app.request('/api/stats'))
    expect(stats.sightings).toEqual({ marmot: 2 })
  })

  it('answers unknown API routes with JSON 404', async () => {
    const { app } = setup()
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect(await json(res)).toEqual({ error: 'not found' })
  })
})

describe('file store', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('persists counters and appends messages', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'hut-store-'))
    const store = createFileStore(dir, 5)
    await store.recordVisit()
    await store.recordSighting('ibex')
    await store.saveMessage({ ...validBody, topic: 'hello', id: 'x', receivedAt: 'now' } as StoredMessage)
    await store.flush()

    const reopened = createFileStore(dir)
    expect(await reopened.getStats()).toEqual({ visitors: 1, sightings: { ibex: 1 } })
    const lines = (await readFile(path.join(dir, 'messages.jsonl'), 'utf8')).trim().split('\n')
    expect(JSON.parse(lines[0]).id).toBe('x')
  })
})

describe('static frontend', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  async function staticApp() {
    dir = await mkdtemp(path.join(tmpdir(), 'hut-static-'))
    await mkdir(path.join(dir, 'assets'))
    await writeFile(path.join(dir, 'index.html'), '<!doctype html><html><head><title>shell</title></head><body></body></html>')
    await writeFile(path.join(dir, 'assets', 'app-123.js'), 'console.log(1)')
    // The blog's plain versions, as a build writes them (see scripts/blog-plain.ts).
    await mkdir(path.join(dir, 'blog', 'first-post', 'plain'), { recursive: true })
    await writeFile(path.join(dir, 'blog', 'first-post.md'), '# First post\n\nHello.\n')
    await writeFile(path.join(dir, 'blog', 'first-post', 'plain', 'index.html'), '<!doctype html><h1>First post</h1>')
    await writeFile(path.join(dir, 'llms.txt'), '# Peter\n\n- [First post](/blog/first-post.md)\n')
    const config = { ...loadConfig({ STATIC_DIR: dir }), staticDir: dir }
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    return createApp({ config, store: createMemoryStore(), mailer: { enabled: false, async send() {} }, logger })
  }

  it('serves hashed assets with long-lived caching and the shell without caching', async () => {
    const app = await staticApp()
    const asset = await app.request('/assets/app-123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')
    const home = await app.request('/')
    expect(home.status).toBe(200)
    expect(home.headers.get('cache-control')).toBe('no-cache')
    expect(home.headers.get('content-security-policy')).toContain("frame-src https://www.youtube-nocookie.com")
  })

  it('falls back to the app shell for client routes but 404s missing files', async () => {
    const app = await staticApp()
    const route = await app.request('/logbook/some-entry')
    expect(route.status).toBe(200)
    expect(await route.text()).toContain('<title>shell</title>')
    expect((await app.request('/assets/missing.js')).status).toBe(404)
    expect((await app.request('/api/unknown')).status).toBe(404)
  })

  const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  const AGENT = 'text/markdown, text/html;q=0.9, */*;q=0.8'

  it('serves a post as Markdown that browsers show rather than download, and as a plain page', async () => {
    const app = await staticApp()
    const md = await app.request('/blog/first-post.md')
    expect(md.status).toBe(200)
    expect(md.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(md.headers.get('cache-control')).toBe('no-cache')
    expect(await md.text()).toBe('# First post\n\nHello.\n')
    const plain = await app.request('/blog/first-post/plain')
    expect(plain.status).toBe(200)
    expect(plain.headers.get('content-type')).toContain('text/html')
    expect(await plain.text()).toContain('<h1>First post</h1>')
    const llms = await app.request('/llms.txt')
    expect(llms.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect((await app.request('/blog/no-such-post.md')).status).toBe(404)
  })

  it('hands AI tools that ask for Markdown a post’s Markdown at its own address, and browsers the site', async () => {
    const app = await staticApp()
    const agent = await app.request('/blog/first-post', { headers: { accept: AGENT } })
    expect(agent.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(agent.headers.get('vary')).toBe('Accept')
    expect(await agent.text()).toBe('# First post\n\nHello.\n')
    const browser = await app.request('/blog/first-post', { headers: { accept: BROWSER } })
    expect(browser.headers.get('content-type')).toContain('text/html')
    expect(browser.headers.get('vary')).toBe('Accept')
    expect(browser.headers.get('cache-control')).toBe('no-cache')
    const html = await browser.text()
    expect(html).toContain('<title>shell</title>')
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/blog/first-post.md" id="markdown-alternate" />\n  </head>')
  })

  it('points the home page and the blog index at llms.txt', async () => {
    const app = await staticApp()
    for (const page of ['/', '/blog', '/blog/']) {
      expect(await (await app.request(page, { headers: { accept: BROWSER } })).text()).toContain('href="/llms.txt"')
      expect(await (await app.request(page, { headers: { accept: AGENT } })).text()).toContain('- [First post](/blog/first-post.md)')
    }
  })

  it('leaves pages without a Markdown version alone', async () => {
    const app = await staticApp()
    for (const page of ['/blog/no-such-post', '/logbook/first-post', '/blog/first-post/elsewhere']) {
      const res = await app.request(page, { headers: { accept: AGENT } })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(res.headers.get('vary')).toBeNull()
      expect(await res.text()).not.toContain('text/markdown')
    }
  })
})

describe('the blog served live from a content folder', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  const post = (front: string, body: string) => `---\n${front}\n---\n${body}\n`

  async function liveApp() {
    dir = await mkdtemp(path.join(tmpdir(), 'hut-live-'))
    const site = path.join(dir, 'dist')
    const content = path.join(dir, 'content')
    await mkdir(path.join(site, 'blog'), { recursive: true })
    await mkdir(path.join(site, 'media'), { recursive: true })
    await mkdir(path.join(content, 'blog'), { recursive: true })
    await mkdir(path.join(content, 'media'), { recursive: true })
    await writeFile(path.join(site, 'index.html'), '<!doctype html><html><head><title>shell</title></head><body></body></html>')
    // What the build wrote: by now out of date.
    await writeFile(path.join(site, 'blog', 'first.md'), '# First (as built)\n')
    await writeFile(path.join(site, 'llms.txt'), '# As built\n')
    await writeFile(path.join(site, 'media', 'built-in.png'), 'png')
    await writeFile(path.join(content, 'blog', '2026-01-01-first.md'), post('title: First\ndate: 2026-01-01\nsummary: The first post.', 'Hello from the NAS.'))
    await writeFile(path.join(content, 'blog', '2026-02-01-draft.md'), post('title: Not yet\ndate: 2026-02-01\ndraft: true', 'Shh.'))
    const clock = { now: 0 }
    const config = { ...loadConfig({}), staticDir: site, contentDir: content, dataDir: path.join(dir, 'data') }
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = createApp({ config, store: createMemoryStore(), mailer: { enabled: false, async send() {} }, logger, now: () => clock.now })
    return { app, clock, content }
  }

  const indexOf = (html: string) => JSON.parse(/<script type="application\/json" id="blog-index">(.*?)<\/script>/.exec(html)![1]) as { slug: string }[]

  it('puts the published posts into every page of the site, and serves each one’s text', async () => {
    const { app } = await liveApp()
    for (const page of ['/', '/blog', '/blog/first', '/about-somewhere']) {
      expect(indexOf(await (await app.request(page)).text()).map((p) => p.slug)).toEqual(['first'])
    }
    const body = await app.request('/api/blog/first')
    expect(body.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(body.headers.get('cache-control')).toBe('no-cache')
    expect(await body.text()).toBe('Hello from the NAS.\n')
    expect((await app.request('/api/blog/draft')).status).toBe(404)
  })

  it('shows a new post, an edit and a deletion within seconds, without a restart', async () => {
    const { app, clock, content } = await liveApp()
    await app.request('/blog')
    await writeFile(path.join(content, 'blog', '2026-03-01-gran-paradiso.md'), post('title: Gran Paradiso\ndate: 2026-03-01', 'A perfect day.'))
    clock.now += 3000
    expect(indexOf(await (await app.request('/blog')).text()).map((p) => p.slug)).toEqual(['gran-paradiso', 'first'])
    expect(await (await app.request('/blog/gran-paradiso.md')).text()).toBe('# Gran Paradiso\n\nA perfect day.\n')
    expect(await (await app.request('/blog/gran-paradiso/plain')).text()).toContain('<p>A perfect day.</p>')
    expect(await (await app.request('/llms.txt')).text()).toContain('- [Gran Paradiso](/blog/gran-paradiso.md)')
    const agent = await app.request('/blog/gran-paradiso', { headers: { accept: 'text/markdown' } })
    expect(await agent.text()).toBe('# Gran Paradiso\n\nA perfect day.\n')
    const browser = await (await app.request('/blog/gran-paradiso')).text()
    expect(browser).toContain('href="/blog/gran-paradiso.md"')

    await writeFile(path.join(content, 'blog', '2026-03-01-gran-paradiso.md'), post('title: Gran Paradiso, again\ndate: 2026-03-01', 'An even better day.'))
    clock.now += 3000
    expect(await (await app.request('/api/blog/gran-paradiso')).text()).toBe('An even better day.\n')

    await rm(path.join(content, 'blog', '2026-01-01-first.md'))
    clock.now += 3000
    // Gone everywhere, even though the build left its own copies behind.
    expect((await app.request('/blog/first.md')).status).toBe(404)
    expect((await app.request('/blog/first/plain')).status).toBe(404)
    expect(await (await app.request('/llms.txt')).text()).not.toContain('First')
    expect(await (await app.request('/blog/first')).text()).not.toContain('first.md')
  })

  it('sends photos without their location, checks for changes cheaply, and refuses what it can’t clean', async () => {
    const { app, content } = await liveApp()
    const { jpeg } = await import('../scripts/media-fixtures.ts')
    const { findMetadata } = await import('../scripts/media-privacy.ts')
    await writeFile(path.join(content, 'media', 'ridge.jpg'), jpeg())
    const photo = await app.request('/media/ridge.jpg')
    expect(photo.status).toBe(200)
    expect(photo.headers.get('content-type')).toBe('image/jpeg')
    expect(findMetadata(new Uint8Array(await photo.arrayBuffer()), '.jpg')).toEqual([])
    const again = await app.request('/media/ridge.jpg', { headers: { 'if-modified-since': photo.headers.get('last-modified')! } })
    expect(again.status).toBe(304)
    await writeFile(path.join(content, 'media', 'IMG_0001.heic'), 'heic')
    expect((await app.request('/media/IMG_0001.heic')).status).toBe(404)
    // Pictures the site was built with still work.
    expect((await app.request('/media/built-in.png')).status).toBe(200)
    expect((await app.request('/media/%2e%2e/%2e%2e/blog/2026-01-01-first.md')).status).toBe(404)
  })
})

describe('formatEmail', () => {
  it('keeps the subject on one line', () => {
    const { subject } = formatEmail({
      ...validBody,
      topic: 'hello',
      name: 'Evil\r\nBcc: someone@example.com',
      id: '1',
      receivedAt: 'now',
    } as StoredMessage)
    expect(subject).not.toMatch(/[\r\n]/)
  })
})
