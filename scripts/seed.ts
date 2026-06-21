// Dev seed: populate the local SQLite DB with demo posts so the blog/search/
// stats pages have content. Idempotent — clears posts first. Run: npm run db:seed
import db from "../lib/db";
import { reindexPost } from "../lib/search/fts";

type Seed = {
  slug: string;
  title: string;
  excerpt: string;
  format: "markdown" | "html";
  body: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  publishedDaysAgo?: number;
  links?: string[]; // slugs of related posts
};

const seeds: Seed[] = [
  {
    slug: "vector-search-in-production",
    title: "Vector search in production",
    excerpt: "Notes on shipping semantic search with sane latency and recall.",
    format: "markdown",
    status: "published",
    tags: ["RAG", "Vector Search"],
    publishedDaysAgo: 12,
    body: `A quick note on deploying semantic search at scale.

## A code snippet

\`\`\`python
def embed(text: str) -> list[float]:
    return model.encode(text)  # normalize for cosine
\`\`\`

## A comparison table

| Approach | Latency | Recall |
|----------|---------|--------|
| Keyword  | 5ms     | 0.62   |
| Vector   | 20ms    | 0.91   |

An image renders inline:

![placeholder diagram](https://placehold.co/600x180)

And a [safe external link](https://example.com/docs) opens in a new tab.`,
  },
  {
    slug: "styling-with-html-posts",
    title: "Styling with HTML posts",
    excerpt: "When markdown isn't enough, author a post in HTML — safely.",
    format: "html",
    status: "published",
    tags: ["meta"],
    publishedDaysAgo: 4,
    links: ["vector-search-in-production"],
    body: `<div class="callout" style="padding:1rem;border-left:3px solid #2563eb">
  <h2>This post is authored in HTML</h2>
  <p>It uses <strong>raw HTML</strong> with classes and inline styles, and
  markdown features <em>still work</em> alongside it.</p>
  <ul><li>First point</li><li>Second point</li></ul>
</div>

<script>alert('this script must be stripped by sanitization')</script>

A trailing markdown paragraph with \`inline code\` to prove both render.`,
  },
  {
    slug: "unpublished-idea",
    title: "An unpublished idea",
    excerpt: "This is a draft and should not appear publicly.",
    format: "markdown",
    status: "draft",
    tags: ["draft"],
    body: `Only the admin should see this via preview while it's a draft.`,
  },
  {
    slug: "an-older-post",
    title: "An older post",
    excerpt: "Kept around, but out of the main feed.",
    format: "markdown",
    status: "archived",
    tags: ["history"],
    publishedDaysAgo: 400,
    body: `This one is archived — still readable, but out of the main feed.`,
  },
];

function run() {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM post_links").run();
    db.prepare("DELETE FROM post_tags").run();
    db.prepare("DELETE FROM posts").run();

    const slugToId: Record<string, number> = {};
    const insert = db.prepare(
      `INSERT INTO posts (slug, title, excerpt, format, body, status, published_at)
       VALUES (@slug, @title, @excerpt, @format, @body, @status, @published_at)`
    );
    for (const s of seeds) {
      const published_at =
        s.status === "published" || s.status === "archived"
          ? new Date(
              Date.now() - (s.publishedDaysAgo ?? 0) * 86400000
            ).toISOString()
          : null;
      const info = insert.run({
        slug: s.slug,
        title: s.title,
        excerpt: s.excerpt,
        format: s.format,
        body: s.body,
        status: s.status,
        published_at,
      });
      const id = Number(info.lastInsertRowid);
      slugToId[s.slug] = id;
      const tagStmt = db.prepare(
        "INSERT INTO post_tags (post_id, tag) VALUES (?, ?)"
      );
      for (const t of s.tags) tagStmt.run(id, t);
    }

    const linkStmt = db.prepare(
      "INSERT OR IGNORE INTO post_links (post_id, related_post_id) VALUES (?, ?)"
    );
    for (const s of seeds) {
      if (!s.links) continue;
      for (const target of s.links) {
        if (slugToId[target]) linkStmt.run(slugToId[s.slug], slugToId[target]);
      }
    }

    for (const id of Object.values(slugToId)) reindexPost(id);
  });
  tx();
  const n = (db.prepare("SELECT COUNT(*) n FROM posts").get() as { n: number })
    .n;
  console.log(`Seeded ${n} posts.`);
}

run();
