import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/authz";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/chat")}`);
  }

  return (
    <main className="max-w-[800px] mx-auto p-8">
      <Link href="/" className="text-blue-600 no-underline">
        ← Home
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-4">Chat</h1>
      <ChatClient />
    </main>
  );
}
