import Link from "next/link";
import type { Metadata } from "next";
import ContentShell from "@/components/ContentShell";
import PostCard from "@/components/PostCard";
import { listByStatus } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archive — Peter Bodnar",
};

export default function ArchivePage() {
  const posts = listByStatus("archived");
  return (
    <ContentShell>
      <h1 className="text-2xl font-bold mb-2">Archive</h1>
      <p className="text-gray-500 mb-6">Older posts, kept for reference.</p>
      {posts.length === 0 ? (
        <p className="text-gray-500">Nothing archived.</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
      <div className="mt-8">
        <Link href="/blog" className="text-blue-600 hover:underline">
          ← Back to blog
        </Link>
      </div>
    </ContentShell>
  );
}
