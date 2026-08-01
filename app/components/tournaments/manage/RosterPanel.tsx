"use client";
import { useState } from "react";
import { Tournament, FormatConfig } from "../../../tournaments/types";
import { DragDropProvider, PointerSensor, DragEndEvent } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

interface Props {
  tournament: Tournament;
  allUsers: { id: string; username: string }[];
  onReorder: (activeUserId: string, newIndex: number) => void;
  onRemove: (userId: string) => void;
  onForfeit: (userId: string) => void;
  onReplace: (userId: string, body: { substituteUserId?: string; guestName?: string }) => void;
  /** userId currently being forfeited or replaced; its row shows a busy state. */
  actingOn: string | null;
}

interface CardProps {
  p: Tournament["participants"][number];
  idx: number;
  /** Seeding drag + the hard "remove from roster" action: registration phase only. */
  isAdmin: boolean;
  /** Forfeit/replace are live-roster corrections, available while the tournament
   *  is OPEN or ONGOING but never once it has completed. */
  canManage: boolean;
  /** True once the player has a completed match: replacing them would rewrite
   *  history, so only forfeit remains available. */
  hasPlayed: boolean;
  isForfeited: boolean;
  busy: boolean;
  /** Registered accounts not already in this tournament, offered as substitutes. */
  substituteOptions: { id: string; username: string }[];
  onRemove: (id: string) => void;
  onForfeit: (id: string) => void;
  onReplace: (id: string, body: { substituteUserId?: string; guestName?: string }) => void;
}

function SortableParticipantCard({
  p, idx, isAdmin, canManage, hasPlayed, isForfeited, busy,
  substituteOptions, onRemove, onForfeit, onReplace,
}: CardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: p.userId,
    index: idx,
    disabled: !isAdmin,
  });

  // The replace form is inline per row rather than a modal, so the organizer
  // keeps the rest of the roster in view while choosing a substitute.
  const [replacing, setReplacing] = useState(false);
  const [substituteUserId, setSubstituteUserId] = useState("");
  const [guestName, setGuestName] = useState("");

  const submitReplace = () => {
    if (substituteUserId) onReplace(p.userId, { substituteUserId });
    else if (guestName.trim()) onReplace(p.userId, { guestName: guestName.trim() });
    else return;
    setReplacing(false);
    setSubstituteUserId("");
    setGuestName("");
  };

  return (
    <div ref={ref} className="space-y-px">
      <div
        className={`bg-[#000000] border transition-colors rounded flex items-center justify-between group h-12 px-4 ${isDragging ? 'border-primary bg-white/5' : 'border-white/20 hover:border-white/40'} ${isForfeited ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-4">
          {isAdmin && (
            <div
              ref={handleRef}
              className="cursor-grab active:cursor-grabbing text-[#888888] hover:text-white transition-colors py-2 px-3 -ml-3 touch-none flex items-center h-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16"/>
              </svg>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[#888888] font-mono text-xs w-6 text-right">{idx + 1}.</span>
            <span className={`text-sm font-semibold truncate max-w-[120px] md:max-w-xs ${isForfeited ? 'text-[#888888] line-through' : 'text-white'}`}>
              {p.user?.username || "Unknown"}
            </span>
          </div>
          {p.user?.isGuest && (
            <span className="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded uppercase font-semibold">Guest</span>
          )}
          {isForfeited && (
            <span className="text-[9px] bg-white/5 text-[#888888] px-1.5 py-0.5 rounded uppercase font-semibold">Forfeited</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#888888] font-mono hidden md:inline">#{p.user?.id?.slice(0, 6)}</span>

          {canManage && !isForfeited && !hasPlayed && (
            <button
              onClick={() => setReplacing(v => !v)}
              disabled={busy}
              className="text-[10px] uppercase font-semibold tracking-wide text-[#888888] hover:text-white disabled:opacity-40 transition-colors"
              title="Substitute another player into this slot"
            >
              Replace
            </button>
          )}
          {canManage && !isForfeited && (
            <button
              onClick={() => onForfeit(p.userId)}
              disabled={busy}
              className="text-[10px] uppercase font-semibold tracking-wide text-[#888888] hover:text-[#FF4D4D] disabled:opacity-40 transition-colors"
              title="Remove this player from the live tournament; opponents win by walkover"
            >
              {busy ? "Working…" : "Forfeit"}
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => onRemove(p.userId)}
              className="w-6 h-6 flex items-center justify-center text-[#888888] hover:text-[#FF4D4D] rounded transition-colors"
              title="Remove Participant"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {replacing && (
        <div className="bg-[#000000] border border-white/20 border-t-0 rounded-b p-3 flex flex-col sm:flex-row gap-2">
          <select
            value={substituteUserId}
            onChange={(e) => { setSubstituteUserId(e.target.value); if (e.target.value) setGuestName(""); }}
            className="flex-1 bg-background border border-white/20 rounded px-2 py-1.5 text-xs text-white focus:border-primary outline-none"
          >
            <option value="">Select a registered player…</option>
            {substituteOptions.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
          <input
            value={guestName}
            onChange={(e) => { setGuestName(e.target.value); if (e.target.value) setSubstituteUserId(""); }}
            placeholder="…or a guest name"
            className="flex-1 bg-background border border-white/20 rounded px-2 py-1.5 text-xs text-white placeholder:text-[#888888] focus:border-primary outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={submitReplace}
              disabled={busy || (!substituteUserId && !guestName.trim())}
              className="px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wide bg-primary text-black rounded disabled:opacity-40"
            >
              {busy ? "Replacing…" : "Confirm"}
            </button>
            <button
              onClick={() => setReplacing(false)}
              className="px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wide text-[#888888] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RosterPanel({
  tournament, allUsers, onReorder, onRemove, onForfeit, onReplace, actingOn,
}: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation;
    if (source && target && source.id !== target.id) {
      const oldIndex = tournament.participants.findIndex(p => p.userId === source.id);
      const newIndex = tournament.participants.findIndex(p => p.userId === target.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(source.id as string, newIndex);
      }
    }
  };

  const isOpen = tournament.status === "OPEN";
  const canManage = tournament.status === "OPEN" || tournament.status === "ONGOING";

  // Who has already played: the backend rejects replacing them, so the button is
  // hidden rather than offered and then refused. Derived from the rounds already
  // loaded with the tournament, so no extra request is made.
  const playedUserIds = new Set<string>();
  for (const round of tournament.rounds ?? []) {
    for (const m of round.matches ?? []) {
      if (m.status !== "COMPLETED") continue;
      if (m.player1Id) playedUserIds.add(m.player1Id);
      if (m.player2Id) playedUserIds.add(m.player2Id);
    }
  }

  const participantIds = new Set(tournament.participants.map(p => p.userId));
  const substituteOptions = allUsers.filter(u => !participantIds.has(u.id));

  // Whether the drag order below will actually be used. Mirrors the backend
  // resolution in format-config.helper.ts: the per-tournament override replaces
  // the preset config, and seedingMode is read from the root (not the phase1
  // alias) because how the field is drawn belongs to the event, not to a
  // HYBRID event's Swiss phase. Anything other than MANUAL means a random draw.
  const presetConfig =
    typeof tournament.format === "string" ? undefined : tournament.format?.config;
  const rawConfig: FormatConfig & { phase1?: FormatConfig } =
    tournament.config ?? presetConfig ?? {};
  const manualSeeding =
    (rawConfig.seedingMode ?? rawConfig.phase1?.seedingMode) === "MANUAL";

  return (
    <div className="lg:col-span-8 space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-white">
          Participant Roster <span className="text-[#888888] ml-2 font-normal text-sm">[{tournament.participants.length} / {tournament.maxPlayers}]</span>
        </h2>
        <div className="h-[1px] flex-1 bg-white/10" />
      </div>

      {isOpen && (
        <p className="text-xs text-[#888888] leading-relaxed">
          {manualSeeding
            ? "Manual seeding is enabled: drag entrants to set the seed order used to build the bracket."
            : "This tournament uses a random draw, so the order below does not affect the bracket. Enable manual seeding in the tournament rules to seed by hand."}
        </p>
      )}

      <DragDropProvider
        sensors={[PointerSensor]}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
          {tournament.participants.length === 0 ? (
            <div className="md:col-span-2 py-16 border border-dashed border-white/20 rounded bg-transparent flex flex-col items-center justify-center gap-2">
              <p className="font-semibold text-sm text-[#888888]">No participants registered</p>
            </div>
          ) : (
            tournament.participants.map((p, idx) => (
              <SortableParticipantCard
                key={p.userId}
                p={p}
                idx={idx}
                isAdmin={isOpen}
                canManage={canManage}
                hasPlayed={playedUserIds.has(p.userId)}
                isForfeited={p.status === "FORFEITED"}
                busy={actingOn === p.userId}
                substituteOptions={substituteOptions}
                onRemove={onRemove}
                onForfeit={onForfeit}
                onReplace={onReplace}
              />
            ))
          )}
        </div>
      </DragDropProvider>
    </div>
  );
}
