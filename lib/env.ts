// Server-only environment access. Secrets are read here and in other server
// modules — never in client components, and never via NEXT_PUBLIC_* (which
// would ship the value to the browser). A missing required key throws loudly.

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env.local (dev) ` +
        `or your compose env_file (prod). See .env.example.`
    );
  }
  return v;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}
