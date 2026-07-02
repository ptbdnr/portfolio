import { NextResponse } from "next/server";
import { getSessionUser, canWrite } from "@/lib/authz";
import {
  createContent,
  listReadableContent,
  slugExists,
} from "@/lib/content";
import { parseContentInput } from "@/lib/validation";

/** List content the caller is allowed to read. */
export async function GET() {
  const user = await getSessionUser();
  const items = await listReadableContent(user);
  return NextResponse.json({ items });
}

/** Create content. Admin only. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!canWrite(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseContentInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (await slugExists(parsed.value.slug)) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }

  const item = await createContent(parsed.value);
  return NextResponse.json({ item }, { status: 201 });
}
