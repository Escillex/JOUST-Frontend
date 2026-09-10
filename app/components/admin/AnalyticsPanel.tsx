"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";

/** Mirrors AnalyticsOverview in server/src/analytics/analytics.service.ts. */
export interface GrowthPoint {
  month: string;
  signups: number;
  tournamentsCreated: number;
  tournamentsCompleted: number;
  entries: number;
}
export interface AnalyticsOverview {
  generatedAt: string;
  months: number;
  summary: {
    users: { total: number; registered: number; guests: number; admins: number; organizers: number };
    tournaments: { total: number; byStatus: Record<string, number>; completedWithoutTimestamp: number };
    participation: { entries: number; uniquePlayers: number; averageFieldSize: number };
    games: { catalog: number; retired: number };
  };
  growth: GrowthPoint[];
  games: { gameId: string | null; name: string; retired: boolean; tournaments: number; completed: number; entries: number; players: number }[];
  formats: { formatId: string | null; name: string; system: string | null; tournaments: number }[];
  systems: { system: string; tournaments: number }[];
  engagement: {
    participationDistribution: { bucket: string; players: number }[];
    returning: { players: number; repeat: number; returnRate: number };
    activity: { active30d: number; active90d: number; dormant: number };
  };
  operations: {
    matches: { total: number; completed: number; pending: number; ongoing: number; byes: number };
    duration: { samples: number; unmeasured: number; medianMinutes: number | null; p90Minutes: number | null };
    stalled: { matchesOngoingOver24h: number; tournamentsOngoingOver30d: number };
    forfeits: { participants: number; rate: number };
  };
}

const ACCENT = "#52B946";
const WINDOWS = [6, 12, 24] as const;

const SECTION = "text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]";
const PANEL = "bg-background border border-white/10 p-6 space-y-6";

/** Durations read as minutes until they stop being useful as minutes. */
function formatMinutes(m: number | null) {
  if (m === null) return "—";
  if (m < 1) return `${Math.round(m * 60)}s`;
  if (m < 90) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${Math.round(m - h * 60)}m`;
}

/** "2026-09" → "SEP 26". Axis ticks stay short so 24 of them still fit. */
function monthLabel(iso: string) {
  const [y, m] = iso.split("-");
  const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
}

/** One series of monthly counts. Small multiples rather than four series on one
 *  plot: signups and entries differ by an order of magnitude, and the honest way
 *  to show series of different scale is separate panels, never a second y-axis.
 *
 *  Laid out in CSS rather than SVG on purpose — a stretched viewBox cannot honour
 *  a pixel cap on bar width or a pixel gap between them, and both are fixed specs. */
function MonthlyColumns({ title, points, valueOf }: {
  title: string;
  points: GrowthPoint[];
  valueOf: (p: GrowthPoint) => number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map(valueOf);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);
  const active = hover !== null && points[hover] ? points[hover] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">{title}</h4>
        <span className="text-[10px] text-white/30 tabular-nums">{total.toLocaleString()} total</span>
      </div>

      {/* Hairline baseline, one step off the surface, solid — never dashed. */}
      <div className="relative h-24 border-b border-white/10">
        {total === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20 uppercase tracking-widest">
            No activity in this window
          </p>
        ) : (
          <div className="flex h-full items-end gap-[2px]">
            {points.map((p, i) => {
              const v = valueOf(p);
              return (
                // The hit target is the whole month band, so a 1-unit bar is still
                // reachable; the fill inside it stays capped at 24px.
                <div key={p.month} className="flex-1 h-full flex items-end justify-center"
                     onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                     tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                     role="img" aria-label={`${monthLabel(p.month)}: ${v}`}>
                  <div
                    className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                    style={{
                      height: v === 0 ? 0 : `${Math.max((v / max) * 100, 3)}%`,
                      backgroundColor: ACCENT,
                      opacity: hover === null || hover === i ? 1 : 0.35,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] text-white/25 tracking-widest tabular-nums">
        <span>{points.length ? monthLabel(points[0].month) : ""}</span>
        {/* Direct label only where it earns its place: the month under the cursor,
            falling back to the peak rather than labelling all twelve columns. */}
        <span className="text-white/60">
          {active
            ? `${monthLabel(active.month)} — ${valueOf(active).toLocaleString()}`
            : total > 0 ? `PEAK ${max.toLocaleString()}` : ""}
        </span>
        <span>{points.length ? monthLabel(points[points.length - 1].month) : ""}</span>
      </div>
    </div>
  );
}

/** Horizontal bars for magnitude-by-identity. Values ride the bar tips, so the
 *  chart is its own table and no value is locked behind a tooltip. */
function BarRows({ rows, emptyLabel }: {
  rows: { key: string; label: string; value: number; note?: string; muted?: boolean }[];
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="text-xs text-white/30">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`text-xs truncate ${r.muted ? "text-white/35" : "text-white"}`}>{r.label}</span>
            <span className="text-xs text-white/60 tabular-nums shrink-0">
              {r.value.toLocaleString()}
              {r.note ? <span className="text-white/25"> · {r.note}</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.06]">
            <div className="h-full rounded-r-[2px]"
                 style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`,
                          backgroundColor: r.muted ? "rgba(255,255,255,0.25)" : ACCENT }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [months, setMonths] = useState<number>(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (window: number) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.ANALYTICS}?months=${window}`);
      if (res.ok) {
        setData((await safeJson(res)) ?? null);
        setError(null);
      } else if (res.status === 0) {
        setError("Connection lost. Showing the last figures loaded.");
      } else {
        setError("Could not load analytics.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(months); }, [load, months]);

  if (!data) {
    return (
      <div className={PANEL}>
        <p className="text-xs text-white/40">{loading ? "Loading analytics…" : error ?? "No data."}</p>
      </div>
    );
  }

  const { summary, growth, engagement, operations } = data;
  const untimed = summary.tournaments.completedWithoutTimestamp;
  const act = engagement.activity;
  const activityTotal = Math.max(act.active30d + (act.active90d - act.active30d) + act.dormant, 1);

  return (
    // Refetch holds the previous figures at reduced opacity rather than flashing
    // a skeleton, so switching the window never jumps the layout.
    <div className={`space-y-8 pb-12 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
      {/* The window scopes the timeline and NOTHING else — every other panel is
          all-time. A control that looks like it filters the page but only moves
          one chart is worse than no control, so it says what it does. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-xs text-white/30">
          Aggregated server-side · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Timeline window">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Timeline</span>
          {WINDOWS.map((w) => (
            <button key={w} onClick={() => setMonths(w)}
                    aria-pressed={months === w}
                    className={`px-3 h-8 text-[10px] font-black uppercase tracking-widest border transition-colors ${
                      months === w ? "bg-primary text-black border-primary" : "border-white/10 text-white/50 hover:border-white/30"
                    }`}>
              {w}M
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[11px] text-[#FFCC00]">{error}</p>}

      {/* Hero figure — exactly one per view — plus supporting tiles. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-background border border-white/10 p-6 lg:col-span-1">
          <p className={SECTION}>Tournaments run</p>
          <p className="text-6xl font-black text-primary leading-none mt-4 font-poppins">{summary.tournaments.total.toLocaleString()}</p>
          <p className="text-[11px] text-white/30 mt-3">
            {(summary.tournaments.byStatus.COMPLETED ?? 0).toLocaleString()} completed ·{" "}
            {(summary.tournaments.byStatus.ONGOING ?? 0).toLocaleString()} ongoing
          </p>
        </div>
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Registered players", value: summary.users.registered, note: `${summary.users.guests.toLocaleString()} guest accounts` },
            { label: "Tournament entries", value: summary.participation.entries, note: `${summary.participation.uniquePlayers.toLocaleString()} distinct players` },
            { label: "Average field size", value: summary.participation.averageFieldSize, note: `across ${data.games.length} game${data.games.length === 1 ? "" : "s"} represented` },
          ].map((t) => (
            <div key={t.label} className="bg-background border border-white/10 p-6">
              <p className={SECTION}>{t.label}</p>
              <p className="text-4xl font-black text-white leading-none mt-4 font-poppins">{t.value.toLocaleString()}</p>
              <p className="text-[11px] text-white/30 mt-3">{t.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Growth — four small multiples, one scale each. */}
      <div className={PANEL}>
        <div className="flex items-center justify-between gap-3">
          <h3 className={SECTION}>Activity over time · last {data.months} months</h3>
          <button onClick={() => setShowTable((v) => !v)}
                  className="text-[9px] font-black text-primary uppercase tracking-widest hover:brightness-125">
            {showTable ? "Show charts" : "Show data table"}
          </button>
        </div>

        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="py-2 pr-4 font-semibold">Month</th>
                  <th className="py-2 pr-4 font-semibold text-right">Signups</th>
                  <th className="py-2 pr-4 font-semibold text-right">Created</th>
                  <th className="py-2 pr-4 font-semibold text-right">Completed</th>
                  <th className="py-2 font-semibold text-right">Entries</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {growth.map((p) => (
                  <tr key={p.month} className="border-t border-white/5 text-white/70">
                    <td className="py-1.5 pr-4">{monthLabel(p.month)}</td>
                    <td className="py-1.5 pr-4 text-right">{p.signups}</td>
                    <td className="py-1.5 pr-4 text-right">{p.tournamentsCreated}</td>
                    <td className="py-1.5 pr-4 text-right">{p.tournamentsCompleted}</td>
                    <td className="py-1.5 text-right">{p.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            <MonthlyColumns title="Player signups" points={growth} valueOf={(p) => p.signups} />
            <MonthlyColumns title="Tournaments created" points={growth} valueOf={(p) => p.tournamentsCreated} />
            <MonthlyColumns title="Tournaments completed" points={growth} valueOf={(p) => p.tournamentsCompleted} />
            <MonthlyColumns title="Entries" points={growth} valueOf={(p) => p.entries} />
          </div>
        )}

        <p className="text-[11px] text-white/25 leading-relaxed">
          Signups count registered accounts only; guests are excluded because they are deleted after
          their event. Entries are attributed to the month their tournament was created.
          {untimed > 0 && (
            <> {untimed.toLocaleString()} tournament{untimed === 1 ? "" : "s"} completed before completion
            timestamps were recorded and cannot be placed on this timeline.</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Games */}
        <div className={PANEL}>
          <h3 className={SECTION}>Tournaments by game · all time</h3>
          <BarRows
            emptyLabel="No tournaments yet."
            rows={data.games.map((g) => ({
              key: g.gameId ?? "none",
              label: g.name + (g.retired ? " (retired)" : ""),
              value: g.tournaments,
              note: `${g.entries.toLocaleString()} entries`,
              muted: g.retired || g.gameId === null,
            }))}
          />
          <p className="text-[11px] text-white/25">
            {summary.games.catalog} game{summary.games.catalog === 1 ? "" : "s"} in the catalog.
            Dimmed rows are tournaments on a retired placeholder or with no game set — reassign them
            to move their results onto a real board.
          </p>
        </div>

        {/* Formats & systems */}
        <div className={PANEL}>
          <h3 className={SECTION}>Tournaments by format preset · all time</h3>
          <BarRows
            emptyLabel="No tournaments yet."
            rows={data.formats.map((f) => ({
              key: f.formatId ?? "none",
              label: f.name,
              value: f.tournaments,
              note: f.system ? f.system.replace(/_/g, " ").toLowerCase() : undefined,
              muted: f.formatId === null,
            }))}
          />
          <div className="pt-2 border-t border-white/5 space-y-4">
            <h3 className={SECTION}>By bracket structure</h3>
            <BarRows
              emptyLabel="No tournaments yet."
              rows={data.systems.map((s) => ({
                key: s.system,
                label: s.system.replace(/_/g, " "),
                value: s.tournaments,
              }))}
            />
          </div>
        </div>
      </div>

      {/* Operational health — these are single numbers, so they are figures, not
          charts. A bar of one value is a stat tile with extra ink. */}
      <div className={PANEL}>
        <h3 className={SECTION}>Operational health · all time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Median match length</p>
            <p className="text-3xl font-black text-white leading-none mt-3 font-poppins">
              {formatMinutes(operations.duration.medianMinutes)}
            </p>
            <p className="text-[11px] text-white/30 mt-2">
              {operations.duration.samples > 0
                ? `p90 ${formatMinutes(operations.duration.p90Minutes)} · ${operations.duration.samples.toLocaleString()} timed`
                : "No timed matches yet"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Matches in progress</p>
            <p className="text-3xl font-black text-white leading-none mt-3 font-poppins">
              {operations.matches.ongoing.toLocaleString()}
            </p>
            <p className="text-[11px] text-white/30 mt-2">
              {operations.matches.pending.toLocaleString()} not started yet
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Matches played</p>
            <p className="text-3xl font-black text-white leading-none mt-3 font-poppins">
              {operations.matches.completed.toLocaleString()}
            </p>
            <p className="text-[11px] text-white/30 mt-2">
              {operations.matches.byes.toLocaleString()} resolved as byes
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Forfeit rate</p>
            <p className="text-3xl font-black text-white leading-none mt-3 font-poppins">
              {operations.forfeits.rate}%
            </p>
            <p className="text-[11px] text-white/30 mt-2">
              {operations.forfeits.participants.toLocaleString()} of {summary.participation.entries.toLocaleString()} entries
            </p>
          </div>
        </div>

        {/* Attention list. Status colour never carries the meaning alone — each
            row says in words what it is and how many. */}
        <div className="pt-4 border-t border-white/5 space-y-2">
          {[
            { label: "Matches started over 24 hours ago and still in progress", value: operations.stalled.matchesOngoingOver24h },
            { label: "Tournaments running for more than 30 days", value: operations.stalled.tournamentsOngoingOver30d },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <span className="text-[11px] text-white/40">{row.label}</span>
              <span className={`text-sm tabular-nums ${row.value > 0 ? "text-[#FFCC00]" : "text-white/40"}`}>
                {row.value > 0 ? `⚠ ${row.value.toLocaleString()}` : "0"}
              </span>
            </div>
          ))}
        </div>

        {operations.duration.unmeasured > 0 && (
          <p className="text-[11px] text-white/25 leading-relaxed">
            {operations.duration.unmeasured.toLocaleString()} completed match
            {operations.duration.unmeasured === 1 ? " has" : "es have"} no timing — finished before match
            timestamps existed, or recorded without starting the match first. Byes and walkovers are
            excluded from timing by design; they complete the moment they are created.
          </p>
        )}
      </div>

      {/* Engagement */}
      <div className={PANEL}>
        <h3 className={SECTION}>Player engagement · all time</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Tournaments entered per player</h4>
            <BarRows
              emptyLabel="No entries yet."
              rows={engagement.participationDistribution.map((d) => ({
                key: d.bucket,
                label: `${d.bucket} tournament${d.bucket === "1" ? "" : "s"}`,
                value: d.players,
              }))}
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Players who came back</h4>
            <p className="text-4xl font-black text-white leading-none font-poppins">{engagement.returning.returnRate}%</p>
            <p className="text-[11px] text-white/30 leading-relaxed">
              {engagement.returning.repeat.toLocaleString()} of {engagement.returning.players.toLocaleString()} registered
              players have entered more than one tournament.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">Recent activity</h4>
            {/* Part-to-whole with three known parts, so a labelled stacked bar
                reads faster than three separate tiles. 2px surface gaps, not borders. */}
            <div className="flex h-1.5 w-full gap-[2px]">
              {[
                { key: "30", value: act.active30d, color: ACCENT },
                { key: "90", value: Math.max(act.active90d - act.active30d, 0), color: "rgba(82,185,70,0.4)" },
                { key: "dormant", value: act.dormant, color: "rgba(255,255,255,0.15)" },
              ].map((seg) => (
                <div key={seg.key} style={{ width: `${(seg.value / activityTotal) * 100}%`, backgroundColor: seg.color }} />
              ))}
            </div>
            <dl className="space-y-1.5 text-[11px]">
              {[
                { label: "Played in the last 30 days", value: act.active30d },
                { label: "Last 90 days", value: act.active90d },
                { label: "Dormant (90+ days)", value: act.dormant },
              ].map((r) => (
                <div key={r.label} className="flex justify-between gap-3">
                  <dt className="text-white/40">{r.label}</dt>
                  <dd className="text-white tabular-nums">{r.value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-white/25 leading-relaxed">
              Measured from when a player&apos;s results last changed, so only players who have played
              at least one match appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
