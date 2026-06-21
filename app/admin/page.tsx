import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, currentUser } from "@/lib/auth";
import { listByStatus } from "@/lib/posts";
import AdminNav from "@/components/AdminNav";
import ImportForm from "@/components/ImportForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
        <p className="text-gray-500">
          You&apos;re signed in as {user.email}, which isn&apos;t an admin
          account. <Link href="/" className="text-blue-600 hover:underline">Go home</Link>.
        </p>
      </div>
    );
  }

  const counts = {
    published: listByStatus("published").length,
    draft: listByStatus("draft").length,
    archived: listByStatus("archived").length,
  };

  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(["published", "draft", "archived"] as const).map((k) => (
          <div
            key={k}
            className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 text-center"
          >
            <div className="text-2xl font-bold">{counts[k]}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {k}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + New post
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-lg font-bold mb-3">Backup</h2>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Export the whole dataset (posts, tags, links, analytics) as a .zip.
        </p>
        <a
          href="/api/export"
          className="inline-block rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ↓ Download backup
        </a>
        <div className="mt-5 border-t border-gray-200 dark:border-gray-800 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Restore from a bundle</h3>
          <ImportForm />
        </div>
      </section>
    </div>
  );
}
