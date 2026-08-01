"use client";
import { Tournament } from "../../../tournaments/types";
import { useToast } from "../../ui/Toast";
import ConnectionPill from "../../ui/ConnectionPill";
import LastUpdated from "../../ui/LastUpdated";

interface Props {
  tournament: Tournament;
  tournamentId: string;
  onBack: () => void;
  onOpenTournament: () => void;
  onStartTournament: () => void;
  onViewBracket: () => void;
  onRefresh?: () => void;
  /** Whether the page is receiving live updates or has fallen back to polling.
   *  The organizer console is the one screen where acting on stale data has
   *  consequences, so it must say which mode it is in. */
  connected?: boolean;
  lastUpdated?: Date | null;
}

export default function ControlRoomHeader({ tournament, tournamentId, onBack, onOpenTournament, onStartTournament, onViewBracket, onRefresh, connected, lastUpdated }: Props) {
  const { toast } = useToast();

  // Puts the public invite URL on the clipboard so the organizer can
  // paste it into chat apps. The short slug is preferred; tournaments
  // created before slugs existed fall back to the long UUID token.
  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/tournaments/invite/${tournament.slug ?? tournament.inviteToken}`;

    // The modern Clipboard API only exists in a "secure context": HTTPS, or
    // http://localhost. When the app is opened over a plain-HTTP LAN IP (for
    // example http://192.168.x.x:3000 during device testing) navigator.clipboard
    // is undefined, so we fall back to the old textarea + execCommand method,
    // which works there too.
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast("Invite link copied to clipboard", "success");
        return;
      } catch {
        // Permission denied or blocked — drop through to the fallback below.
      }
    }

    // Fallback: put the URL in an off-screen textarea, select it, and ask the
    // browser to copy the selection. execCommand is deprecated but is the only
    // copy path available outside a secure context.
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      // Keep it out of view and out of the layout so nothing flickers.
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        toast("Invite link copied to clipboard", "success");
      } else {
        // Even the fallback failed — show the link so it can be copied by hand.
        toast(`Could not copy automatically. Link: ${url}`, "error");
      }
    } catch {
      toast(`Could not copy automatically. Link: ${url}`, "error");
    }
  };

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
              <div className={`w-2 h-2 rounded-full ${tournament.status === 'COMPLETED' ? 'bg-white/50' : 'bg-primary'}`} />
              <span className="text-xs font-semibold text-[#888888]">{tournament.status}</span>
            </div>
            <span className="text-xs text-[#888888]">
              {(typeof tournament.format === 'string' ? tournament.format : tournament.format?.system || "UNKNOWN").replace(/_/g, " ")} <span className="mx-2">/</span> ₱{tournament.prizePool?.toLocaleString() || "0"} POOL
            </span>
            {connected !== undefined && <ConnectionPill connected={connected} />}
            <LastUpdated lastUpdated={lastUpdated ?? null} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 w-full md:w-auto mt-4 md:mt-0">
        {onRefresh && (
          <button onClick={onRefresh} className="px-4 py-2.5 bg-background border border-white/20 text-white rounded hover:bg-white/10 transition-colors flex items-center justify-center group" title="Refresh Data">
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button onClick={handleCopyInvite} className="flex-1 md:flex-none px-6 py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors">
          Copy Invite Link
        </button>
        <button onClick={onViewBracket} className="flex-1 md:flex-none px-6 py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors">
          View Bracket
        </button>

        {tournament.status === "UPCOMING" && (
          <button onClick={onOpenTournament} className="flex-1 md:flex-none px-6 py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors">
            Open Registration
          </button>
        )}
        {tournament.status === "OPEN" && (
          <button onClick={onStartTournament} className="flex-1 md:flex-none px-6 py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors">
            Start Tournament
          </button>
        )}
      </div>
    </div>
  );
}
