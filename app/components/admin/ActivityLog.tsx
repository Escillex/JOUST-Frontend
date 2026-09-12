"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";

/**
 * The admin dashboard's record of what organizers and admins did (todo.md obj.
 * 3.1) — read from GET /admin/audit, written server-side by the @Audit
 * interceptor after each action succeeds.
 *
 * This replaces a "System Audit Log" card that was removed for inventing
 * log-looking lines from a re-download of every user and tournament every ten
 * seconds. These entries are real, and are fetched on demand rather than
 * polled: an audit trail does not need to tick, and a dashboard on venue Wi-Fi
 * should not re-pull it every few seconds (Core Rule 8).
 */
interface Entry {
  id: string;
  createdAt: string;
  actorName: string;
  actorRoles: string[];
  category: string;
  action: string;
  summary: string;
  tournamentId: string | null;
  tournamentName: string | null;
}

const CATEGORIES: [string, string][] = [
  ["", "All"],
  ["TOURNAMENT", "Tournaments"],
  ["PARTICIPANT", "Participants"],
  ["MATCH", "Matches"],
  ["STAFF", "Staff"],
  ["USER", "Users"],
  ["AWARD", "Awards"],
  ["CATALOG", "Catalog"],
  ["SYSTEM", "System"],
];

const CATEGORY_TONE: Record<string, string> = {
  TOURNAMENT: "text-primary border-primary/30",
  PARTICIPANT: "text-sky-400 border-sky-400/30",
  MATCH: "text-white/70 border-white/20",
  STAFF: "text-violet-400 border-violet-400/30",
  USER: "text-amber-400 border-amber-400/30",
  AWARD: "text-yellow-300 border-yellow-300/30",
  CATALOG: "text-white/50 border-white/15",
  SYSTEM: "text-[#FF4D4D] border-[#FF4D4D]/30",
};

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString();
}

const roleOf = (roles: string[]) =>
  roles.includes("ADMIN") ? "Admin" : roles.includes("ORGANIZER") ? "Organizer" : roles.length ? "Player" : "";

export default function ActivityLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // debounced copy of `search`
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = useCallback(
    (after?: string) => {
      const p = new URLSearchParams({ limit: "40" });
      if (category) p.set("category", category);
      if (query) p.set("q", query);
      if (after) p.set("cursor", after);
      return `${API_ENDPOINTS.ADMIN.AUDIT}?${p.toString()}`;
    },
    [category, query],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const res = await authenticatedFetch(url());
    const data = await safeJson(res);
    if (res.ok && data) {
      setEntries(data.entries ?? []);
      setCursor(data.nextCursor ?? null);
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, [url]);

  useEffect(() => { void load(); }, [load]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await authenticatedFetch(url(cursor));
    const data = await safeJson(res);
    if (res.ok && data) {
      setEntries((e) => [...e, ...(data.entries ?? [])]);
      setCursor(data.nextCursor ?? null);
    }
    setLoadingMore(false);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    if (debounce.current) clearTimeout(debounce.current);
    // One request per pause in typing, not per keystroke.
    debounce.current = setTimeout(() => setQuery(v.trim()), 350);
  };

  return (
    <div className="bg-background border border-white/10 p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Activity Log</h3>
          <p className="text-xs text-white/30 mt-1">
            Every organizer and admin action, newest first. Recorded only after the action succeeded.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search people, tournaments, actions"
            className="flex-1 sm:w-72 h-9 bg-black border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="h-9 px-4 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:border-white/30 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(([value, label]) => (
          <button
            key={value || "all"}
            onClick={() => setCategory(value)}
            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-all ${
              category === value ? "bg-primary text-black border-primary" : "border-white/10 text-white/40 hover:text-white hover:border-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="text-xs text-[#FF4D4D]">Could not load the activity log. Check the connection and refresh.</p>
      ) : loading ? (
        <p className="text-xs text-white/30 py-8 text-center">Loading activity…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-white/30 py-8 text-center">
          {query || category ? "Nothing matches these filters." : "No actions recorded yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 border-b border-white/10">
                <th className="py-2 pr-4 w-28">When</th>
                <th className="py-2 pr-4 w-44">Who</th>
                <th className="py-2 pr-4">What</th>
                <th className="py-2 w-24 text-right">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.id} className="align-top hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-[11px] text-white/40 whitespace-nowrap" title={new Date(e.createdAt).toLocaleString()}>
                    {ago(e.createdAt)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <p className="text-xs text-white font-semibold truncate">{e.actorName}</p>
                    <p className="text-[9px] uppercase tracking-widest text-white/30">{roleOf(e.actorRoles)}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-white/80 leading-relaxed">
                    {e.summary}
                    {e.tournamentId && (
                      <Link
                        href={`/tournaments/${e.tournamentId}/report`}
                        className="ml-2 text-[9px] font-bold uppercase tracking-widest text-white/30 hover:text-primary"
                      >
                        Report →
                      </Link>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[8px] font-bold uppercase tracking-widest border px-1.5 py-0.5 ${CATEGORY_TONE[e.category] ?? "text-white/40 border-white/10"}`}>
                      {e.category.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && !loading && (
        <button
          onClick={more}
          disabled={loadingMore}
          className="w-full py-2.5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:border-white/30 disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "Load older entries"}
        </button>
      )}
    </div>
  );
}
