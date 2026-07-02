import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { listAllContent, getAccessEmails } from "@/lib/content";
import AdminDashboard, { type AdminItem } from "./AdminDashboard";

export default async function AdminPage() {
  const user = await getSessionUser();
  // Defense-in-depth: middleware also gates this, but never rely on it alone.
  if (!user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }
  if (!isAdmin(user)) {
    redirect("/");
  }

  const items = await listAllContent();
  const withAcl: AdminItem[] = await Promise.all(
    items.map(async (item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      body: item.body,
      visibility: item.visibility,
      accessEmails:
        item.visibility === "restricted"
          ? await getAccessEmails(item.id)
          : [],
    })),
  );

  return (
    <main className="max-w-[900px] mx-auto p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Content admin</h1>
        <Link href="/" className="text-blue-600 no-underline">
          ← Home
        </Link>
      </div>
      <p className="text-gray-500 text-sm mt-1 mb-6">
        Signed in as {user.email}
      </p>
      <AdminDashboard initialItems={withAcl} />
    </main>
  );
}
