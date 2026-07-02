import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * A piece of portfolio content.
 *
 * `visibility`:
 *   - 'public'     → readable by anyone (including anonymous visitors)
 *   - 'restricted' → readable only by the admin and by users named in
 *                    `contentAccess` for this item.
 *
 * `slug` is what appears in a shareable direct link: /content/<slug>.
 */
export const contentItems = sqliteTable("content_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  visibility: text("visibility", { enum: ["public", "restricted"] })
    .notNull()
    .default("public"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Per-item access control list. A row grants one email address read access to
 * one restricted content item. "Privileged" is therefore evaluated per content
 * item, not as a global role — the same user can be named on one item and not
 * on another.
 */
export const contentAccess = sqliteTable(
  "content_access",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    // Stored lowercased; matched against the verified email from the OIDC provider.
    email: text("email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    contentEmailUnique: uniqueIndex("content_access_content_email_unique").on(
      table.contentId,
      table.email,
    ),
  }),
);

export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type ContentAccessRow = typeof contentAccess.$inferSelect;
