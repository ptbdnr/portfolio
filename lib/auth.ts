import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";

// Authentication via Auth.js v5 (JWT sessions — no DB table). Sign-in providers
// are wired only when configured, so local dev works without OAuth apps. The
// "admin" is whoever signs in with an email listed in ADMIN_EMAILS; everyone
// else is a regular reader. isAdmin()/requireAdmin() keep the same signatures
// the rest of the app already calls, so call sites don't change.

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) providers.push(MicrosoftEntraID);

// Dev-only password-less login so admin gating is verifiable without real OAuth
// apps. HARD-GATED to non-production — it is never registered in a prod build.
if (process.env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: (creds) => {
        const email = String(creds?.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/login" },
  // Self-hosted behind a reverse proxy (NAS) — trust the forwarded host.
  trustHost: true,
});

// True if the current session belongs to an allow-listed admin email.
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && adminEmails().includes(email);
}

// Guard for mutations and protected reads. Throws if the caller isn't admin.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: admin access required.");
  }
}

// The signed-in user (or null), for nav display.
export async function currentUser(): Promise<{
  name?: string | null;
  email?: string | null;
} | null> {
  const session = await auth();
  return session?.user ?? null;
}
