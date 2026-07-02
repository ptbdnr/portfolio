import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/authz";

/**
 * Shows sign-in / sign-out state in the navbar. Server component: reads the
 * session directly, no client fetch needed.
 */
export default async function AuthStatus() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Link
        href="/api/auth/signin"
        className="ml-4 text-blue-600 no-underline"
      >
        Sign in
      </Link>
    );
  }

  return (
    <span className="ml-4 inline-flex items-center gap-3">
      {isAdmin(user) && (
        <Link href="/admin" className="text-blue-600 no-underline">
          Admin
        </Link>
      )}
      <Link href="/chat" className="text-blue-600 no-underline">
        Chat
      </Link>
      <span className="text-gray-500 text-sm">{user.email}</span>
      <Link
        href="/api/auth/signout"
        className="text-blue-600 no-underline"
      >
        Sign out
      </Link>
    </span>
  );
}
