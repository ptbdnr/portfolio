import { notFound, redirect } from "next/navigation";
import { getById } from "@/lib/posts";

export const dynamic = "force-dynamic";

// Stable, id-based permalink. Resolves the post by id and redirects to its
// current slug — so shared links keep working even after the slug changes.
// A 307 (temporary) redirect is used on purpose, so a later slug change is
// always re-resolved rather than cached.
export default async function PostByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getById(Number(id));
  if (!post) notFound();
  redirect(`/blog/${post.slug}`);
}
