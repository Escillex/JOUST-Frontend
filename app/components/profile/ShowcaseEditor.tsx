"use client";

import { useEffect, useMemo, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import type { UserAward } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { groupAwards } from "../awards/group";

/**
 * Choosing what a profile shows: up to three medals, in order, and one plaque
 * under the name (or none).
 *
 * Works on awards, not grants — "Champion" won three times is one tile with a
 * ×3 badge, and pinning it pins the medal, not a particular win. The whole
 * showcase is saved in one request, so there is never a half-applied state.
 */
const MAX_PINS = 3;

export default function ShowcaseEditor({ handle }: { handle: string }) {
  const [awards, setAwards] = useState<UserAward[] | null>(null);
  const [pinned, setPinned] = useState<string[]>([]); // award ids, slot order
  const [plaque, setPlaque] = useState<string | null>(null); // award id
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const groups = useMemo(() => groupAwards(awards ?? []), [awards]);
  const medals = groups.filter((g) => g.kind === "MEDAL");
  const plaques = groups.filter((g) => g.kind === "PLAQUE");

  // Seed the editor from what is currently saved.
  useEffect(() => {
    void authenticatedFetch(API_ENDPOINTS.AUTH.USER_PROFILE(handle))
      .then(safeJson)
      .then((bundle) => {
        const list: UserAward[] = Array.isArray(bundle?.awards) ? bundle.awards : [];
        setAwards(list);
        const g = groupAwards(list);
        setPinned(
          g.filter((x) => x.kind === "MEDAL" && x.pinSlot)
            .sort((a, b) => (a.pinSlot ?? 0) - (b.pinSlot ?? 0))
            .map((x) => x.awardId),
        );
        setPlaque(g.find((x) => x.kind === "PLAQUE" && x.displayed)?.awardId ?? null);
      })
      .catch(() => setAwards([]));
  }, [handle]);

  const toggle = (awardId: string) => {
    setMessage(null);
    setPinned((p) =>
      p.includes(awardId) ? p.filter((x) => x !== awardId) : p.length < MAX_PINS ? [...p, awardId] : p,
    );
  };

  /** The server pins grants; any grant of a medal stands for the medal. Prefer
   *  the one already pinned so a save with no change is a no-op in effect. */
  const grantFor = (awardId: string, flag: "pinSlot" | "displayed") => {
    const g = groups.find((x) => x.awardId === awardId)!;
    return (g.grants.find((x) => (flag === "pinSlot" ? x.pinSlot : x.displayed)) ?? g.grants[0]).id;
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.SHOWCASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pinnedMedals: pinned.map((id) => grantFor(id, "pinSlot")),
          plaque: plaque ? grantFor(plaque, "displayed") : null,
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setAwards(Array.isArray(data) ? data : awards);
        setMessage({ text: "Showcase saved.", ok: true });
      } else {
        setMessage({ text: data?.message || "Could not save your showcase.", ok: false });
      }
    } catch {
      setMessage({ text: "Could not reach the server.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/20 flex items-center gap-3">
        <div className="w-2 h-2 bg-primary" />
        SHOWCASE
      </div>

      {awards === null ? (
        <p className="text-xs text-white/30">Loading your awards...</p>
      ) : groups.length === 0 ? (
        <div className="bg-component-background border border-component-border p-8">
          <p className="text-sm text-white/50">You have no awards yet.</p>
          <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
            Administrators give medals and plaques for achievements. When you receive one it appears here, and you
            choose what your profile shows.
          </p>
        </div>
      ) : (
        <div className="bg-component-background border border-component-border p-6 md:p-8 space-y-8">
          {medals.length > 0 && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-white">
                Pinned medals <span className="text-white/30">({pinned.length}/{MAX_PINS})</span>
              </p>
              <p className="text-[10px] text-white/40 mt-1 mb-5">
                Tap to pin, in the order you tap. Tap again to unpin.
              </p>
              <div className="flex flex-wrap gap-4">
                {medals.map((g) => {
                  const slot = pinned.indexOf(g.awardId) + 1 || null;
                  const full = !slot && pinned.length >= MAX_PINS;
                  return (
                    <button
                      key={g.awardId}
                      type="button"
                      onClick={() => toggle(g.awardId)}
                      disabled={full}
                      className={`w-24 p-2 border transition-all ${
                        slot ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/30"
                      } ${full ? "opacity-30 cursor-not-allowed" : ""}`}
                    >
                      <Medal
                        name={g.name}
                        imageUrl={g.imageUrl}
                        grants={g.grants}
                        slot={slot}
                        sizeClass="w-16 h-16 mx-auto"
                        showDetail={false}
                      />
                      <p className="text-[9px] font-bold text-white/70 mt-1.5 leading-tight line-clamp-2">{g.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {plaques.length > 0 && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-white">Plaque under your name</p>
              <p className="text-[10px] text-white/40 mt-1 mb-5">One, or none.</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setPlaque(null); setMessage(null); }}
                  className={`w-full text-left px-4 py-3 border text-[10px] font-black uppercase tracking-widest transition-all ${
                    plaque === null ? "border-primary text-primary bg-primary/10" : "border-white/10 text-white/40 hover:border-white/30"
                  }`}
                >
                  None
                </button>
                {plaques.map((g) => (
                  <button
                    key={g.awardId}
                    type="button"
                    onClick={() => { setPlaque(g.awardId); setMessage(null); }}
                    className={`block w-full p-2 border transition-all ${
                      plaque === g.awardId ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <Plaque name={g.name} imageUrl={g.imageUrl} size="md" count={g.grants.length} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="px-8 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-50 transition-all active:scale-95"
            >
              {saving ? "Saving..." : "Save Showcase"}
            </button>
            {message && (
              <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
