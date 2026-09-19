"use client";

import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { Tournament } from "../../../tournaments/types";
import SearchableSelect from "../../ui/SearchableSelect";
import { useToast } from "../../ui/Toast";

interface Props {
  tournament: Tournament;
  tournamentId: string;
  onClose: () => void;
  onInvited: () => void;
}

interface UserOption {
  id: string;
  username: string;
  isGuest?: boolean;
}

export default function InvitePlayerModal({ tournament, tournamentId, onClose, onInvited }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [forceAdd, setForceAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.AUTH.USERS);
    if (!res.ok) return;
    const data = await safeJson(res);
    if (Array.isArray(data)) setUsers(data);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter out users who are already participants and guests, who cannot accept
  // an invitation — they are organizer-managed via Add Guest instead.
  const available = users.filter(
    (u) =>
      !u.isGuest &&
      !tournament.participants.some((p) => p.userId === u.id)
  );

  const handleInvite = async () => {
    if (!selectedUserId || busy) return;
    setBusy(true);

    try {
      if (forceAdd) {
        // Force-add: use the existing /join endpoint directly
        const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN(tournamentId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUserId }),
        });
        if (res.ok) {
          const username = available.find((u) => u.id === selectedUserId)?.username ?? "Player";
          toast(`${username} has been added to the tournament`, "success");
          onInvited();
          onClose();
        } else {
          const d = await safeJson(res);
          toast(d?.message || "Could not add the player", "error");
        }
      } else {
        const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.INVITE_PLAYER(tournamentId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUserId }),
        });
        if (res.ok) {
          const username = available.find((u) => u.id === selectedUserId)?.username ?? "Player";
          toast(`Invitation sent to ${username}`, "success");
          onInvited();
          onClose();
        } else {
          const d = await safeJson(res);
          toast(d?.message || "Could not send the invitation", "error");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0A0A0A] border border-white/20 rounded-lg w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Invite Player</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888888] block">Search Players</label>
            <SearchableSelect
              options={available.map((u) => ({ value: u.id, label: u.username }))}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Type to search for a player..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={forceAdd}
              onChange={(e) => setForceAdd(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-primary"
            />
            <span className="text-xs text-white/60 group-hover:text-white transition-colors">
              Force add (join immediately without asking)
            </span>
          </label>

          {!forceAdd && (
            <p className="text-[11px] text-[#888888] leading-relaxed">
              The player will receive an invitation and can accept or decline it from their
              notifications and tournament page.
            </p>
          )}
          {forceAdd && (
            <p className="text-[11px] text-[#FFB020] leading-relaxed">
              The player will be added immediately without confirmation.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={!selectedUserId || busy}
            className="px-6 py-2 bg-primary text-black text-xs font-semibold rounded hover:brightness-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Sending..." : forceAdd ? "Force Add" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
