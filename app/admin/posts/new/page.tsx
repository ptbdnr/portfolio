import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listAllRefs } from "@/lib/posts";
import AdminNav from "@/components/AdminNav";
import PostForm from "@/components/PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  if (!(await isAdmin())) redirect("/admin");
  const allPosts = listAllRefs();
  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold mb-6">New post</h1>
      <PostForm allPosts={allPosts} />
    </div>
  );
}
