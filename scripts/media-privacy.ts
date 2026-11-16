/**
 * Keeps location and camera details out of the photos, videos and sound files the site publishes.
 * Phones write GPS coordinates and the time a picture was taken into every file (voice memos too);
 * anyone can read them back.
 *
 *   node scripts/media-privacy.ts           check public/, src/content/ and src/assets/: lists files with metadata, exits 1 if any
 *   node scripts/media-privacy.ts --clean   strips it in place (JPEG, PNG, WebP, SVG, MP3, WAV, FLAC;
 *                                           MP4/MOV/M4A and Ogg/Opus via ffmpeg)
 *
 * `npm run build` runs the check first, so nothing with a location in it goes live by accident.
 */
import { spawnSync } from 'node:child_process'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len))
const u16 = (b: Uint8Array, at: number, le: boolean) => (le ? b[at] | (b[at + 1] << 8) : (b[at] << 8) | b[at + 1])
const u32 = (b: Uint8Array, at: number, le = false) =>
  (le ? b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24) : (b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const includes = (b: Uint8Array, text: string) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes(text, 0, 'latin1')

/* ------------------------------------------------------------------- JPEG */

const ORIENTATION = 0x0112
const GPS_IFD = 0x8825

/** The tags in an EXIF block's first directory, its orientation, and whether more directories follow. */
function readExif(seg: Uint8Array) {
  const t = 6
  const le = ascii(seg, t, 2) === 'II'
  const ifd = t + u32(seg, t + 4, le)
  const n = u16(seg, ifd, le)
  const tags: number[] = []
  let orientation = 1
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    const tag = u16(seg, e, le)
    tags.push(tag)
    if (tag === ORIENTATION) orientation = u16(seg, e + 8, le)
  }
  const next = u32(seg, ifd + 2 + n * 12, le)
  return { tags, orientation, next }
}

/** A minimal EXIF block holding nothing but the orientation, so rotated photos still display upright. */
function orientationOnly(orientation: number) {
  // Big-endian TIFF header, one directory with one entry (Orientation, SHORT, 1 value), no next directory.
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]
  const body = [...Buffer.from('Exif\0\0', 'latin1'), ...tiff]
  return new Uint8Array([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255, ...body])
}

type Segment = { marker: number; start: number; end: number }

function jpegSegments(b: Uint8Array): { segments: Segment[]; scan: number } {
  const segments: Segment[] = []
  let at = 2
  while (at + 4 <= b.length && b[at] === 0xff) {
    const marker = b[at + 1]
    if (marker === 0xda) return { segments, scan: at }
    const end = at + 2 + u16(b, at + 2, false)
    segments.push({ marker, start: at, end })
    at = end
  }
  return { segments, scan: at }
}

function jpegFindings(b: Uint8Array) {
  const found = new Set<string>()
  for (const s of jpegSegments(b).segments) {
    const seg = b.subarray(s.start + 4, s.end)
    if (s.marker === 0xe1 && ascii(seg, 0, 6) === 'Exif\0\0') {
      const { tags, next } = readExif(seg)
      if (tags.includes(GPS_IFD)) found.add('GPS location')
      if (tags.some((t) => t !== ORIENTATION) || next) found.add('EXIF (camera, time)')
    } else if (s.marker === 0xe1) found.add('XMP')
    else if (s.marker === 0xed) found.add('IPTC')
    else if (s.marker === 0xfe) found.add('comment')
  }
  return [...found]
}

/** Keeps the image, its colour profile and orientation; drops EXIF, XMP, IPTC and comments. */
export function stripJpeg(b: Uint8Array) {
  const { segments, scan } = jpegSegments(b)
  const keep: Uint8Array[] = [b.subarray(0, 2)]
  let orientation = 1
  for (const s of segments) {
    const seg = b.subarray(s.start + 4, s.end)
    if (s.marker === 0xe1 && ascii(seg, 0, 6) === 'Exif\0\0') {
      orientation = readExif(seg).orientation
      continue
    }
    const isIcc = s.marker === 0xe2 && ascii(seg, 0, 11) === 'ICC_PROFILE'
    const metadata = s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe || (s.marker >= 0xe2 && s.marker <= 0xef && s.marker !== 0xee && !isIcc)
    if (!metadata) keep.push(b.subarray(s.start, s.end))
  }
  // Right after the JFIF header if there is one.
  if (orientation > 1 && orientation <= 8) keep.splice(keep[1]?.[1] === 0xe0 ? 2 : 1, 0, orientationOnly(orientation))
  keep.push(b.subarray(scan))
  return concat(keep)
}

/* -------------------------------------------------------------------- PNG */

const PNG_METADATA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

function pngChunks(b: Uint8Array) {
  const chunks: { type: string; start: number; end: number }[] = []
  for (let at = 8; at + 12 <= b.length; ) {
    const end = at + 12 + u32(b, at)
    chunks.push({ type: ascii(b, at + 4, 4), start: at, end })
    at = end
  }
  return chunks
}

/** Drops EXIF, text (where XMP lives) and timestamp chunks. */
export function stripPng(b: Uint8Array) {
  return concat([b.subarray(0, 8), ...pngChunks(b).filter((c) => !PNG_METADATA.has(c.type)).map((c) => b.subarray(c.start, c.end))])
}

/* ------------------------------------------------------------------- WebP */

function webpChunks(b: Uint8Array) {
  const chunks: { type: string; start: number; end: number }[] = []
  for (let at = 12; at + 8 <= b.length; ) {
    const size = u32(b, at + 4, true)
    const end = at + 8 + size + (size & 1)
    chunks.push({ type: ascii(b, at, 4), start: at, end })
    at = end
  }
  return chunks
}

/** Drops the EXIF and XMP chunks (and their flags in the header). */
export function stripWebp(b: Uint8Array) {
  const body = webpChunks(b)
    .filter((c) => c.type !== 'EXIF' && c.type !== 'XMP ')
    .map((c) => {
      const chunk = b.slice(c.start, c.end)
      if (c.type === 'VP8X') chunk[8] &= ~0x0c
      return chunk
    })
  const out = concat([b.slice(0, 12), ...body])
  new DataView(out.buffer).setUint32(4, out.length - 8, true)
  return out
}

/* ------------------------------------------------------------ MP4 / MOV */

/** Boxes that hold metadata (directly or further down). */
const MP4_CONTAINERS = new Set(['moov', 'trak', 'udta', 'meta', 'ilst'])

/** Box types found in the movie's metadata, plus the QuickTime metadata key names. */
function mp4Metadata(b: Uint8Array, from = 0, to = b.length, found = { types: new Set<string>(), keys: '' }) {
  for (let at = from; at + 8 <= to; ) {
    let size = u32(b, at)
    const type = ascii(b, at + 4, 4)
    let header = 8
    if (size === 1) {
      size = u32(b, at + 8) * 2 ** 32 + u32(b, at + 12)
      header = 16
    } else if (size === 0) size = to - at
    if (size < header || at + size > to) break
    found.types.add(type)
    if (type === 'keys') found.keys += ascii(b, at + header, Math.min(size - header, 4096))
    if (MP4_CONTAINERS.has(type)) {
      // An MP4 'meta' box has 4 bytes of version and flags before its children; a QuickTime one doesn't.
      const skip = type === 'meta' && ascii(b, at + header + 4, 4) !== 'hdlr' ? 4 : 0
      mp4Metadata(b, at + header + skip, at + size, found)
    }
    at += size
  }
  return found
}

function videoFindings(b: Uint8Array) {
  const { types, keys } = mp4Metadata(b)
  const found: string[] = []
  // 3GPP 'loci' (ffmpeg, some Android phones), '©xyz' (Android, older iPhones), ISO 6709 keys (iPhone).
  if (types.has('loci') || types.has('\u00a9xyz') || keys.includes('location')) found.push('GPS location')
  if (types.has('\u00a9mak') || types.has('\u00a9mod') || keys.includes('quicktime.make') || keys.includes('quicktime.model')) found.push('camera')
  return found
}

/**
 * A movie's metadata boxes ('udta' and 'meta', at the top level or in 'moov' and 'trak'): every
 * place the location and camera details can be. Renaming them to 'free' (padding that players skip)
 * and blanking what's inside removes the details without moving anything else, so it still plays.
 */
export function mp4MetadataBoxes(b: Uint8Array, from = 0, to = b.length, found: { at: number; header: number; size: number }[] = []) {
  for (let at = from; at + 8 <= to; ) {
    let size = u32(b, at)
    const type = ascii(b, at + 4, 4)
    let header = 8
    if (size === 1) {
      size = u32(b, at + 8) * 2 ** 32 + u32(b, at + 12)
      header = 16
    } else if (size === 0) size = to - at
    if (size < header || at + size > to) break
    if (type === 'udta' || type === 'meta') found.push({ at, header, size })
    else if (type === 'moov' || type === 'trak') mp4MetadataBoxes(b, at + header, at + size, found)
    at += size
  }
  return found
}

/* ------------------------------------------------------------ MP3 / AAC */

/** ID3v2 tags at the start of the file (there can be more than one), as [start, end] ranges. */
function id3v2Tags(b: Uint8Array) {
  const tags: [number, number][] = []
  let at = 0
  while (at + 10 <= b.length && ascii(b, at, 3) === 'ID3') {
    const size = ((b[at + 6] & 0x7f) << 21) | ((b[at + 7] & 0x7f) << 14) | ((b[at + 8] & 0x7f) << 7) | (b[at + 9] & 0x7f)
    const footer = b[at + 5] & 0x10 ? 10 : 0
    const end = Math.min(b.length, at + 10 + size + footer)
    tags.push([at, end])
    at = end
  }
  return tags
}

/** An APEv2 tag at the end (before an ID3v1 tag, if there is one), as a [start, end] range. */
function apeTag(b: Uint8Array): [number, number] | null {
  for (const end of [b.length, b.length - 128]) {
    const footer = end - 32
    if (footer < 0 || ascii(b, footer, 8) !== 'APETAGEX') continue
    const size = u32(b, footer + 12, true)
    const hasHeader = (u32(b, footer + 20, true) & 0x80000000) !== 0
    const start = end - size - (hasHeader ? 32 : 0)
    if (start >= 0) return [start, end]
  }
  return null
}

const nonZero = (b: Uint8Array, from: number, to: number) => b.subarray(from, to).some((x) => x !== 0)

function id3Findings(b: Uint8Array) {
  const found = new Set<string>()
  // A tag that's all padding (as left by stripId3) says nothing.
  if (id3v2Tags(b).some(([from, to]) => nonZero(b, from + 10, to))) found.add('ID3 tags')
  if (b.length >= 128 && ascii(b, b.length - 128, 3) === 'TAG' && nonZero(b, b.length - 125, b.length - 1)) found.add('ID3 tags')
  if (apeTag(b)) found.add('APE tags')
  return [...found]
}

/** Empties ID3 and APE tags without moving anything: tags become padding, which players skip. */
export function stripId3(b: Uint8Array) {
  const out = b.slice()
  for (const [from, to] of id3v2Tags(out)) {
    out[from + 5] &= ~0x50 // no extended header, no footer: just padding inside
    out.fill(0, from + 10, to)
  }
  const ape = apeTag(out)
  if (ape) out.fill(0, ape[0], ape[1])
  if (out.length >= 128 && ascii(out, out.length - 128, 3) === 'TAG') {
    out.fill(0, out.length - 125, out.length)
    out[out.length - 1] = 255 // genre: none
  }
  return out
}

/* -------------------------------------------------------------------- WAV */

/** The chunks a WAV file needs to play; anything else (LIST/INFO, bext, iXML, XMP, ID3…) is metadata. */
const WAV_KEEP = new Set(['fmt ', 'data', 'fact', 'cue ', 'smpl', 'JUNK', 'junk', 'PAD ', 'pad '])

function wavChunks(b: Uint8Array) {
  const chunks: { type: string; start: number; end: number }[] = []
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WAVE') return chunks
  for (let at = 12; at + 8 <= b.length; ) {
    const size = u32(b, at + 4, true)
    const end = Math.min(b.length, at + 8 + size + (size & 1))
    chunks.push({ type: ascii(b, at, 4), start: at, end })
    at = end
  }
  return chunks
}

/** Turns metadata chunks into empty 'JUNK' chunks (padding players skip), so nothing moves. */
export function stripWav(b: Uint8Array) {
  const out = b.slice()
  for (const c of wavChunks(out)) {
    if (WAV_KEEP.has(c.type)) continue
    out.set(Buffer.from('JUNK', 'latin1'), c.start)
    out.fill(0, c.start + 8, c.end)
  }
  return out
}

/* ------------------------------------------------------------------- FLAC */

const FLAC = { padding: 1, application: 2, comments: 4, picture: 6 }

function flacBlocks(b: Uint8Array) {
  const blocks: { type: number; start: number; end: number }[] = []
  if (ascii(b, 0, 4) !== 'fLaC') return blocks
  for (let at = 4; at + 4 <= b.length; ) {
    const type = b[at] & 0x7f
    const end = Math.min(b.length, at + 4 + ((b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]))
    blocks.push({ type, start: at, end })
    if (b[at] & 0x80) break
    at = end
  }
  return blocks
}

function flacFindings(b: Uint8Array) {
  const found = new Set<string>()
  for (const block of flacBlocks(b)) {
    if (block.type === FLAC.picture) found.add('cover picture')
    else if (block.type === FLAC.application) found.add('application data')
    else if (block.type === FLAC.comments) {
      const vendor = u32(b, block.start + 4, true)
      if (u32(b, block.start + 8 + vendor, true) > 0) found.add('tags')
    }
  }
  return [...found]
}

/** Turns tags, pictures and application data into padding blocks, so nothing moves. */
export function stripFlac(b: Uint8Array) {
  const out = b.slice()
  for (const block of flacBlocks(out)) {
    if (block.type !== FLAC.comments && block.type !== FLAC.picture && block.type !== FLAC.application) continue
    out[block.start] = (out[block.start] & 0x80) | FLAC.padding
    out.fill(0, block.start + 4, block.end)
  }
  return out
}

/* -------------------------------------------------------------- Ogg / Opus */

/** Whether an Ogg Vorbis or Opus file has comments (tags such as LOCATION=…) in its second page. */
function oggFindings(b: Uint8Array) {
  if (ascii(b, 0, 4) !== 'OggS') return []
  const pageLength = (at: number) => {
    const segments = b[at + 26]
    let body = 0
    for (let i = 0; i < segments; i++) body += b[at + 27 + i]
    return { header: 27 + segments, total: 27 + segments + body }
  }
  const second = pageLength(0).total
  if (second + 27 > b.length || ascii(b, second, 4) !== 'OggS') return []
  const at = second + pageLength(second).header
  const magic = ascii(b, at, 8) === 'OpusTags' ? 8 : ascii(b, at + 1, 6) === 'vorbis' ? 7 : 0
  if (!magic) return []
  const vendor = u32(b, at + magic, true)
  const count = u32(b, at + magic + 4 + vendor, true)
  return count > 0 ? ['tags'] : []
}

/* ------------------------------------------------------------- everything */

export const VIDEO = new Set(['.mp4', '.m4v', '.mov'])
/** MP4 containers: videos, and sound recorded on phones (voice memos and the like). */
export const MP4 = new Set([...VIDEO, '.m4a'])
/** Sound that ffmpeg has to clean (comments live inside the Ogg pages). */
export const OGG = new Set(['.ogg', '.oga', '.opus'])
export const AUDIO = new Set(['.mp3', '.aac', '.wav', '.flac', ...OGG])
/** Files that can carry personal metadata (others, like WebM video, are passed as they are). */
export const MEDIA = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.heic', '.heif', '.tif', '.tiff', ...MP4, ...AUDIO])

/** What personal metadata a file carries (empty when it's clean). */
export function findMetadata(b: Uint8Array, ext: string): string[] {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return jpegFindings(b)
    case '.png':
      return [...new Set(pngChunks(b).filter((c) => PNG_METADATA.has(c.type)).map((c) => (c.type === 'eXIf' ? 'EXIF' : c.type === 'tIME' ? 'timestamp' : 'text')))]
    case '.webp':
      return webpChunks(b)
        .filter((c) => c.type === 'EXIF' || c.type === 'XMP ')
        .map((c) => c.type.trim())
    case '.svg':
      return includes(b, '<metadata') || includes(b, 'sodipodi:docname') || includes(b, 'export-filename') ? ['editor metadata (may include file paths)'] : []
    case '.heic':
    case '.heif':
    case '.tif':
    case '.tiff':
      return ['not a web format: convert to JPEG or WebP first']
    case '.mp3':
    case '.aac':
      return id3Findings(b)
    case '.wav': {
      const extra = [...new Set(wavChunks(b).filter((c) => !WAV_KEEP.has(c.type)).map((c) => c.type.trim()))]
      return extra.length ? [`recording details (${extra.join(', ')})`] : []
    }
    case '.flac':
      return flacFindings(b)
    default:
      if (OGG.has(ext)) return oggFindings(b)
      return MP4.has(ext) ? videoFindings(b) : []
  }
}

export function stripMetadata(b: Uint8Array, ext: string): Uint8Array {
  if (ext === '.jpg' || ext === '.jpeg') return stripJpeg(b)
  if (ext === '.png') return stripPng(b)
  if (ext === '.webp') return stripWebp(b)
  if (ext === '.mp3' || ext === '.aac') return stripId3(b)
  if (ext === '.wav') return stripWav(b)
  if (ext === '.flac') return stripFlac(b)
  if (ext === '.svg') {
    const text = Buffer.from(b)
      .toString('utf8')
      .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
      .replace(/\s(?:sodipodi:docname|inkscape:export-filename|inkscape:export-xdpi|inkscape:export-ydpi)="[^"]*"/g, '')
    return new Uint8Array(Buffer.from(text, 'utf8'))
  }
  return b
}

async function mediaFiles(dirs: string[]) {
  const files: string[] = []
  for (const dir of dirs) {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (e.isFile() && MEDIA.has(path.extname(e.name).toLowerCase())) files.push(path.join(e.parentPath, e.name))
    }
  }
  return files.sort()
}

/** Rewrites a movie or an Ogg file without its metadata (bit-exact: no "encoder" tag added either). */
async function stripWithFfmpeg(file: string) {
  const ext = path.extname(file)
  const tmp = `${file}.clean${ext}`
  const container = MP4.has(ext.toLowerCase()) ? ['-movflags', '+faststart'] : []
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0', '-map_metadata', '-1', '-map_chapters', '-1', '-c', 'copy', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact', ...container, tmp])
  if (run.error || run.status !== 0) throw new Error(`ffmpeg is needed to clean videos and Ogg sound files (${file})`)
  await rename(tmp, file)
}

async function main() {
  const clean = process.argv.includes('--clean')
  const files = await mediaFiles(['public', 'src/content', 'src/assets'])
  const dirty: string[] = []
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    let found = findMetadata(await readFile(file), ext)
    if (found.length && clean && !ext.startsWith('.he') && !ext.startsWith('.ti')) {
      if (MP4.has(ext) || OGG.has(ext)) await stripWithFfmpeg(file)
      else await writeFile(file, stripMetadata(await readFile(file), ext))
      found = findMetadata(await readFile(file), ext)
      if (!found.length) console.log(`cleaned  ${file}`)
    }
    if (found.length) dirty.push(`  ${file}: ${found.join(', ')}`)
  }
  if (dirty.length) {
    console.error(`These files carry personal metadata (such as where a photo was taken):\n${dirty.join('\n')}`)
    if (!clean) console.error('Run `npm run media:clean` to remove it.')
    process.exit(1)
  }
  console.log(`media privacy: ${files.length} file${files.length === 1 ? '' : 's'} checked, no location or camera metadata`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main()
