"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import type { Award, UserAward } from "../../tournaments/types";
import Medal from "./Medal";
import Plaque from "./Plaque";

/**
 * Giving (and revoking) awards. One modal with two doors: the Award action on
 * a user-management row, and the Award button on a profile when the viewer is
 * an admin. Both mean the same thing, so they share one implementation.
 *
 * Revoke acts immediately with a busy state — no window.confirm (Core Rule 5).
 * A revoke is also cheap to undo: give the award again.
 */
interface Props {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a give or revoke, so the caller can refresh what it shows. */
  onChanged?: () => void;
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function GrantAwardModal({ userId, userName, isOpen, onClose, onChanged }: Props) {
  const [catalog, setCatalog] = useState<Award[]>([]);
  const [grants, setGrants] = useState<UserAward[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [cat, mine] = await Promise.all([
      authenticatedFetch(API_ENDPOINTS.AWARDS.CATALOG).then(safeJson),
      authenticatedFetch(API_ENDPOINTS.AWARDS.GRANTS(userId)).then(safeJson),
    ]);
    setCatalog(Array.isArray(cat) ? cat : []);
    setGrants(Array.isArray(mine) ? mine : []);
  }, [userId]);

  // Callers mount this only while it is open, so every opening starts from
  // fresh state rather than resetting leftovers from the last person.
  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const give = async () => {
    if (!selected) return;
    setBusy("give");
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.GRANTS(userId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awardId: selected, note: note.trim() || undefined }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setMessage({ text: `Given to ${userName}. They have been notified.`, ok: true });
        setSelected(null); setNote("");
        await load();
        onChanged?.();
      } else {
        setMessage({ text: data?.message || "Could not give the award.", ok: false });
      }
    } catch {
      setMessage({ text: "Could not reach the server.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (grantId: string) => {
    setBusy(grantId);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.GRANT(userId, grantId), { method: "DELETE" });
      if (res.ok) { await load(); onChanged?.(); }
      else setMessage({ text: (await safeJson(res))?.message || "Could not revoke.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const [search, setSearch] = useState("");

  const filteredCatalog: Award[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (a: Award) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)),
    );
  }, [catalog, search]);

  const medals = filteredCatalog.filter((a: Award) => a.kind === "MEDAL");
  const plaques = filteredCatalog.filter((a: Award) => a.kind === "PLAQUE");
  const tile = (a: Award) =>
    `border p-2 transition-all text-left ${
      selected === a.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.02] hover:border-white/30"
    }`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#111] border border-white/10 w-full max-w-[640px] max-h-[88vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">Give an Award</h3>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">
              To <span className="text-primary font-bold">{userName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xs uppercase tracking-widest">
            Close
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {catalog.length === 0 ? (
            <p className="text-sm text-white/40">
              No awards exist yet. Create one in <span className="text-white">Admin → Awards</span> first.
            </p>
          ) : (
            <>
              {/* Search by award label / name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    Search by Award Label
                  </label>
                  {search.trim() && (
                    <span className="text-[10px] text-primary font-bold">
                      {filteredCatalog.length} matching award{filteredCatalog.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type award label to find medals or plaques..."
                    className="w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="p-6 text-center border border-white/5 bg-white/[0.01]">
                  <p className="text-sm text-white/40">No awards match label &quot;{search}&quot;.</p>
                </div>
              ) : (
                <>
                  {medals.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                        Medals ({medals.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {medals.map((a: Award) => (
                          <button key={a.id} onClick={() => setSelected(a.id)} className={tile(a)}>
                            <Medal name={a.name} imageUrl={a.imageUrl} sizeClass="w-14 h-14 mx-auto" showDetail={false} />
                            <p className="text-[10px] text-white/70 font-bold mt-1.5 text-center truncate">{a.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {plaques.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                        Plaques ({plaques.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {plaques.map((a: Award) => (
                          <button key={a.id} onClick={() => setSelected(a.id)} className={tile(a)}>
                            <Plaque name={a.name} imageUrl={a.imageUrl} size="sm" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Note (optional) — shown on their profile
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Won the Winter Invitational"
                  className="w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/15"
                />
              </div>

              <button
                onClick={give}
                disabled={!selected || busy === "give"}
                className="w-full py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-40 transition-all active:scale-[0.99]"
              >
                {busy === "give" ? "Giving..." : selected ? "Give Award" : "Choose an award above"}
              </button>
            </>
          )}

          {message && (
            <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>
          )}

          <div className="border-t border-white/5 pt-5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
              Currently held ({grants.length})
            </p>
            {grants.length === 0 ? (
              <p className="text-xs text-white/30">None yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {grants.map((g) => (
                  <li key={g.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">
                        {g.name}
                        <span className="text-[9px] text-white/30 uppercase tracking-widest ml-2">
                          {g.kind === "MEDAL" ? "Medal" : "Plaque"}
                        </span>
                      </p>
                      <p className="text-[10px] text-white/40 truncate">
                        {date(g.awardedAt)}
                        {g.awardedBy ? ` · by ${g.awardedBy.displayName || g.awardedBy.username}` : ""}
                        {g.note ? ` · ${g.note}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => void revoke(g.id)}
                      disabled={busy === g.id}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#FF4D4D]/80 hover:text-[#FF4D4D] border border-[#FF4D4D]/30 px-3 py-1 disabled:opacity-40"
                    >
                      {busy === g.id ? "Revoking..." : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
