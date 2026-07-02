import Link from "next/link";
import type { Metadata } from "next";
import ContentShell from "@/components/ContentShell";
import PostCard from "@/components/PostCard";
import { listVisible, allTags } from "@/lib/posts";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Peter Bodnar",
  description: "Writing on ML, GenAI, recommender systems, and optimization.",
};

export default async function BlogPage() {
  const admin = await isAdmin();
  const posts = listVisible(admin);
  const tags = allTags();

  return (
    <ContentShell>
      <h1 className="text-2xl font-bold mb-2">Blog</h1>
      <p className="text-gray-500 mb-6">
        Notes on ML, GenAI, recommendation systems, and optimization.
        {admin && " You're viewing as admin — drafts are shown."}
      </p>

      <form action="/search" className="mb-6">
        <input
          type="search"
          name="q"
          placeholder="Search posts…"
          aria-label="Search posts"
          className="w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-700
            bg-white dark:bg-gray-900 px-4 py-2 outline-none focus:border-blue-500"
        />
      </form>

      {tags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t}
              href={`/search?tag=${encodeURIComponent(t)}`}
              className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts published yet.</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}

      <div className="mt-8">
        <Link href="/blog/archive" className="text-blue-600 hover:underline">
          View archive →
        </Link>
      </div>
    </ContentShell>
  );
}
