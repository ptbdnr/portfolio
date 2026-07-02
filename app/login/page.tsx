import type { Metadata } from "next";
import { FaGoogle, FaMicrosoft } from "react-icons/fa";
import ContentShell from "@/components/ContentShell";
import { loginWith, loginDev } from "@/app/actions/auth";
import { currentUser, isAdmin } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Peter Bodnar",
  robots: { index: false, follow: false },
};

const btn =
  "flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800";

export default async function LoginPage() {
  const user = await currentUser();
  const admin = user ? await isAdmin() : false;
  const hasGoogle = !!process.env.AUTH_GOOGLE_ID;
  const hasMicrosoft = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const devLogin = process.env.NODE_ENV !== "production";

  if (user) {
    return (
      <ContentShell width="narrow">
        <h1 className="text-2xl font-bold mb-2">Signed in</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          You&apos;re signed in as <strong>{user.email}</strong>
          {admin ? " (admin)." : " — a regular reader account."}
        </p>
        <form action={logout}>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Sign out
          </button>
        </form>
      </ContentShell>
    );
  }

  return (
    <ContentShell width="narrow">
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Sign in to manage the site. Readers don&apos;t need an account — all
        published posts are public.
      </p>

      <div className="max-w-sm space-y-3">
        {hasGoogle && (
          <form action={loginWith.bind(null, "google")}>
            <button className={btn}>
              <FaGoogle /> Continue with Google
            </button>
          </form>
        )}
        {hasMicrosoft && (
          <form action={loginWith.bind(null, "microsoft-entra-id")}>
            <button className={btn}>
              <FaMicrosoft /> Continue with Microsoft
            </button>
          </form>
        )}
        {!hasGoogle && !hasMicrosoft && !devLogin && (
          <p className="text-sm text-amber-600">
            No sign-in providers are configured yet.
          </p>
        )}

        {devLogin && (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Dev login (non-production only)
            </div>
            <form action={loginDev} className="flex gap-2">
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:border-blue-500"
              />
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Sign in
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-400">
              An email in <code>ADMIN_EMAILS</code> signs you in as admin.
            </p>
          </div>
        )}
      </div>
    </ContentShell>
  );
}
