import { css, hex, mix, shade } from './color.ts'
import { bakeText, textWidth } from './font.ts'
import { hash } from './math.ts'
import type { ScenePalette } from './palettes.ts'
import { drawBike } from './actors.ts'
import { pline } from './rig.ts'
import {
  BEACH_UMBRELLAS,
  BEECH_BRANCHES,
  BEECH_CROWN,
  BENCH,
  BIVACCO,
  BURROW,
  CAIRN,
  CEMBRA,
  CHURCH,
  CROSS,
  CYPRESS,
  FARMHOUSE,
  GRANITE,
  GRANITE_SMALL,
  HOUSE,
  LARCH_BRANCHES,
  LARCH_CROWN,
  NURAGHE,
  OLIVE,
  ORCHARD_BLOSSOM,
  ORCHARD_BRANCHES,
  ORCHARD_CROWN,
  REEDS,
  RIFUGIO,
  ROCKS,
  SHRUB,
  SPRUCE,
  SPRUCE_SMALL,
  UMBRELLA_PINE,
  bake,
  lightsFor,
  snowCap,
  snowFor,
  type Sprite,
} from './sprites.ts'
import type { Glow, Light, View } from './view.ts'
import { BRIDGE_HALF, WORLD_LEN, Z, type Prop } from './world.ts'

const BURROW_SNOW = snowCap(BURROW)
const SIGN_YELLOW = '#f2d14b'
const INK = '#1a1c2c'

export type PropCtx = {
  lights: Light[]
  glows: Glow[]
  /** Climber's trail position (0..1), to show/hide the parked bike. */
  f: number
  /** The windsurf board lies on the sand (ashore, or left there to go snorkelling). */
  boardAshore: boolean
  inHut: boolean
  holds: { x: number; done: boolean }[]
  showHolds: boolean
}

/** Where the hut's door is, relative to the prop x and the ground. */
export const HUT_DOOR = { dx: -1, dy: -5, w: 4, h: 5 }

function blit(s: CanvasRenderingContext2D, sprite: Sprite, sx: number, top: number, pal: ScenePalette | null, flip = false) {
  const c = bake(sprite, pal, flip)
  s.drawImage(c, Math.round(sx - sprite.w / 2), Math.round(top))
  return c
}

export function drawProps(s: CanvasRenderingContext2D, v: View, row: Prop['row'], pc: PropCtx) {
  const pal = row === 'back' ? v.paletteBack : v.palette
  for (const p of v.world.props) {
    if (p.row !== row) continue
    const half = p.kind === 'vines' || p.kind === 'drywall' ? (p.v ?? 20) : 50
    const sx = Math.round(p.x - v.camX)
    if (sx < -half || sx > v.W + half) continue
    const lift = row === 'back' ? -2 : row === 'front' ? 5 : 0
    const gy = v.groundY(p.x) + lift + (p.dy ?? 0)
    const coastal = p.x / WORLD_LEN < 0.2
    const snowy = !coastal && pal.treeSnow > 0
    const snowPal = v.world.permanentSnow(p.x) > 0.5 ? { ...pal, treeSnow: 1 } : pal
    const tree = (layers: Sprite[], snowOf: Sprite) => {
      const top = gy - layers[0].h
      for (const l of layers) blit(s, l, sx, top, pal, p.flip)
      if (snowy) blit(s, snowFor(snowOf), sx, top, pal, p.flip)
    }
    const building = (sprite: Sprite, glow = true) => {
      const top = gy - sprite.h + 1
      blit(s, sprite, sx, top, null, p.flip)
      if (snowPal.treeSnow > 0 && !coastal) blit(s, snowFor(sprite), sx, top, snowPal, p.flip)
      pc.lights.push({ c: bake(lightsFor(sprite), null, p.flip), x: Math.round(sx - sprite.w / 2), y: top })
      if (glow) pc.glows.push({ x: sx, y: top + sprite.h * 0.55, r: Math.max(12, sprite.w * 0.6), strength: 0.45, warm: true })
    }
    switch (p.kind) {
      case 'spruce':
        tree([SPRUCE], SPRUCE)
        break
      case 'spruceSmall':
        tree([SPRUCE_SMALL], SPRUCE_SMALL)
        break
      case 'beech':
        tree([BEECH_BRANCHES, BEECH_CROWN], BEECH_BRANCHES)
        break
      case 'larch':
        tree([LARCH_BRANCHES, LARCH_CROWN], LARCH_BRANCHES)
        break
      case 'cembra':
        tree([CEMBRA], CEMBRA)
        break
      case 'orchard':
        tree([ORCHARD_BRANCHES, ORCHARD_CROWN, ORCHARD_BLOSSOM], ORCHARD_BRANCHES)
        break
      case 'umbrellaPine':
        tree([UMBRELLA_PINE], UMBRELLA_PINE)
        break
      case 'olive':
        blit(s, OLIVE, sx, gy - OLIVE.h + 1, pal, p.flip)
        break
      case 'cypress':
        blit(s, CYPRESS, sx, gy - CYPRESS.h + 1, pal, p.flip)
        break
      case 'shrub':
        if (pal.groundSnow < 0.7 || coastal) blit(s, SHRUB, sx, gy - SHRUB.h + 1, pal, p.flip)
        break
      case 'reeds':
        blit(s, REEDS, sx, gy - REEDS.h + 1, pal, p.flip)
        break
      case 'rockSmall':
      case 'rockMedium':
      case 'boulder':
      case 'marker': {
        const sprite =
          p.kind === 'rockSmall' ? ROCKS.small : p.kind === 'rockMedium' ? ROCKS.medium : p.kind === 'boulder' ? ROCKS.boulder : ROCKS.marker
        blit(s, sprite, sx, gy - sprite.h + 2, pal, p.flip)
        if (snowPal.treeSnow > 0) blit(s, snowFor(sprite), sx, gy - sprite.h + 2, snowPal, p.flip)
        break
      }
      case 'granite': {
        const sprite = p.v ? GRANITE_SMALL : GRANITE
        blit(s, sprite, sx, gy - sprite.h + 2, null, p.flip)
        break
      }
      case 'cairn':
        blit(s, CAIRN, sx, gy - CAIRN.h + 1, null)
        break
      case 'burrow':
        blit(s, BURROW, sx, gy - BURROW.h + 2, null)
        if (pal.treeSnow > 0) blit(s, BURROW_SNOW, sx, gy - BURROW.h + 2, pal)
        break
      case 'beachUmbrella': {
        const sprite = BEACH_UMBRELLAS[p.v ?? 0]
        blit(s, sprite, sx, gy - sprite.h + 1, null, p.flip)
        break
      }
      case 'house':
        building(HOUSE)
        break
      case 'church':
        building(CHURCH)
        break
      case 'farmhouse':
        building(FARMHOUSE)
        break
      case 'nuraghe':
        blit(s, NURAGHE, sx, gy - NURAGHE.h + 1, null, p.flip)
        break
      case 'rifugio':
        building(RIFUGIO)
        drawHutDoor(s, sx, gy, pc)
        break
      case 'bivacco':
        building(BIVACCO, false)
        break
      case 'cross':
        blit(s, CROSS, sx, gy - CROSS.h + 1, null)
        break
      case 'bench':
        blit(s, BENCH, sx, gy - BENCH.h + 1, null)
        break
      case 'flag':
        drawFlag(s, v, sx, gy)
        break
      case 'sign':
        drawSign(s, v, sx, gy, p.text ?? [])
        break
      case 'serac':
        drawSerac(s, v, p, sx, gy)
        break
      case 'skis':
        drawSkiDepot(s, sx, gy)
        break
      case 'stream':
        drawBridge(s, v, p, sx)
        break
      case 'board':
        if (pc.boardAshore) drawBoard(s, sx, gy)
        break
      case 'parkedBike':
        if (pc.f < Z.bikeStart) drawBike(s, sx, v.groundY(p.x - 6), v.groundY(p.x + 6), 1, 0, null)
        break
      case 'bikeRack':
        drawRack(s, v, sx, gy)
        if (pc.f >= Z.bikeEnd) drawBike(s, sx, v.groundY(p.x - 6), v.groundY(p.x + 6), 1, 0, null)
        break
      case 'vines':
        drawVines(s, v, p, lift)
        break
      case 'drywall':
        drawDryWall(s, v, p)
        break
      case 'wand':
        drawWand(s, v, sx, gy, p.v ?? 0)
        break
      case 'glacierTable':
        drawGlacierTable(s, v, sx, gy, p.v ?? 0, p.flip)
        break
      case 'cornice':
        drawCornice(s, v, p)
        break
      case 'blaze':
        drawBlaze(s, v, p, sx)
        break
      case 'anchor':
        drawAnchor(s, sx, gy)
        break
      case 'ladder':
        drawLadder(s, v, p)
        break
      default:
        break
    }
  }
  if (row === 'mid' && pc.holds.length) drawHolds(s, v, pc)
}

function drawHutDoor(s: CanvasRenderingContext2D, sx: number, gy: number, pc: PropCtx) {
  if (!pc.inHut) return
  const x = sx + HUT_DOOR.dx
  const y = gy + HUT_DOOR.dy
  s.fillStyle = '#ffcd75'
  s.fillRect(x, y, HUT_DOOR.w, HUT_DOOR.h)
  s.fillStyle = '#f9a31b'
  s.fillRect(x, y + HUT_DOOR.h - 2, HUT_DOOR.w, 2)
  // Warm light spilling onto the ground.
  s.fillStyle = 'rgba(255,205,117,0.35)'
  s.fillRect(x - 2, gy + 1, HUT_DOOR.w + 4, 1)
  pc.glows.push({ x: x + 2, y: y + 2, r: 16, strength: 0.95, warm: true })
}

function drawFlag(s: CanvasRenderingContext2D, v: View, sx: number, gy: number) {
  s.fillStyle = '#c0c8d2'
  s.fillRect(sx, gy - 22, 1, 23)
  const wave = v.reducedMotion ? 0 : Math.floor(v.time * 3) % 2
  const cols = ['#38b764', '#38b764', '#f4f4f4', '#f4f4f4', '#b13e53', '#b13e53']
  cols.forEach((c, i) => {
    s.fillStyle = c
    s.fillRect(sx + 1 + i, gy - 22 + (i >= 4 ? wave : 0), 1, 4)
  })
}

function drawSign(s: CanvasRenderingContext2D, v: View, sx: number, gy: number, lines: string[]) {
  const postH = 5 + lines.length * 8
  s.fillStyle = css(v.palette.trunk)
  s.fillRect(sx, gy - postH, 1, postH + 1)
  lines.forEach((line, i) => {
    const bw = textWidth(line) + 4
    const by = gy - postH + i * 8
    const bx = sx - 2
    s.fillStyle = SIGN_YELLOW
    s.fillRect(bx, by, bw, 7)
    s.fillRect(bx + bw, by + 1, 1, 5)
    s.fillRect(bx + bw + 1, by + 2, 1, 3)
    s.fillStyle = 'rgba(26,28,44,0.35)'
    s.fillRect(bx, by + 7, bw, 1)
    s.drawImage(bakeText(line, INK), bx + 2, by + 1)
  })
}

/**
 * Seracs: towers of glacier ice, some leaning, with lit and shaded faces, layering and cracks, each
 * wearing a snow cap that overhangs its lee side like a little cornice, with icicles beneath.
 */
function drawSerac(s: CanvasRenderingContext2D, v: View, p: Prop, sx: number, gy: number) {
  const h = p.v ?? 14
  const pal = v.palette
  const lit = css(mix(pal.ice, hex('#ffffff'), 0.5))
  const face = css(mix(pal.ice, pal.iceDeep, 0.15))
  const shadow = css(mix(pal.ice, pal.iceDeep, 0.55))
  const band = css(mix(pal.ice, pal.iceDeep, 0.35))
  const crack = css(mix(pal.iceDeep, hex('#0d2440'), 0.35))
  const snow = css(pal.snow)
  const snowShade = css(pal.snowShade)
  const seed = Math.round(p.x)
  const blocks = 2 + Math.floor(hash(seed, 1) * 3)
  const widths = Array.from({ length: blocks }, (_, b) => 4 + Math.floor(hash(seed + b, 2) * 4))
  const capH = pal.groundSnow > 0.5 ? 2 : 1
  let x = sx - Math.round(widths.reduce((a, b) => a + b, 0) / 2)
  for (let b = 0; b < blocks; b++) {
    const bw = widths[b]
    const bh = Math.max(4, Math.round(h * (0.5 + 0.5 * hash(seed + b, 3))))
    const top = gy - bh
    // Taller towers lean a little; the upper half is shifted.
    const lean = bh > 9 && hash(seed + b, 4) < 0.4 ? (hash(seed + b, 8) < 0.5 ? -1 : 1) : 0
    const mid = top + Math.round(bh / 2)
    for (let i = 0; i < bw; i++) {
      const col = x + i
      s.fillStyle = i === 0 ? lit : i >= bw - 2 ? shadow : face
      s.fillRect(col + lean, top, 1, mid - top)
      s.fillRect(col, mid, 1, gy - mid + 1)
      s.fillStyle = band
      for (let y = top + 3 + (b & 1); y < gy - 1; y += 4) {
        if (hash(col, y) < 0.6) s.fillRect(col + (y < mid ? lean : 0), y, 1, 1)
      }
    }
    if (bw > 4 && hash(seed + b, 6) < 0.65) {
      const cx = x + 1 + Math.floor(hash(seed + b, 7) * (bw - 2))
      s.fillStyle = crack
      s.fillRect(cx + lean, top + 2, 1, Math.max(1, mid - top - 2))
      s.fillRect(cx, mid, 1, Math.round(bh * 0.25))
    }
    // Snow cap, overhanging the lee (right) side with a shaded underside and icicles.
    const lee = hash(seed + b, 9) < 0.6 ? 2 : 1
    const capX = x + lean - 1
    const capW = bw + 1 + lee
    s.fillStyle = snow
    s.fillRect(capX + 1, top - capH, capW - 2, 1)
    s.fillRect(capX, top - capH + 1, capW, capH)
    s.fillStyle = snowShade
    s.fillRect(capX, top + 1, 1, 1)
    s.fillRect(capX + capW - lee, top + 1, lee, 1)
    s.fillStyle = lit
    if (hash(seed + b, 10) < 0.7) s.fillRect(capX + capW - 1, top + 2, 1, 1 + (hash(seed + b, 11) < 0.4 ? 1 : 0))
    x += bw
  }
  // Ice chunks that have toppled off.
  s.fillStyle = lit
  for (let k = 0; k < 3; k++) {
    if (hash(seed + k, 12) < 0.5) continue
    const cx = sx + Math.round((hash(seed + k, 13) - 0.5) * (h + 10))
    s.fillRect(cx, gy - 1, 2, 1)
  }
}

/** A glacier table: a boulder left standing on a pedestal of ice that it shades from the sun. */
function drawGlacierTable(s: CanvasRenderingContext2D, v: View, sx: number, gy: number, variant: number, flip?: boolean) {
  const pal = v.palette
  const stem = variant ? 5 : 4
  const ice = css(mix(pal.ice, hex('#ffffff'), 0.35))
  const iceShade = css(mix(pal.ice, pal.iceDeep, 0.4))
  s.fillStyle = ice
  s.fillRect(sx - 2, gy - 1, 5, 2)
  s.fillRect(sx - 1, gy - stem, 3, stem)
  s.fillStyle = iceShade
  s.fillRect(sx + (flip ? -1 : 1), gy - stem, 1, stem + 1)
  // The slab of rock on top.
  const bw = variant ? 10 : 8
  const left = sx - (bw >> 1) + (flip ? 1 : 0)
  const top = gy - stem - 3
  s.fillStyle = css(pal.rock)
  s.fillRect(left, top, bw, 3)
  s.fillStyle = css(pal.rockLight)
  s.fillRect(left + 1, top, bw - 3, 1)
  s.fillStyle = css(pal.rockDark)
  s.fillRect(left, top + 2, bw, 1)
  s.fillRect(left + bw - 1, top + 1, 1, 1)
  if (pal.groundSnow > 0.5) {
    s.fillStyle = css(pal.snow)
    s.fillRect(left + 1, top - 1, bw - 2, 1)
  }
}

/**
 * The summit cornice: wind-packed snow building up along the crest and curling out over the north
 * face like a breaking wave. A hairline crack set back from the edge shows where it would break
 * off; the underside is in shadow, hung with icicles, and shades the rock below. Nobody walks out
 * onto it — the trail ends before.
 */
function drawCornice(s: CanvasRenderingContext2D, v: View, p: Prop) {
  const len = p.v ?? 22
  const back = 30
  const crest = 7
  const pal = v.palette
  const snow = css(pal.snow)
  const glint = css(mix(pal.snow, hex('#ffffff'), 0.7))
  const snowShade = css(pal.snowShade)
  const under = css(mix(pal.snowShade, hex('#5d7fa6'), 0.45))
  const hollow = css(mix(pal.snowShade, hex('#34507a'), 0.65))
  const ice = css(mix(pal.ice, hex('#ffffff'), 0.4))
  // A soft rim along the top keeps the white cornice readable against snowy peaks behind it.
  const rim = css(mix(pal.snowShade, hex('#5d7fa6'), 0.3), 0.7)
  const crestY = v.groundY(p.x - 1)
  for (let i = -back; i <= len; i++) {
    const x = Math.round(p.x + i - v.camX)
    if (x < -1 || x > v.W) continue
    if (i <= 0) {
      // The wind slab, thickening along the crest towards the edge, with wind ripples on top.
      const gy = v.groundY(p.x + i)
      const thick = Math.max(1, Math.round(crest * Math.pow((i + back) / back, 1.7)))
      s.fillStyle = rim
      s.fillRect(x, gy - thick - 1, 1, 1)
      s.fillStyle = snow
      s.fillRect(x, gy - thick, 1, thick)
      if (hash(i, 19) < 0.2) {
        s.fillStyle = glint
        s.fillRect(x, gy - thick, 1, 1)
      }
      if (i === -9) {
        // The crack where it would break away.
        s.fillStyle = under
        s.fillRect(x, gy - thick, 1, thick - 1)
      }
      continue
    }
    // The overhang rises a little, thins out and droops at the lip.
    const t = i / len
    const droop = t > 0.78 ? Math.round(((t - 0.78) / 0.22) * 2) : 0
    const top = crestY - crest - Math.round(Math.sin(t * Math.PI * 0.75) * 2) + droop
    const thick = Math.max(1, Math.round(crest * Math.pow(1 - t, 0.75)) + (t > 0.9 ? 0 : 1) - droop)
    s.fillStyle = rim
    s.fillRect(x, top - 1, 1, i === len ? thick + 1 : 1)
    s.fillStyle = snow
    s.fillRect(x, top, 1, thick)
    if (hash(i, 21) < 0.25) {
      s.fillStyle = glint
      s.fillRect(x, top, 1, 1)
    }
    s.fillStyle = t > 0.82 ? snowShade : under
    s.fillRect(x, top + thick, 1, 1)
    if (t < 0.6 && thick > 2) {
      s.fillStyle = hollow
      s.fillRect(x, top + thick - 1, 1, 1)
    }
    if (hash(i, 17) < 0.45 && t < 0.88) {
      s.fillStyle = ice
      s.fillRect(x, top + thick + 1, 1, 1 + Math.floor(hash(i, 18) * 3))
    }
    // Its shadow on the face below.
    s.fillStyle = 'rgba(26,36,70,0.28)'
    s.fillRect(x, v.groundY(p.x + i), 1, 5)
  }
}

/** Italian trail paint (red-white-red, as the CAI marks its paths) on the face of a rock step. */
function drawBlaze(s: CanvasRenderingContext2D, v: View, p: Prop, sx: number) {
  for (let i = 0; i < 2; i++) {
    const top = v.groundY(p.x + i) + 2
    s.fillStyle = '#d43a3a'
    s.fillRect(sx + i, top, 1, 1)
    s.fillRect(sx + i, top + 2, 1, 1)
    s.fillStyle = '#f4f4f4'
    s.fillRect(sx + i, top + 1, 1, 1)
  }
}

function drawSkiDepot(s: CanvasRenderingContext2D, sx: number, gy: number) {
  s.fillStyle = '#ef7d57'
  s.fillRect(sx - 2, gy - 13, 1, 13)
  s.fillRect(sx, gy - 13, 1, 13)
  s.fillStyle = '#f9a31b'
  s.fillRect(sx - 2, gy - 14, 1, 1)
  s.fillRect(sx, gy - 14, 1, 1)
  s.fillStyle = '#566c86'
  s.fillRect(sx + 3, gy - 11, 1, 11)
  s.fillRect(sx + 5, gy - 10, 1, 10)
}

/** A plank bridge. Its deck is the walking surface (see World.walkAltAt), so nobody wades the stream. */
function drawBridge(s: CanvasRenderingContext2D, v: View, p: Prop, sx: number) {
  const y = v.walkY(p.x)
  const h = BRIDGE_HALF
  s.fillStyle = css(v.palette.trunk)
  s.fillRect(sx - h, y, h * 2 + 1, 1)
  s.fillStyle = css(shade(v.palette.trunk, 0.7))
  s.fillRect(sx - h, y + 1, h * 2 + 1, 1)
  for (let x = sx - h + 2; x < sx + h; x += 4) s.fillRect(x, y, 1, 1)
  s.fillRect(sx - h + 1, y - 4, 1, 4)
  s.fillRect(sx + h - 1, y - 4, 1, 4)
  s.fillRect(sx - h + 1, y - 4, h * 2 - 1, 1)
  // Posts down to the stream bed.
  s.fillRect(sx - h + 3, y + 2, 1, Math.max(0, v.groundY(p.x - h + 3) - y - 2))
  s.fillRect(sx + h - 3, y + 2, 1, Math.max(0, v.groundY(p.x + h - 3) - y - 2))
}

/** The windsurf board and rig left on the sand. */
function drawBoard(s: CanvasRenderingContext2D, sx: number, gy: number) {
  s.fillStyle = '#ff3fa4'
  pline(s, sx - 10, gy - 1, sx + 7, gy - 3)
  s.fillStyle = '#41a6f6'
  pline(s, sx - 6, gy - 2, sx + 3, gy - 3)
  s.fillStyle = '#e8e8e8'
  pline(s, sx - 10, gy - 2, sx + 8, gy - 4)
  s.fillStyle = '#f4f4f4'
  s.fillRect(sx - 7, gy, 15, 1)
  s.fillStyle = '#ef7d57'
  s.fillRect(sx - 2, gy, 5, 1)
  s.fillStyle = '#1a1c2c'
  s.fillRect(sx - 6, gy - 1, 1, 1)
}

function drawRack(s: CanvasRenderingContext2D, v: View, sx: number, gy: number) {
  s.fillStyle = css(v.palette.trunk)
  s.fillRect(sx - 9, gy - 6, 1, 7)
  s.fillRect(sx + 9, gy - 6, 1, 7)
  s.fillRect(sx - 9, gy - 6, 19, 1)
  s.fillStyle = css(shade(v.palette.trunk, 0.7))
  s.fillRect(sx - 9, gy - 5, 19, 1)
}

function drawVines(s: CanvasRenderingContext2D, v: View, p: Prop, lift: number) {
  const w = p.v ?? 20
  const autumn = v.season === 'autumn'
  const leaf = autumn ? css(mix(v.palette.larch, hex('#b13e53'), 0.35)) : css(shade(v.palette.leaf, 0.9))
  const leafLight = autumn ? css(v.palette.larchLight) : css(v.palette.leafLight)
  const trunk = css(v.palette.trunk)
  const x0 = Math.round(p.x - w / 2)
  for (let i = 0; i < w; i++) {
    const x = x0 + i - v.camX
    const gy = v.groundY(x0 + i) + lift
    if (i % 5 === 0) {
      s.fillStyle = trunk
      s.fillRect(x, gy - 6, 1, 7)
    }
    const h = 3 + (hash(i, 31) < 0.4 ? 1 : 0)
    s.fillStyle = leaf
    s.fillRect(x, gy - 2 - h, 1, h)
    if (hash(i, 32) < 0.35) {
      s.fillStyle = leafLight
      s.fillRect(x, gy - 2 - h, 1, 1)
    }
    if (hash(i, 33) < 0.18) {
      s.fillStyle = '#5a2d6e'
      s.fillRect(x, gy - 3, 1, 2)
    }
  }
}

function drawDryWall(s: CanvasRenderingContext2D, v: View, p: Prop) {
  const w = p.v ?? 14
  const seed = Math.round(p.x)
  const x0 = Math.round(p.x - w / 2)
  const tones = ['#b9b3a6', '#9d968a', '#d2ccbf', '#8a8378']
  for (let i = 0; i < w; i++) {
    const gy = v.groundY(x0 + i)
    const top = gy - 3 + (hash(i >> 1, seed) < 0.3 ? 1 : 0)
    for (let y = top; y <= gy; y++) {
      s.fillStyle = tones[Math.floor(hash((i >> 1) * 7 + (y - top), seed + 3) * 4)]
      s.fillRect(x0 + i - v.camX, y, 1, 1)
    }
  }
}

/** A bamboo marker wand with a little flag, the kind that marks a safe line across a glacier. */
function drawWand(s: CanvasRenderingContext2D, v: View, sx: number, gy: number, variant: number) {
  s.fillStyle = '#8a6a3a'
  s.fillRect(sx, gy - 10, 1, 11)
  const flutter = v.reducedMotion ? 0 : Math.floor(v.time * 4 + sx) % 2
  s.fillStyle = variant ? '#ef7d57' : '#b13e53'
  s.fillRect(sx + 1, gy - 10, 2, 2)
  s.fillRect(sx + 3, gy - 10 + flutter, 1, 1)
}

function drawAnchor(s: CanvasRenderingContext2D, sx: number, gy: number) {
  s.fillStyle = '#c0c8d2'
  s.fillRect(sx - 1, gy - 1, 1, 1)
  s.fillRect(sx + 2, gy - 1, 1, 1)
  s.fillStyle = '#b13e53'
  pline(s, sx - 1, gy - 1, sx, gy + 1)
  pline(s, sx + 2, gy - 1, sx + 1, gy + 1)
  s.fillStyle = '#566c86'
  s.fillRect(sx, gy + 1, 2, 1)
}

/** An aluminium ladder across the big crevasse, with a sagging hand line. */
function drawLadder(s: CanvasRenderingContext2D, v: View, p: Prop) {
  const len = Math.round(p.v ?? 18)
  const x0 = Math.round(p.x - v.camX) - 3
  const x1 = x0 + len + 6
  const y = v.groundY(p.x - 3) - 1
  s.fillStyle = '#c0c8d2'
  s.fillRect(x0, y, x1 - x0, 1)
  s.fillStyle = '#94b0c2'
  s.fillRect(x0, y + 1, x1 - x0, 1)
  s.fillStyle = '#566c86'
  for (let x = x0 + 1; x < x1; x += 3) s.fillRect(x, y, 1, 2)
  // Stakes and a hand line.
  s.fillStyle = '#ef7d57'
  s.fillRect(x0 - 2, y - 6, 1, 7)
  s.fillRect(x1 + 1, y - 6, 1, 7)
  for (let x = x0 - 1; x <= x1; x++) {
    const t = (x - x0 + 1) / (x1 - x0 + 2)
    s.fillRect(x, y - 6 + Math.round(Math.sin(t * Math.PI) * 2), 1, 1)
  }
}

/** Climbing holds on the wall: glowing until tapped, chalked once done. */
function drawHolds(s: CanvasRenderingContext2D, v: View, pc: PropCtx) {
  const pulse = v.reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(v.time * 5)
  for (const h of pc.holds) {
    const x = Math.round(h.x - v.camX)
    if (x < -4 || x > v.W + 4) continue
    const y = v.groundY(h.x) + 1
    if (h.done) {
      s.fillStyle = '#38b764'
      s.fillRect(x - 1, y, 2, 2)
      s.fillStyle = '#f4f4f4'
      s.fillRect(x - 1, y, 1, 1)
    } else {
      if (pc.showHolds) {
        s.fillStyle = `rgba(255,205,117,${(0.25 + pulse * 0.35).toFixed(2)})`
        s.fillRect(x - 3, y - 2, 6, 6)
      }
      s.fillStyle = pulse > 0.5 ? '#ffcd75' : '#f9a31b'
      s.fillRect(x - 1, y, 2, 2)
      if (pc.showHolds) pc.glows.push({ x, y: y + 1, r: 6, strength: 0.8, warm: true })
    }
  }
}
