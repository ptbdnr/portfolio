import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// SQLite lives alongside the app data. On the NAS this is a mounted volume (/data).
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "portfolio.db");

function createConnection(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT,
      format TEXT NOT NULL DEFAULT 'markdown',   -- 'markdown' | 'html'
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',       -- 'draft' | 'published' | 'archived'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

    CREATE TABLE IF NOT EXISTS post_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      UNIQUE(post_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

    -- Many-to-many links between posts (a post references other posts by id).
    CREATE TABLE IF NOT EXISTS post_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      related_post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(post_id, related_post_id)
    );
    CREATE INDEX IF NOT EXISTS idx_post_links_post ON post_links(post_id);

    -- Full-text index for keyword search. rowid == posts.id; the search layer
    -- (lib/search) keeps this in sync via reindexPost/removeFromIndex.
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title, excerpt, body, tags, tokenize = 'porter unicode61'
    );

    -- ---------- Privacy-respecting, first-party visitor analytics ----------
    -- visitor_id is a random UUID stored in a first-party cookie. No IP / PII.
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT,
      session_id TEXT,
      type TEXT NOT NULL,         -- 'pageview' | 'click' | 'heartbeat' | 'leave'
      path TEXT,
      post_id INTEGER,
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      duration_ms INTEGER,
      user_email TEXT,            -- set (server-side) when the visitor is signed in
      user_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(type);
    CREATE INDEX IF NOT EXISTS idx_events_ts ON analytics_events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_path ON analytics_events(path);
    CREATE INDEX IF NOT EXISTS idx_events_visitor ON analytics_events(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_email);

    -- Signed-in users, for later analysis (analysis itself is out of scope).
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add the identity columns to analytics_events on databases created before
  // they existed (SQLite has no "ADD COLUMN IF NOT EXISTS").
  const cols = db
    .prepare("PRAGMA table_info(analytics_events)")
    .all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  if (!have.has("user_email")) {
    db.exec("ALTER TABLE analytics_events ADD COLUMN user_email TEXT");
  }
  if (!have.has("user_name")) {
    db.exec("ALTER TABLE analytics_events ADD COLUMN user_name TEXT");
  }
}

// Tables carried by export/import, parents before children (FK-safe insert
// order; delete in reverse). posts_fts is derived and rebuilt after import.
export const EXPORT_TABLES = [
  "posts",
  "post_tags",
  "post_links",
  "visitors",
  "users",
  "analytics_events",
] as const;

// Reuse a single connection across hot reloads / requests, opened lazily on
// first use so the build step never touches SQLite.
const g = globalThis as unknown as { __portfolioDb?: Database.Database };

function getDb(): Database.Database {
  if (!g.__portfolioDb) g.__portfolioDb = createConnection();
  return g.__portfolioDb;
}

// Lazy proxy: any property/method access resolves against the real connection,
// which is created the first time it's needed.
const db = new Proxy({} as Database.Database, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as Database.Database;

export default db;
export { DATA_DIR, DB_PATH };
