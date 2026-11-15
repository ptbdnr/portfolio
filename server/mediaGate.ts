import { createHash } from 'node:crypto'
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import path from 'node:path'
import { MEDIA, VIDEO, findMetadata, mp4MetadataBoxes, stripMetadata } from '../scripts/media-privacy.ts'

type Logger = Pick<Console, 'info' | 'warn' | 'error'>

/** The file to send for a picture or video: the original, or a copy with the personal details taken out. */
export type MediaFile = { file: string; stats: Stats }
export type MediaVerdict = MediaFile | { blocked: string[] }

/** Pictures bigger than this aren't read to be checked (and so aren't shown). */
const MAX_PICTURE = 64 * 1024 * 1024

/** The file a site address like `2026/ridge.jpg` points to, only if it's inside `dir` and not hidden. */
export function insideFolder(dir: string, rel: string) {
  if (!rel || rel.includes('\0') || rel.includes('\\') || rel.split('/').some((part) => !part || part.startsWith('.'))) return null
  const file = path.resolve(dir, rel)
  return file.startsWith(path.resolve(dir) + path.sep) ? file : null
}

/** A movie's top-level boxes (type, where it starts, how big it is), read without loading the movie itself. */
async function topLevelBoxes(file: string, size: number) {
  const handle = await open(file, 'r')
  try {
    const boxes: { type: string; at: number; size: number }[] = []
    const head = Buffer.alloc(16)
    for (let at = 0; at + 8 <= size && boxes.length < 1000; ) {
      await handle.read(head, 0, 16, at)
      let length = head.readUInt32BE(0)
      if (length === 1) length = Number(head.readBigUInt64BE(8))
      else if (length === 0) length = size - at
      if (length < 8 || at + length > size) break
      boxes.push({ type: head.toString('latin1', 4, 8), at, size: length })
      at += length
    }
    return boxes
  } finally {
    await handle.close()
  }
}

/** The parts of a movie that can hold metadata ('moov' and any top-level 'udta' or 'meta'), and where each starts. */
async function videoMetadata(file: string, size: number) {
  const parts = (await topLevelBoxes(file, size)).filter((b) => b.type === 'moov' || b.type === 'udta' || b.type === 'meta')
  const handle = await open(file, 'r')
  try {
    const read = await Promise.all(
      parts.map(async (part) => {
        const bytes = Buffer.alloc(part.size)
        await handle.read(bytes, 0, part.size, part.at)
        return { at: part.at, bytes }
      }),
    )
    return read
  } finally {
    await handle.close()
  }
}

const findingsIn = (parts: { bytes: Buffer }[], ext: string) => findMetadata(Buffer.concat(parts.map((p) => p.bytes)), ext)

/**
 * Pictures and videos for the site, straight from the content folder, with the location and camera
 * details phones write into them taken out (as `npm run build` makes sure of for the built-in ones):
 * a cleaned copy is kept in `cacheDir`, and the originals are left as they are. A file that can't be
 * cleaned (an iPhone HEIC photo, say) isn't shown at all, and the log says why.
 */
export function createMediaGate(dir: string, cacheDir: string, logger: Logger = console) {
  const verdicts = new Map<string, { key: string; verdict: Promise<MediaVerdict> }>()

  async function cleanCopy(file: string, key: string, ext: string, write: (to: string) => Promise<void>) {
    await mkdir(cacheDir, { recursive: true })
    const to = path.join(cacheDir, `${createHash('sha256').update(`${file}\0${key}`).digest('hex').slice(0, 24)}${ext}`)
    await write(`${to}.part`)
    await rename(`${to}.part`, to)
    return to
  }

  async function check(file: string, stats: Stats, key: string): Promise<MediaVerdict> {
    const ext = path.extname(file).toLowerCase()
    const name = path.relative(dir, file)
    if (VIDEO.has(ext)) {
      const found = findingsIn(await videoMetadata(file, stats.size), ext)
      if (!found.length) return { file, stats }
      const copy = await cleanCopy(file, key, ext, async (to) => {
        await copyFile(file, to)
        const handle = await open(to, 'r+')
        try {
          for (const part of await videoMetadata(to, stats.size)) {
            for (const at of mp4MetadataBoxes(part.bytes)) await handle.write(Buffer.from('free', 'latin1'), 0, 4, part.at + at + 4)
          }
        } finally {
          await handle.close()
        }
      })
      const left = findingsIn(await videoMetadata(copy, stats.size), ext)
      if (left.length) return { blocked: left }
      logger.info(`[media] ${name}: took out ${found.join(' and ')}`)
      return { file: copy, stats: await stat(copy) }
    }
    if (stats.size > MAX_PICTURE) return { blocked: ['too big to check'] }
    const bytes = await readFile(file)
    const found = findMetadata(bytes, ext)
    if (!found.length) return { file, stats }
    const cleaned = stripMetadata(bytes, ext)
    const left = findMetadata(cleaned, ext)
    if (left.length) return { blocked: left }
    const copy = await cleanCopy(file, key, ext, (to) => writeFile(to, cleaned))
    logger.info(`[media] ${name}: took out ${found.join(', ')}`)
    return { file: copy, stats: await stat(copy) }
  }

  return {
    /** What to send for /media/<rel>, or null if there's no such file. */
    async resolve(rel: string): Promise<MediaVerdict | null> {
      const file = insideFolder(dir, rel)
      if (!file) return null
      const stats = await stat(file).catch(() => null)
      if (!stats?.isFile()) return null
      if (!MEDIA.has(path.extname(file).toLowerCase())) return { file, stats }
      const key = `${stats.mtimeMs}:${stats.size}`
      const known = verdicts.get(file)
      if (known?.key === key) return known.verdict
      const verdict = check(file, stats, key)
        .catch((error: Error): MediaVerdict => ({ blocked: [`couldn't be checked (${error.message})`] }))
        .then((result) => {
          if ('blocked' in result) logger.warn(`[media] ${path.relative(dir, file)} isn't shown: ${result.blocked.join(', ')}`)
          return result
        })
      verdicts.set(file, { key, verdict })
      // The file changed: its old cleaned copy is no longer needed.
      const old = await known?.verdict
      if (old && 'file' in old && old.file.startsWith(cacheDir)) await rm(old.file, { force: true })
      return verdict
    },
  }
}

export type MediaGate = ReturnType<typeof createMediaGate>
