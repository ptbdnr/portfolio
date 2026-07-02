"use client";

import { useActionState } from "react";
import { importData } from "@/lib/actions";
import type { ImportResult } from "@/lib/exportImport";

export default function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(
    importData,
    null
  );
  return (
    <form action={action} className="space-y-2">
      <input
        type="file"
        name="bundle"
        accept=".zip"
        className="block text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white"
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <input type="checkbox" name="confirm" />
        I understand this replaces all current data (a backup is taken first).
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import bundle"}
      </button>
      {state && (
        <p
          className={`text-sm ${
            state.ok ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
