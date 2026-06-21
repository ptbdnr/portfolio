"use client";

import { useState } from "react";
import Link from "next/link";
import { FaBars, FaTimes } from "react-icons/fa";
import Logo from "./Logo";
import { logout } from "@/app/actions/auth";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/stats", label: "Stats" },
];

const linkCls = "text-blue-600 no-underline hover:underline";

// The common top navigation, reused on every page. Collapses to a hamburger
// menu below md. Receives the session state from the server (TopNav).
export default function SiteHeader({
  user,
  isAdmin,
}: {
  user: { email?: string | null } | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const authLink = user ? (
    <form action={logout}>
      <button className="text-left text-gray-500 hover:underline">Logout</button>
    </form>
  ) : (
    <Link href="/login" onClick={close} className={linkCls}>
      Login
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 dark:border-gray-800/70 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-[1200px] items-center gap-4 px-6 py-3">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2 font-bold no-underline text-[var(--foreground)]"
        >
          <Logo />
          <span>Peter Bodnar</span>
        </Link>

        {/* Desktop */}
        <div className="ml-auto hidden items-center gap-5 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className={linkCls}>
              Admin
            </Link>
          )}
          {authLink}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="ml-auto rounded-md p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
        >
          {open ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-3 border-t border-gray-200/70 dark:border-gray-800/70 px-6 py-4 md:hidden"
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close} className={linkCls}>
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" onClick={close} className={linkCls}>
              Admin
            </Link>
          )}
          {authLink}
        </div>
      )}
    </header>
  );
}
