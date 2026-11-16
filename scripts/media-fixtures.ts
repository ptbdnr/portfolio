/**
 * Test pictures and movies carrying the personal details phones write into them (GPS location,
 * camera, comments), built byte by byte. Shared by the media privacy tests.
 */
export const bytes = (...parts: (number[] | string | Uint8Array)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : [...p])))
const be16 = (n: number) => [n >> 8, n & 255]
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]
const segment = (marker: number, body: Uint8Array | number[]) => bytes([0xff, marker], be16(body.length + 2), [...body])

/** A phone-style EXIF block: orientation, camera model and a pointer to GPS coordinates. */
export function phoneExif(orientation: number) {
  const entries = [
    [0x0112, 3, 1, orientation << 16],
    [0x0110, 2, 4, 0x6950686f],
    [0x8825, 4, 1, 26 + 3 * 12 + 4],
  ]
  const tiff = bytes('MM', [0, 0x2a], be32(8), be16(entries.length), ...entries.map(([tag, type, count, value]) => [...be16(tag), ...be16(type), ...be32(count), ...be32(value)]), be32(0))
  return segment(0xe1, bytes('Exif\0\0', tiff, [0, 2, 0, 1, 0, 0, 0, 0]))
}

export const scan = bytes([0xff, 0xda], be16(8), [1, 1, 0, 0, 63, 0], [0x12, 0x34, 0x56], [0xff, 0xd9])
export const jpeg = (orientation = 1) =>
  bytes([0xff, 0xd8], segment(0xe0, bytes('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0])), phoneExif(orientation), segment(0xe1, bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')), segment(0xfe, bytes('taken at home')), segment(0xdb, [0, ...Array(64).fill(1)]), scan)

const chunk = (type: string, data: number[]) => bytes(be32(data.length), type, data, [0, 0, 0, 0])
export const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', Array(13).fill(1)), chunk('eXIf', [1, 2, 3]), chunk('tEXt', [...Buffer.from('GPS\0somewhere')]), chunk('IDAT', [9, 9, 9]), chunk('IEND', []))

const riff = (type: string, data: number[]) => bytes(type, le32(data.length), data, data.length & 1 ? [0] : [])
export function webp() {
  const body = bytes('WEBP', riff('VP8X', [0x0c, 0, 0, 0, 9, 0, 0, 9, 0, 0]), riff('VP8 ', [1, 2, 3, 4]), riff('EXIF', [5, 6, 7]), riff('XMP ', [8, 9]))
  return bytes('RIFF', le32(body.length), body)
}

export const box = (type: string, ...children: (Uint8Array | number[] | string)[]) => {
  const body = bytes(...children)
  return bytes(be32(body.length + 8), type, body)
}
export const movie = (...meta: Uint8Array[]) => bytes(box('ftyp', 'isom', [0, 0, 0, 0]), box('moov', box('mvhd', Array(20).fill(0)), ...meta), box('mdat', [1, 2, 3]))

/* ------------------------------------------------------------------ sound */

const syncsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]
const id3frame = (id: string, text: string) => bytes(id, be32(text.length + 1), [0, 0], [0], text)
/** An MP3 frame's worth of "audio" (a frame header and some bytes). */
export const mpegFrame = bytes([0xff, 0xfb, 0x90, 0x64], Array(60).fill(0x55))

/** An MP3 from a phone's recorder: ID3v2 tags (with a location) up front, an ID3v1 tag at the end. */
export function mp3() {
  const frames = bytes(id3frame('TIT2', 'Morning on the ridge'), id3frame('TXXX', '\0LOCATION\x0046.5,9.4'))
  const v1 = bytes('TAG', 'Morning'.padEnd(30, '\0'), 'Me'.padEnd(30, '\0'), ''.padEnd(30, '\0'), '2026', ''.padEnd(30, '\0'), [12])
  return bytes('ID3', [3, 0, 0], syncsafe(frames.length), frames, mpegFrame, mpegFrame, v1)
}

const riffChunk = (type: string, data: Uint8Array | number[] | string) => {
  const body = bytes(data)
  return bytes(type, le32(body.length), body, body.length & 1 ? [0] : [])
}

/** A WAV from a field recorder: INFO tags, a Broadcast WAV block and iXML with a location. */
export function wav() {
  const body = bytes(
    'WAVE',
    riffChunk('fmt ', [1, 0, 1, 0, 0x44, 0xac, 0, 0, 0x88, 0x58, 1, 0, 2, 0, 16, 0]),
    riffChunk('LIST', bytes('INFO', riffChunk('INAM', 'Home recording\0'))),
    riffChunk('bext', 'Zoom H5, 2026-11-15 07:12'),
    riffChunk('iXML', '<BWFXML><LOCATION>51.5072,-0.1276</LOCATION></BWFXML>'),
    riffChunk('data', [1, 2, 3, 4, 5, 6]),
  )
  return bytes('RIFF', le32(body.length), body)
}

const flacBlock = (type: number, last: boolean, data: Uint8Array | number[] | string) => {
  const body = bytes(data)
  return bytes([(last ? 0x80 : 0) | type, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255], body)
}
const vorbisComments = (vendor: string, comments: string[]) =>
  bytes(le32(vendor.length), vendor, le32(comments.length), ...comments.map((c) => bytes(le32(c.length), c)))

/** A FLAC with tags (one a location) and a cover picture. */
export function flac(tags = ['LOCATION=Aosta', 'TITLE=Stream']) {
  return bytes(
    'fLaC',
    flacBlock(0, false, Array(34).fill(7)),
    flacBlock(4, false, vorbisComments('reference libFLAC 1.4.3', tags)),
    flacBlock(6, true, bytes(Array(12).fill(0), 'image/jpeg', Array(20).fill(9))),
    [0xff, 0xf8, 0x69, 0x08, 1, 2, 3],
  )
}

const oggPage = (packet: Uint8Array) => bytes('OggS', [0, 0], Array(8).fill(0), [1, 0, 0, 0], Array(8).fill(0), [1, packet.length], packet)

/** An Opus file whose comments say where it was recorded. */
export const opus = (comments = ['LOCATION=51.5,-0.1']) =>
  bytes(oggPage(bytes('OpusHead', [1, 1, 0x38, 1, 0x80, 0xbb, 0, 0, 0, 0, 0])), oggPage(bytes('OpusTags', vorbisComments('Lavf61', comments))), oggPage(bytes([1, 2, 3])))
