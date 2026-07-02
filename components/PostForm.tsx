import Link from "next/link";
import { createPost, updatePost } from "@/lib/actions";
import {
  PostRef,
  PostWithMeta,
  POST_FORMATS,
  POST_STATUSES,
} from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:border-blue-500";
const labelCls = "block text-sm font-medium mb-1";

// Authoring form, shared by new + edit. Plain HTML form posting to a server
// action — no client JS needed (the related-posts multi-select uses native
// multiple selection).
export default function PostForm({
  post,
  allPosts,
}: {
  post?: PostWithMeta;
  allPosts: PostRef[];
}) {
  const editing = !!post;
  const related = new Set(post?.related ?? []);
  const others = allPosts.filter((p) => p.id !== post?.id);

  return (
    <form action={editing ? updatePost : createPost} className="space-y-5">
      {editing && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label className={labelCls}>Title</label>
        <input
          name="title"
          defaultValue={post?.title ?? ""}
          required
          className={inputCls}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            Slug <span className="text-gray-400">(auto from title if blank)</span>
          </label>
          <input
            name="slug"
            defaultValue={post?.slug ?? ""}
            placeholder="my-post"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Format</label>
            <select
              name="format"
              defaultValue={post?.format ?? "markdown"}
              className={inputCls}
            >
              {POST_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select
              name="status"
              defaultValue={post?.status ?? "draft"}
              className={inputCls}
            >
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Excerpt</label>
        <input
          name="excerpt"
          defaultValue={post?.excerpt ?? ""}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>
          Tags <span className="text-gray-400">(comma-separated)</span>
        </label>
        <input
          name="tags"
          defaultValue={post?.tags.join(", ") ?? ""}
          placeholder="RAG, Optimization"
          className={inputCls}
        />
      </div>

      {others.length > 0 && (
        <div>
          <label className={labelCls}>
            Related posts{" "}
            <span className="text-gray-400">
              (Cmd/Ctrl-click to select several)
            </span>
          </label>
          <select
            name="related"
            multiple
            defaultValue={[...related].map(String)}
            className={`${inputCls} h-32`}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>
          Body{" "}
          <span className="text-gray-400">
            (markdown, or HTML if format is html)
          </span>
        </label>
        <textarea
          name="body"
          defaultValue={post?.body ?? ""}
          rows={20}
          className={`${inputCls} font-mono text-sm`}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
        >
          {editing ? "Save changes" : "Create post"}
        </button>
        <Link
          href="/admin/posts"
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
