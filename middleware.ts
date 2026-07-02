import { auth } from "@/auth";

/**
 * Early gate for the admin area. This is defense-in-depth only: every data read
 * and mutation re-checks authorization server-side (see lib/authz.ts), so a
 * bypass of the middleware still cannot read or change anything.
 */
export default auth((req) => {
  const { nextUrl } = req;
  if (nextUrl.pathname.startsWith("/admin")) {
    const user = req.auth?.user;
    if (!user) {
      const signInUrl = new URL("/api/auth/signin", nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", nextUrl.href);
      return Response.redirect(signInUrl);
    }
    if (user.role !== "admin") {
      return Response.redirect(new URL("/", nextUrl.origin));
    }
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
