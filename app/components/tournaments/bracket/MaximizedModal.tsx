import { LeaderboardEntry } from "../../../tournaments/[id]/bracket/types";

interface LogEntry { id: string; action: string; details?: string; timestamp: string; }

interface Props {
  panel: "TERMINAL" | "STANDINGS" | null;
  logs: LogEntry[];
  leaderboard: LeaderboardEntry[];
  onClose: () => void;
}

export default function MaximizedModal({ panel, logs, leaderboard, onClose }: Props) {
  if (!panel) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#1B1B1B]/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="w-full max-w-6xl bg-background border border-primary/20 rounded-[3rem] flex flex-col h-[85vh] shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-10 right-10 w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/20 hover:text-white transition-all font-black text-xl font-poppins z-50">✕</button>

        <div className="p-12 pb-6 shrink-0">
          <span className="text-xs font-black text-primary uppercase tracking-[0.4em] font-poppins mb-2 block">Full Screen View</span>
          <h2 className="text-4xl md:text-6xl font-black text-foreground uppercase tracking-tighter font-poppins">
            {panel === "TERMINAL" ? "Terminal Logs" : "Tournament Standings"}
          </h2>
        </div>

        {panel === "TERMINAL" ? (
          <div className="px-12 pb-12 flex-1 overflow-hidden flex flex-col">
            <div className="bg-foreground/5 border border-white/5 rounded-[2rem] p-8 flex-1 overflow-y-auto custom-scrollbar font-mono text-sm space-y-6">
              {logs.map(log => (
                <div key={log.id} className="flex gap-8 border-b border-white/5 pb-4 last:border-0">
                  <span className="text-foreground/20 shrink-0 font-black">[{log.timestamp}]</span>
                  <span className="text-primary font-black uppercase tracking-widest">{log.action}</span>
                  {log.details && <span className="text-foreground/40 tracking-wider">/ {log.details}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-12 pb-12 flex-1 overflow-hidden flex flex-col">
            <div className="bg-foreground/5 border border-white/5 rounded-[2rem] flex-1 overflow-hidden flex flex-col">
              <div className="px-8 bg-[#161616] border-b border-white/10 shrink-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.4em]">
                      <th className="py-6 px-8 w-32">RANK</th>
                      <th className="py-6 px-4">PARTICIPANT</th>
                      <th className="py-6 px-8 text-center w-48">POINTS</th>
                      <th className="py-6 px-8 text-center w-48">W-D-L</th>
                      <th className="py-6 px-8 text-right w-48">WIN RATIO</th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-8">
                <table className="w-full text-left border-collapse">
                  <tbody className="text-lg font-black text-foreground uppercase">
                    {leaderboard.map(e => (
                      <tr key={e.userId} className="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td className="py-8 px-8 text-primary font-poppins text-2xl w-32">#{e.rank.toString().padStart(2, "0")}</td>
                        <td className="py-8 px-4 font-poppins tracking-tighter text-2xl">{e.username}</td>
                        <td className="py-8 px-8 text-center font-poppins text-2xl w-48">{e.points}</td>
                        <td className="py-8 px-8 text-center text-foreground/40 font-poppins text-2xl w-48">{e.wins}-{e.draws || 0}-{e.losses}</td>
                        <td className="py-8 px-8 text-right text-foreground/60 font-poppins text-2xl w-48">{(e.matchWinPct * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
