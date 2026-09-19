"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, displayNameOf, safeJson } from "../../utils/api";
import { useToast } from "../ui/Toast";
import type { Tournament } from "../../tournaments/types";

interface Props {
  tournament: Tournament;
  onUpdated?: () => void | Promise<void>;
  onViewResults?: () => void;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

/**
 * A deliberately compact completion moment. It belongs above the tab strip on
 * both the public tournament page and its manage page, so the result is seen
 * without turning either page into a separate celebration screen.
 */
export default function TournamentCompletionBanner({ tournament, onUpdated, onViewResults }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const firstGuest = tournament.participants.find((participant) => participant.user.isGuest);
  const [guestId, setGuestId] = useState(() => firstGuest?.user.id ?? "");
  const [username, setUsername] = useState(() => firstGuest?.user.username ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const cleanupAt = tournament.guestCleanupAt ? new Date(tournament.guestCleanupAt).getTime() : null;
  const guestRegistrationOpen = tournament.canManage === true &&
    tournament.status === "COMPLETED" &&
    cleanupAt !== null &&
    cleanupAt > now;

  useEffect(() => {
    if (!cleanupAt || cleanupAt <= Date.now()) return;
    const delay = Math.min(cleanupAt - Date.now(), 60_000);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [cleanupAt, now]);

  const winnerName = useMemo(
    () => displayNameOf(tournament.winner ?? tournament.participants.find((participant) => participant.placement === 1)?.user, "Champion"),
    [tournament.winner, tournament.participants],
  );

  const currentGuests = useMemo(
    () => tournament.participants.filter((participant) => participant.user.isGuest),
    [tournament.participants],
  );

  if (tournament.status !== "COMPLETED") return null;

  const convertGuest = async () => {
    if (!guestId || !username.trim() || !email.trim() || !password || converting) return;
    setConverting(true);
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.AUTH.CONVERT_GUEST(guestId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        toast(data?.message || "Could not register the guest account", "error");
        return;
      }
      setEmail("");
      setPassword("");
      setFormOpen(false);
      toast("Guest registered; tournament history was preserved", "success");
      await onUpdated?.();
    } finally {
      setConverting(false);
    }
  };

  return (
    <section className="border border-primary/40 bg-black shadow-[5px_5px_0_rgba(82,185,70,0.16)]" aria-label="Tournament result">
      <div className="h-1 bg-primary" />
      <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary/50 bg-primary/10 text-primary" aria-hidden="true">
            <svg viewBox="0 0 48 48" className="h-7 w-7 fill-none stroke-current stroke-2"><path d="M15 8h18v10c0 7-4 12-9 12s-9-5-9-12V8Z" /><path d="M15 11H8v5c0 5 3 8 8 8M33 11h7v5c0 5-3 8-8 8M24 30v7M16 41h16M19 37h10" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-primary">Tournament complete · {formatDate(tournament.completedAt)}</p>
            <h2 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white md:text-2xl">{winnerName} won the final</h2>
            <p className="mt-1 text-xs text-white/50">The final standings and tournament history are now saved.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <button type="button" onClick={onViewResults} className="border border-primary/60 bg-primary/10 px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary hover:text-black">View final results</button>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">Winner recorded</span>
        </div>
      </div>

      {guestRegistrationOpen && currentGuests.length > 0 && (
        <div className="border-t border-primary/20 bg-primary/5 px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Organizer access</p>
              <p className="mt-1 text-xs text-white/70"><span className="font-bold text-white">Register a current guest as a user</span> to keep their match history.</p>
              <p className="mt-1 text-[10px] text-white/35">Available only for tournaments you organize · guest records close {formatDate(tournament.guestCleanupAt)}.</p>
            </div>
            <button type="button" onClick={() => setFormOpen((open) => !open)} className="shrink-0 border border-primary/60 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary hover:bg-primary hover:text-black">{formOpen ? "Close" : "Register existing guest"}</button>
          </div>
          {formOpen && (
            <div className="mt-4 grid gap-3 border-t border-primary/20 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Current guest</span><select value={guestId} onChange={(event) => { const next = currentGuests.find((participant) => participant.user.id === event.target.value); setGuestId(event.target.value); setUsername(next?.user.username ?? ""); }} className="h-10 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none focus:border-primary">{currentGuests.map((participant) => <option key={participant.user.id} value={participant.user.id}>{displayNameOf(participant.user, participant.user.username)}</option>)}</select></label>
              <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} className="h-10 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary" /></label>
              <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" className="h-10 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary" /></label>
              <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Password</span><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary" /></label>
              <button type="button" onClick={() => void convertGuest()} disabled={!guestId || !username.trim() || !email.trim() || !password || converting} className="h-10 bg-primary px-4 text-[10px] font-black uppercase tracking-[0.18em] text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-4 lg:justify-self-end">{converting ? "Registering…" : "Register as user"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
