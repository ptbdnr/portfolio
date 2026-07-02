import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getById, listAllRefs } from "@/lib/posts";
import AdminNav from "@/components/AdminNav";
import PostForm from "@/components/PostForm";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const post = getById(Number(id));
  if (!post) notFound();
  const allPosts = listAllRefs();

  return (
    <div>
      <AdminNav />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit post</h1>
        <Link
          href={`/blog/${post.slug}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Preview ↗
        </Link>
      </div>
      <PostForm post={post} allPosts={allPosts} />
    </div>
  );
}
