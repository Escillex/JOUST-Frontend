"use client";

/**
 * Tournament report (todo.md obj. 6.2): one page with the result, the final
 * placements, the standings, and every round's matches — printable as a
 * hand-out or saved as a PDF from the browser's print dialog.
 *
 * Built entirely from endpoints that already exist: GET /tournaments/:id (full
 * view carries participants with their recorded placement, and every round
 * with its matches) and GET /tournaments/:id/leaderboard (standings). Nothing
 * here is computed that the server has not already decided; where a value is
 * missing — placements for a tournament finished before they were recorded —
 * the report says so rather than inventing one.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ENDPOINTS, authenticatedFetch, displayNameOf, safeJson } from "../../../utils/api";
import {
  isGrandFinal,
  isLosersRound,
  losersRoundIndex,
} from "../bracket/roundNumbers";

// ── Shapes of what the two endpoints return (only what the report reads) ─────
interface Person { id: string; username: string | null; displayName?: string | null; isGuest?: boolean }
interface ReportMatch {
  id: string;
  status: string;
  isBye: boolean;
  player1Id: string | null;
  player2Id: string | null;
  player1: Person | null;
  player2: Person | null;
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  /** Names burned in when an account is deleted, so history still reads. */
  p1Name?: string | null;
  p2Name?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}
interface ReportRound { roundNumber: number; matches: ReportMatch[] }
interface ReportTournament {
  id: string;
  name: string;
  status: string;
  date: string | null;
  venue: string | null;
  createdAt: string;
  completedAt?: string | null;
  maxPlayers: number;
  prizePool: number | null;
  createdBy?: { username: string } | null;
  winner?: Person | null;
  game?: { name: string } | null;
  format?: { name: string; system: string } | null;
  participants: { userId: string; status?: string; placement?: number | null; user: Person }[];
  rounds?: ReportRound[];
}
interface Standing {
  rank: number; userId: string; username: string; displayName?: string | null; isGuest?: boolean;
  points: number; wins: number; losses: number; draws: number;
  matchWinPct: number; omw: number; oomw: number;
}

const SYSTEM_LABEL: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS: "Swiss",
  ROUND_ROBIN: "Round Robin",
  HYBRID: "Swiss → Top Cut",
};
/** Systems where standings ARE the result; elimination results are placements. */
const STANDINGS_SYSTEMS = new Set(["SWISS", "ROUND_ROBIN", "HYBRID"]);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

function roundLabel(n: number, system?: string) {
  if (n === 201) return "Grand Final Reset";
  if (isGrandFinal(n)) return "Grand Final";
  if (isLosersRound(n)) return `Losers Round ${losersRoundIndex(n)}`;
  if (system === "DOUBLE_ELIMINATION") return `Winners Round ${n}`;
  return `Round ${n}`;
}

function duration(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export default function TournamentReportPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<ReportTournament | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    Promise.all([
      authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(id)).then(async (r) => (r.ok ? safeJson(r) : null)),
      authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD(id)).then(async (r) => (r.ok ? safeJson(r) : null)),
    ]).then(([tour, board]) => {
      if (!alive) return;
      if (!tour) { setState("missing"); return; }
      setT(tour);
      setStandings(Array.isArray(board) ? board : Array.isArray(board?.leaderboard) ? board.leaderboard : []);
      setState("ready");
    });
    return () => { alive = false; };
  }, [id]);

  const derived = useMemo(() => {
    if (!t) return null;
    const rounds = [...(t.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
    const matches = rounds.flatMap((r) => r.matches);
    const played = matches.filter((m) => m.status === "COMPLETED" && !m.isBye);
    const draws = played.filter((m) => !m.winnerId).length;
    const byes = matches.filter((m) => m.isBye).length;
    const forfeited = t.participants.filter((p) => p.status === "FORFEITED").length;
    const starts = matches.map((m) => m.startedAt).filter(Boolean).map((s) => +new Date(s!));
    const span = starts.length && t.completedAt ? +new Date(t.completedAt) - Math.min(...starts) : null;

    const byUser = new Map(standings.map((s) => [s.userId, s]));
    const havePlacements = t.participants.some((p) => p.placement != null);
    // Placements recorded at completion are the result. Without them (a
    // tournament finished before they were stored, or still running) fall
    // back to standings order — and label it as such.
    const placements = havePlacements
      ? [...t.participants].sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999))
      : [...t.participants].sort((a, b) => (byUser.get(a.userId)?.rank ?? 9999) - (byUser.get(b.userId)?.rank ?? 9999));

    return { rounds, matches, played, draws, byes, forfeited, span, byUser, havePlacements, placements };
  }, [t, standings]);

  if (state === "loading") {
    return <div className="min-h-screen bg-background text-white/40 flex items-center justify-center text-sm">Preparing the report…</div>;
  }
  if (state === "missing" || !t || !derived) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-white/60">This tournament could not be found.</p>
        <Link href="/tournaments" className="text-primary text-xs font-black uppercase tracking-widest">Back to tournaments</Link>
      </div>
    );
  }

  const system = t.format?.system ?? "";
  const done = t.status === "COMPLETED";
  const nameOf = (p?: Person | null, fallback?: string | null) =>
    p ? displayNameOf(p as { username: string; displayName?: string | null }) : fallback || "TBD";
  const podium = derived.havePlacements
    ? derived.placements.filter((p) => p.placement && p.placement <= 3)
    : [];

  return (
    <div className="report min-h-screen bg-background text-white">
      <style jsx global>{`
        /* A report is meant to leave the screen. In print: black on white,
           no site chrome, and sections that do not split across pages. */
        @media print {
          @page { margin: 14mm; }
          html, body { background: #fff !important; }
          /* Hide the whole site, then reveal only the report and pin it to the
             top — robust to however the navigation happens to be built. */
          body * { visibility: hidden !important; }
          .report, .report * { visibility: visible !important; }
          .report { position: absolute; inset: 0 auto auto 0; width: 100%; }
          .report .no-print { display: none !important; }
          .report, .report * { background: transparent !important; color: #000 !important; box-shadow: none !important; }
          .report .rp-card { border: 1px solid #bbb !important; }
          .report .rp-accent { color: #1f6f16 !important; }
          .report table { border-collapse: collapse; }
          .report th, .report td { border-bottom: 1px solid #ddd !important; }
          .report section { break-inside: avoid; }
          .report .rp-round { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-28 pb-20 print:pt-0 space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <Link href={`/tournaments/${t.id}`} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary">
              ← Back to tournament
            </Link>
            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              Print / Save as PDF
            </button>
          </div>
          <p className="rp-accent text-[10px] font-black uppercase tracking-[0.3em] text-primary">Tournament Report</p>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter font-poppins leading-none">{t.name}</h1>
          <p className="text-sm text-white/50">
            {/* The preset name is dropped when it only repeats the system
                ("Double Elimination · Double Elimination"). */}
            {[t.game?.name, SYSTEM_LABEL[system] ?? system, t.format?.name]
              .filter((v, i, a) => v && a.findIndex((x) => x?.toLowerCase() === v.toLowerCase()) === i)
              .join(" · ")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              ["Status", done ? "Completed" : t.status.charAt(0) + t.status.slice(1).toLowerCase()],
              ["Event date", fmtDate(t.date ?? t.createdAt)],
              ["Completed", done ? fmtDate(t.completedAt) : "—"],
              ["Organizer", t.createdBy?.username ?? "—"],
              ...(t.venue ? [["Venue", t.venue]] : []),
              ...(t.prizePool ? [["Prize pool", String(t.prizePool)]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{k}</p>
                <p className="text-white/80 font-semibold mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {!done && (
            <p className="rp-card border border-amber-500/40 bg-amber-500/5 text-amber-400 text-xs px-4 py-3">
              This tournament is not finished. Everything below is provisional and reflects the state at the time of printing.
            </p>
          )}
        </div>

        {/* Result */}
        <section className="rp-card border-2 border-primary/40 bg-primary/5 p-6 md:p-8">
          <p className="rp-accent text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">
            {done ? "Champion" : "Current leader"}
          </p>
          <p className="text-3xl md:text-4xl font-black uppercase tracking-tight font-poppins">
            {t.winner
              ? nameOf(t.winner)
              : derived.placements[0]
                ? nameOf(derived.placements[0].user)
                : "Not decided"}
          </p>
          {podium.length > 1 && (
            <div className="flex flex-wrap gap-x-10 gap-y-2 mt-5">
              {podium.filter((p) => p.placement! > 1).map((p) => (
                <p key={p.userId} className="text-sm text-white/70">
                  <span className="font-black text-white/40 mr-2">{p.placement === 2 ? "2nd" : "3rd"}</span>
                  {nameOf(p.user)}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* Summary figures */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Players", `${t.participants.length} / ${t.maxPlayers}`],
            ["Matches played", String(derived.played.length)],
            ["Rounds", String(derived.rounds.length)],
            ["Draws", String(derived.draws)],
            ["Byes", String(derived.byes)],
            ["Forfeits", String(derived.forfeited)],
            ["Duration", derived.span ? duration(derived.span) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rp-card border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{k}</p>
              <p className="text-2xl font-black mt-1">{v}</p>
            </div>
          ))}
        </section>

        {/* Final placements */}
        <section>
          <h2 className="text-lg font-black uppercase tracking-widest font-poppins mb-1">Final placements</h2>
          <p className="text-[11px] text-white/40 mb-4">
            {derived.havePlacements
              ? "As recorded when the tournament was completed."
              : done
                ? "This tournament finished before placements were recorded, so players are listed in standings order."
                : "Not finished — players are listed in current standings order."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[9px] font-black uppercase tracking-widest text-white/30 border-b border-white/10">
                  <th className="py-2 pr-4 w-16">{derived.havePlacements ? "Place" : "Rank"}</th>
                  <th className="py-2 pr-4">Player</th>
                  <th className="py-2 pr-4 text-center">W / L / D</th>
                  {STANDINGS_SYSTEMS.has(system) && <th className="py-2 pr-4 text-center">Points</th>}
                  <th className="py-2 text-right">Note</th>
                </tr>
              </thead>
              <tbody>
                {derived.placements.map((p, i) => {
                  const s = derived.byUser.get(p.userId);
                  return (
                    <tr key={p.userId} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 font-black">
                        {derived.havePlacements ? (p.placement ?? "—") : (s?.rank ?? i + 1)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {nameOf(p.user)}
                        {p.user.isGuest && <span className="text-white/30 text-[10px] ml-2">guest</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-center text-white/70">{s ? `${s.wins} / ${s.losses} / ${s.draws}` : "—"}</td>
                      {STANDINGS_SYSTEMS.has(system) && <td className="py-2.5 pr-4 text-center">{s?.points ?? "—"}</td>}
                      <td className="py-2.5 text-right text-[11px] text-white/40">
                        {p.status === "FORFEITED" ? "Forfeited" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Standings — the result itself for Swiss/Round Robin, context for elimination */}
        {standings.length > 0 && STANDINGS_SYSTEMS.has(system) && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest font-poppins mb-1">Standings</h2>
            <p className="text-[11px] text-white/40 mb-4">Ordered by points, then the tournament&apos;s tie-breakers.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-black uppercase tracking-widest text-white/30 border-b border-white/10">
                    <th className="py-2 pr-4 w-16">Rank</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4 text-center">Points</th>
                    <th className="py-2 pr-4 text-center">W / L / D</th>
                    <th className="py-2 pr-4 text-center">Match win</th>
                    <th className="py-2 pr-4 text-center">OMW</th>
                    <th className="py-2 text-center">OOMW</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.userId} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 font-black">{s.rank}</td>
                      <td className="py-2.5 pr-4">{displayNameOf(s)}</td>
                      <td className="py-2.5 pr-4 text-center font-bold">{s.points}</td>
                      <td className="py-2.5 pr-4 text-center text-white/70">{s.wins} / {s.losses} / {s.draws}</td>
                      <td className="py-2.5 pr-4 text-center">{pct(s.matchWinPct)}</td>
                      <td className="py-2.5 pr-4 text-center text-white/60">{pct(s.omw)}</td>
                      <td className="py-2.5 text-center text-white/60">{pct(s.oomw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Every round */}
        <section>
          <h2 className="text-lg font-black uppercase tracking-widest font-poppins mb-4">
            {system.includes("ELIMINATION") ? "Bracket results" : "Round results"}
          </h2>
          {derived.rounds.length === 0 ? (
            <p className="text-sm text-white/40">No rounds have been played yet.</p>
          ) : (
            <div className="space-y-8">
              {derived.rounds.map((r) => (
                <div key={r.roundNumber} className="rp-round">
                  <p className="rp-accent text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-2">
                    {roundLabel(r.roundNumber, system)}
                  </p>
                  <div className="overflow-x-auto">
                    {/* Fixed columns so the score column lines up across every
                        round, not just within one. */}
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-10" />
                        <col />
                        <col className="w-24" />
                        <col />
                        <col className="w-24" />
                      </colgroup>
                      <tbody>
                        {r.matches.map((m, i) => {
                          const p1 = nameOf(m.player1, m.p1Name);
                          const p2 = m.isBye ? "Bye" : nameOf(m.player2, m.p2Name);
                          const w1 = m.winnerId && m.winnerId === m.player1Id;
                          const w2 = m.winnerId && m.winnerId === m.player2Id;
                          const note = m.isBye
                            ? "Bye"
                            : m.status !== "COMPLETED"
                              ? m.status === "ONGOING" ? "In progress" : "Not played"
                              : !m.winnerId
                                ? "Draw"
                                : m.startedAt && m.completedAt
                                  ? duration(+new Date(m.completedAt) - +new Date(m.startedAt))
                                  : "";
                          return (
                            <tr key={m.id} className="border-b border-white/5">
                              <td className="py-2 pr-3 text-white/30 text-[11px]">{i + 1}</td>
                              <td className={`py-2 pr-3 text-right truncate ${w1 ? "font-black" : "text-white/60"}`}>{p1}</td>
                              <td className="py-2 px-3 text-center font-mono whitespace-nowrap">
                                {m.isBye || m.status !== "COMPLETED" ? "–" : `${m.player1Score ?? 0} : ${m.player2Score ?? 0}`}
                              </td>
                              <td className={`py-2 pl-3 truncate ${w2 ? "font-black" : "text-white/60"}`}>{p2}</td>
                              <td className="py-2 text-right text-[11px] text-white/40 whitespace-nowrap">{note}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-[10px] text-white/25 pt-6 border-t border-white/5">
          Generated {new Date().toLocaleString()} · {t.id}
        </p>
      </div>
    </div>
  );
}
