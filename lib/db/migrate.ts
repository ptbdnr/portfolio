import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseUrl } from "@/lib/env";

/**
 * Applies pending migrations from ./drizzle. Run at deploy/startup:
 *   npm run db:migrate
 */
async function main() {
  const client = createClient({ url: databaseUrl });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
