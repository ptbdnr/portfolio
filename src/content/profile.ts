/**
 * Everything personal lives here, so the site can be edited without touching components.
 * The copy is written to be modest: the visitor is the player, Peter is the host who left notes.
 */

export const profile = {
  name: 'Peter Bodnar',
  nativeName: 'Bodnár Péter',
  role: 'Lead AI Engineer',
  home: 'London, UK',
  tagline: 'Applied AI and optimisation by day. Slowly up mountains whenever I can.',
  /** Used for the mailto fallback when the contact API is unreachable. Leave empty to hide. */
  email: '',
  /** Shown on the "about me" card, in the Menu and in the footer (leave `href` empty to hide one). */
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/peterbodnar' },
    { label: 'GitHub', href: 'https://github.com/ptbdnr' },
  ],
}

export const intro = [
  "I help organisations use AI in ways that are genuinely useful — and that people can understand and trust. Most of my work is about the human side: what problem are we really solving, who will use it, and how will we know it works?",
  "Outside work I'm happiest somewhere between a mountain hut and a summit: classic alpine routes, hut-to-hut ski touring, the odd rock climb, gravel ride or windsurf. I'm not fast. I just like being out there.",
]

/** Quick facts for the "about me" card. */
export const facts = [
  { label: 'Grew up', value: 'Hungary' },
  { label: 'Lived in', value: 'Northern Italy · Denmark · the Netherlands · the UK' },
  { label: 'Studied', value: 'MSc and PhD in Aarhus, Denmark' },
  { label: 'Work', value: 'Lead AI Engineer at Kainos (before that, Amazon)' },
  { label: 'Home', value: 'London — with a fox problem' },
]

/** Topics I'm always happy to talk about (shown next to the contact form). */
export const chatTopics = [
  'AI at work, without the hype',
  'Moving countries and changing careers',
  'Mountain huts, skiing and getting started in the Alps',
  'Where to eat in Sardinia',
]

export type Chapter = {
  id: string
  place: string
  when: string
  title: string
  text: string
  greeting: string
  lon: number
  lat: number
}

/** Places that shaped me, in order. Drawn as a route on the map. */
export const chapters: Chapter[] = [
  {
    id: 'hungary',
    place: 'Hungary',
    when: 'Early years',
    title: 'Where it started',
    text: 'I grew up with the Rubik’s Cube (a Hungarian invention), teletext and 8-bit home computers. That probably explains why this site has always been a little game.',
    greeting: 'Szia!',
    lon: 19.4,
    lat: 47.2,
  },
  {
    id: 'italy',
    place: 'Northern Italy',
    when: 'At 20',
    title: 'Italy, and the Alps',
    text: 'Moved to the north of Italy when I was twenty. The mountains were suddenly right there — and they never really left.',
    greeting: 'Ciao!',
    lon: 9.6,
    lat: 45.6,
  },
  {
    id: 'hungary-again',
    place: 'Hungary',
    when: 'Back home',
    title: 'Back home',
    text: 'Back to Hungary for a while, with a new habit of looking for the nearest hill.',
    greeting: 'Szia újra!',
    lon: 19.0,
    lat: 47.5,
  },
  {
    id: 'aarhus',
    place: 'Aarhus, Denmark',
    when: 'MSc → PhD',
    title: 'Aarhus',
    text: 'Came for an MSc and stayed for a PhD. Danish winters are good training for patience, and for research.',
    greeting: 'Hej!',
    lon: 10.2,
    lat: 56.16,
  },
  {
    id: 'delft',
    place: 'Delft, Netherlands',
    when: 'A PhD year abroad',
    title: 'Delft',
    text: 'Spent a year of the PhD in Delft — the flattest place I have ever lived, which turned out to be great for thinking.',
    greeting: 'Hoi!',
    lon: 4.36,
    lat: 52.01,
  },
  {
    id: 'london',
    place: 'London, UK',
    when: 'Now',
    title: 'London',
    text: 'Moved to the UK with my wife. First Amazon logistics, then Kainos. Home is London now, shared with some very confident foxes.',
    greeting: 'Cheers!',
    lon: -0.13,
    lat: 51.51,
  },
]

/** Not chapters, but places I keep going back to. Shown as small stars on the map. */
export const haunts = [
  { id: 'sardinia', label: 'Sardinia', note: 'Where a lot of my time off goes.', lon: 9.0, lat: 40.1 },
  { id: 'chamonix', label: 'Chamonix', note: 'Tacul, the Vallée Blanche, the Argentière glacier.', lon: 6.87, lat: 45.92 },
  { id: 'aosta', label: 'Italian Alps', note: 'Gran Paradiso, and hut-to-hut ski tours.', lon: 7.4, lat: 45.6 },
  { id: 'lakes', label: 'English hills', note: 'Weekend legs.', lon: -3.1, lat: 54.45 },
]

export const work = {
  now: {
    role: 'Lead AI Engineer',
    org: 'Kainos',
    text: 'I lead teams that design and build AI systems — from the first “is this even a good idea?” conversation to something people rely on every day.',
  },
  before: [
    {
      role: 'Senior Operations Researcher',
      org: 'Amazon',
      text: 'Logistics planning: helping a very large number of parcels find a slightly more sensible way home.',
    },
  ],
  study: [
    { degree: 'PhD', where: 'Aarhus, Denmark', note: 'including a year in Delft, NL' },
    { degree: 'MSc', where: 'Aarhus, Denmark', note: '' },
  ],
}

export type RucksackItem = { id: string; item: string; skill: string; note: string }

/** "What's in my rucksack" — tools of the trade, without the skill bars. */
export const rucksack: RucksackItem[] = [
  { id: 'radio', item: 'Radio', skill: 'Listening & translating', note: 'Between people and technology, in both directions. Probably the most useful thing I carry.' },
  { id: 'map', item: 'Map & compass', skill: 'Untangling problems', note: 'Turning a fuzzy question into something you can actually reason about.' },
  { id: 'headlamp', item: 'Head torch', skill: 'Generative AI', note: 'Brilliant in the dark — as long as you keep checking the batteries (I test how well it really works).' },
  { id: 'axe', item: 'Ice axe', skill: 'Optimisation', note: 'Finding a good plan among millions of options, and knowing when “good enough” is right.' },
  { id: 'altimeter', item: 'Altimeter', skill: 'Forecasting', note: 'An honest estimate, with the uncertainty included, beats a confident guess.' },
  { id: 'firstaid', item: 'First-aid kit', skill: 'Responsible AI', note: 'Safety checks, fairness, and being upfront about what a system can’t do.' },
  { id: 'rope', item: 'Rope', skill: 'Getting it into real use', note: 'Taking ideas out of the lab and into everyday work, safely belayed.' },
  { id: 'thermos', item: 'Thermos', skill: 'Python', note: 'A programming language, not a snake. Always in the bag.' },
]

/** Ideas I keep returning to; each links to logbook entries by tag. */
export const ideas = [
  { title: 'Optimisation and learning are better together', tag: 'optimisation' },
  { title: 'Calibration is a form of honesty', tag: 'uncertainty' },
  { title: 'Small rules, big avalanches', tag: 'complex-systems' },
]

export const offTheClock = [
  { id: 'ski', title: 'Two weeks on skis', text: 'About two weeks a year. Favourite format: hut-to-hut ski touring — skins on in the morning, a warm hut by the afternoon.' },
  { id: 'hills', title: 'England & Italy', text: 'Weekends in the English hills, longer trips to the Italian Alps.' },
  { id: 'sardinia', title: 'Sardinia', text: 'Where a lot of my time off goes: granite, turquoise sea, and very long lunches.' },
  { id: 'windsurf', title: 'Windsurfing', text: 'When the mistral blows. More falling in than I’d like to admit.' },
  { id: 'rock', title: 'Rock climbing', text: 'Now and then — mostly for the views and the company.' },
  { id: 'gravel', title: 'Gravel cycling', text: 'Back roads, dusty tracks and very important coffee stops.' },
]

export type Summit = {
  name: string
  height: number
  country: string
  cc: string
  where: string
  lon: number
  lat: number
}

export const summits: Summit[] = [
  { name: 'Huayna Potosí', height: 6088, country: 'Bolivia', cc: 'BO', where: 'Cordillera Real', lon: -68.15, lat: -16.26 },
  { name: 'Kilimanjaro', height: 5895, country: 'Tanzania', cc: 'TZ', where: 'Uhuru Peak', lon: 37.35, lat: -3.07 },
  { name: 'Mont Blanc du Tacul', height: 4248, country: 'France', cc: 'FR', where: 'Mont Blanc massif', lon: 6.89, lat: 45.86 },
  { name: 'Gran Paradiso', height: 4061, country: 'Italy', cc: 'IT', where: 'Graian Alps', lon: 7.27, lat: 45.52 },
  { name: 'Mount Fuji', height: 3776, country: 'Japan', cc: 'JP', where: 'Honshu', lon: 138.73, lat: 35.36 },
]

export const skiLines = [
  { name: 'Vallée Blanche', where: 'Chamonix, France', note: 'The long glacier run down from the Aiguille du Midi.' },
  { name: 'Argentière glacier', where: 'Chamonix, France', note: 'Big ice, big walls, small skier.' },
  { name: 'Hut-to-hut ski touring', where: 'The Alps', note: 'The favourite way to spend a week of winter.' },
]
