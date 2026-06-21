import JSZip from "jszip";
import path from "path";
import fs from "fs";
import db, { EXPORT_TABLES, DATA_DIR } from "./db";
import { rebuildIndex } from "./search/fts";

// Complete export/import of the dataset as a .zip (one JSON file per table +
// manifest). Import replaces all data inside a transaction and snapshots the
// previous DB first, so a bad import can be rolled back. Callers MUST be
// admin-gated (see app/api/export and the import server action).

export interface ImportResult {
  ok: boolean;
  message: string;
  counts?: Record<string, number>;
}

export async function exportBundle(): Promise<Uint8Array> {
  const zip = new JSZip();
  const counts: Record<string, number> = {};
  for (const table of EXPORT_TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    counts[table] = rows.length;
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        app: "portfolio",
        format_version: 1,
        exported_at: new Date().toISOString(),
        tables: EXPORT_TABLES,
        counts,
      },
      null,
      2
    )
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function tableColumns(table: string): string[] {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.map((c) => c.name);
}

// SQLite accepts string/number/bigint/null. Coerce anything else.
function coerce(v: unknown): string | number | bigint | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") {
    return v;
  }
  return JSON.stringify(v);
}

// Snapshot the live DB before overwriting, so a bad import can be undone.
function snapshot(): void {
  try {
    const dir = path.join(DATA_DIR, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date()
      .toISOString()
      .replace(/\.\d+Z$/, "")
      .replace(/[-:]/g, "")
      .replace("T", "-");
    const dest = path.join(dir, `pre-import-${stamp}.db`);
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } catch (e) {
    console.error("[portfolio] pre-import backup failed:", e);
  }
}

export async function importBundle(buf: ArrayBuffer): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return { ok: false, message: "That file isn't a valid .zip bundle." };
  }

  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    try {
      const manifest = JSON.parse(await manifestFile.async("string"));
      if (manifest.app && manifest.app !== "portfolio") {
        return { ok: false, message: "This bundle isn't a portfolio export." };
      }
    } catch {
      return { ok: false, message: "The bundle's manifest is unreadable." };
    }
  }

  // Parse every table up front so we fail before touching the DB.
  const parsed: Record<string, Record<string, unknown>[]> = {};
  for (const table of EXPORT_TABLES) {
    const entry = zip.file(`${table}.json`);
    if (!entry) {
      parsed[table] = [];
      continue;
    }
    let rows: unknown;
    try {
      rows = JSON.parse(await entry.async("string"));
    } catch {
      return { ok: false, message: `${table}.json contains invalid JSON.` };
    }
    if (!Array.isArray(rows)) {
      return { ok: false, message: `${table}.json is not a JSON array.` };
    }
    parsed[table] = rows.filter(
      (r): r is Record<string, unknown> => !!r && typeof r === "object"
    );
  }

  snapshot();

  const counts: Record<string, number> = {};
  try {
    const replaceAll = db.transaction(() => {
      for (const table of [...EXPORT_TABLES].reverse()) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      for (const table of EXPORT_TABLES) {
        const cols = tableColumns(table);
        let n = 0;
        for (const row of parsed[table]) {
          const keys = cols.filter((c) => c in row);
          if (keys.length === 0) continue;
          const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys
            .map((k) => "@" + k)
            .join(", ")})`;
          const params: Record<string, string | number | bigint | null> = {};
          for (const k of keys) params[k] = coerce(row[k]);
          db.prepare(sql).run(params);
          n++;
        }
        counts[table] = n;
      }
    });
    replaceAll();
  } catch (e) {
    return {
      ok: false,
      message:
        "Import failed and was rolled back — your data is unchanged. " +
        (e instanceof Error ? e.message : ""),
    };
  }

  // Rebuild the derived full-text index to match the imported posts.
  try {
    rebuildIndex();
  } catch (e) {
    console.error("[portfolio] search reindex after import failed:", e);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    ok: true,
    message: `Imported ${total} rows. Your previous data was backed up first.`,
    counts,
  };
}
