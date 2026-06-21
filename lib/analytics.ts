import db from "./db";
import { wordCount, readingMinutes } from "./util";
import { AnalyticsEventType, PostStatus } from "./types";

// ---------- Recording (called by the /api/analytics beacon) ----------

const EVENT_TYPES = new Set<AnalyticsEventType>([
  "pageview",
  "click",
  "heartbeat",
  "leave",
]);

export interface IncomingEvent {
  visitorId?: string;
  sessionId?: string;
  type?: string;
  path?: string;
  durationMs?: number | null;
}

// Map a /blog/<slug> path to a post id so views can be attributed to posts.
function postIdForPath(path: string): number | null {
  const m = path.match(/^\/blog\/([^/?#]+)/);
  if (!m) return null;
  try {
    const row = db
      .prepare("SELECT id FROM posts WHERE slug = ?")
      .get(decodeURIComponent(m[1])) as { id: number } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

// Server-derived identity (from the session) — never trusted from the client.
export interface Identity {
  email?: string | null;
  name?: string | null;
}

export function recordEvent(e: IncomingEvent, identity?: Identity): boolean {
  if (!e.type || !EVENT_TYPES.has(e.type as AnalyticsEventType)) return false;
  const vid = (e.visitorId || "").toString().slice(0, 64);
  const sid = (e.sessionId || "").toString().slice(0, 64);
  if (!vid) return false;
  const path = (e.path || "").toString().slice(0, 512);
  const dur =
    typeof e.durationMs === "number" && e.durationMs >= 0
      ? Math.min(Math.round(e.durationMs), 1000 * 60 * 60)
      : null;
  const email = identity?.email
    ? identity.email.toString().toLowerCase().slice(0, 256)
    : null;
  const name = identity?.name ? identity.name.toString().slice(0, 256) : null;

  db.prepare(
    `INSERT INTO visitors (id) VALUES (?)
     ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now')`
  ).run(vid);

  // Record the signed-in user so behaviour can be analysed per-user later.
  if (email) {
    db.prepare(
      `INSERT INTO users (email, name) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = COALESCE(excluded.name, users.name),
         last_seen = datetime('now')`
    ).run(email, name);
  }

  db.prepare(
    `INSERT INTO analytics_events
       (visitor_id, session_id, type, path, post_id, duration_ms, user_email, user_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(vid, sid, e.type, path, postIdForPath(path), dur, email, name);
  return true;
}

// ---------- Visitor analytics aggregates (for /stats) ----------

export interface VisitorSummary {
  totalViews: number;
  uniqueVisitors: number;
  totalClicks: number;
  avgTimeOnPageSec: number;
}

function count(sql: string, ...args: unknown[]): number {
  const r = db.prepare(sql).get(...args) as { n: number };
  return r?.n ?? 0;
}

export function visitorSummary(): VisitorSummary {
  const avg = db
    .prepare(
      "SELECT AVG(duration_ms) AS a FROM analytics_events WHERE type = 'leave' AND duration_ms IS NOT NULL"
    )
    .get() as { a: number | null };
  return {
    totalViews: count(
      "SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'pageview'"
    ),
    uniqueVisitors: count(
      "SELECT COUNT(DISTINCT visitor_id) AS n FROM analytics_events"
    ),
    totalClicks: count(
      "SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'click'"
    ),
    avgTimeOnPageSec: avg.a ? Math.round(avg.a / 1000) : 0,
  };
}

export interface DayViews {
  day: string;
  views: number;
}

export function viewsByDay(days = 30): DayViews[] {
  return db
    .prepare(
      `SELECT date(ts) AS day, COUNT(*) AS views
       FROM analytics_events
       WHERE type = 'pageview' AND ts >= date('now', ?)
       GROUP BY day ORDER BY day`
    )
    .all(`-${days} days`) as DayViews[];
}

export interface TopPost {
  id: number;
  title: string;
  slug: string;
  views: number;
}

export function topPosts(limit = 8): TopPost[] {
  return db
    .prepare(
      `SELECT p.id, p.title, p.slug, COUNT(*) AS views
       FROM analytics_events e JOIN posts p ON p.id = e.post_id
       WHERE e.type = 'pageview'
       GROUP BY p.id ORDER BY views DESC, p.title LIMIT ?`
    )
    .all(limit) as TopPost[];
}

// ---------- Content stats (derived from posts) ----------

export interface ContentStats {
  total: number;
  byStatus: Record<PostStatus, number>;
  totalWords: number;
  totalReadingMinutes: number;
  tags: { tag: string; count: number }[];
  timeline: { month: string; count: number }[];
}

export function contentStats(): ContentStats {
  const rows = db.prepare("SELECT status, body FROM posts").all() as {
    status: PostStatus;
    body: string;
  }[];
  const byStatus: Record<PostStatus, number> = {
    published: 0,
    draft: 0,
    archived: 0,
  };
  let totalWords = 0;
  let totalReadingMinutes = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.status === "published") {
      totalWords += wordCount(r.body);
      totalReadingMinutes += readingMinutes(r.body);
    }
  }

  const tags = db
    .prepare(
      `SELECT pt.tag AS tag, COUNT(*) AS count FROM post_tags pt
       JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
       GROUP BY pt.tag ORDER BY count DESC, pt.tag LIMIT 12`
    )
    .all() as { tag: string; count: number }[];

  const timeline = db
    .prepare(
      `SELECT strftime('%Y-%m', COALESCE(published_at, created_at)) AS month,
              COUNT(*) AS count
       FROM posts WHERE status = 'published'
       GROUP BY month ORDER BY month`
    )
    .all() as { month: string; count: number }[];

  return {
    total: rows.length,
    byStatus,
    totalWords,
    totalReadingMinutes,
    tags,
    timeline,
  };
}
