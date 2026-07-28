"use client";
import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { TournamentStaff } from "../../../tournaments/types";
import { useToast } from "../../ui/Toast";

interface Props {
  tournamentId: string;
  /** Only the creator (or an admin) may change staff; everyone else who can see
   *  this panel gets a read-only list, because the backend rejects both actions. */
  isCreator: boolean;
}

interface InvitableUser {
  id: string;
  username: string;
  roles?: string[];
}

const STATUS_LABEL: Record<TournamentStaff["status"], string> = {
  PENDING: "Invited",
  ACCEPTED: "Co-organizer",
  DECLINED: "Declined",
};

export default function StaffPanel({ tournamentId, isCreator }: Props) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<TournamentStaff[]>([]);
  const [candidates, setCandidates] = useState<InvitableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.ORGANIZERS.LIST(tournamentId));
    if (!res.ok) return;
    const data = await safeJson(res);
    if (Array.isArray(data)) setStaff(data);
  }, [tournamentId]);

  // The candidate list comes from /auth/users, not /auth/registered-users: the
  // latter is admin-only and returns no roles, so an ordinary creator would see
  // an empty picker.
  const loadCandidates = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.AUTH.USERS);
    if (!res.ok) return;
    const data = await safeJson(res);
    if (Array.isArray(data)) setCandidates(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!isCreator) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCandidates();
  }, [isCreator, loadCandidates]);

  // Only users who already hold the organizer role can be invited: the backend
  // rejects anyone else, so offering them here would just produce an error.
  const invitable = candidates.filter(
    (u) =>
      (u.roles?.includes("ORGANIZER") || u.roles?.includes("ADMIN")) &&
      !staff.some((s) => s.userId === u.id),
  );

  const handleInvite = async () => {
    if (!selectedUserId || busy) return;
    setBusy(selectedUserId);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ORGANIZERS.INVITE(tournamentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (res.ok) {
        toast("Invitation sent", "success");
        setSelectedUserId("");
        await load();
      } else {
        const d = await safeJson(res);
        toast(d?.message || "Could not send the invitation", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.ORGANIZERS.REVOKE(tournamentId, userId),
        { method: "DELETE" },
      );
      if (res.ok) {
        toast("Access removed", "success");
        await load();
      } else {
        const d = await safeJson(res);
        toast(d?.message || "Could not remove access", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-[#000000] border border-white/20 rounded p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold text-white">Tournament Staff</h3>
        <div className="h-[1px] flex-1 bg-white/10" />
      </div>

      <p className="text-[11px] text-[#888888] leading-relaxed">
        {isCreator
          ? "Invited organizers can manage this tournament once they accept. They cannot invite or remove other staff."
          : "Only the tournament creator can change staff."}
      </p>

      {staff.length === 0 ? (
        <p className="text-xs text-[#888888] py-2">No staff invited.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 h-11"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm text-white truncate">
                  {member.user?.username || "Unknown"}
                </span>
                <span
                  className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                    member.status === "ACCEPTED"
                      ? "bg-[#52B946]/15 text-[#52B946]"
                      : "bg-white/5 text-[#888888]"
                  }`}
                >
                  {STATUS_LABEL[member.status]}
                </span>
              </div>
              {isCreator && (
                <button
                  onClick={() => handleRevoke(member.userId)}
                  disabled={busy === member.userId}
                  className="text-[10px] uppercase font-semibold tracking-wide text-[#888888] hover:text-[#FF4D4D] disabled:opacity-40 transition-colors"
                >
                  {busy === member.userId ? "Working…" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isCreator && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 bg-[#1B1B1B] border border-white/20 rounded px-2 py-1.5 text-xs text-white focus:border-[#52B946] outline-none"
          >
            <option value="">Select an organizer…</option>
            {invitable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={!selectedUserId || !!busy}
            className="px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wide bg-[#52B946] text-black rounded disabled:opacity-40"
          >
            Invite
          </button>
        </div>
      )}
    </div>
  );
}
