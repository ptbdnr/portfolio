import { NextResponse } from "next/server";
import { getSessionUser, canUseChat } from "@/lib/authz";

/**
 * Chat endpoint. Any authenticated user may use it; anonymous callers are
 * rejected. The actual chat backend is a stub here — wire it to your model /
 * assistant of choice.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!canUseChat(user)) {
    return NextResponse.json(
      { error: "Sign in to use the chat" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const message =
    body && typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Placeholder echo response — replace with a real chat backend.
  return NextResponse.json({
    reply: `Hi ${user!.name ?? user!.email}, you said: ${message}`,
  });
}
