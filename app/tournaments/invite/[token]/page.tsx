"use client";

// Invite landing page. Anyone opening a shared invite link
// (/tournaments/invite/<slug-or-token>) lands here, sees what the
// tournament is, and can enter it directly: signed-in users join with
// their account, visitors can enter as a guest. This page must work
// without being logged in, which is why it uses the public invite
// endpoint and never requires auth.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  authenticatedFetch,
  API_ENDPOINTS,
  safeJson,
} from "../../../utils/api";
import { useUser } from "../../../components/UserProvider";
import { useToast } from "../../../components/ui/Toast";
import { Tournament } from "../../types";

export default function InvitePage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const res = await authenticatedFetch(
        API_ENDPOINTS.TOURNAMENTS.INVITE(token),
      );
      if (res.ok) {
        setTournament(await safeJson(res));
      } else {
        // A wrong or removed link should show a clear message, not an
        // endless loading screen.
        setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const userId: string | undefined = user?.sub || user?.id;
  const isOpen = tournament?.status === "OPEN";
  const isFull =
    !!tournament && tournament.participants.length >= tournament.maxPlayers;
  const alreadyJoined =
    !!tournament &&
    !!userId &&
    tournament.participants.some(p => p.userId === userId);

  const handleJoin = async () => {
    if (!tournament || !userId || joining) return;
    setJoining(true);
    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.TOURNAMENTS.JOIN(tournament.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      const data = await safeJson(res);
      if (res.ok) {
        toast("You have joined the tournament", "success");
        // Send registered joiners to the lobby, the same place the normal
        // join flow lands them (tournaments/[id]/page.tsx), rather than the
        // read-only overview page.
        router.push(`/tournaments/${tournament.id}/lobby`);
      } else {
        toast(data?.message || "Could not join the tournament", "error");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleGuestJoin = async () => {
    if (!tournament || joining) return;
    const name = guestName.trim();
    if (name.length < 3) {
      toast("Guest name must be at least 3 characters", "error");
      return;
    }
    setJoining(true);
    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournament.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name }),
        },
      );
      const data = await safeJson(res);
      if (res.ok) {
        toast(`Welcome, ${name}. You are registered.`, "success");
        // Guests have no account pages, so the bracket view is the most
        // useful place to send them after entering.
        router.push(`/tournaments/${tournament.id}/bracket`);
      } else {
        toast(data?.message || "Could not register as guest", "error");
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-black">
        <p className="text-sm text-[#888888]">Loading invitation...</p>
      </div>
    );
  }

  if (notFound || !tournament) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full border border-white/20 rounded p-8 text-center space-y-4">
          <h1 className="text-lg font-semibold text-white">
            This invite link is not valid
          </h1>
          <p className="text-sm text-[#888888]">
            The tournament may have been removed, or the link was typed
            incorrectly. Please ask the organizer for a new link.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-[#52B946] text-black font-semibold text-xs rounded hover:brightness-90 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const formatName =
    typeof tournament.format === "object" ? tournament.format?.name : null;
  const detailRows = [
    { label: "Format", value: formatName || "Not set" },
    {
      label: "Date",
      value: tournament.date
        ? new Date(tournament.date).toLocaleString()
        : "To be announced",
    },
    { label: "Venue", value: tournament.venue || "To be announced" },
    {
      label: "Entrance Fee",
      value:
        tournament.entranceFee != null
          ? `₱${tournament.entranceFee.toLocaleString()}`
          : "Free",
    },
    {
      label: "Prize Pool",
      value:
        tournament.prizePool != null
          ? `₱${tournament.prizePool.toLocaleString()}`
          : "None",
    },
    {
      label: "Players",
      value: `${tournament.participants.length} / ${tournament.maxPlayers}`,
    },
  ];

  // Only OPEN tournaments with a free slot accept new entries; everything
  // else gets an explanation instead of buttons that would fail anyway.
  const canJoin = isOpen && !isFull;

  return (
    <div className="min-h-[80vh] bg-black px-4 py-10 flex justify-center">
      <div className="max-w-lg w-full space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#52B946]">
            Tournament Invitation
          </p>
          <h1 className="text-2xl font-semibold text-white">
            {tournament.name}
          </h1>
          {tournament.description && (
            <p className="text-sm text-[#888888]">{tournament.description}</p>
          )}
        </div>

        <div className="border border-white/20 rounded p-6 grid grid-cols-2 gap-y-4 gap-x-4">
          {detailRows.map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <p className="text-xs font-semibold text-[#888888]">{label}</p>
              <p className="text-sm text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="border border-white/20 rounded p-6 space-y-4">
          {!canJoin ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-white">
                {isFull && isOpen
                  ? "This tournament is full."
                  : tournament.status === "UPCOMING"
                    ? "Registration has not opened yet. Please check back later."
                    : "Registration for this tournament is closed."}
              </p>
              <Link
                href={`/tournaments/${tournament.id}`}
                className="inline-block px-6 py-2.5 bg-[#1B1B1B] border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors"
              >
                View Tournament
              </Link>
            </div>
          ) : userLoading ? (
            <p className="text-sm text-[#888888] text-center">
              Checking your account...
            </p>
          ) : user ? (
            alreadyJoined ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-white">
                  You are already registered for this tournament.
                </p>
                <Link
                  href={`/tournaments/${tournament.id}`}
                  className="inline-block px-6 py-2.5 bg-[#52B946] text-black font-semibold text-xs rounded hover:brightness-90 transition-colors"
                >
                  View Tournament
                </Link>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full h-11 bg-[#52B946] text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : `Join as ${user.username || "yourself"}`}
              </button>
            )
          ) : (
            <div className="space-y-4">
              {/* Private tournaments only accept registered accounts, so
                  the guest form is hidden for them. */}
              {!tournament.isPrivate && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#888888] block">
                    Enter as Guest
                  </label>
                  <input
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    maxLength={40}
                    placeholder="Your display name (3-40 characters)"
                    className="w-full h-11 bg-[#1B1B1B] border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-[#52B946] transition-colors rounded"
                  />
                  <button
                    onClick={handleGuestJoin}
                    disabled={joining}
                    className="w-full h-11 bg-[#52B946] text-black font-semibold text-sm rounded hover:brightness-90 transition-colors disabled:opacity-50"
                  >
                    {joining ? "Registering..." : "Enter as Guest"}
                  </button>
                </div>
              )}
              <div className="text-center">
                {tournament.isPrivate && (
                  <p className="text-sm text-white mb-2">
                    This is a private tournament. An account is required to
                    join.
                  </p>
                )}
                <Link
                  href="/auth"
                  className="text-xs font-semibold text-[#52B946] hover:brightness-90 transition-colors"
                >
                  Sign in to join with your account
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
