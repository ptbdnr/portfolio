import Link from "next/link";

const cls = "text-blue-600 hover:underline";

// Contextual admin sub-navigation (the global top nav handles Logout / site links).
export default function AdminNav() {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-4 text-sm">
      <Link href="/admin" className={cls}>
        Dashboard
      </Link>
      <Link href="/admin/posts" className={cls}>
        Posts
      </Link>
      <Link href="/admin/posts/new" className={cls}>
        New post
      </Link>
    </nav>
  );
}
