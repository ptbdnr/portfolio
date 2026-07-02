import { streamChat, type ChatTurn } from "@/lib/llm";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep the conversation small and well-formed before it reaches the model.
function sanitize(messages: unknown): ChatTurn[] {
  if (!Array.isArray(messages)) return [];
  const out: ChatTurn[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim()
    ) {
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  return out.slice(-12);
}

// POST /api/chat — streams a grounded assistant reply as plain text. The model
// API key is used only here (server), never sent to the browser.
export async function POST(req: Request) {
  // Require a signed-in user. Chat calls cost money, so this keeps bots out —
  // enforced on the server, not just hidden in the UI.
  const session = await auth();
  if (!session?.user) {
    return new Response("Please sign in to chat.", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = sanitize((body as { messages?: unknown })?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("Expected a user message.", { status: 400 });
  }

  try {
    const stream = await streamChat(messages);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    // Most likely a missing/invalid API key — degrade gracefully.
    const msg = e instanceof Error ? e.message : "Chat is unavailable.";
    return new Response(`The chat assistant isn't available right now. ${msg}`, {
      status: 503,
    });
  }
}
