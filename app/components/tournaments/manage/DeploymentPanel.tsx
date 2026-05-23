import { Tournament } from "../../../tournaments/types";

const inputCls = "h-10 bg-[#1B1B1B] border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-[#52B946] transition-colors rounded w-full";

interface Props {
  tournament: Tournament;
  allUsers: { id: string; username: string }[];
  guestUsername: string;
  setGuestUsername: (v: string) => void;
  batchGuestCount: number | "";
  setBatchGuestCount: (v: number | "") => void;
  selectedUserId: string;
  setSelectedUserId: (v: string) => void;
  onAddGuest: () => void;
  onBatchAddGuests: () => void;
  onInvitePlayer: () => void;
  batchLoading?: boolean;
}

export default function DeploymentPanel({ tournament, allUsers, guestUsername, setGuestUsername, batchGuestCount, setBatchGuestCount, selectedUserId, setSelectedUserId, onAddGuest, onBatchAddGuests, onInvitePlayer, batchLoading = false }: Props) {
  const available = allUsers.filter(u => !tournament.participants.some(p => p.userId === u.id));
  const remaining = tournament.maxPlayers - tournament.participants.length;
  const hasFormat = !!tournament.formatId;

  if (tournament.status === "UPCOMING") {
    return (
      <div className="bg-[#1B1B1B] border border-white/20 p-4 rounded flex items-start gap-4">
        <div className="p-2 bg-[#FFCC00]/10 rounded border border-[#FFCC00]/20">
          <svg className="w-4 h-4 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <p className="text-sm text-[#888888]">
          Management interface locked. <span className="text-white">Change status to OPEN</span> to unlock management systems.
        </p>
      </div>
    );
  }

  if (tournament.status !== "OPEN") return null;

  if (!hasFormat) return (
    <div className="bg-transparent border border-dashed border-white/20 p-12 rounded flex justify-center opacity-50">
      <p className="text-sm font-semibold text-[#888888]">Select Format Preset to Enable Participant Deployment</p>
    </div>
  );

  return (
    <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded space-y-6">
      <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-4">Participant Management</h3>

      {/* Add Guest */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#888888] block">Add Guest Participant</label>
        <div className="flex gap-2">
          <input placeholder="Guest Username" value={guestUsername} onChange={e => setGuestUsername(e.target.value)} className={inputCls} />
          <button onClick={onAddGuest} className="w-10 h-10 bg-[#52B946] text-black font-semibold hover:brightness-90 transition-colors rounded flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>
      </div>

      {/* Invite Player */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#888888] block">Add Registered User</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className={inputCls}>
            <option value="">Select User</option>
            {available.map(u => (
              <option key={u.id} value={u.id}>{((u as any).username || "Unknown")}</option>
            ))}
          </select>
          <button onClick={onInvitePlayer} className="px-4 h-10 sm:w-auto w-full bg-[#1B1B1B] border border-white/20 text-white font-semibold text-sm rounded hover:bg-white/10 transition-colors whitespace-nowrap">
            Add User
          </button>
        </div>
      </div>

      {/* Batch Add Guests */}
      {remaining > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex justify-between items-end">
            <label className="text-xs font-semibold text-[#888888] block">Bulk Guest Creation</label>
            <span className="text-xs text-[#888888]">Remaining Slots: {remaining}</span>
          </div>
          <div className="flex gap-2">
            <input type="number" min="1" max={remaining} placeholder="Count" value={batchGuestCount} onChange={e => setBatchGuestCount(e.target.value === "" ? "" : Number(e.target.value))} className={`w-24 ${inputCls}`} />
            <button onClick={onBatchAddGuests} disabled={batchLoading || !batchGuestCount} className={`flex-1 h-10 font-semibold text-sm transition-colors rounded px-4 ${batchLoading ? 'bg-[#1B1B1B] text-[#888888] cursor-not-allowed' : 'bg-[#1B1B1B] border border-[#52B946] text-[#52B946] hover:bg-[#52B946] hover:text-black'}`}>
              {batchLoading ? 'Generating...' : 'Generate Guests'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
