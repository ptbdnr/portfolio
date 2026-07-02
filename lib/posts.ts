import db from "./db";
import { Post, PostRef, PostStatus, PostWithMeta } from "./types";

// ---- helpers ----

function tagsByPost(ids: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (ids.length === 0) return map;
  const ph = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT post_id, tag FROM post_tags WHERE post_id IN (${ph})
       ORDER BY tag COLLATE NOCASE`
    )
    .all(...ids) as { post_id: number; tag: string }[];
  for (const r of rows) {
    const arr = map.get(r.post_id);
    if (arr) arr.push(r.tag);
    else map.set(r.post_id, [r.tag]);
  }
  return map;
}

export type PostListItem = Post & { tags: string[] };

function attachTags(rows: Post[]): PostListItem[] {
  const tags = tagsByPost(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] }));
}

// ---- public reads ----

export function listPublished(): PostListItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
    )
    .all() as Post[];
  return attachTags(rows);
}

// All posts regardless of status — admin listing.
export function listAll(): PostListItem[] {
  const rows = db
    .prepare("SELECT * FROM posts ORDER BY updated_at DESC, id DESC")
    .all() as Post[];
  return attachTags(rows);
}

// Posts for the public blog feed. Admins also see drafts (surfaced first);
// readers see only published. Archived posts live on the archive page.
export function listVisible(includeDrafts: boolean): PostListItem[] {
  const rows = (
    includeDrafts
      ? db.prepare(
          `SELECT * FROM posts WHERE status IN ('published','draft')
           ORDER BY (status = 'draft') DESC,
                    COALESCE(published_at, created_at) DESC, id DESC`
        )
      : db.prepare(
          `SELECT * FROM posts WHERE status = 'published'
           ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
        )
  ).all() as Post[];
  return attachTags(rows);
}

export function listByStatus(status: PostStatus): PostListItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE status = ?
       ORDER BY COALESCE(published_at, updated_at) DESC, id DESC`
    )
    .all(status) as Post[];
  return attachTags(rows);
}

// Published posts carrying a given tag (for tag browsing on /search).
export function listByTag(tag: string): PostListItem[] {
  const rows = db
    .prepare(
      `SELECT p.* FROM posts p
       JOIN post_tags pt ON pt.post_id = p.id
       WHERE pt.tag = ? AND p.status = 'published'
       ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC`
    )
    .all(tag) as Post[];
  return attachTags(rows);
}

// Full record (tags + linked post ids). Used by the post page and admin editor.
function hydrate(row: Post | undefined): PostWithMeta | undefined {
  if (!row) return undefined;
  const tags = tagsByPost([row.id]).get(row.id) ?? [];
  const related = (
    db
      .prepare("SELECT related_post_id FROM post_links WHERE post_id = ?")
      .all(row.id) as { related_post_id: number }[]
  ).map((r) => r.related_post_id);
  return { ...row, tags, related };
}

export function getBySlug(slug: string): PostWithMeta | undefined {
  return hydrate(
    db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug) as
      | Post
      | undefined
  );
}

export function getById(id: number): PostWithMeta | undefined {
  return hydrate(
    db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined
  );
}

// Resolve linked post ids to lightweight refs, preserving the given order.
// `publishedOnly` is used for the public site so links to drafts don't leak.
export function resolveRefs(
  ids: number[],
  opts: { publishedOnly?: boolean } = {}
): PostRef[] {
  if (ids.length === 0) return [];
  const ph = ids.map(() => "?").join(",");
  let sql = `SELECT id, slug, title, status FROM posts WHERE id IN (${ph})`;
  if (opts.publishedOnly) sql += " AND status = 'published'";
  const rows = db.prepare(sql).all(...ids) as PostRef[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is PostRef => !!r);
}

// All posts as refs — for the admin "related posts" picker.
export function listAllRefs(): PostRef[] {
  return db
    .prepare("SELECT id, slug, title, status FROM posts ORDER BY created_at DESC")
    .all() as PostRef[];
}

export function allTags(): string[] {
  return (
    db
      .prepare("SELECT DISTINCT tag FROM post_tags ORDER BY tag COLLATE NOCASE")
      .all() as { tag: string }[]
  ).map((r) => r.tag);
}

export function publishedSlugs(): string[] {
  return (
    db
      .prepare("SELECT slug FROM posts WHERE status = 'published'")
      .all() as { slug: string }[]
  ).map((r) => r.slug);
}
