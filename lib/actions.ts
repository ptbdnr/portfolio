"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "./db";
import { requireAdmin } from "./auth";
import { reindexPost, removeFromIndex } from "./search/fts";
import { slugify } from "./util";
import { importBundle, ImportResult } from "./exportImport";
import { PostFormat, PostStatus, POST_FORMATS, POST_STATUSES } from "./types";

function str(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

function asFormat(v: FormDataEntryValue | null): PostFormat {
  const s = str(v);
  return (POST_FORMATS as string[]).includes(s) ? (s as PostFormat) : "markdown";
}

function asStatus(v: FormDataEntryValue | null): PostStatus {
  const s = str(v);
  return (POST_STATUSES as string[]).includes(s) ? (s as PostStatus) : "draft";
}

function parseTags(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(",")) {
    const tag = piece.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function parseRelated(formData: FormData, excludeId?: number): number[] {
  const ids = new Set<number>();
  for (const v of formData.getAll("related")) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && n !== excludeId) ids.add(n);
  }
  return [...ids];
}

// Ensure a unique slug, appending -2, -3, … on collision.
function uniqueSlug(base: string, excludeId?: number): string {
  const root = slugify(base) || "post";
  let candidate = root;
  let n = 1;
  for (;;) {
    const row = db
      .prepare("SELECT id FROM posts WHERE slug = ?")
      .get(candidate) as { id: number } | undefined;
    if (!row || row.id === excludeId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function writeTags(postId: number, tags: string[]) {
  db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)"
  );
  for (const t of tags) ins.run(postId, t);
}

function writeLinks(postId: number, related: number[]) {
  db.prepare("DELETE FROM post_links WHERE post_id = ?").run(postId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO post_links (post_id, related_post_id) VALUES (?, ?)"
  );
  // Only link to posts that actually exist.
  for (const rid of related) {
    const exists = db.prepare("SELECT 1 FROM posts WHERE id = ?").get(rid);
    if (exists) ins.run(postId, rid);
  }
}

function revalidateBlog(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/blog/archive");
  revalidatePath("/search");
  revalidatePath("/stats");
  revalidatePath("/admin/posts");
  if (slug) revalidatePath(`/blog/${slug}`);
}

// ---------- Post mutations (admin only) ----------

export async function createPost(formData: FormData) {
  await requireAdmin();
  const title = str(formData.get("title")) || "Untitled";
  const status = asStatus(formData.get("status"));
  const slug = uniqueSlug(str(formData.get("slug")) || title);

  const info = db
    .prepare(
      `INSERT INTO posts (slug, title, excerpt, format, body, status, published_at)
       VALUES (@slug, @title, @excerpt, @format, @body, @status, @published_at)`
    )
    .run({
      slug,
      title,
      excerpt: str(formData.get("excerpt")) || null,
      format: asFormat(formData.get("format")),
      body: str(formData.get("body")),
      status,
      published_at:
        status === "published" ? new Date().toISOString() : null,
    });

  const id = Number(info.lastInsertRowid);
  writeTags(id, parseTags(str(formData.get("tags"))));
  writeLinks(id, parseRelated(formData, id));
  reindexPost(id);

  revalidateBlog(slug);
  redirect(`/admin/posts/${id}/edit`);
}

export async function updatePost(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Missing id");
  const existing = db
    .prepare("SELECT slug, status, published_at FROM posts WHERE id = ?")
    .get(id) as
    | { slug: string; status: PostStatus; published_at: string | null }
    | undefined;
  if (!existing) throw new Error("Post not found");

  const status = asStatus(formData.get("status"));
  const slug = uniqueSlug(
    str(formData.get("slug")) || str(formData.get("title")) || existing.slug,
    id
  );
  // Set published_at the first time a post goes public; keep it thereafter.
  const published_at =
    status === "published"
      ? existing.published_at || new Date().toISOString()
      : existing.published_at;

  db.prepare(
    `UPDATE posts SET
       slug = @slug, title = @title, excerpt = @excerpt, format = @format,
       body = @body, status = @status, published_at = @published_at,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    slug,
    title: str(formData.get("title")) || "Untitled",
    excerpt: str(formData.get("excerpt")) || null,
    format: asFormat(formData.get("format")),
    body: str(formData.get("body")),
    status,
    published_at,
  });

  writeTags(id, parseTags(str(formData.get("tags"))));
  writeLinks(id, parseRelated(formData, id));
  reindexPost(id);

  revalidateBlog(slug);
  revalidateBlog(existing.slug);
  redirect(`/admin/posts/${id}/edit`);
}

export async function setStatus(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = asStatus(formData.get("status"));
  const row = db
    .prepare("SELECT published_at, slug FROM posts WHERE id = ?")
    .get(id) as { published_at: string | null; slug: string } | undefined;
  if (!row) return;
  const published_at =
    status === "published"
      ? row.published_at || new Date().toISOString()
      : row.published_at;
  db.prepare(
    "UPDATE posts SET status = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, published_at, id);
  reindexPost(id);
  revalidateBlog(row.slug);
}

export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const row = db.prepare("SELECT slug FROM posts WHERE id = ?").get(id) as
    | { slug: string }
    | undefined;
  removeFromIndex(id);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id); // cascades tags/links
  revalidateBlog(row?.slug);
  redirect("/admin/posts");
}

// ---------- Import (admin only) ----------

export async function importData(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  await requireAdmin();
  const file = formData.get("bundle");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an export .zip to import." };
  }
  if (formData.get("confirm") !== "on") {
    return {
      ok: false,
      message: "Tick the box to confirm — importing replaces all data.",
    };
  }
  const res = await importBundle(await file.arrayBuffer());
  if (res.ok) revalidateBlog();
  return res;
}
