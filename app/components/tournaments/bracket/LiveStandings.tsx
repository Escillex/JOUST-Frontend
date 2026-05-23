import { LeaderboardEntry } from "../../../tournaments/[id]/bracket/types";

const MaximizeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
  </svg>
);

interface Props { leaderboard: LeaderboardEntry[]; onMaximize: () => void; }

export default function LiveStandings({ leaderboard, onMaximize }: Props) {
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
                <th className="py-4 px-6 text-center">PTS</th>
                <th className="py-4 px-6 text-right">RATIO</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-black text-foreground uppercase">
              {leaderboard.map(e => (
                <tr key={e.userId} className={`border-b border-foreground/5 transition-all ${e.rank === 1 ? 'bg-primary/5' : 'hover:bg-foreground/5'}`}>
                  <td className="py-4 px-6 text-primary">
                    <div className="flex items-center gap-2">
                      #{e.rank.toString().padStart(2, "0")}
                      {e.rank === 1 && <span className="text-[8px] px-1 bg-primary text-black">TOP</span>}
                    </div>
                  </td>
                  <td className={`py-4 px-2 truncate max-w-[120px] ${e.rank === 1 ? 'text-primary' : ''}`}>{e.username}</td>
                  <td className={`py-4 px-6 text-center ${e.rank === 1 ? 'text-primary font-bold' : ''}`}>{e.points}</td>
                  <td className="py-4 px-6 text-right text-foreground/40">{(e.matchWinPct * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
