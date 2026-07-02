import db from "../db";
import { SearchProvider, SearchOptions } from "./index";
import { PostStatus, SearchResult } from "../types";

// Turn arbitrary user input into a safe FTS5 MATCH expression: tokenize into
// alphanumeric terms, quote each (so punctuation can't break the query syntax),
// add a prefix wildcard for partial matches, and OR them for recall. Returns
// null when there's nothing searchable.
function toFtsQuery(raw: string): string | null {
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" OR ");
}

// Cheap plain-text preview for a result snippet (rendered as text, never HTML).
function plainPreview(body: string): string {
  return body
    .replace(/<[^>]+>/g, " ")
    .replace(/[`#>*_~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

interface Row {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  status: string;
  score: number;
}

export class KeywordProvider implements SearchProvider {
  readonly name = "keyword-fts5";

  async search(
    query: string,
    opts: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const match = toFtsQuery(query);
    if (!match) return [];
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const params: (string | number)[] = [match];
    let tagClause = "";
    if (opts.tag && opts.tag.trim()) {
      tagClause =
        "AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag = ?)";
      params.push(opts.tag.trim());
    }
    params.push(limit);

    // bm25() returns lower = more relevant; we negate so higher = better.
    const rows = db
      .prepare(
        `SELECT p.id, p.slug, p.title, p.excerpt, p.body, p.status,
                bm25(posts_fts) AS score
         FROM posts_fts
         JOIN posts p ON p.id = posts_fts.rowid
         WHERE posts_fts MATCH ? AND p.status = 'published' ${tagClause}
         ORDER BY bm25(posts_fts)
         LIMIT ?`
      )
      .all(...params) as Row[];

    return rows.map((r) => ({
      post: {
        id: r.id,
        slug: r.slug,
        title: r.title,
        status: r.status as PostStatus,
        excerpt: r.excerpt,
      },
      score: -r.score,
      snippet: r.excerpt || plainPreview(r.body),
    }));
  }
}
