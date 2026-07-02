import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listAll } from "@/lib/posts";
import { setStatus, deletePost } from "@/lib/actions";
import { fmtDate } from "@/lib/util";
import AdminNav from "@/components/AdminNav";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-amber-600",
  archived: "text-gray-500",
};

export default async function AdminPostsPage() {
  if (!(await isAdmin())) redirect("/admin");
  const posts = listAll();

  return (
    <div>
      <AdminNav />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet.</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/posts/${p.id}/edit`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {p.title}
                </Link>
                <div className="text-xs text-gray-500">
                  <span className={STATUS_COLOR[p.status]}>{p.status}</span> ·{" "}
                  {p.format} · updated {fmtDate(p.updated_at)} ·{" "}
                  <span className="font-mono">/{p.slug}</span>
                </div>
              </div>

              <form action={setStatus} className="flex gap-1">
                <input type="hidden" name="id" value={p.id} />
                {(["published", "draft", "archived"] as const)
                  .filter((s) => s !== p.status)
                  .map((s) => (
                    <button
                      key={s}
                      name="status"
                      value={s}
                      className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {s === "published"
                        ? "Publish"
                        : s === "draft"
                        ? "Unpublish"
                        : "Archive"}
                    </button>
                  ))}
              </form>

              <form action={deletePost}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmButton
                  message={`Delete "${p.title}"? This cannot be undone.`}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
