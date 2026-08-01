"use client";
import { LeaderboardEntry } from "../../../tournaments/[id]/bracket/types";
import { tieBreakerLabel } from "../../../utils/formatConfig";

const MaximizeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
  </svg>
);

interface Props {
  leaderboard: LeaderboardEntry[];
  onMaximize: () => void;
  /** The configured tiebreaker order for this tournament, most significant
   *  first. Passed in rather than assumed: it is configurable, and hardcoding
   *  OMW here would state something false for any event that changed it. */
  tieBreakerOrder: string[];
}

/** Reads the value a given tiebreaker key refers to off an entry. Keys match
 *  the backend getters in `leaderboard.service.ts` tiebreakCriterion. */
function tieBreakerValue(entry: LeaderboardEntry, key: string): number | null {
  switch (key) {
    case "omw": return entry.omw;
    case "oomw": return entry.oomw;
    case "matchWinPct": return entry.matchWinPct;
    case "wins": return entry.wins;
    case "losses": return entry.losses;
    default: return null;
  }
}

/** Percentage-style tiebreakers are 0..1 ratios; counts are shown as-is. */
function formatTieBreaker(key: string, value: number | null): string {
  if (value === null) return "—";
  if (key === "omw" || key === "oomw" || key === "matchWinPct") {
    return `${(value * 100).toFixed(0)}%`;
  }
  return String(value);
}

export default function LiveStandings({ leaderboard, onMaximize, tieBreakerOrder }: Props) {
  // The first configured criterion is the one that actually decides most ties,
  // so that is the column worth the space in this narrow panel.
  const primary = tieBreakerOrder[0] ?? "omw";
  const primaryLabel = tieBreakerLabel(primary);

  // Which rows are level on points with a neighbour. Those are exactly the rows
  // whose order the tiebreaker column explains; without this a player on equal
  // points could not tell why they were ranked below someone.
  const tiedOnPoints = new Set<string>();
  for (let i = 0; i < leaderboard.length; i++) {
    const prev = leaderboard[i - 1];
    const next = leaderboard[i + 1];
    if (
      (prev && prev.points === leaderboard[i].points) ||
      (next && next.points === leaderboard[i].points)
    ) {
      tiedOnPoints.add(leaderboard[i].userId);
    }
  }

  return (
    <div className="bg-foreground/5 border border-foreground/5 p-8 rounded-[3rem]">
      <div className="flex justify-between items-center mb-6 border-b border-foreground/10 pb-4">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.4em] font-poppins">Live Standings</h3>
        <button onClick={onMaximize} className="p-2 hover:bg-primary/10 rounded-lg text-foreground/20 hover:text-primary transition-all" title="MAXIMIZE">
          <MaximizeIcon />
        </button>
      </div>
      <div className="bg-background rounded-2xl overflow-hidden h-64 border border-foreground/5">
        <div className="h-full overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.3em] border-b border-foreground/5 sticky top-0 bg-background z-10">
                <th className="py-4 px-6">RANK</th>
                <th className="py-4 px-2">PARTICIPANT</th>
                <th className="py-4 px-4 text-center">PTS</th>
                <th
                  className="py-4 px-4 text-center"
                  title={`Tiebreaker: players level on points are separated by ${tieBreakerOrder.map(tieBreakerLabel).join(" → ")}`}
                >
                  {primaryLabel}
                </th>
                <th className="py-4 px-6 text-right">RATIO</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-black text-foreground uppercase">
              {leaderboard.map(e => {
                const isTied = tiedOnPoints.has(e.userId);
                return (
                  <tr key={e.userId} className={`border-b border-foreground/5 transition-all ${e.rank === 1 ? 'bg-primary/5' : 'hover:bg-foreground/5'}`}>
                    <td className="py-4 px-6 text-primary">
                      <div className="flex items-center gap-2">
                        #{e.rank.toString().padStart(2, "0")}
                        {e.rank === 1 && <span className="text-[8px] px-1 bg-primary text-black">TOP</span>}
                      </div>
                    </td>
                    <td className={`py-4 px-2 truncate max-w-[120px] ${e.rank === 1 ? 'text-primary' : ''}`}>{e.username}</td>
                    <td className={`py-4 px-4 text-center ${e.rank === 1 ? 'text-primary font-bold' : ''}`}>{e.points}</td>
                    <td
                      className={`py-4 px-4 text-center ${isTied ? 'text-foreground/70' : 'text-foreground/25'}`}
                      title={isTied ? `Level on points — ${primaryLabel} is deciding this placing` : undefined}
                    >
                      {formatTieBreaker(primary, tieBreakerValue(e, primary))}
                    </td>
                    <td className="py-4 px-6 text-right text-foreground/40">{(e.matchWinPct * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-[9px] text-foreground/25 uppercase tracking-widest leading-relaxed">
        Ties on points are broken by {tieBreakerOrder.map(tieBreakerLabel).join(" → ")}
      </p>
    </div>
  );
}
