"use server";

import { signIn, signOut } from "@/lib/auth";

// Thin server-action wrappers around Auth.js sign-in/out, callable from forms.

// OAuth providers (google | microsoft-entra-id). Redirects to the provider,
// then back home (where the chat lives).
export async function loginWith(provider: string) {
  await signIn(provider, { redirectTo: "/" });
}

// Dev-only password-less login (the "dev" Credentials provider exists only in
// non-production builds; in production this simply fails to sign in).
export async function loginDev(formData: FormData) {
  await signIn("dev", {
    email: String(formData.get("email") || ""),
    redirectTo: "/",
  });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
