"use client";
import Link from "next/link";
import { TournamentStatus } from "../../tournaments/types";

export interface AdminTournament {
  id: string;
  name: string;
  status: TournamentStatus;
  maxPlayers: number;
  participants: any[];
  createdAt: string;
}

interface Props {
  tournaments: AdminTournament[];
  onForceComplete: (id: string) => void;
}

export default function TournamentTable({ tournaments, onForceComplete }: Props) {
  return (
    <div className="bg-background border border-white/5 rounded-sm overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/80">Tournaments</h2>
        <span className="text-[10px] text-white/60 font-mono">{tournaments.length} total</span>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <thead className="sticky top-0 bg-background border-b border-white/10 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold text-white/60 uppercase tracking-widest">Identity / Name</th>
              <th className="px-4 py-3 text-[10px] font-bold text-white/60 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-white/60 uppercase tracking-widest">Players</th>
              <th className="px-4 py-3 text-[10px] font-bold text-white/60 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tournaments.map((t) => (
              <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-white">{t.name}</span>
                    <span className="text-[10px] text-white/60 font-mono uppercase tracking-tighter">{t.id.slice(0, 8)}...</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                    t.status === 'COMPLETED' ? 'text-primary border-primary/20 bg-primary/5' :
                    t.status === 'ONGOING'   ? 'text-amber-400 border-amber-400/20 bg-amber-400/5 animate-pulse' :
                    t.status === 'OPEN'      ? 'text-green-400 border-green-400/20 bg-green-400/5' :
                                               'text-white/60 border-white/5 bg-white/5'
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary/40" 
                        style={{ width: `${Math.min(100, (t.participants?.length || 0) / t.maxPlayers * 100)}%` }} 
                      />
                    </div>
                    <span className="text-[10px] text-white/60 font-mono">
                      {t.participants?.length || 0}/{t.maxPlayers}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {/* Every tournament's results, one click from the admin
                      dashboard (todo.md obj. 6.2). */}
                  <Link
                    href={`/tournaments/${t.id}/report`}
                    className="mr-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1 rounded-sm transition-all"
                  >
                    Report
                  </Link>
                  {t.status !== 'COMPLETED' && (
                    <button 
                      onClick={() => onForceComplete(t.id)} 
                      className="opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold uppercase tracking-widest text-primary hover:text-white hover:bg-primary/20 border border-primary/30 px-3 py-1 rounded-sm"
                    >
                      Force Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tournaments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-20 text-center text-[10px] text-white/60 uppercase tracking-widest italic">
                  No active tournament records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
