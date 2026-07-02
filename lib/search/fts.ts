import db from "../db";

// Low-level FTS5 index maintenance. The KeywordProvider (lib/search) queries
// posts_fts; these helpers keep it in sync. rowid == posts.id, so a post's
// index row is addressable directly. Server actions call reindex/remove on
// write; import calls rebuild after a bulk replace.

function tagsFor(postId: number): string {
  const rows = db
    .prepare("SELECT tag FROM post_tags WHERE post_id = ?")
    .all(postId) as { tag: string }[];
  return rows.map((r) => r.tag).join(" ");
}

export function reindexPost(postId: number): void {
  const post = db
    .prepare("SELECT id, title, excerpt, body FROM posts WHERE id = ?")
    .get(postId) as
    | { id: number; title: string; excerpt: string | null; body: string }
    | undefined;
  db.prepare("DELETE FROM posts_fts WHERE rowid = ?").run(postId);
  if (!post) return;
  db.prepare(
    "INSERT INTO posts_fts(rowid, title, excerpt, body, tags) VALUES (?, ?, ?, ?, ?)"
  ).run(post.id, post.title, post.excerpt || "", post.body || "", tagsFor(postId));
}

export function removeFromIndex(postId: number): void {
  db.prepare("DELETE FROM posts_fts WHERE rowid = ?").run(postId);
}

// Rebuild the whole index from scratch (used after an import replaces all data).
export function rebuildIndex(): void {
  const ids = db.prepare("SELECT id FROM posts").all() as { id: number }[];
  const tx = db.transaction(() => {
    db.exec("DELETE FROM posts_fts");
    for (const { id } of ids) reindexPost(id);
  });
  tx();
}
