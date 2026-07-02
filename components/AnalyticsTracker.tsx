"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Privacy-respecting, first-party page analytics. A random visitor id lives in
// localStorage and a session id in sessionStorage — no cookies, no IP, no PII.
// Sends a pageview on navigation, click events, and a "leave" event with the
// time spent when the page is hidden/unloaded. The server attributes /blog/<slug>
// paths to posts.
function getOrCreate(key: string, store: Storage): string {
  try {
    let v = store.getItem(key);
    if (!v) {
      v =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      store.setItem(key, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visitorId = getOrCreate("pf_vid", localStorage);
    const sessionId = getOrCreate("pf_sid", sessionStorage);
    const start = Date.now();

    const send = (type: string, durationMs?: number) => {
      const payload = JSON.stringify({
        visitorId,
        sessionId,
        type,
        path: pathname,
        durationMs: durationMs ?? null,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/analytics",
            new Blob([payload], { type: "application/json" })
          );
        } else {
          fetch("/api/analytics", {
            method: "POST",
            body: payload,
            keepalive: true,
            headers: { "content-type": "application/json" },
          });
        }
      } catch {
        /* best-effort */
      }
    };

    send("pageview");

    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el && el.closest("a,button")) send("click");
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") send("leave", Date.now() - start);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onHide);
      send("leave", Date.now() - start);
    };
  }, [pathname]);

  return null;
}
