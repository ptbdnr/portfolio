"use client";

import { useState } from "react";
import {
  FaShareAlt,
  FaLink,
  FaTwitter,
  FaLinkedinIn,
  FaEnvelope,
  FaCheck,
} from "react-icons/fa";

// Per-post share control. Uses the native share sheet when available
// (mostly mobile); otherwise opens a small popover with copy-link + socials.
// Always shares the id-based permalink (/b/<id>) so the link survives slug edits.
export default function ShareButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const path = `/b/${id}`;
  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function onShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to popover */
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — the URL is shown below */
    }
  }

  const socials = [
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        url
      )}&text=${encodeURIComponent(title)}`,
      icon: <FaTwitter />,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        url
      )}`,
      icon: <FaLinkedinIn />,
    },
    {
      label: "Share by email",
      href: `mailto:?subject=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(url)}`,
      icon: <FaEnvelope />,
    },
  ];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onShare}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <FaShareAlt /> Share
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-[var(--background)] p-3 shadow-lg"
        >
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {copied ? <FaCheck className="text-emerald-600" /> : <FaLink />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {s.icon} {s.label}
            </a>
          ))}
          <div className="mt-2 truncate rounded bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs text-gray-500">
            {url}
          </div>
        </div>
      )}
    </div>
  );
}
