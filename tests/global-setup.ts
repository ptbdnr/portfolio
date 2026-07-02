import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Playwright global setup: build a fresh test database with one public and one
 * restricted item so the authorization specs have known content to probe.
 *
 * The webServer (see playwright.config.ts) is started with the same
 * DATABASE_URL, so it reads this database.
 */
async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "file:./data/test.db";
  // libsql opens (but does not create) the parent directory of a file: URL.
  const filePath = url.startsWith("file:") ? url.slice("file:".length) : null;
  if (filePath) {
    const dir = filePath.replace(/\/[^/]*$/, "");
    if (dir) mkdirSync(dir, { recursive: true });
  }
  const client = createClient({ url });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "./drizzle" });

  // Reset and seed.
  await client.execute("DELETE FROM content_access");
  await client.execute("DELETE FROM content_items");

  const publicId = crypto.randomUUID();
  const restrictedId = crypto.randomUUID();

  await client.execute({
    sql: "INSERT INTO content_items (id, slug, title, body, visibility) VALUES (?, ?, ?, ?, ?)",
    args: [publicId, "hello-public", "Hello (public)", "Public body.", "public"],
  });
  await client.execute({
    sql: "INSERT INTO content_items (id, slug, title, body, visibility) VALUES (?, ?, ?, ?, ?)",
    args: [
      restrictedId,
      "secret-plan",
      "Secret plan",
      "Restricted body.",
      "restricted",
    ],
  });
  await client.execute({
    sql: "INSERT INTO content_access (id, content_id, email) VALUES (?, ?, ?)",
    args: [crypto.randomUUID(), restrictedId, "alice@example.com"],
  });

  client.close();
}

export default globalSetup;
