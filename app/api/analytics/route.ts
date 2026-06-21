import { recordEvent } from "@/lib/analytics";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/analytics — first-party event beacon (pageview/click/heartbeat/leave).
// Always answers 204 and never leaks state; bad payloads are simply ignored.
// When the visitor is signed in, the event is tagged with their identity
// (read from the session here on the server — never trusted from the client).
export async function POST(req: Request) {
  try {
    const [body, session] = await Promise.all([req.json(), auth()]);
    const identity = session?.user
      ? { email: session.user.email, name: session.user.name }
      : undefined;
    recordEvent(body, identity);
  } catch {
    /* ignore malformed beacons */
  }
  return new Response(null, { status: 204 });
}
