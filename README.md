# Hut to Hut — Peter Bodnar

A personal site told as a little 16‑bit journey. Scroll (or swipe) to travel: windsurfing off a Sardinian beach
(come back to the sea and he takes turns: snorkelling, then windsurfing again), cycling inland past olive groves
and flamingos, hiking up through an Alpine village and forest to a mountain hut, over the rocks (or round the
lake), through a golden larch valley and up its rock band — a scramble on hands and feet, following red-white-red
trail paint — then up a glacier (seracs, crevasses, the bergschrund, a cornice on the summit ridge) to a summit at
4,061 m, and home to a turreted Victorian terrace in London. Summer by the sea, autumn in the mountains,
winter up high.

- **About me** — a short bio, the work I care about in plain words, hobbies, a pixel map of the places that
  shaped me and a summit log.
- **Blog** — Markdown posts with images, video, YouTube/Vimeo, code, maths and related posts. It lives in the hut
  (step inside), and its index is a teletext page.
- **Contact** — the summit book: a form backed by a small TypeScript API, with a dial-up modem flourish.

It's written for anyone, not just techies: a welcome card and a **Help** window explain how it works, the top bar
says where you are, a trail map under it jumps to any stop, and **Simple view** turns it into a plain, quiet page
(over a still picture of the mountain hut in today's season, by day or by starlight; the Menu can pick another).
The journey itself always runs through the seasons as you climb.
Everything game-like is optional and never blocks the content:

- **Choices** — step inside the hut (or keep walking); at the fork, take the rocks or the lake. The rocks take
  their time (a climb and an abseil to help with); the lake path flows straight on.
- **Challenges** — tap the glowing holds to help with a rock climb, bounce down an abseil, and jump a crevasse
  with a timing meter (or just walk the ladder). Each earns a badge. Heading back, it's always a climb up a cliff
  and an abseil down one.
- **Wildlife** — 20 species react to the pointer (or your finger) and can be photographed for your album;
  land animals keep to dry land, cross the stream on the bridge and stay below ~3,600 m (higher up, only birds;
  mountain hares never come below 1,200–1,600 m). Flamingos wade in the lagoon, and now and then one takes off.
  Once in a while two deer, chamois, ibex or foxes meet nose to nose (hearts float up) and wander off together — at
  least once on every journey, if you pause to look; come too close and they're gone.
- **Buried finds** — a different handful each visit, in the ground's cross-section: an amphora on the sea bed,
  pirate treasure in the sand, a Nuragic bronze, fossils and crystals in the rock, an old ice axe in the glacier.
- **Look up** — now and then: a contrail, a flock of birds, a paraglider, a hot-air balloon, a cable car on a far
  ridge, a lighthouse and a ferry out at sea, a shooting star at night. Nothing pops in or out: they ease in and out
  as they come and go, as night falls and as you walk on; the cable cars slide by with their mountains, and the ferry
  slips behind the coast. Birds in the foreground fly in from the side (or flutter up, fading in) and fly or fade
  away: gulls glide across, an eagle glides over to circle, a flock of choughs swoops in to land by the path.
- **Day / night** — the moon button (or a click on the sun or the moon in the sky) switches between day and night;
  the sun and the moon ride the same arc across the sky.
  At night the trail keeps its own clock: a sunset over the sea, the beach and the bike ride; darkness falling
  gradually once you get off the bike and walk on through the village; late evening at the hut, an alpine start over
  the rocks and the glacier, and first light from the upper glacier to sunrise on the summit. The head torch comes on
  when it's dark enough to need it, and follows the pointer.
- **Phones** — the scene, cards and menus are laid out for small touch screens.

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
| `npm test` | Vitest: API routes, storage, blog logic, frontmatter, media embeds, Markdown rendering, wildlife rules (dry land, bridge, lagoon) |
| `npm run lint` / `npm run typecheck` | oxlint / `tsc -b` |
| `npm run maps` | Re-rasterise the pixel maps from Natural Earth (output is committed) |
| `npm run media` | Re-generate the sample post media (needs `ffmpeg`) |
| `npm run media:check` / `npm run media:clean` | Find / remove GPS location and camera details in `public/` and `src/content/` media (videos need `ffmpeg`) |

In development, `/lab?f=0.6&theme=night&route=lake&hut=inside` pins the scene anywhere on the trail (handy for
screenshots), and `window.__world.debugTargets()` lists what's clickable on screen.

## Editing content

- **About me, places, work, summits, side quests:** `src/content/profile.ts`. All copy is in one place; set
  `profile.email` to enable a `mailto:` fallback in the contact form and `profile.links` to show links in the footer.
- **Photo album species:** `src/content/species.ts` (names, facts, hints). **Badges:** `src/content/badges.ts`.
  **How-it-works guide:** `src/content/howto.ts`.
- **Blog posts:** add a Markdown file to `src/content/logbook/`, e.g. `2026-12-01-my-entry.md`:

  ```markdown
  ---
  title: My entry
  date: 2026-12-01
  summary: One sentence for the index and the trail signs.
  tags: [ml, mountains]
  season: winter        # spring | summer | autumn | winter — sets the scenery while reading
  draft: false          # drafts show only in `npm run dev`, and are left out of the build entirely
  ---

  Text with **Markdown**, footnotes[^1], tables, `code` and maths like $e^{i\pi}+1=0$.

  ![A photo](/media/photo.jpg "Optional caption")
  ![A local video](/media/clip.mp4 "Shown in a camcorder frame")
  ![A talk](https://www.youtube.com/watch?v=VIDEO_ID)

  [^1]: Footnote text.
  ```

  Put media files in `public/media/`. Images, `.mp4/.webm` videos and YouTube/Vimeo links all use the image
  syntax. Raw HTML is never rendered. Reading time, alpine grade (F → ED), "ascent" (one word, one metre),
  teletext page numbers (P201…) and related posts ("nearby routes", by shared tags) are computed automatically.
  On a post, hovering over (or tapping) the time, grade or ascent explains it; the blog index has a one-line key.

  On the NAS (see [Running it on a NAS](#running-it-on-a-nas-and-posting-without-redeploying)), posts go in its
  `content/blog` folder instead, and appear without rebuilding anything.

  **Hundreds of posts are fine.** Each post's details are worked out at build time (`scripts/vite-plugin-blog.ts`),
  so visitors download a small index of all posts (about 0.6 KB per post, compressed to a third of that) and each
  post's text only when they open it. The blog lists 20 posts per page, with search and topic filters. Teletext
  numbers run P201–P999, so after 799 posts the newest can't be reached by typing a number (links still work).

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

There is also an anonymous visitor counter and collective "sightings" counter (`/api/stats*`), stored in
`data/stats.json`. No cookies, no analytics.

## Privacy

The site says where you live only as "London". Phones store GPS coordinates (and the time and camera) in every
photo and video, so `npm run build` refuses to publish media that still carries them: run `npm run media:clean`
to strip it (portrait photos keep their orientation). Drafts are left out of production builds.

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
   - photos and videos go in `media/`, and posts show them as `/media/<file name>`;
   - drafts (`draft: true`) are never shown on the NAS. Write and preview them on your Mac with `npm run dev`
     (in `src/content/logbook`), then copy the finished file across.

   The Markdown and plain versions, `llms.txt`, reading time, grade and related posts all follow automatically.

**Photos stay private.** Before a photo or video is sent to a visitor, the server takes out the location and
camera details phones write into it. It keeps a cleaned copy in `data/media-cache` and leaves your original as it
is. Videos are cleaned without re-encoding: the metadata is marked as padding, so nothing else changes. A file it
can't clean, such as an iPhone HEIC photo, isn't shown at all. Export it as JPEG instead. The project's log (in the
Docker app) has a `[media]` line for everything it cleans or holds back.

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

- 20 species for the photo album (dolphins, flamingos, marmots, ibex… some only at night or in certain seasons),
  7 hidden edelweiss, and 12 badges.
- Night mode follows your device's dark mode until you flip it with the moon button; the Menu lets you pick a season.
- On the blog page, type a three-digit page number like an old teletext remote.
- ↑ ↑ ↓ ↓ ← → ← → B A.

## Accessibility & comfort

All content is regular, semantic HTML over a decorative canvas (`aria-hidden`). Body text uses Atkinson
Hyperlegible; pixel fonts are kept for headings. Sound is off by default. `prefers-reduced-motion` is respected
(no weather, no camera easing, no VHS transitions; the crevasse jump needs no timing). Simple view removes the game
(only a still, decorative scene remains), and the Menu can switch off animals, the old-TV effect and sound. Dialogs trap focus and close with
`Esc`. Day and night themes, phone layouts and all dialogs pass an axe-core audit.

## Project layout

```
server/           Hono API (Node runs the .ts files directly), the live blog and media privacy, + tests
shared/           Types and zod schema shared by client and server; the plain versions' addresses
src/game/engine/  Canvas engine: world (trail, routes, ground layers, water, bridge), clock (night along the
                  trail), seaSport (windsurf or snorkel), backdrop (sky, sun and moon, sea, Alps), distant
                  (quiet things in the background), finds (treasures and fossils in the ground),
                  terrain (layered ground: sea, sand, soil, scree, glacier ice, bedrock), waters (lake and
                  lagoon with reflections), props, actors (climber, bike, windsurf, snorkel, scramble),
                  animals + rig (procedural legs/wings), night (darkness, head torch), renderer
src/game/         React bridge, pixel maps, icons, London street scene (Victorian terrace)
src/components/   HUD, trail map, menu, help, photo album, toasts, Markdown, home sections, challenges
src/pages/        Home (the journey), Logbook (blog, teletext), Post, NotFound, Lab (dev only)
src/content/      profile.ts, species.ts, badges.ts, howto.ts, logbook/*.md
scripts/          Blog build plugin and plain versions, map rasteriser, media generator and privacy check
```

## Credits

Map data: [Natural Earth](https://www.naturalearthdata.com/) (public domain). Fonts: Press Start 2P, VT323 and
IBM Plex Mono (SIL Open Font License). Pixel art, sounds and sample media are original and generated in code.
