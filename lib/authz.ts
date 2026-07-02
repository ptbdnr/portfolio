import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/env";
import { db } from "@/lib/db";
import { contentAccess, type ContentItem } from "@/lib/db/schema";

export type SessionUser = {
  email: string;
  name?: string | null;
  role: "admin" | "user";
};

/** The signed-in user (with normalized email), or null when anonymous. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.email) return null;
  return {
    email: sessionUser.email.toLowerCase(),
    name: sessionUser.name,
    role: sessionUser.role ?? "user",
  };
}

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && (user.role === "admin" || isAdminEmail(user.email));
}

/** Any authenticated user may use the chat. */
export function canUseChat(user: SessionUser | null): boolean {
  return user !== null;
}

/** Only the admin may create/edit/delete content. */
export function canWrite(user: SessionUser | null): boolean {
  return isAdmin(user);
}

/**
 * Whether `user` may read `item`.
 *
 * - public items: everyone, including anonymous visitors
 * - admin: everything
 * - restricted items: only if the user's email is on the item's ACL
 *
 * Denials should surface as 404 (not 403) so we don't reveal that a restricted
 * item exists to people who aren't on its list.
 */
export async function canRead(
  user: SessionUser | null,
  item: Pick<ContentItem, "id" | "visibility">,
): Promise<boolean> {
  if (item.visibility === "public") return true;
  if (!user) return false;
  if (isAdmin(user)) return true;

  const rows = await db
    .select({ id: contentAccess.id })
    .from(contentAccess)
    .where(
      and(
        eq(contentAccess.contentId, item.id),
        eq(contentAccess.email, user.email),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
