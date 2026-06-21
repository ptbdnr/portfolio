import Link from "next/link";
import type { PostListItem } from "@/lib/posts";
import { fmtDate, readingMinutes } from "@/lib/util";

// Blog list card — mirrors the SectionItem look (gray surface, transparent
// border that lights up on hover) for a consistent feel across the site.
export default function PostCard({ post }: { post: PostListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block mb-6 p-5 rounded-lg bg-gray-50 dark:bg-gray-800/50
        border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700
        hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all duration-200"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-xl font-bold text-blue-600">{post.title}</h3>
        {post.status !== "published" && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
            {post.status}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-gray-500">
        {fmtDate(post.published_at || post.created_at)} ·{" "}
        {readingMinutes(post.body)} min read
      </div>
      {post.excerpt && (
        <p className="mt-2 text-gray-700 dark:text-gray-300">{post.excerpt}</p>
      )}
      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span
              key={t}
              className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-xs"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
