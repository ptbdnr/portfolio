import Link from "next/link";
import type { Metadata } from "next";
import ContentShell from "@/components/ContentShell";
import PostCard from "@/components/PostCard";
import { search } from "@/lib/search";
import { listByTag } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search — Peter Bodnar",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q || "").trim();
  const tag = (sp.tag || "").trim();

  const results = query ? await search(query, { tag: tag || null }) : [];
  const tagBrowse = !query && tag ? listByTag(tag) : [];

  return (
    <ContentShell>
      <h1 className="text-2xl font-bold mb-4">Search</h1>

      <form action="/search" className="mb-2 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search posts…"
          autoFocus
          className="w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-700
            bg-white dark:bg-gray-900 px-4 py-2 outline-none focus:border-blue-500"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {tag && (
        <p className="mb-6 text-sm text-gray-500">
          Filtered by tag{" "}
          <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5">
            {tag}
          </span>{" "}
          <Link
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className="text-blue-600 hover:underline"
          >
            clear
          </Link>
        </p>
      )}

      {query ? (
        results.length === 0 ? (
          <p className="text-gray-500">No results for “{query}”.</p>
        ) : (
          <ul className="space-y-4">
            {results.map((r) => (
              <li key={r.post.id}>
                <Link
                  href={`/blog/${r.post.slug}`}
                  className="text-lg font-bold text-blue-600 hover:underline"
                >
                  {r.post.title}
                </Link>
                {r.snippet && (
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                    {r.snippet}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )
      ) : tag ? (
        tagBrowse.length === 0 ? (
          <p className="text-gray-500">No posts tagged “{tag}”.</p>
        ) : (
          tagBrowse.map((p) => <PostCard key={p.id} post={p} />)
        )
      ) : (
        <p className="text-gray-500">
          Type a query to search posts by title, content, or tag.
        </p>
      )}
    </ContentShell>
  );
}
