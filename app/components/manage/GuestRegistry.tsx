"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../UserProvider";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { GUEST_RETENTION_NOTICE } from "../../utils/guestPolicy";

type Guest = {
  id: string;
  username: string;
  displayName: string | null;
  expiresAt: string | null;
  claimProblem: string | null;
  tournaments: {
    id: string; name: string; status: string; completedAt: string | null;
    placement: number | null; isWinner: boolean;
    excluded?: boolean; exclusion?: { reason: string | null } | null;
  }[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const inputClass = "mt-1 h-11 w-full border border-white/20 bg-black px-3 text-sm text-white outline-none focus:border-primary";

function RegistrationForm({ guest, excludedTournamentIds, onRegistered, onClose }: {
  guest: Guest; excludedTournamentIds: string[]; onRegistered: (username: string) => void; onClose: () => void;
}) {
  const [username, setUsername] = useState(guest.username);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !verified) return;
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.AUTH.CONVERT_GUEST(guest.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, verifiedOwnership: verified, excludedTournamentIds }),
      });
      const data = await safeJson(response);
      if (!response.ok) {
        setError(Array.isArray(data?.message) ? data.message.join(" ") : data?.message || "Could not register this guest. Check your connection and retry.");
        return;
      }
      setPassword("");
      onRegistered(username.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={register} className="mt-5 space-y-4 border-t border-primary/20 pt-5" aria-label={`Register ${guest.username}`}>
      <p className="text-sm leading-relaxed text-white/70">Verify that this person played in the tournament shown above. A matching guest name alone is not proof of identity.</p>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-white/70">Account username
          <input required minLength={3} maxLength={20} pattern="[A-Za-z0-9._\-]+" title="3–20 letters, numbers, dots, underscores or hyphens" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-white/70">Player’s email
          <input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-white/70 sm:col-span-2">Temporary password
          <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-white/40">At least 8 characters. The player must change this password on first sign-in.</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-white/80 sm:col-span-2">
          <input type="checkbox" required checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
          I verified this player’s identity and participation in the listed tournament, and they asked to register this account.
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-white">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || !verified} className="bg-primary px-4 py-3 text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40">{busy ? "Registering…" : "Register and keep results"}</button>
        <button type="button" disabled={busy} onClick={onClose} className="border border-white/20 px-4 py-3 text-xs text-white/70 disabled:opacity-40">Cancel</button>
      </div>
    </form>
  );
}

export default function GuestRegistry({ initialQuery }: { initialQuery: string }) {
  const { user, loading: authLoading } = useUser();
  const authorized = !!user?.roles?.some((role) => role === "ADMIN" || role === "ORGANIZER");
  const [query, setQuery] = useState(initialQuery);
  const [now, setNow] = useState(() => Date.now());
  const [guests, setGuests] = useState<Guest[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState("");
  const [excludedByGuest, setExcludedByGuest] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    let latestRequest = 0;
    const controller = new AbortController();
    async function refresh() {
      const request = ++latestRequest;
      setLoading(true);
      const response = await authenticatedFetch(`${API_ENDPOINTS.AUTH.GUESTS}?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      const data = await safeJson(response);
      if (!active || request !== latestRequest) return;
      if (response.ok && Array.isArray(data?.guests)) {
        setGuests(data.guests);
        setHasMore(data.hasMore === true);
        setError("");
      } else {
        setError(data?.message || "Guest records could not be refreshed. Check your connection and retry.");
      }
      setNow(Date.now());
      setLoading(false);
    }
    const debounce = window.setTimeout(() => void refresh(), 250);
    // temporary polling block — claims and expiry may change at another desk.
    const poll = window.setInterval(() => void refresh(), 60_000);
    // end of temporary polling block
    return () => { active = false; controller.abort(); window.clearTimeout(debounce); window.clearInterval(poll); };
  }, [authorized, query, revision]);

  if (authLoading) return <p role="status" className="text-sm text-white/60">Checking organizer access…</p>;
  if (!authorized) return <p className="text-sm text-white/60">Guest registration is available to organizers and administrators.</p>;

  function toggleExclusion(guest: Guest, tournamentId: string) {
    setExcludedByGuest((current) => {
      const selected = new Set(current[guest.id] ?? []);
      if (selected.has(tournamentId)) selected.delete(tournamentId); else selected.add(tournamentId);
      return { ...current, [guest.id]: [...selected] };
    });
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Guest registration</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">Help a returning player keep their results. Any organizer can register a verified guest, including players from tournaments managed by other staff.</p>
        </div>
        <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading} className="border border-white/20 px-4 py-2 text-xs text-white/70 disabled:opacity-40">Refresh</button>
      </div>
      <p className="border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-white/70">{GUEST_RETENTION_NOTICE}</p>
      {registeredName && (
        <div role="status" className="border border-primary/40 p-4 text-sm leading-relaxed text-white">
          <p><strong>@{registeredName}</strong> is registered. Their existing tournament results were preserved.</p>
          <p className="mt-2 text-white/60">Have the player sign in and change their temporary password. Then use Invite Player or Add Player in a tournament you manage.</p>
          <Link href="/tournaments/manage" className="mt-3 inline-block text-primary underline">Go to tournament management</Link>
        </div>
      )}
      <label className="block text-xs font-semibold text-white/70">Search guest name
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} placeholder="e.g. Pikapi" className={inputClass} />
      </label>
      {error && <p role="alert" className="border border-white/20 p-4 text-sm text-white">{error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-2 text-primary underline">Retry</button></p>}
      {loading && <p role="status" className="text-xs text-white/50">Refreshing guest records…</p>}
      {!loading && !error && guests.length === 0 && <p className="border border-white/10 p-6 text-sm text-white/60">No current guest records match this name. The player may already be registered, or their guest name may have expired or been reassigned.</p>}
      {hasMore && <p className="text-xs text-white/50">Showing the latest 50 matching guests. Narrow your search to find a player.</p>}
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-white/50">Select only the tournaments that belong to this player. Checked tournaments will be included when the guest is registered.</p>
        {guests.map((guest) => {
          const expired = !!guest.expiresAt && new Date(guest.expiresAt).getTime() <= now;
          const problem = guest.claimProblem || (expired ? "The guest registration window has expired." : null);
          return (
            <article key={guest.id} className="border border-white/15 bg-black p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{guest.displayName || guest.username}</h2>
                  <p className="mt-1 text-xs text-white/50">Guest name: {guest.username}</p>
                  <p className="mt-2 text-xs text-white/60">{guest.expiresAt ? `Register before ${dateLabel(guest.expiresAt)}` : "Registration window ends 30 days after tournament completion."}</p>
                </div>
                {selectedId !== guest.id && <button type="button" disabled={!!problem || loading || !!error} onClick={() => setSelectedId(guest.id)} className="border border-primary/50 px-4 py-3 text-xs font-semibold text-primary disabled:opacity-40">Register guest</button>}
              </div>
              <ul className="mt-4 space-y-2">
                {guest.tournaments.map((tournament) => <li key={tournament.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                  <Link href={`/tournaments/${tournament.id}`} className="text-white hover:underline">{tournament.name}</Link>
                  <p className="mt-1 text-xs text-white/50">{tournament.isWinner ? "Champion · " : tournament.placement ? `Placed #${tournament.placement} · ` : ""}{tournament.status.toLowerCase()}{tournament.completedAt ? ` · ${dateLabel(tournament.completedAt)}` : ""}</p>
                  <label className={`mt-3 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-xs font-semibold uppercase tracking-wider ${(excludedByGuest[guest.id] ?? []).includes(tournament.id) ? "text-white/35" : "text-primary"}`}>
                    <input
                      type="checkbox"
                      checked={!(excludedByGuest[guest.id] ?? []).includes(tournament.id)}
                      onChange={() => toggleExclusion(guest, tournament.id)}
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                    <span>{(excludedByGuest[guest.id] ?? []).includes(tournament.id) ? "Excluded from account history" : "Include in account history"}</span>
                  </label>
                </li>)}
              </ul>
              {guest.tournaments.length === 0 && <p className="mt-3 text-xs text-white/50">No tournament results recorded.</p>}
              {problem && <p className="mt-3 text-sm text-white/60">{problem}</p>}
              {selectedId === guest.id && !problem && !error && <RegistrationForm key={guest.id} guest={guest} excludedTournamentIds={excludedByGuest[guest.id] ?? []} onClose={() => setSelectedId(null)} onRegistered={(name) => { setRegisteredName(name); setSelectedId(null); setGuests((current) => current.filter((entry) => entry.id !== guest.id)); setRevision((value) => value + 1); }} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}
