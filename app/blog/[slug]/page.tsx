import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentShell from "@/components/ContentShell";
import PostBody from "@/components/PostBody";
import ShareButton from "@/components/ShareButton";
import { getBySlug, resolveRefs } from "@/lib/posts";
import { isAdmin } from "@/lib/auth";
import { fmtDate, readingMinutes } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: `${post.title} — Peter Bodnar`,
    description: post.excerpt || undefined,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBySlug(slug);
  if (!post) notFound();

  const admin = await isAdmin();
  // Public visitors see published + archived posts; drafts are admin-only.
  if (post.status === "draft" && !admin) notFound();

  const related = resolveRefs(post.related, { publishedOnly: true });

  return (
    <ContentShell width="narrow">
      <article>
        {post.status !== "published" && (
          <div className="mb-4 inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs text-amber-800 dark:text-amber-300">
            {post.status === "draft" ? "Draft (preview)" : "Archived"}
          </div>
        )}
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        <div className="text-sm text-gray-500 mb-2">
          {fmtDate(post.published_at || post.created_at)} ·{" "}
          {readingMinutes(post.body)} min read
        </div>
        {post.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
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

        <div className="mb-6 flex items-center gap-3">
          <ShareButton id={post.id} title={post.title} />
          {admin && (
            <Link
              href={`/admin/posts/${post.id}/edit`}
              className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Edit
            </Link>
          )}
        </div>

        <PostBody format={post.format} body={post.body} />

        {related.length > 0 && (
          <div className="mt-12 border-t border-gray-200 dark:border-gray-800 pt-6">
            <h2 className="text-lg font-bold mb-3">Related posts</h2>
            <ul className="space-y-1">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/blog/${r.slug}`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <div className="mt-10">
        <Link href="/blog" className="text-blue-600 hover:underline">
          ← All posts
        </Link>
      </div>
    </ContentShell>
  );
}
