/**
 * The trail: every place you can stand, what you see there, and how the places connect.
 *
 * Each scene is a 360° photograph (equirectangular, 2:1). Directions in a photo are given as
 * `yaw` (degrees; 0 is the middle of the photo, positive to the right, ±180 its left/right edges)
 * and `pitch` (degrees; 0 is the horizon, +90 straight up). `npm run panoramas` turns the photos
 * named here into the files in src/assets/trail/.
 *
 * The photographs are CC0 panoramas from Poly Haven (polyhaven.com), standing in for the places in
 * the story; each scene says where its photo was really taken. Swap in your own 360° photos with
 * `file:` (an equirectangular JPEG from a 360 camera or a phone's panorama mode).
 */
import type { Season } from '../lib/logbookCore.ts'

export type SceneId =
  | 'beach'
  | 'cove'
  | 'orchard'
  | 'valley'
  | 'forest'
  | 'stream'
  | 'hut'
  | 'inside'
  | 'rocks'
  | 'lake'
  | 'summit'
  | 'bivouac'
  | 'home'

export type TimeOfDay = 'sunrise' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'dusk' | 'night' | 'evening'

/** What's underfoot, for the footsteps. */
export type Ground = 'sand' | 'grass' | 'earth' | 'gravel' | 'rock' | 'wood' | 'tiles' | 'pavement'

/** A direction in a scene's photo, in degrees. */
export type Dir = { yaw: number; pitch: number }

export type Photo = {
  /** A CC0 panorama on polyhaven.com (its id)… */
  polyhaven?: string
  /** …or an equirectangular photo of your own (path from the project root). */
  file?: string
  title: string
  authors: string[]
  /** Where the photo was really taken. */
  where?: string
  /** Degrees to turn the photo, to line up time-of-day variants taken from the same spot. */
  rotate?: number
}

export type Bird = 'songbird' | 'blackbird' | 'cuckoo' | 'skylark' | 'gull' | 'chough' | 'woodpigeon' | 'robin' | 'owl' | 'woodpecker'

/** The sounds of a place, made up live in the browser (see src/engine/audio). Directions are yaws. */
export type Ambience = {
  /** How the place echoes. */
  space: 'open' | 'forest' | 'valley' | 'room' | 'street'
  /** 0–1 */
  wind: number
  /** Leaves and grass moving in the wind, 0–1. */
  leaves?: number
  waves?: { at: number; level: number }
  stream?: { at: number; level: number }
  lapping?: { at: number; level: number }
  birds?: Bird[]
  insects?: ('cicadas' | 'crickets' | 'bees')[]
  cowbells?: { at: number; level: number }
  marmots?: boolean
  fire?: { at: number; level: number }
  /** Murmur of a busy room, clinks and footsteps on wooden floors. */
  hut?: boolean
  rain?: number
  traffic?: number
}

export type Particles = 'dust' | 'pollen' | 'midges' | 'seeds' | 'diamond-dust' | 'drizzle' | 'embers' | 'meteors' | 'none'

export type Weather = {
  particles: Particles
  /** Water that glitters and moves: angular boxes in the photo. */
  water?: { yaw: [number, number]; pitch: [number, number]; strength?: number }[]
}

/** A light touch on a photo's look: brightness (1 = as photographed) and colour (1 = as photographed). */
export type Grade = { exposure?: number; saturation?: number }

export type Variant = {
  key: string
  time: TimeOfDay
  label: string
  photo: Photo
  grade?: Grade
  sun?: Dir & { strength?: number }
  ambience?: Partial<Ambience>
  weather?: Partial<Weather>
}

export type Link = {
  to: SceneId
  /** Which way to walk, in this scene's photo. */
  yaw: number
  /** Which way you face on arrival (defaults to the opposite of the way back). */
  arrive?: number
  label: string
  /** Metres walked, for the walking animation. */
  distance?: number
  /** A door (a short step), or a journey (the scene fades rather than walks). */
  kind?: 'path' | 'door' | 'travel'
  /** A detour: never suggested as the way on. */
  side?: boolean
}

export type NoteId =
  | 'hello'
  | 'sardinia'
  | 'windsurf'
  | 'places'
  | 'gravel'
  | 'work'
  | 'rucksack'
  | 'ideas'
  | 'hut'
  | 'logbook'
  | 'talk'
  | 'rock'
  | 'ski'
  | 'summits'
  | 'summit-book'
  | 'night'
  | 'home'

/** A note I left on the trail: a pin in the photo that opens a card about me. */
export type Note = { id: NoteId; at: Dir; label: string }

/** Something real in the photo worth spotting, for the field guide. */
export type Spot = {
  id: string
  at: Dir
  /** How close (degrees) you need to look. */
  radius: number
  name: string
  latin?: string
  fact: string
  /** Shown in the field guide before it's found. */
  hint: string
  /** Only there at one time of day (a variant's key). */
  variant?: string
}

export type Scene = {
  id: SceneId
  name: string
  /** One line for the trail map. */
  blurb: string
  /** What you see, in words: for screen readers and the simple view. */
  description: string
  /** Metres, as the story goes (not the photo's real altitude). */
  elevation: number
  season: Season
  time: TimeOfDay
  photo: Photo
  /** Other times of day, photographed from the same spot (the first is the scene itself). */
  variants?: Variant[]
  /** The view you get when you arrive without walking (and the postcard). */
  view: Dir & { fov?: number }
  /** Yaw of north, for the compass. */
  north: number
  sun?: Dir & { strength?: number }
  /** Eye height and a rough distance to things around (metres), for the sense of depth while walking. */
  eye?: number
  radius?: number
  ground: Ground
  weather: Weather
  ambience: Ambience
  links: Link[]
  notes: Note[]
  spots: Spot[]
  /** Where blog posts are pinned, like waymarks along the path. */
  waymarks: Dir[]
}

const photo = (polyhaven: string, title: string, authors: string[], where?: string, rotate?: number): Photo => ({ polyhaven, title, authors, where, rotate })
const AM = ['Andreas Mischok']
const GZ_JG = ['Greg Zaal', 'Jarod Guest']
const QWANTANI = 'the Drakensberg foothills, South Africa'

export const SCENES: Scene[] = [
  {
    id: 'beach',
    name: 'The beach',
    blurb: 'Where the walk begins: warm sand, stone pines, the sea at your back.',
    description:
      'A wide sandy beach in the afternoon sun. Behind you the sea runs along the horizon; ahead, umbrella-shaped stone pines and palms, with a rocky headland rising on either side.',
    elevation: 0,
    season: 'summer',
    time: 'afternoon',
    photo: photo('spiaggia_di_mondello', 'Spiaggia di Mondello', AM, 'Mondello, near Palermo, Sicily'),
    view: { yaw: -30, pitch: 5, fov: 80 },
    north: 160,
    sun: { yaw: 40, pitch: 25 },
    radius: 40,
    ground: 'sand',
    weather: {
      particles: 'none',
      water: [
        { yaw: [-180, -100], pitch: [-6, 0] },
        { yaw: [138, 180], pitch: [-6, 0] },
      ],
    },
    ambience: { space: 'open', wind: 0.35, waves: { at: 180, level: 0.8 }, birds: ['gull'], insects: ['cicadas'] },
    links: [
      { to: 'orchard', yaw: -5, label: 'Inland, under the pines', distance: 9 },
      { to: 'cove', yaw: -150, arrive: 20, label: 'Along the shore to the cove', distance: 9, side: true },
    ],
    notes: [
      { id: 'hello', at: { yaw: -22, pitch: -9 }, label: 'Hello!' },
      { id: 'sardinia', at: { yaw: 172, pitch: -3 }, label: 'Why the sea' },
    ],
    spots: [
      {
        id: 'stone-pine',
        at: { yaw: -15, pitch: 14 },
        radius: 9,
        name: 'Stone pine',
        latin: 'Pinus pinea',
        fact: 'The umbrella pine of Mediterranean coasts. Its seeds are the pine nuts that go into pesto, and they take three years to ripen in the cone.',
        hint: 'Look for a tree shaped like an umbrella.',
      },
      {
        id: 'pellegrino',
        at: { yaw: -72, pitch: 7 },
        radius: 8,
        name: 'Monte Pellegrino',
        fact: 'The limestone headland above Palermo. Goethe, visiting in 1787, called it the most beautiful promontory in the world.',
        hint: 'A rocky headland, inland and to the left.',
      },
      {
        id: 'horizon',
        at: { yaw: -150, pitch: -0.5 },
        radius: 10,
        name: 'The horizon',
        fact: 'From eye height, about 1.6 m, the sea horizon is only some 4.5 km away: the Earth curves out of sight beyond it.',
        hint: 'Turn round and look out to sea.',
      },
    ],
    waymarks: [
      { yaw: -45, pitch: -6 },
      { yaw: 65, pitch: -6 },
      { yaw: 135, pitch: -5 },
    ],
  },
  {
    id: 'cove',
    name: 'The cove',
    blurb: 'A sheltered cove of granite boulders and clear water, just along the shore.',
    description:
      'A small sandy cove shut in by rounded granite boulders and scrubby trees. The water is clear and calm in the morning sun, and a long strand of kelp lies on the sand at your feet.',
    elevation: 0,
    season: 'summer',
    time: 'morning',
    photo: photo('secluded_beach', 'Secluded Beach', ['Greg Zaal', 'Rico Cilliers'], 'the Cape Peninsula, South Africa'),
    view: { yaw: 15, pitch: -3, fov: 85 },
    north: -85,
    sun: { yaw: 50, pitch: 32 },
    radius: 18,
    ground: 'sand',
    weather: { particles: 'none', water: [{ yaw: [-50, 88], pitch: [-28, -1] }] },
    ambience: { space: 'open', wind: 0.25, lapping: { at: 20, level: 0.6 }, waves: { at: 30, level: 0.35 }, birds: ['gull'], insects: ['cicadas'] },
    links: [{ to: 'beach', yaw: -105, label: 'Back along the shore', distance: 9 }],
    notes: [{ id: 'windsurf', at: { yaw: 32, pitch: -10 }, label: 'On the water' }],
    spots: [
      {
        id: 'kelp',
        at: { yaw: 25, pitch: -55 },
        radius: 10,
        name: 'Sea bamboo kelp',
        latin: 'Ecklonia maxima',
        fact: 'A kelp that grows in underwater forests over 10 m tall. A gas-filled bulb at the top of its long stalk floats the fronds up into the light.',
        hint: 'Something washed up, right at your feet.',
      },
      {
        id: 'granite',
        at: { yaw: 3, pitch: 3 },
        radius: 7,
        name: 'Granite boulders',
        fact: 'Granite cools slowly, deep underground. Once it is exposed, water works along its cracks and wears the corners away first, which leaves rounded boulders like these.',
        hint: 'The big round rocks across the water.',
      },
      {
        id: 'turquoise',
        at: { yaw: 20, pitch: -15 },
        radius: 12,
        name: 'Clear water',
        fact: 'Why turquoise? Water soaks up red light, and pale sand reflects back what is left: blues and greens. The shallower and whiter the bottom, the brighter the colour.',
        hint: 'Look down into the shallows.',
      },
    ],
    waymarks: [
      { yaw: -70, pitch: -5 },
      { yaw: 115, pitch: -4 },
    ],
  },
  {
    id: 'orchard',
    name: 'The orchard',
    blurb: 'Old fruit trees in long grass, on the way inland.',
    description:
      'An old orchard meadow on a summer afternoon: rows of fruit trees with lengthening shadows, half-mown grass, and big fair-weather clouds drifting over.',
    elevation: 120,
    season: 'summer',
    time: 'afternoon',
    photo: photo('dry_orchard_meadow', 'Dry Orchard Meadow', ['Alexander Scholten']),
    view: { yaw: -20, pitch: 6, fov: 85 },
    north: 142,
    sun: { yaw: 22, pitch: 20, strength: 0.8 },
    radius: 25,
    ground: 'grass',
    weather: { particles: 'seeds' },
    ambience: { space: 'open', wind: 0.35, leaves: 0.45, birds: ['songbird', 'skylark'], insects: ['bees', 'crickets'] },
    links: [
      { to: 'beach', yaw: -135, label: 'Back to the sea' },
      { to: 'valley', yaw: 55, label: 'On towards the mountains', distance: 10 },
    ],
    notes: [
      { id: 'places', at: { yaw: 30, pitch: -7 }, label: 'Places that shaped me' },
      { id: 'gravel', at: { yaw: 150, pitch: -8 }, label: 'Two wheels' },
    ],
    spots: [
      {
        id: 'cumulus',
        at: { yaw: -25, pitch: 42 },
        radius: 12,
        name: 'Fair-weather cumulus',
        fact: 'Sun-warmed air rises in bubbles, and its moisture condenses where it has cooled enough: that height is the flat base of every cloud. While they stay small and puffy, the weather holds.',
        hint: 'Up in the sky, the biggest cloud.',
      },
      {
        id: 'orchard-meadow',
        at: { yaw: -95, pitch: 8 },
        radius: 10,
        name: 'Orchard meadow',
        fact: 'Tall old fruit trees scattered over unploughed grass are one of Central Europe’s richest habitats: thousands of species, from owls and bats to beetles living in the old wood.',
        hint: 'A lone tree, off to the left.',
      },
    ],
    waymarks: [
      { yaw: -60, pitch: -5 },
      { yaw: 95, pitch: -4 },
    ],
  },
  {
    id: 'valley',
    name: 'The valley',
    blurb: 'A wide green valley floor, the first real mountains all around.',
    description:
      'A broad meadow in an Alpine valley on a spring morning. Forested slopes rise on every side to rocky tops still streaked with snow; a village church stands at the far end, and a contrail arcs across the sky.',
    elevation: 950,
    season: 'spring',
    time: 'morning',
    photo: photo('alps_field', 'Alps Field', AM, 'Graubünden, Switzerland'),
    view: { yaw: 10, pitch: 8, fov: 85 },
    north: -95,
    sun: { yaw: 35, pitch: 40 },
    radius: 60,
    ground: 'grass',
    weather: { particles: 'pollen' },
    ambience: { space: 'valley', wind: 0.3, leaves: 0.2, birds: ['skylark', 'songbird', 'cuckoo'], cowbells: { at: -40, level: 0.55 }, insects: ['bees'] },
    links: [
      { to: 'orchard', yaw: -145, label: 'Back down to the orchard' },
      { to: 'forest', yaw: 150, label: 'Up into the forest', distance: 10 },
    ],
    notes: [{ id: 'work', at: { yaw: 25, pitch: -8 }, label: 'What I do' }],
    spots: [
      {
        id: 'contrail',
        at: { yaw: -55, pitch: 42 },
        radius: 12,
        name: 'Contrail',
        fact: 'Water vapour from jet engines, frozen into ice crystals 10 km up. When trails linger and spread like this one, the high air is moist: often a sign the weather is about to change.',
        hint: 'A long white curve across the sky.',
      },
      {
        id: 'larch-slopes',
        at: { yaw: -160, pitch: 9 },
        radius: 10,
        name: 'Bare larches',
        latin: 'Larix decidua',
        fact: 'The brownish patches among the dark spruces are larches: conifers that drop all their needles in autumn. They green up in late spring, and turn gold in October.',
        hint: 'Brown patches in the forest on the slopes behind you.',
      },
      {
        id: 'late-snow',
        at: { yaw: 105, pitch: 7 },
        radius: 7,
        name: 'Late snow',
        fact: 'Snow lasts into summer on north-facing slopes and in gullies, where the sun hardly reaches. Skiers chase it; walkers check it before crossing.',
        hint: 'A snowy peak at the far end of the valley.',
      },
    ],
    waymarks: [
      { yaw: -60, pitch: -5 },
      { yaw: 70, pitch: -5 },
      { yaw: -110, pitch: -5 },
    ],
  },
  {
    id: 'forest',
    name: 'The forest',
    blurb: 'Tall spruces and sandstone towers, the sun slanting through.',
    description:
      'A shady spruce forest on a summer morning. The path winds between mossy roots and sandstone towers; cones litter the ground, and the sun comes through the canopy in patches.',
    elevation: 1300,
    season: 'summer',
    time: 'morning',
    photo: photo('forest_slope', 'Forest Slope', AM, 'Saxon Switzerland, Germany'),
    view: { yaw: 30, pitch: 8, fov: 85 },
    north: -68,
    sun: { yaw: 32, pitch: 45, strength: 0.6 },
    radius: 14,
    ground: 'earth',
    weather: { particles: 'dust' },
    ambience: { space: 'forest', wind: 0.3, leaves: 0.5, birds: ['songbird', 'blackbird', 'cuckoo', 'woodpecker'] },
    links: [
      { to: 'valley', yaw: -110, label: 'Back down to the valley' },
      { to: 'stream', yaw: 85, label: 'On to the stream', distance: 9 },
    ],
    notes: [{ id: 'rucksack', at: { yaw: 55, pitch: -12 }, label: 'What’s in my rucksack' }],
    spots: [
      {
        id: 'sandstone',
        at: { yaw: 45, pitch: 12 },
        radius: 10,
        name: 'Sandstone towers',
        fact: 'This rock was laid down as sand on the floor of a shallow sea about 100 million years ago. Rain, frost and roots have been carving it into towers ever since.',
        hint: 'A wall of layered rock among the trees.',
      },
      {
        id: 'spruce-cones',
        at: { yaw: -40, pitch: -52 },
        radius: 10,
        name: 'Spruce cones',
        latin: 'Picea abies',
        fact: 'Spruce cones hang down and fall whole, so the forest floor is full of them. Fir cones stand upright and fall apart on the branch: you rarely find one.',
        hint: 'Look down at the forest floor.',
      },
      {
        id: 'shallow-roots',
        at: { yaw: 60, pitch: -45 },
        radius: 10,
        name: 'Shallow roots',
        fact: 'Spruces spread their roots through the top half-metre of soil. It is why they are the first trees to blow over in a storm.',
        hint: 'Roots crossing the path.',
      },
    ],
    waymarks: [
      { yaw: 15, pitch: -12 },
      { yaw: -150, pitch: -8 },
      { yaw: 125, pitch: -8 },
    ],
  },
  {
    id: 'stream',
    name: 'The stream',
    blurb: 'A mossy stream under a tangle of trees, crossed on stepping stones.',
    description:
      'A narrow stream runs over mossy boulders and pebbles beneath a dense, damp canopy. Ferns grow along the banks, and a flat stone makes a step across the water.',
    elevation: 1450,
    season: 'spring',
    time: 'afternoon',
    photo: photo('mossy_forest', 'Mossy Forest', ['Greg Zaal'], 'the Drakensberg, South Africa'),
    view: { yaw: -30, pitch: -10, fov: 85 },
    north: -5,
    sun: { yaw: -140, pitch: 35, strength: 0.2 },
    radius: 10,
    ground: 'rock',
    weather: { particles: 'midges', water: [{ yaw: [-178, 12], pitch: [-62, -18] }] },
    ambience: { space: 'forest', wind: 0.15, leaves: 0.3, stream: { at: -60, level: 0.85 }, birds: ['songbird', 'blackbird'] },
    links: [
      { to: 'forest', yaw: -110, label: 'Back to the forest' },
      { to: 'hut', yaw: 88, arrive: -100, label: 'Up to the hut', distance: 10 },
    ],
    notes: [{ id: 'ideas', at: { yaw: 45, pitch: -18 }, label: 'Ideas I keep coming back to' }],
    spots: [
      {
        id: 'moss',
        at: { yaw: 25, pitch: -25 },
        radius: 10,
        name: 'Moss',
        fact: 'Mosses have no real roots: they soak up water through their leaves. So they thrive where the air stays damp, on shady stones by a stream.',
        hint: 'A big green boulder.',
      },
      {
        id: 'ferns',
        at: { yaw: 50, pitch: -14 },
        radius: 9,
        name: 'Ferns',
        fact: 'Ferns were here long before flowers. They spread by spores, not seeds: a way of life more than 350 million years old.',
        hint: 'Feathery leaves on the bank.',
      },
    ],
    waymarks: [
      { yaw: 0, pitch: -14 },
      { yaw: 130, pitch: -12 },
      { yaw: -150, pitch: -10 },
    ],
  },
  {
    id: 'hut',
    name: 'The hut',
    blurb: 'A wooden hut on a deck above the trees. The logbook is inside.',
    description:
      'A wooden hut on a timber deck high above a forested valley, at sunset. The light is fading over the hills, and the hut’s glass doors stand open.',
    elevation: 2100,
    season: 'autumn',
    time: 'sunset',
    photo: photo('treetop_balcony', 'Treetop Balcony', ['Dimitrios Savva', 'Jarod Guest'], 'the Garden Route, South Africa'),
    view: { yaw: -110, pitch: 2, fov: 90 },
    north: 110,
    sun: { yaw: 10, pitch: 3, strength: 0.6 },
    radius: 12,
    ground: 'wood',
    weather: { particles: 'midges' },
    ambience: { space: 'valley', wind: 0.3, leaves: 0.3, birds: ['blackbird', 'songbird'], insects: ['crickets'] },
    links: [
      { to: 'stream', yaw: -45, label: 'Back down the steps' },
      { to: 'inside', yaw: -150, label: 'Step inside the hut', kind: 'door', distance: 5 },
      { to: 'rocks', yaw: 125, label: 'The fork: over the rocks', distance: 10 },
      { to: 'lake', yaw: 70, label: 'The fork: round the lake', distance: 10 },
    ],
    notes: [{ id: 'hut', at: { yaw: -115, pitch: -4 }, label: 'The hut' }],
    spots: [
      {
        id: 'sunset-colours',
        at: { yaw: 10, pitch: 4 },
        radius: 10,
        name: 'Sunset colours',
        fact: 'Near the horizon, sunlight crosses almost 40 times more air than at noon. Most of the blue is scattered away on the way, leaving yellows, oranges and reds.',
        hint: 'The brightest part of the sky.',
      },
    ],
    waymarks: [
      { yaw: -80, pitch: -18 },
      { yaw: 160, pitch: -15 },
    ],
  },
  {
    id: 'inside',
    name: 'Inside the hut',
    blurb: 'Long tables, a wood fire and the logbook: every blog post is in here.',
    description:
      'The hut’s dining room in the evening: long wooden tables and benches, wicker chairs, cowhide rugs on a terracotta floor, and a wood fire burning in a stone fireplace under the timber roof.',
    elevation: 2100,
    season: 'autumn',
    time: 'evening',
    photo: photo('warm_restaurant_night', 'Warm Restaurant Night', GZ_JG, 'the Drakensberg, South Africa'),
    view: { yaw: -155, pitch: -6, fov: 90 },
    north: 0,
    eye: 1.5,
    radius: 7,
    ground: 'tiles',
    weather: { particles: 'dust' },
    ambience: { space: 'room', wind: 0.05, fire: { at: -170, level: 0.7 }, hut: true },
    links: [{ to: 'hut', yaw: 25, arrive: 95, label: 'Back out to the deck', kind: 'door', distance: 5 }],
    notes: [
      { id: 'logbook', at: { yaw: -135, pitch: -17 }, label: 'The logbook' },
      { id: 'talk', at: { yaw: -172, pitch: -4 }, label: 'Pull up a chair' },
    ],
    spots: [
      {
        id: 'firewood',
        at: { yaw: -155, pitch: -6 },
        radius: 7,
        name: 'Seasoned firewood',
        fact: 'Freshly cut wood can be half water. Stacked under cover for a year or two, it dries out and burns hotter, with less smoke.',
        hint: 'Next to the fire.',
      },
    ],
    waymarks: [],
  },
  {
    id: 'rocks',
    name: 'The rocks',
    blurb: 'Bare granite slabs high above two lakes: the scrambly way.',
    description:
      'A wide shoulder of bare, lichen-flecked rock on a hazy morning. A rounded wooded hill rises straight ahead; there is a big lake with islands to the left, a smaller one to the right, and rows of mountains fading into the distance.',
    elevation: 2400,
    season: 'autumn',
    time: 'morning',
    photo: photo('montorfano', 'Montorfano', AM),
    view: { yaw: -115, pitch: -3, fov: 90 },
    north: -85,
    sun: { yaw: 55, pitch: 12, strength: 0.35 },
    radius: 30,
    ground: 'rock',
    weather: {
      particles: 'none',
      water: [
        { yaw: [-180, -100], pitch: [-8, -1], strength: 0.5 },
        { yaw: [95, 160], pitch: [-14, -5], strength: 0.6 },
      ],
    },
    ambience: { space: 'open', wind: 0.5, birds: ['chough', 'songbird'] },
    links: [
      { to: 'hut', yaw: -35, label: 'Back down to the hut' },
      { to: 'summit', yaw: 75, arrive: -130, label: 'Up the ridge to the summit', distance: 10 },
    ],
    notes: [{ id: 'rock', at: { yaw: 160, pitch: -25 }, label: 'On the rock' }],
    spots: [
      {
        id: 'lichen',
        at: { yaw: 30, pitch: -45 },
        radius: 10,
        name: 'Lichen',
        fact: 'Each pale crust is a fungus and an alga living as one. Some grow less than a millimetre a year, so a patch the size of a coin can be decades old.',
        hint: 'Pale patches on the rock underfoot.',
      },
      {
        id: 'cirrus',
        at: { yaw: -40, pitch: 55 },
        radius: 15,
        name: 'Cirrus',
        fact: 'Wispy clouds of ice crystals, 6 to 12 km up. Their streaks show which way the high winds blow; when they thicken and lower, rain is often a day away.',
        hint: 'High, wispy clouds overhead.',
      },
    ],
    waymarks: [
      { yaw: -100, pitch: -25 },
      { yaw: 140, pitch: -25 },
    ],
  },
  {
    id: 'lake',
    name: 'The lake',
    blurb: 'A frozen lake under snowy peaks: the gentle way round.',
    description:
      'A high mountain lake still frozen in spring, its ice cracked and slumped along the shore. A rocky knoll of spruce and larch stands beside you, and snow-streaked peaks line the valley beyond.',
    elevation: 2300,
    season: 'winter',
    time: 'midday',
    photo: photo('lago_disola', "Lago d'Isola", AM, 'Valle Spluga, Lombardy, Italy'),
    view: { yaw: 60, pitch: 5, fov: 85 },
    north: -147,
    sun: { yaw: 33, pitch: 51 },
    radius: 35,
    ground: 'gravel',
    weather: { particles: 'diamond-dust', water: [{ yaw: [95, 160], pitch: [-20, -4], strength: 0.35 }] },
    ambience: { space: 'valley', wind: 0.45, stream: { at: 5, level: 0.3 }, birds: ['songbird'], marmots: true },
    links: [
      { to: 'hut', yaw: -160, label: 'Back to the hut' },
      { to: 'summit', yaw: 42, arrive: -130, label: 'Past the lake, up to the summit', distance: 10 },
    ],
    notes: [{ id: 'ski', at: { yaw: 8, pitch: -14 }, label: 'Two weeks on skis' }],
    spots: [
      {
        id: 'larch',
        at: { yaw: -78, pitch: 35 },
        radius: 10,
        name: 'European larch',
        latin: 'Larix decidua',
        fact: 'The bare tree beside the dark spruces is a larch, the only conifer here that sheds its needles for winter. In autumn these slopes turn gold.',
        hint: 'A tree that looks dead, but isn’t.',
      },
      {
        id: 'spring-ice',
        at: { yaw: 75, pitch: -15 },
        radius: 12,
        name: 'Spring ice',
        fact: 'Grey, waterlogged ice like this is rotten: it melts from inside, along the boundaries between its crystals, and can’t take a person’s weight. Never walk on a lake in spring.',
        hint: 'Out on the lake.',
      },
    ],
    waymarks: [
      { yaw: -15, pitch: -20 },
      { yaw: 125, pitch: -8 },
      { yaw: -110, pitch: -15 },
    ],
  },
  {
    id: 'summit',
    name: 'The summit',
    blurb: 'Wind, dry grass, a flag on the top and a lake far below. The summit book is here.',
    description:
      'A grassy summit ridge at midday under a deep blue sky. A tattered flag flies on the top just behind you; far below, a long lake winds between hazy blue mountains, with snowy peaks on the horizon.',
    elevation: 2600,
    season: 'winter',
    time: 'midday',
    photo: photo('pizzo_pernice', 'Pizzo Pernice', AM, 'above Lago Maggiore, Piedmont, Italy'),
    view: { yaw: -10, pitch: -2, fov: 90 },
    north: -148,
    sun: { yaw: 32, pitch: 52 },
    radius: 50,
    ground: 'grass',
    weather: { particles: 'none' },
    ambience: { space: 'open', wind: 0.75, birds: ['chough'] },
    links: [
      { to: 'rocks', yaw: 125, label: 'Down the ridge to the rocks' },
      { to: 'lake', yaw: 65, label: 'Down to the lake' },
      { to: 'bivouac', yaw: -40, arrive: 30, label: 'Down to a quiet spot for the night', distance: 10 },
    ],
    notes: [
      { id: 'summits', at: { yaw: -148, pitch: 3 }, label: 'Summit log' },
      { id: 'summit-book', at: { yaw: -155, pitch: 13 }, label: 'The summit book' },
    ],
    spots: [
      {
        id: 'maggiore',
        at: { yaw: 15, pitch: -8 },
        radius: 10,
        name: 'Lago Maggiore',
        fact: 'Italy’s second-largest lake, about 65 km long. Its northern end is in Switzerland, and its mild shores grow camellias and palms below snowy peaks.',
        hint: 'The long lake far below.',
      },
      {
        id: 'blue-ridges',
        at: { yaw: -75, pitch: -4 },
        radius: 12,
        name: 'Blue ridges',
        fact: 'The further away a ridge is, the paler and bluer it looks: the air in between scatters blue light into your eyes. Painters call it aerial perspective.',
        hint: 'Rows of hazy mountains, one behind another.',
      },
      {
        id: 'summit-flag',
        at: { yaw: -153, pitch: 20 },
        radius: 6,
        name: 'The summit flag',
        fact: 'Ribbons on a summit pole are a free windsock: they stream away from the wind. Frayed ones show how often it blows hard up here.',
        hint: 'On the very top, behind you.',
      },
    ],
    waymarks: [
      { yaw: -100, pitch: -12 },
      { yaw: 150, pitch: -10 },
    ],
  },
  {
    id: 'bivouac',
    name: 'The bivouac',
    blurb: 'A grassy shoulder for the night above a lake. Stay and watch the sky.',
    description:
      'A rocky, grassy hilltop above a wide lake at sunset, with flat-topped mountains on the horizon. Wait here and the light fades through dusk into a sky full of stars, and on to sunrise.',
    elevation: 2350,
    season: 'winter',
    time: 'sunset',
    photo: photo('qwantani_sunset', 'Qwantani Sunset', GZ_JG, QWANTANI),
    variants: [
      {
        key: 'bivouac-dusk',
        time: 'dusk',
        label: 'Dusk',
        photo: photo('qwantani_dusk_1', 'Qwantani Dusk 1', GZ_JG, QWANTANI),
        grade: { exposure: 0.9 },
        sun: { yaw: 40, pitch: -2, strength: 0.25 },
        ambience: { birds: [], insects: ['crickets'], wind: 0.2 },
      },
      {
        key: 'bivouac-night',
        time: 'night',
        label: 'Night',
        photo: photo('qwantani_night', 'Qwantani Night', GZ_JG, QWANTANI, -57.3),
        grade: { exposure: 0.62, saturation: 0.8 },
        ambience: { birds: ['owl'], insects: ['crickets'], wind: 0.15 },
        weather: { particles: 'meteors' },
      },
      {
        key: 'bivouac-sunrise',
        time: 'sunrise',
        label: 'Sunrise',
        photo: photo('qwantani_sunrise', 'Qwantani Sunrise', GZ_JG, QWANTANI, -213.4),
        sun: { yaw: -178, pitch: 2, strength: 0.8 },
        ambience: { birds: ['songbird', 'blackbird', 'robin'], insects: [], wind: 0.2 },
      },
    ],
    view: { yaw: 25, pitch: 2, fov: 85 },
    north: 110,
    sun: { yaw: 40, pitch: 3, strength: 0.8 },
    radius: 40,
    ground: 'grass',
    weather: { particles: 'none', water: [{ yaw: [-32, 178], pitch: [-10, -1], strength: 0.6 }] },
    ambience: { space: 'open', wind: 0.3, birds: ['songbird'], insects: ['crickets'] },
    links: [
      { to: 'summit', yaw: -95, label: 'Back up to the summit' },
      { to: 'home', yaw: 140, label: 'Head home to London', kind: 'travel' },
    ],
    notes: [{ id: 'night', at: { yaw: 15, pitch: -18 }, label: 'Before you go' }],
    spots: [
      {
        id: 'table-mountains',
        at: { yaw: -95, pitch: 1.5 },
        radius: 8,
        name: 'Flat-topped mountains',
        fact: 'A hard cap of rock, here layers of old lava over sandstone, protects the softer rock beneath. The hills wear away at the edges and keep their flat tops.',
        hint: 'Far away on the horizon, mountains with flat tops.',
      },
      {
        id: 'milky-way',
        at: { yaw: -145, pitch: 68 },
        radius: 18,
        name: 'The Milky Way',
        fact: 'Our own galaxy, seen edge-on from inside: a disc of a few hundred billion stars. Its brightest part is towards the centre, about 26,000 light-years away.',
        hint: 'Only at night: look high overhead.',
        variant: 'bivouac-night',
      },
      {
        id: 'light-domes',
        at: { yaw: -40, pitch: 3 },
        radius: 15,
        name: 'Light pollution',
        fact: 'Each glow on the horizon is a town. Artificial light hides the Milky Way from over a third of humanity, including about 60% of Europeans.',
        hint: 'Only at night: glows along the horizon.',
        variant: 'bivouac-night',
      },
    ],
    waymarks: [
      { yaw: -60, pitch: -10 },
      { yaw: 100, pitch: -12 },
    ],
  },
  {
    id: 'home',
    name: 'Home',
    blurb: 'A London street of Victorian terraces. Kettle on.',
    description:
      'A quiet residential street in south-east London on an overcast morning: tall Victorian terraces with bay windows and front gardens, cars parked along the kerb, and big trees in the gardens.',
    elevation: 30,
    season: 'autumn',
    time: 'morning',
    photo: photo('urban_street_03', 'Urban Street 03', AM, 'Greenwich, London'),
    view: { yaw: 40, pitch: 8, fov: 85 },
    north: 0,
    radius: 20,
    ground: 'pavement',
    weather: { particles: 'drizzle' },
    ambience: { space: 'street', wind: 0.2, leaves: 0.2, birds: ['woodpigeon', 'robin'], traffic: 0.3, rain: 0.25 },
    links: [{ to: 'beach', yaw: 0, label: 'Back to the sea, and start again', kind: 'travel' }],
    notes: [{ id: 'home', at: { yaw: 52, pitch: -2 }, label: 'Home' }],
    spots: [
      {
        id: 'chimney-pots',
        at: { yaw: -110, pitch: 27 },
        radius: 8,
        name: 'Chimney pots',
        fact: 'Every pot on a chimney stack tops its own flue, and every flue served a fireplace. Count the pots and you can count the coal fires a Victorian house once had.',
        hint: 'High up on the rooftops, to the left.',
      },
      {
        id: 'bay-windows',
        at: { yaw: 82, pitch: 12 },
        radius: 8,
        name: 'Bay windows',
        fact: 'A late-Victorian favourite: the bay bulges out to catch light from three sides, a big help in a narrow terraced house on a grey morning like this one.',
        hint: 'The terrace across the road.',
      },
    ],
    waymarks: [
      { yaw: -20, pitch: -12 },
      { yaw: 140, pitch: -10 },
    ],
  },
]

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]))

/** How far along the trail each place is, for the "on we go" suggestion. */
const ORDER: Record<SceneId, number> = {
  beach: 0,
  cove: 0.5,
  orchard: 1,
  valley: 2,
  forest: 3,
  stream: 4,
  hut: 5,
  inside: 5.5,
  rocks: 6,
  lake: 6,
  summit: 7,
  bivouac: 8,
  home: 9,
}

export const FIRST_SCENE: SceneId = 'beach'

/** The way on from a scene: the next place along the trail you haven't been to yet, if there is one. */
export function nextLink(scene: Scene, visited: ReadonlySet<SceneId> = new Set()): Link | null {
  const ahead = scene.links.filter((l) => !l.side && ORDER[l.to] > ORDER[scene.id]).sort((a, b) => ORDER[a.to] - ORDER[b.to])
  return ahead.find((l) => !visited.has(l.to)) ?? ahead[0] ?? scene.links.find((l) => !l.side) ?? null
}

/** One photo to prepare (see scripts/panoramas.ts): a scene (with its postcard), or one of its time-of-day variants. */
export type PhotoJob = { key: string; scene: SceneId; photo: Photo; card?: Dir & { fov?: number } }

export const PHOTOS: PhotoJob[] = SCENES.flatMap((s) => [
  { key: s.id, scene: s.id, photo: s.photo, card: s.view },
  ...(s.variants ?? []).map((v) => ({ key: v.key, scene: s.id, photo: v.photo })),
])
