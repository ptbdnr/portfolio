import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, canRead } from "@/lib/authz";
import { getContentBySlug } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  const item = await getContentBySlug(slug);

  if (!item) notFound();

  if (!(await canRead(user, item))) {
    // Anonymous visitor following a restricted direct link: send them to
    // sign in and bring them straight back to this URL afterwards.
    if (!user && item.visibility === "restricted") {
      redirect(
        `/api/auth/signin?callbackUrl=${encodeURIComponent(`/content/${slug}`)}`,
      );
    }
    // Signed in but not on the ACL — behave as if the item does not exist.
    notFound();
  }

  return (
    <main className="max-w-[800px] mx-auto p-8">
      <Link href="/" className="text-blue-600 no-underline">
        ← Home
      </Link>
      <article className="mt-6">
        <h1 className="text-3xl font-bold mb-2">{item.title}</h1>
        {item.visibility === "restricted" && (
          <p className="text-sm text-amber-600 mb-4">Restricted content</p>
        )}
        <div className="whitespace-pre-wrap leading-relaxed">{item.body}</div>
      </article>
    </main>
  );
}
