# Personal Portfolio

A personal portfolio website built with [Next.js](https://nextjs.org). Alongside the
landing page it includes a self-hosted **blog** (Markdown or HTML posts, draft/
published/archived state, related-post links), **keyword search**, a **stats** page
(content + privacy-respecting visitor analytics), and a landing-page **AI chat**
assistant grounded in the site's content.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 15 (App Router) + React 19
- **Database**: SQLite via better-sqlite3 (full-text search with FTS5)
- **AI chat**: [LangChain](https://js.langchain.com) — provider-agnostic (Anthropic / OpenAI)
- **Testing**: Playwright for E2E testing
- **Styling**: Tailwind CSS
- **Font**: [Geist](https://vercel.com/font) by Vercel

## Content platform

- **Auth** uses Auth.js (Google + Microsoft sign-in). Whoever signs in with an email in
  `ADMIN_EMAILS` is the **admin** (sees drafts, can edit, export/import); everyone else is
  a reader. A common responsive top nav (logo, Blog, About, Stats, Login) appears on every
  page. **Home** = welcome + chat + contact; **About** = intro + work + education.
- **Authoring** lives at `/admin`. Create/edit posts, pick Markdown or HTML, set status, add
  tags and related posts, and export/import the whole dataset as a `.zip`. Each post has a
  **share** button and a stable `/b/<id>` permalink that redirects to the current slug, so
  links keep working after a slug change.
- **Search** (`/search`) is keyword-based (FTS5) behind a `SearchProvider` interface
  that's designed to extend to Lucene / embeddings / fusion / reranking.
- **Stats** (`/stats`) shows writing output plus first-party visitor analytics
  (views, unique visitors, time on page, clicks) — no third-party trackers, no PII.
  When a visitor is **signed in**, events are also tagged (server-side) with their
  email + name and recorded in a `users` table, for later per-user analysis.
- **Chat** posts to `/api/chat`, which streams a grounded reply. It **requires a
  signed-in user** (a bot filter, since model calls cost money) — enforced on the
  server, not just the UI. The model key is used only server-side. The chat input
  also supports voice (Web Speech API).

### Configuration

Copy `.env.example` to `.env.local` (dev) or provide it as the compose `env_file`
(prod). `.env*` is gitignored — never commit secrets, and never prefix any of these
with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated admin emails (anyone else who signs in is a reader). |
| `AUTH_SECRET` | Signs session tokens (use a long random string). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` | Microsoft Entra credentials + tenant. |
| `LLM_PROVIDER` | `anthropic` or `openai`. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Key for the chosen provider. |
| `LLM_MODEL` | Optional model override. |
| `DATA_DIR` | Where the SQLite DB + backups live (`/data` in Docker). |

**OAuth setup:** create a Google OAuth client and/or an Azure (Microsoft Entra) app
registration, and set each provider's **redirect URI** to
`https://<your-host>/api/auth/callback/google` and
`https://<your-host>/api/auth/callback/microsoft-entra-id`. In **development** you don't
need OAuth apps — the `/login` page offers a dev sign-in (non-production only); sign in with
an email from `ADMIN_EMAILS` to get admin.

Seed demo content for local development: `npm run db:seed`.

### Docker

```bash
cp .env.example .env   # fill in secrets
docker compose up --build
```

The SQLite database and pre-import backups persist in the `/data` volume.

## Getting Started

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the portfolio.

## Project Structure

```
├── app/              # Next.js app directory
├── components/       # Reusable React components
├── store/            # Redux store configuration and slices
├── tests/            # Playwright E2E tests
├── public/           # Static assets
└── styles/           # Global styles
```

## Testing

Run end-to-end tests with Playwright:

```bash
# Run tests
npm run test:e2e

# Open Playwright UI
npm run test:e2e:ui
```

## Deployment

This portfolio is configured for deployment on [Vercel](https://vercel.com), but can be deployed on any platform that supports Next.js.

For manual deployment:

```bash
npm run build
npm run start
```

## Contributing

This is a personal portfolio project, but if you find any bugs or have suggestions for improvements, please feel free to open an issue or submit a pull request.

## License

[MIT License](LICENSE)
