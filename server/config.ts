import path from 'node:path'

export type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
}

export type Config = {
  port: number
  host: string
  dataDir: string
  /** Absolute path of the built frontend (served with SPA fallback), or null to disable. */
  staticDir: string | null
  /**
   * A folder with the blog's posts (`blog/`) and pictures (`media/`), read live so posts can be added
   * and changed without rebuilding, or null to serve the posts the site was built with.
   */
  contentDir: string | null
  /** Trust X-Forwarded-For (only enable behind a reverse proxy you control). */
  trustProxy: boolean
  corsOrigins: string[]
  contactTo: string | null
  smtp: SmtpConfig | null
  /** Submissions faster than this after the form rendered are treated as bots. */
  minFormMs: number
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Config {
  const smtpHost = env.SMTP_HOST?.trim()
  const contactTo = env.CONTACT_TO?.trim() || null
  const smtp: SmtpConfig | null =
    smtpHost && contactTo
      ? {
          host: smtpHost,
          port: int(env.SMTP_PORT, 587),
          secure: bool(env.SMTP_SECURE, false),
          user: env.SMTP_USER || undefined,
          pass: env.SMTP_PASS || undefined,
          from: env.SMTP_FROM?.trim() || contactTo,
        }
      : null

  const staticSetting = env.STATIC_DIR ?? 'dist'
  return {
    port: int(env.PORT, 8787),
    host: env.HOST || '0.0.0.0',
    dataDir: path.resolve(cwd, env.DATA_DIR || 'data'),
    staticDir: staticSetting === '' || staticSetting === 'false' ? null : path.resolve(cwd, staticSetting),
    contentDir: env.CONTENT_DIR ? path.resolve(cwd, env.CONTENT_DIR) : null,
    trustProxy: bool(env.TRUST_PROXY, false),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    contactTo,
    smtp,
    minFormMs: int(env.MIN_FORM_MS, 2500),
  }
}
