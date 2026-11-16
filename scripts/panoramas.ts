/**
 * Builds the trail's 360° photographs. Run with `npm run panoramas`; the output is committed.
 *
 * For every scene and time-of-day variant in src/content/trail.ts it takes the photo (a CC0 panorama
 * from Poly Haven, downloaded once into node_modules/.cache, or an equirectangular photo of your own)
 * and writes into src/assets/trail/ (the build fingerprints them, so they can be cached for good):
 *
 *   <key>.webp          4096×2048, the full view
 *   <key>.preview.webp  1024×512, shown at once while the full view loads
 *   <key>.card.webp     1280×720, a flat "postcard" of a scene's default view (trail map, simple view)
 *
 * Location, camera and editing metadata are never copied across. Needs ImageMagick 7 (`magick`),
 * `cwebp` and `ffmpeg` on PATH.
 *
 *   node scripts/panoramas.ts                  everything that's missing
 *   node scripts/panoramas.ts --force          everything, again
 *   node scripts/panoramas.ts beach lake       only these scenes (and their variants)
 *   node scripts/panoramas.ts --cards          only the postcards (after changing a scene's view)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PHOTOS, type PhotoJob } from '../src/content/trail.ts'

const OUT = path.resolve('src/assets/trail')
const CACHE = path.resolve('node_modules/.cache/panoramas')
const WIDTH = 4096
const POLY_HAVEN = (id: string) => `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${id}.jpg`

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  if (result.error) throw new Error(`${cmd} is needed (${result.error.message})`)
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr.toString().trim()}`)
}

/** The full-size source photo on disk: your own file, or a Poly Haven download (cached). */
async function source(job: PhotoJob) {
  if (job.photo.file) return path.resolve(job.photo.file)
  const id = job.photo.polyhaven
  if (!id) throw new Error(`${job.key}: a photo needs \`polyhaven\` or \`file\``)
  const file = path.join(CACHE, `${id}.jpg`)
  if (existsSync(file)) return file
  console.log(`  downloading ${id} from Poly Haven…`)
  const res = await fetch(POLY_HAVEN(id))
  if (!res.ok) throw new Error(`${id}: download failed (${res.status})`)
  await mkdir(CACHE, { recursive: true })
  await writeFile(`${file}.part`, Buffer.from(await res.arrayBuffer()))
  await rm(file, { force: true })
  run('mv', [`${file}.part`, file])
  return file
}

const kb = async (file: string) => `${Math.round((await stat(file)).size / 1024)} kB`

async function build(job: PhotoJob, { force, cardsOnly }: { force: boolean; cardsOnly: boolean }) {
  const full = path.join(OUT, `${job.key}.webp`)
  const preview = path.join(OUT, `${job.key}.preview.webp`)
  const card = path.join(OUT, `${job.key}.card.webp`)
  if (cardsOnly && !job.card) return
  const needed = cardsOnly ? [card] : [full, preview, ...(job.card ? [card] : [])]
  if (!force && !cardsOnly && needed.every((f) => existsSync(f))) return
  console.log(`${job.key}`)
  const src = await source(job)
  const tmp = path.join(CACHE, `${job.key}.${process.pid}`)
  await mkdir(CACHE, { recursive: true })
  try {
    // Turning a panorama about the vertical axis is just a sideways shift of its columns.
    const shift = Math.round((((job.photo.rotate ?? 0) % 360) / 360) * 8192)
    run('magick', [src, '-resize', '8192x4096!', ...(shift ? ['-roll', `${shift >= 0 ? '+' : ''}${shift}+0`] : []), '-strip', `${tmp}.8k.png`])
    if (!cardsOnly) {
      run('magick', [`${tmp}.8k.png`, '-filter', 'Lanczos', '-resize', `${WIDTH}x${WIDTH / 2}!`, '-strip', `${tmp}.full.png`])
      run('cwebp', ['-quiet', '-q', '80', '-m', '6', '-sharp_yuv', '-metadata', 'none', `${tmp}.full.png`, '-o', full])
      run('magick', [`${tmp}.full.png`, '-filter', 'Lanczos', '-resize', '1024x512!', '-strip', `${tmp}.preview.png`])
      run('cwebp', ['-quiet', '-q', '72', '-m', '6', '-sharp_yuv', '-metadata', 'none', `${tmp}.preview.png`, '-o', preview])
    }
    if (job.card) {
      const { yaw, pitch, fov = 80 } = job.card
      const vfov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (9 / 16)) * 180) / Math.PI
      const v360 = `v360=input=e:output=flat:h_fov=${fov}:v_fov=${vfov.toFixed(3)}:yaw=${yaw}:pitch=${pitch}:w=1280:h=720:interp=lanczos`
      run('ffmpeg', ['-v', 'error', '-y', '-i', `${tmp}.8k.png`, '-vf', v360, '-frames:v', '1', `${tmp}.card.png`])
      run('cwebp', ['-quiet', '-q', '76', '-m', '6', '-sharp_yuv', '-metadata', 'none', `${tmp}.card.png`, '-o', card])
    }
    const sizes = [...(cardsOnly ? [] : [`${await kb(full)} full`, `${await kb(preview)} preview`]), ...(job.card ? [`${await kb(card)} card`] : [])]
    console.log(`  ${sizes.join(' · ')}`)
  } finally {
    for (const suffix of ['8k', 'full', 'preview', 'card']) await rm(`${tmp}.${suffix}.png`, { force: true })
  }
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const cardsOnly = args.includes('--cards')
  const only = new Set(args.filter((a) => !a.startsWith('--')))
  const jobs = PHOTOS.filter((job) => !only.size || only.has(job.scene) || only.has(job.key))
  if (only.size && !jobs.length) throw new Error(`No scene or variant called ${[...only].join(', ')}`)
  await mkdir(OUT, { recursive: true })
  for (const job of jobs) await build(job, { force, cardsOnly })
  console.log(`panoramas: ${jobs.length} photo${jobs.length === 1 ? '' : 's'} in ${path.relative(process.cwd(), OUT)}/`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await main().catch((error: Error) => {
    console.error(error.message)
    process.exit(1)
  })
}
