import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentAccess,
  contentItems,
  type ContentItem,
} from "@/lib/db/schema";
import { canRead, isAdmin, type SessionUser } from "@/lib/authz";

export type Visibility = "public" | "restricted";

export async function getContentBySlug(
  slug: string,
): Promise<ContentItem | null> {
  const rows = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** Content items the user is allowed to see, newest first. */
export async function listReadableContent(
  user: SessionUser | null,
): Promise<ContentItem[]> {
  const all = await db
    .select()
    .from(contentItems)
    .orderBy(desc(contentItems.updatedAt));

  if (isAdmin(user)) return all;

  const readable: ContentItem[] = [];
  for (const item of all) {
    if (await canRead(user, item)) readable.push(item);
  }
  return readable;
}

export async function listAllContent(): Promise<ContentItem[]> {
  return db.select().from(contentItems).orderBy(desc(contentItems.updatedAt));
}

export async function getAccessEmails(contentId: string): Promise<string[]> {
  const rows = await db
    .select({ email: contentAccess.email })
    .from(contentAccess)
    .where(eq(contentAccess.contentId, contentId));
  return rows.map((r) => r.email);
}

function normalizeEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@")),
    ),
  );
}

export type ContentInput = {
  slug: string;
  title: string;
  body: string;
  visibility: Visibility;
  /** ACL emails; ignored unless visibility === 'restricted'. */
  accessEmails?: string[];
};

export async function createContent(input: ContentInput): Promise<ContentItem> {
  const [item] = await db
    .insert(contentItems)
    .values({
      slug: input.slug.trim(),
      title: input.title.trim(),
      body: input.body,
      visibility: input.visibility,
    })
    .returning();

  if (input.visibility === "restricted") {
    await replaceAccessEmails(item.id, input.accessEmails ?? []);
  }
  return item;
}

export async function updateContent(
  id: string,
  input: ContentInput,
): Promise<ContentItem | null> {
  const [item] = await db
    .update(contentItems)
    .set({
      slug: input.slug.trim(),
      title: input.title.trim(),
      body: input.body,
      visibility: input.visibility,
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, id))
    .returning();

  if (!item) return null;

  if (input.visibility === "restricted") {
    await replaceAccessEmails(item.id, input.accessEmails ?? []);
  } else {
    // Public items keep no ACL.
    await db.delete(contentAccess).where(eq(contentAccess.contentId, item.id));
  }
  return item;
}

export async function deleteContent(id: string): Promise<void> {
  // contentAccess rows are removed by ON DELETE CASCADE.
  await db.delete(contentItems).where(eq(contentItems.id, id));
}

async function replaceAccessEmails(
  contentId: string,
  emails: string[],
): Promise<void> {
  await db.delete(contentAccess).where(eq(contentAccess.contentId, contentId));
  const normalized = normalizeEmails(emails);
  if (normalized.length === 0) return;
  await db
    .insert(contentAccess)
    .values(normalized.map((email) => ({ contentId, email })));
}

export async function slugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(
      excludeId
        ? and(eq(contentItems.slug, slug))
        : eq(contentItems.slug, slug),
    )
    .limit(1);
  const found = rows[0];
  if (!found) return false;
  return excludeId ? found.id !== excludeId : true;
}
