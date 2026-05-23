import { Tournament } from "../../../tournaments/types";

interface Props {
  tournament: Tournament;
  tournamentId: string;
  onBack: () => void;
  onOpenTournament: () => void;
  onStartTournament: () => void;
  onViewBracket: () => void;
  onRefresh?: () => void;
}

export default function ControlRoomHeader({ tournament, tournamentId, onBack, onOpenTournament, onStartTournament, onViewBracket, onRefresh }: Props) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pb-6 border-b border-white/20">
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-[#888888] hover:text-white transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Dashboard
        </button>
        
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">{tournament.name}</h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${tournament.status === 'COMPLETED' ? 'bg-white/50' : 'bg-[#52B946]'}`} />
              <span className="text-xs font-semibold text-[#888888]">{tournament.status}</span>
            </div>
            <span className="text-xs text-[#888888]">
              {(typeof tournament.format === 'string' ? tournament.format : tournament.format?.system || "UNKNOWN").replace(/_/g, " ")} <span className="mx-2">/</span> ₱{tournament.prizePool?.toLocaleString() || "0"} POOL
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 w-full md:w-auto mt-4 md:mt-0">
        {onRefresh && (
          <button onClick={onRefresh} className="px-4 py-2.5 bg-[#1B1B1B] border border-white/20 text-white rounded hover:bg-white/10 transition-colors flex items-center justify-center group" title="Refresh Data">
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button onClick={onViewBracket} className="flex-1 md:flex-none px-6 py-2.5 bg-[#1B1B1B] border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors">
          View Bracket
        </button>

        {tournament.status === "UPCOMING" && (
          <button onClick={onOpenTournament} className="flex-1 md:flex-none px-6 py-2.5 bg-[#52B946] text-black font-semibold text-xs rounded hover:brightness-90 transition-colors">
            Open Registration
          </button>
        )}
        {tournament.status === "OPEN" && (
          <button onClick={onStartTournament} className="flex-1 md:flex-none px-6 py-2.5 bg-[#52B946] text-black font-semibold text-xs rounded hover:brightness-90 transition-colors">
            Start Tournament
          </button>
        )}
      </div>
    </div>
  );
}
