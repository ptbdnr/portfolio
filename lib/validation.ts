import type { ContentInput, Visibility } from "@/lib/content";

export type ParsedInput = { value: ContentInput } | { error: string };

/** Validate and normalize a content create/update request body. */
export function parseContentInput(body: unknown): ParsedInput {
  if (!body || typeof body !== "object") {
    return { error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const content = typeof b.body === "string" ? b.body : "";
  const visibility: Visibility =
    b.visibility === "restricted" ? "restricted" : "public";

  if (!slug) return { error: "slug is required" };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: "slug may only contain lowercase letters, numbers, and hyphens",
    };
  }
  if (!title) return { error: "title is required" };

  let accessEmails: string[] = [];
  if (Array.isArray(b.accessEmails)) {
    accessEmails = b.accessEmails.filter(
      (e): e is string => typeof e === "string",
    );
  } else if (typeof b.accessEmails === "string") {
    accessEmails = b.accessEmails.split(/[\n,]/);
  }

  return { value: { slug, title, body: content, visibility, accessEmails } };
}
