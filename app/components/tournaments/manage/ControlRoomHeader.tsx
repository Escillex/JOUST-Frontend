"use client";
import { useState } from "react";
import { Tournament } from "../../../tournaments/types";
import { useToast } from "../../ui/Toast";
import ConnectionPill from "../../ui/ConnectionPill";
import LastUpdated from "../../ui/LastUpdated";
import ShareModal from "./ShareModal";

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
  onAddGuest?: () => void;
  onInvitePlayer?: () => void;
  onCompleteTournament?: () => void;
}

export default function ControlRoomHeader({ tournament, tournamentId, onBack, onOpenTournament, onStartTournament, onViewBracket, onRefresh, connected, lastUpdated, onAddGuest, onInvitePlayer, onCompleteTournament }: Props) {
  const { toast } = useToast();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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

  const inviteUrl = `${window.location.origin}/tournaments/invite/${tournament.slug ?? tournament.inviteToken}`;

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pb-6 border-b border-white/20">
      {isShareModalOpen && (
        <ShareModal
          url={inviteUrl}
          onClose={() => setIsShareModalOpen(false)}
          onCopy={handleCopyInvite}
        />
      )}
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
              {(typeof tournament.format === 'string' ? tournament.format : tournament.format?.system || "UNKNOWN").replace(/_/g, " ")} <span className="mx-2">/</span> {tournament.prizePool || "No prize"}
            </span>
            {connected !== undefined && <ConnectionPill connected={connected} />}
            <LastUpdated lastUpdated={lastUpdated ?? null} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0 justify-end">
        <div className="flex flex-col gap-2 flex-1 md:w-[320px]">
          {/* Row 1: Share | Toggle Public View */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIsShareModalOpen(true)} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
              Share
            </button>
            <button onClick={onViewBracket} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
              Toggle Public View
            </button>
          </div>

          {/* Row 2: Add Guest | Invite Player (only when OPEN) */}
          {tournament.status === "OPEN" && (
            <div className="grid grid-cols-2 gap-2">
              {onAddGuest && (
                <button onClick={onAddGuest} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
                  Add Guest
                </button>
              )}
              {onInvitePlayer && (
                <button onClick={onInvitePlayer} className="w-full py-2.5 bg-background border border-primary/40 text-primary font-semibold text-xs rounded hover:bg-primary/10 transition-colors whitespace-nowrap">
                  Invite Player
                </button>
              )}
            </div>
          )}

          {/* Row 3: Refresh (text) | Start Tournament / Open Registration / Finalize Tournament */}
          {(tournament.status === "UPCOMING" || tournament.status === "OPEN") && (
            <div className="grid grid-cols-2 gap-2">
              {onRefresh && (
                <button onClick={onRefresh} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
                  Refresh
                </button>
              )}
              {tournament.status === "UPCOMING" && (
                 <button onClick={onOpenTournament} className="w-full py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors whitespace-nowrap">
                  Open Registration
                </button>
              )}
              {tournament.status === "OPEN" && (
                <button onClick={onStartTournament} className="w-full py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors whitespace-nowrap">
                  Start Tournament
                </button>
              )}
            </div>
          )}

          {/* Ongoing tournament actions: Refresh + Finalize if all matches complete */}
          {tournament.status === "ONGOING" && (
            <div className="grid grid-cols-2 gap-2">
              {onRefresh && (
                <button onClick={onRefresh} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
                  Refresh
                </button>
              )}
              {onCompleteTournament && (
                <button onClick={onCompleteTournament} className="w-full py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors whitespace-nowrap">
                  Finalize Tournament
                </button>
              )}
            </div>
          )}

          {/* Fallback refresh for other statuses */}
          {tournament.status !== "UPCOMING" && tournament.status !== "OPEN" && tournament.status !== "ONGOING" && onRefresh && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onRefresh} className="w-full py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors whitespace-nowrap">
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
