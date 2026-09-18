"use client";
import { Tournament } from "../../../tournaments/types";

const inputCls = "h-10 bg-background border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded w-full";

interface Props {
  tournament: Tournament;
  batchGuestCount: number | "";
  setBatchGuestCount: (v: number | "") => void;
  onBatchAddGuests: () => void;
  batchLoading?: boolean;
}

// The only thing this panel does is bulk guest creation. Adding a single guest
// is the header's Add Guest modal, and adding a registered player is the header's
// Invite Player button — both were duplicated here before, so this keeps just the
// one control with no other home. The "Allow Bulk Guest Creation" setting is
// effectively on/off for this component: off means the panel does not render and
// the server refuses the batch route, while single guest add and invites are
// untouched. The flag is served on the tournament itself because co-organizers
// get 403 on the admin-only settings read.
export default function AddParticipantsPanel({ tournament, batchGuestCount, setBatchGuestCount, onBatchAddGuests, batchLoading = false }: Props) {
  const remaining = tournament.maxPlayers - tournament.participants.length;
  const hasFormat = !!tournament.formatId;

  if (!tournament.allowBulkGuestCreation) return null;

  if (tournament.status === "UPCOMING") {
    return (
      <div className="bg-background border border-white/20 p-4 rounded flex items-start gap-4">
        <div className="p-2 bg-[#FFCC00]/10 rounded border border-[#FFCC00]/20">
          <svg className="w-4 h-4 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <p className="text-sm text-[#888888]">
          Participants can only be changed while registration is open. <span className="text-white">Set the status to OPEN</span> to make changes.
        </p>
      </div>
    );
  }

  if (tournament.status !== "OPEN") return null;

  if (!hasFormat) return (
    <div className="bg-transparent border border-dashed border-white/20 p-12 rounded flex justify-center opacity-50">
      <p className="text-sm font-semibold text-[#888888]">Select a format preset to start adding participants</p>
    </div>
  );

  if (remaining <= 0) return null;

  return (
    <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded space-y-6">
      <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-4">Participant Management</h3>

      {/* Bulk Guest Creation. `remaining` is the full-roster backstop. */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <label className="text-xs font-semibold text-[#888888] block">Bulk Guest Creation</label>
          <span className="text-xs text-[#888888]">Remaining Slots: {remaining}</span>
        </div>
        <div className="flex gap-2">
          <input type="number" min="1" max={remaining} placeholder="Count" value={batchGuestCount} onChange={e => setBatchGuestCount(e.target.value === "" ? "" : Number(e.target.value))} className={`w-24 ${inputCls}`} />
          <button onClick={onBatchAddGuests} disabled={batchLoading || !batchGuestCount} className={`flex-1 h-10 font-semibold text-sm transition-colors rounded px-4 ${batchLoading ? 'bg-background text-[#888888] cursor-not-allowed' : 'bg-background border border-primary text-primary hover:bg-primary hover:text-black'}`}>
            {batchLoading ? 'Generating...' : 'Generate Guests'}
          </button>
        </div>
      </div>
    </div>
  );
}
