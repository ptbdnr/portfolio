import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { isAdminEmail } from "@/lib/env";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Two OpenID Connect providers. Client id/secret are read from the environment
 * automatically by the providers:
 *   Google    → AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
 *   Microsoft → AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET
 *
 * Identity for authorization is the verified email claim. We derive a coarse
 * `role` ('admin' | 'user') from the ADMIN_EMAILS allowlist. Fine-grained,
 * per-item access ("privileged") is decided at read time against the ACL, not
 * baked into the token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google, MicrosoftEntraID],
  callbacks: {
    async jwt({ token }) {
      const email = token.email ? token.email.toLowerCase() : null;
      token.email = email ?? undefined;
      token.role = isAdminEmail(email) ? "admin" : "user";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email =
          session.user.email?.toLowerCase() ?? session.user.email;
        session.user.role = (token.role as "admin" | "user") ?? "user";
      }
      return session;
    },
  },
});
