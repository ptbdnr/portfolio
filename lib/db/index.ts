import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { databaseUrl } from "@/lib/env";
import * as schema from "./schema";

/**
 * Lazily-created Drizzle client.
 *
 * The connection is opened on first query rather than at import time, so that
 * build-time page-data collection (which imports these modules without a real
 * database present) does not try to open a connection.
 */
let _db: LibSQLDatabase<typeof schema> | null = null;

function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    const client = createClient({ url: databaseUrl });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
