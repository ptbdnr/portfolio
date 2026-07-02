"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  visibility: "public" | "restricted";
  accessEmails: string[];
};

const EMPTY: AdminItem = {
  id: "",
  slug: "",
  title: "",
  body: "",
  visibility: "public",
  accessEmails: [],
};

export default function AdminDashboard({
  initialItems,
}: {
  initialItems: AdminItem[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminItem>(EMPTY);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEditing = editingSlug !== null;

  function edit(item: AdminItem) {
    setDraft({ ...item });
    setEditingSlug(item.slug);
    setError(null);
  }

  function resetForm() {
    setDraft(EMPTY);
    setEditingSlug(null);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      slug: draft.slug,
      title: draft.title,
      body: draft.body,
      visibility: draft.visibility,
      accessEmails: draft.accessEmails,
    };

    const url = isEditing
      ? `/api/content/${editingSlug}`
      : "/api/content";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      resetForm();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(slug: string) {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/content/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      if (editingSlug === slug) resetForm();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/content/${slug}`;
    navigator.clipboard?.writeText(url);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={save} className="space-y-3">
        <h2 className="text-xl font-semibold">
          {isEditing ? `Edit: ${editingSlug}` : "New content"}
        </h2>

        <label className="block">
          <span className="text-sm">Slug (used in the link)</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="my-content"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Title</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Body</span>
          <textarea
            className="w-full border rounded px-3 py-2 h-40"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-sm">Visibility</span>
          <select
            className="w-full border rounded px-3 py-2"
            value={draft.visibility}
            onChange={(e) =>
              setDraft({
                ...draft,
                visibility: e.target.value as "public" | "restricted",
              })
            }
          >
            <option value="public">public — anyone can read</option>
            <option value="restricted">restricted — named users only</option>
          </select>
        </label>

        {draft.visibility === "restricted" && (
          <label className="block">
            <span className="text-sm">
              Allowed emails (one per line or comma-separated)
            </span>
            <textarea
              className="w-full border rounded px-3 py-2 h-24"
              value={draft.accessEmails.join("\n")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  accessEmails: e.target.value.split(/[\n,]/),
                })
              }
              placeholder="alice@example.com&#10;bob@example.com"
            />
          </label>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {isEditing ? "Save changes" : "Create"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="border rounded px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div>
        <h2 className="text-xl font-semibold mb-3">
          Existing content ({initialItems.length})
        </h2>
        <ul className="space-y-3">
          {initialItems.map((item) => (
            <li key={item.id} className="border rounded p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    /content/{item.slug} · {item.visibility}
                    {item.visibility === "restricted" &&
                      ` · ${item.accessEmails.length} user(s)`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 text-sm">
                <button
                  onClick={() => edit(item)}
                  className="text-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => copyLink(item.slug)}
                  className="text-blue-600"
                >
                  Copy link
                </button>
                <a
                  href={`/content/${item.slug}`}
                  className="text-blue-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <button
                  onClick={() => remove(item.slug)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {initialItems.length === 0 && (
            <li className="text-gray-500 text-sm">No content yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
