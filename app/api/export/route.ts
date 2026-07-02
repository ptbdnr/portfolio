import { isAdmin } from "@/lib/auth";
import { exportBundle } from "@/lib/exportImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export -> a .zip backup of the whole dataset. Admin only: the export
// contains drafts and analytics, so it must never be publicly reachable.
export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await exportBundle();
  const body = new Uint8Array(data.byteLength);
  body.set(data);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="portfolio-export-${stamp}.zip"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
