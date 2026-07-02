/**
 * Central place for reading runtime configuration.
 *
 * ADMIN_EMAILS is a comma-separated allowlist so the admin can be changed by
 * editing the container environment and restarting — no code change / redeploy.
 */

export const adminEmails: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}

/** Absolute or relative path to the SQLite database file. */
export const databaseUrl: string =
  process.env.DATABASE_URL ?? "file:./data/portfolio.db";
