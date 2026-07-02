import Link from "next/link";
import type { Metadata } from "next";
import ContentShell from "@/components/ContentShell";
import {
  contentStats,
  visitorSummary,
  viewsByDay,
  topPosts,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats — Peter Bodnar",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (sec <= 0) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function StatsPage() {
  const content = contentStats();
  const visitors = visitorSummary();
  const days = viewsByDay(30);
  const top = topPosts(8);

  const dayMax = Math.max(1, ...days.map((d) => d.views));
  const topMax = Math.max(1, ...top.map((p) => p.views));
  const monthMax = Math.max(1, ...content.timeline.map((m) => m.count));

  return (
    <ContentShell>
      <h1 className="text-2xl font-bold mb-2">Stats</h1>
      <p className="text-gray-500 mb-8">
        Writing output and how the site is being read.
      </p>

      {/* ---- Content ---- */}
      <h2 className="text-lg font-bold mb-3">Content</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label="Published" value={content.byStatus.published} />
        <StatCard
          label="Drafts"
          value={content.byStatus.draft}
          sub={`${content.byStatus.archived} archived`}
        />
        <StatCard
          label="Words"
          value={content.totalWords.toLocaleString()}
          sub="across published posts"
        />
        <StatCard
          label="Reading time"
          value={`${content.totalReadingMinutes}m`}
        />
      </div>

      {content.tags.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-medium mb-2">Tags</div>
          <div className="flex flex-wrap gap-2">
            {content.tags.map((t) => (
              <Link
                key={t.tag}
                href={`/search?tag=${encodeURIComponent(t.tag)}`}
                className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t.tag} <span className="text-gray-500">{t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {content.timeline.length > 0 && (
        <div className="mb-10">
          <div className="text-sm font-medium mb-2">Posts over time</div>
          <div className="flex items-end gap-1 h-24">
            {content.timeline.map((m) => (
              <div
                key={m.month}
                title={`${m.month}: ${m.count}`}
                className="flex-1 min-w-[6px] rounded-t bg-blue-500/70"
                style={{ height: `${(m.count / monthMax) * 100}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---- Visitors ---- */}
      <h2 className="text-lg font-bold mb-3">Visitors</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label="Page views" value={visitors.totalViews.toLocaleString()} />
        <StatCard label="Unique visitors" value={visitors.uniqueVisitors.toLocaleString()} />
        <StatCard label="Clicks" value={visitors.totalClicks.toLocaleString()} />
        <StatCard
          label="Avg. time on page"
          value={fmtDuration(visitors.avgTimeOnPageSec)}
        />
      </div>

      <div className="mb-6">
        <div className="text-sm font-medium mb-2">Views — last 30 days</div>
        {days.length === 0 ? (
          <p className="text-sm text-gray-400">No views recorded yet.</p>
        ) : (
          <div className="flex items-end gap-[2px] h-28">
            {days.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.views} views`}
                className="flex-1 min-w-[3px] rounded-t bg-blue-500/70"
                style={{ height: `${(d.views / dayMax) * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Most-read posts</div>
        {top.length === 0 ? (
          <p className="text-sm text-gray-400">No post views yet.</p>
        ) : (
          <div className="space-y-3">
            {top.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between text-sm">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="text-blue-600 hover:underline truncate"
                  >
                    {p.title}
                  </Link>
                  <span className="text-gray-500 ml-2 shrink-0">{p.views}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded bg-blue-500"
                    style={{ width: `${(p.views / topMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ContentShell>
  );
}
