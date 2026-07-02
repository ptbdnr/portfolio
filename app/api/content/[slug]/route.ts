import { NextResponse } from "next/server";
import { getSessionUser, canWrite, canRead } from "@/lib/authz";
import {
  getContentBySlug,
  getAccessEmails,
  updateContent,
  deleteContent,
  slugExists,
} from "@/lib/content";
import { parseContentInput } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

/** Read a single item. Restricted items require ACL membership (404 otherwise). */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const user = await getSessionUser();
  const item = await getContentBySlug(slug);

  // Return 404 (not 403) on denial so restricted items stay invisible.
  if (!item || !(await canRead(user, item))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accessEmails = canWrite(user)
    ? await getAccessEmails(item.id)
    : undefined;
  return NextResponse.json({ item, accessEmails });
}

/** Update an item. Admin only. */
export async function PUT(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!canWrite(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getContentBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = parseContentInput(await req.json().catch(() => null));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (
    parsed.value.slug !== existing.slug &&
    (await slugExists(parsed.value.slug, existing.id))
  ) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }

  const item = await updateContent(existing.id, parsed.value);
  return NextResponse.json({ item });
}

/** Delete an item. Admin only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!canWrite(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getContentBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteContent(existing.id);
  return NextResponse.json({ ok: true });
}
