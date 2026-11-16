# Hut to Hut — Peter Bodnar

A personal site told as a first-person walk through real places. You stand in 360° photographs and walk from one
to the next: from a Mediterranean beach, inland through an orchard and an Alpine valley, up through a forest and
along a mossy stream to a wooden hut, over the rocks (or round a frozen lake) to a summit, down to a quiet spot
for the night under the Milky Way, and home to a Victorian street in London. Look around, follow the arrows on the
ground, and open the notes I left along the way.

- **About me** — notes pinned in the photos: hello, places that shaped me (with a map), what I do, what's in my
  rucksack, ideas I keep coming back to, the summit log, and a few things I do for fun.
- **Blog** — Markdown posts with pictures, **sound**, video, YouTube/Vimeo, code, maths and related posts. Every
  post is pinned along the trail as a red-and-white waymark, and they all live in the hut's logbook.
- **Contact** — the summit book: a form backed by a small TypeScript API.

v1 (Next.js) and v2 (a pixel-art side-scroller) stay on their branches. v3 is a new engine, written from scratch:

- **The view** — a WebGL 2 renderer (`src/engine`) that draws an equirectangular photo per pixel, mipmapped and
  anisotropically filtered, with no seam where the photo's edges meet. A small preview appears at once and the
  full photo fades in when it has loaded; the next places are fetched before you get there.
- **Walking** — each photo is treated as painted on the ground and on a sphere around where it was taken, so
  stepping from one to the next has real parallax (the ground flows under you) as one photo dissolves into the
  next, with footsteps and a slight sway. Doors are a short step; long journeys fade.
- **A camera, not a picture** — exposure adapts to what you look at (darker into the sky, brighter in the
  shade), the sun glares and throws lens ghosts, water ripples and glints, and there's a touch of grain and
  vignette. Dust drifts in forest light, seeds and pollen float over meadows, midges swarm by the stream, ice
  crystals glitter by the frozen lake, it drizzles in London, flocks of birds cross the sky now and then, and
  there are shooting stars at night.
- **Real time of day** — at the bivouac, *Stay the night* crossfades through real photographs taken from the same
  spot at sunset, dusk, night (with the Milky Way overhead) and sunrise.
- **Sound** — every place has its own soundscape, synthesised live with Web Audio (no recordings): wind in
  gusts, waves, a brook, gulls, finches, blackbirds, a cuckoo, skylarks, choughs, an owl, a woodpecker, cicadas
  and crickets, distant cowbells, marmots, a crackling fire, rain and traffic. Sounds sit where they are in the
  photo and turn as you look around (HRTF panning); each place has its own echo, and walking crossfades one place
  into the next. Sound is off until you turn it on.
- **Things to find** — a field guide of 30 real things to spot in the photos (zoom in and look at them for a
  moment): a stone pine, sea bamboo kelp, a larch, rotten spring ice, the Milky Way… each with a short fact. Plus
  17 notes, 12 badges, and a camera to take photos of the view (kept in your browser).

It's written for anyone, not just techies: a title screen explains how it works, **Next** at the bottom always
knows the way on, the trail map (M) jumps to any place, and **Simple view** turns it into a plain, fast page with
everything on it (also used automatically where WebGL 2 isn't available). Keyboard, mouse, touch and pinch all
work.

## Quick start

Requires Node.js **22.18+** (the server and scripts run TypeScript directly via Node's type stripping).

```bash
npm install
npm run dev        # Vite on http://localhost:5173 + API on http://localhost:8787 (proxied at /api)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Frontend (Vite) and API (`node --watch server/index.ts`) together |
| `npm run build` | Check media for location data, type-check everything and build the frontend into `dist/` |
| `npm start` | Production server: serves `dist/` (SPA fallback) **and** the API on `PORT` (with `CONTENT_DIR` set, the blog is read live from that folder) |
| `npm run image:nas` | Build the Docker image for an x86 NAS and save it as `hut2hut.tar`, ready to import (needs Docker Desktop) |
| `npm test` | Vitest: API routes, storage, blog logic, frontmatter, media embeds and privacy (photos, video, sound), Markdown rendering, camera maths, the trail's paths and photos, post placement, saved progress |
| `npm run lint` / `npm run typecheck` | oxlint / `tsc -b` |
| `npm run panoramas` | Prepare the trail's photos in `src/assets/trail/` from `src/content/trail.ts` (downloads from Poly Haven once; needs ImageMagick 7, `cwebp` and `ffmpeg`; output is committed) |
| `npm run map` | Re-draw the map of Europe from Natural Earth (output is committed) |
| `npm run media` | Re-generate the sample post media, including the sandpile sound (needs `ffmpeg`) |
| `npm run media:check` / `npm run media:clean` | Find / remove GPS location, camera and recorder details in `public/`, `src/content/` and `src/assets/` media (videos and Ogg sound need `ffmpeg`) |

Any place can be opened directly: `/trail/beach`, `/trail/summit`, `/trail/bivouac`… (the address follows you as
you walk).

## Editing content

- **About me, places, work, summits, side quests:** `src/content/profile.ts`. All copy is in one place; set
  `profile.email` to enable a `mailto:` fallback in the contact form and `profile.links` to show links. The notes
  that show it along the trail are in `src/ui/panels/notes.tsx`; **badges** are in `src/content/badges.ts`.
- **The trail:** `src/content/trail.ts` — every place, its photo (and who took it, where), which way the paths go,
  where the notes, waymarks and field-guide spots are in the photo, the sun, water, weather and sounds. Directions
  are `yaw` (degrees from the middle of the photo, positive to the right) and `pitch` (degrees above the horizon).
- **Your own 360° photos:** any equirectangular JPEG (2:1, from a 360 camera or a phone's panorama mode) works.
  Point a scene at it with `photo: { file: 'photos/ridge.jpg', title: 'The ridge', authors: ['Me'] }`, run
  `npm run panoramas ridge` and adjust the scene's directions. Strip its location first (`npm run media:clean`
  does JPEGs).
- **Blog posts:** add a Markdown file to `src/content/logbook/`, e.g. `2026-12-01-my-entry.md`:

  ```markdown
  ---
  title: My entry
  date: 2026-12-01
  summary: One sentence for the index and the waymark.
  tags: [ml, mountains]
  season: winter        # spring | summer | autumn | winter — picks a place on the trail with that season
  scene: summit         # optional: pin it at a particular place instead (any id from src/content/trail.ts)
  draft: false          # drafts show only in `npm run dev`, and are left out of the build entirely
  ---

  Text with **Markdown**, footnotes[^1], tables, `code` and maths like $e^{i\pi}+1=0$.

  ![A photo](/media/photo.jpg "Optional caption")
  ![Birdsong at the hut](/media/dawn.mp3 "A sound: shown as a player")
  ![A local video](/media/clip.mp4 "Optional caption")
  ![A talk](https://www.youtube.com/watch?v=VIDEO_ID)

  [^1]: Footnote text.
  ```

  Put media files in `public/media/`. Pictures, sound (`.mp3`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.wav`, `.flac`),
  video (`.mp4`, `.webm`, `.mov`) and YouTube/Vimeo links all use the image syntax. While a post's sound or video
  plays, the trail's own sounds step back. Raw HTML is never rendered. Reading time, alpine grade (F → ED),
  "ascent" (one word, one metre), post numbers (No. 201…) and related posts (by shared tags) are computed
  automatically. Each post is pinned along the trail: at its `scene`, or at a place with its `season` (posts are
  spread evenly, oldest first, so a new post never moves an older one); when a place has more posts than
  waymarks, the rest share a trail register.

  On the NAS (see [Running it on a NAS](#running-it-on-a-nas-and-posting-without-redeploying)), posts go in its
  `content/blog` folder instead, and appear without rebuilding anything.

  **Hundreds of posts are fine.** Each post's details are worked out at build time (`scripts/vite-plugin-blog.ts`),
  so visitors download a small index of all posts (about 0.6 KB per post, compressed to a third of that) and each
  post's text only when they open it. The blog lists 20 posts per page, with search and topic filters.

  **Plain versions, for AI tools and for people.** Every post is also published without the site's decoration,
  showing only its title and text (no date, tags, reading time, grade or ascent):

  | Address | What it is |
  |---------|------------|
  | `/blog/<post>.md` | The post as plain Markdown (`text/markdown`): its title as a heading, then the text as written |
  | `/blog/<post>/plain` | That same Markdown shown as a plain web page, in the browser's own light or dark colours, with no JavaScript |
  | `/llms.txt` | An index for AI tools ([llmstxt.org](https://llmstxt.org)): who writes the blog, and each post's Markdown |

  Each post links to both at the top ("Plain version · Markdown"). For AI tools that read pages without running
  them, every post, the blog index and the home page carry a `<link rel="alternate" type="text/markdown">`, and
  tools that ask for `Accept: text/markdown` (as many AI agents do) get the Markdown at the page's own address.
  The build writes these files into `dist/` (`scripts/blog-plain.ts`); the dev server serves them straight from
  the Markdown.

## Contact form & API

`POST /api/contact` validates with the same zod schema the form uses (`shared/contact.ts`), applies a honeypot,
a time trap and per-IP rate limiting, then:

- always appends the message to `data/messages.jsonl` (file mode `0600`), and
- emails it via SMTP if `SMTP_HOST` and `CONTACT_TO` are set (see `.env.example`).

There is also an anonymous visitor counter and a collective count of what's been spotted in the field guide
(`/api/stats*`), stored in `data/stats.json`. No cookies, no analytics.

## Privacy

The site says where you live only as "London". Phones store GPS coordinates (and the time and camera) in every
photo and video, and recorders in sound files, so `npm run build` refuses to publish media that still carries
them: run `npm run media:clean` to strip it (portrait photos keep their orientation). Drafts are left out of
production builds. The trail's photos are of other people's places, credited in the app, and carry no metadata.

Progress (places, notes, finds, badges) and the photos you take on the walk stay in your browser
(localStorage and IndexedDB). Things spotted in the field guide are counted anonymously, as visits are.

Outside the site: keep the LinkedIn and GitHub location at city level, use GitHub's no-reply commit email, host on a
cloud service, or at home only behind a tunnel (never by forwarding a port on your router: your home IP address shows
roughly where you live), use WHOIS privacy for the domain, and post about trips once you're back.

## Deploying

- **Single service (recommended):** `npm run build && npm start`, or the included `Dockerfile` and
  `compose.yaml` (volumes at `/data` and `/content`; see below). Behind a reverse proxy, set `TRUST_PROXY=1`.
- **Static hosting + separate API:** build with `VITE_API_BASE=https://your-api` and run the API elsewhere with
  `STATIC_DIR=false` and `CORS_ORIGINS=https://your-site`. Static hosts need an SPA fallback to `index.html`.

The server sends a strict Content-Security-Policy (YouTube/Vimeo frames allowed), long-lived caching for hashed
assets and `no-cache` for the HTML shell, the posts' Markdown and `llms.txt`. On a static host, serve `.md` as
`text/markdown; charset=utf-8` (or `text/plain`) so browsers show it rather than download it; the Markdown for
`Accept: text/markdown` at a post's own address needs the server.

### Running it on a NAS, and posting without redeploying

The Docker image reads the blog **live** from a folder (`CONTENT_DIR`, `/content` in the container): posts in
`blog/`, photos and videos in `media/`. Add, change or delete a file there and the site shows it within a couple of
seconds. Rebuilding the image is only needed when the site's code changes. These steps are for a UGREEN DXP4800
Plus (UGOS Pro, x86); any Docker host works the same way.

1. **Build the image** on your Mac, with Docker Desktop running: `npm run image:nas`. It makes `hut2hut.tar`
   (about 230 MB, for x86 processors).
2. **Make the folders.** In UGOS **Files**, create a folder for the site, for example `docker/hut2hut`, with two
   folders inside it: `content` and `data`. Creating them yourself means they belong to your account, so you can
   edit them over the network later.
3. **Import the image.** **Docker → Image → Add → Import**, and choose `hut2hut.tar`.
4. **Start it.** **Docker → Project → Create**: name it `hut2hut`, choose the `docker/hut2hut` folder, paste in
   [`compose.yaml`](compose.yaml) and deploy. The site is at `http://<NAS address>:8787`. On its first start it
   copies the current posts and pictures into `content/`, ready to edit.
5. **Post.** On your Mac, Finder → Go → Connect to Server → `smb://<NAS address>`, and open
   `docker/hut2hut/content`:
   - a new post is a new file in `blog/`, named and written as in [Editing content](#editing-content)
     (`2026-12-01-gran-paradiso.md`); edit or delete files to change or remove posts;
   - photos, sound files and videos go in `media/`, and posts show them as `/media/<file name>`;
   - drafts (`draft: true`) are never shown on the NAS. Write and preview them on your Mac with `npm run dev`
     (in `src/content/logbook`), then copy the finished file across.

   The Markdown and plain versions, `llms.txt`, reading time, grade and related posts all follow automatically.

**Photos and recordings stay private.** Before a photo, video or sound file is sent to a visitor, the server takes
out the location and camera or recorder details phones write into it (voice memos record where they were made,
too). It keeps a cleaned copy in `data/media-cache` and leaves your original as it is. Videos, M4A, MP3, WAV and
FLAC files are cleaned without re-encoding: the metadata becomes padding, so nothing else changes. A file it can't
clean, such as an iPhone HEIC photo or an Ogg/Opus file with tags, isn't shown at all: export it as JPEG (or MP3
or M4A), or run it through `npm run media:clean` first. The project's log (in the Docker app) has a `[media]` line
for everything it cleans or holds back.

**Updating the site's code:** run `npm run image:nas` again, import the new `hut2hut.tar`, and restart the project
(stop, then start). `content/` and `data/` are kept.

**Putting it on the internet** without opening ports on your router, and without telling visitors your home IP
address, use a Cloudflare Tunnel. `compose.yaml` has it ready: create a tunnel in the Cloudflare dashboard (Zero
Trust → Networks → Tunnels), paste its token into the `tunnel` service, give the tunnel a public hostname (your
domain) pointing to `http://site:8787`, and uncomment `TRUST_PROXY`. HTTPS comes with it.

**Back up** `content/` (your posts and photos) and `data/` (messages and counters), for example with UGOS's backup
app. If the log says "permission denied", set `user:` in `compose.yaml` to your NAS account's ids (over SSH, `id`
shows them), or give the folder read and write access in UGOS.

## Things to find

- 30 things to spot in the photos for the field guide (zoom in on them), 17 notes from me, 12 badges, and the
  Milky Way if you stay the night.
- Every post read to the end gets a stamp in your logbook.
- Keys: arrows or WASD to look and walk, + and − to zoom, M map, B blog, G field guide, P photo, H help.

## Accessibility & comfort

All content is regular, semantic HTML over a decorative canvas (`aria-hidden`); every pin and arrow is a real
button you can reach with Tab, and screen readers hear where you've arrived and what's there. Body text uses
Atkinson Hyperlegible; headings use Fraunces. Sound is off by default and never starts on its own.
`prefers-reduced-motion` is respected (no walking motion, sway, particles or rippling water; places crossfade),
and the Menu can turn motion down by hand. **Simple view** removes the 3D walk altogether. Dialogs trap focus and
close with `Esc`. The renderer lowers its resolution on slow devices, frees photos it no longer needs, pauses in
a hidden tab and recovers from a lost GPU context.

## Project layout

```
server/            Hono API (Node runs the .ts files directly), the live blog and media privacy, + tests
shared/            Types and zod schema shared by client and server; the plain versions' addresses
src/engine/        The first-person engine: WebGL 2 renderer and shaders (panorama, parallax walk, exposure,
                   glare, water, grain), textures (preview → full, memory budget), particles and birds,
                   camera maths, and audio/ (the soundscape: synthesised voices, HRTF panning, reverb)
src/ui/            React: the stage and input, hotspots, HUD, panels (notes, map, field guide, photos, menu),
                   blog (index, post reader, Markdown with sound/video, summit book), simple view
src/content/       trail.ts (places, photos, paths, notes, spots, sounds), profile.ts, badges.ts,
                   europeMap.ts (generated), logbook/*.md
src/lib/           Blog logic, post placement, saved progress, photos (IndexedDB), media embeds, API client
src/assets/trail/  The trail's photos (generated by `npm run panoramas`; the build fingerprints them); public/media/ the posts' media
scripts/           Blog build plugin and plain versions, panorama and map builders, media generator and privacy check
```

## Credits

360° photographs: [Poly Haven](https://polyhaven.com/hdris) (CC0), by Andreas Mischok, Greg Zaal, Rico Cilliers,
Alexander Scholten, Dimitrios Savva and Jarod Guest; each place in the app says which photo it is and where it was
taken. Map data: [Natural Earth](https://www.naturalearthdata.com/) (public domain). Fonts: Fraunces, Atkinson
Hyperlegible and IBM Plex Mono (SIL Open Font License). Sounds and sample media are original and generated in code.
