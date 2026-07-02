# Personal Portfolio

A personal portfolio website built with modern web technologies, showcasing projects and experience. This project uses [Next.js](https://nextjs.org), Auth.js for authentication, Drizzle + SQLite for content storage, and Playwright for end-to-end testing.

## Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org) (App Router)
- **Authentication**: [Auth.js](https://authjs.dev) (NextAuth v5) — Google & Microsoft (OIDC)
- **Database**: SQLite via Drizzle ORM + libSQL
- **Testing**: Playwright for E2E testing
- **Styling**: Tailwind CSS
- **Font**: [Geist](https://vercel.com/font) by Vercel

## User groups & content access

The site has three access levels (see `docs/PLAN-user-groups-and-public-exposure.md`):

| Role | Who | Can do |
|---|---|---|
| Anonymous | anyone | read `public` content only; no chat |
| Regular user | signed in via Google or Microsoft | read `public` content + use the chat |
| Privileged user | signed-in user named on a content item's ACL | additionally read that specific `restricted` item (incl. via direct link) |
| Admin | email(s) in `ADMIN_EMAILS` | full CRUD on any content, manage per-item ACLs, copy share links (`/admin`) |

"Restricted" access is decided **per content item** by an ACL of allowed emails, so the
group can differ for each item. Denied reads of a restricted item return **404** (not 403)
so the item's existence stays hidden. Admin is an environment allowlist (`ADMIN_EMAILS`),
so it can change without a code change.

### Configuration

Copy `.env.example` to `.env` and fill in `AUTH_SECRET`, the Google / Microsoft OAuth
credentials, `ADMIN_EMAILS`, and `DATABASE_URL`. Then:

```bash
npm run db:generate   # (only after changing lib/db/schema.ts) generate migrations
npm run db:migrate    # apply migrations to the SQLite database
```

### Deploying on the UGREEN NAS + exposing to the internet

The app ships with a `Dockerfile` and `compose.yaml` (standalone Next.js output, SQLite on
a `/data` volume, migrations applied on startup). For a full step-by-step on running it on
the UGREEN 4800 Plus and reaching it from the internet via a Namecheap domain — with **no
LAN/VPN** — see [`docs/deployment-public-exposure.md`](docs/deployment-public-exposure.md).

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
