"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import type { Award, AwardKind } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";

/**
 * The award catalog (todo.md obj. 4.1): what can be given. Giving happens
 * elsewhere — from a user-management row or a profile — through
 * GrantAwardModal.
 *
 * The create form previews the artwork at the sizes it will actually be shown,
 * on the dark surface it will be shown on. That is where the two common
 * mistakes become obvious before anyone is awarded: a medal on a white
 * background (renders as a white square) and busy plaque art fighting the
 * title drawn across its middle.
 */
const GUIDE: Record<AwardKind, string> = {
  MEDAL:
    "Square PNG or WebP with a transparent background, at least 512×512. Stored at 512×512 and never cropped — non-square art is fitted onto a transparent canvas.",
  PLAQUE:
    "At least 1200×300 (4:1). Stored at 1200×300, cropped from the centre. The award's name is drawn across the middle, so keep ornament in the outer edges.",
};

export default function AwardManager() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [kind, setKind] = useState<AwardKind>("MEDAL");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Derived, not stored: the URL follows the file, and the effect below only
  // releases the old one — an object URL pins the file in memory until revoked.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.CATALOG_ALL);
    const data = await safeJson(res);
    if (res.ok && Array.isArray(data)) setAwards(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flash = (text: string, ok: boolean) => setMessage({ text, ok });

  const create = async () => {
    if (!name.trim() || !file) return;
    setCreating(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("name", name.trim());
      if (description.trim()) body.append("description", description.trim());
      body.append("kind", kind);
      body.append("image", file);
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.CATALOG, { method: "POST", body });
      const data = await safeJson(res);
      if (res.ok) {
        flash(`"${name.trim()}" created.`, true);
        setName(""); setDescription(""); setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        await load();
      } else {
        flash(Array.isArray(data?.message) ? data.message.join(" ") : data?.message || "Could not create the award.", false);
      }
    } catch {
      flash("Could not reach the server.", false);
    } finally {
      setCreating(false);
    }
  };

  const patch = async (a: Award, body: Record<string, unknown>) => {
    setBusyId(a.id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.ONE(a.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await load();
      else flash((await safeJson(res))?.message || "Could not update the award.", false);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: Award) => {
    setBusyId(a.id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.ONE(a.id), { method: "DELETE" });
      if (res.ok) { flash(`"${a.name}" deleted.`, true); await load(); }
      else flash((await safeJson(res))?.message || "Could not delete the award.", false);
    } finally {
      setBusyId(null);
    }
  };

  const replaceArt = async (id: string, f: File) => {
    setBusyId(id);
    try {
      const body = new FormData();
      body.append("image", f);
      const res = await authenticatedFetch(API_ENDPOINTS.AWARDS.IMAGE(id), { method: "POST", body });
      if (res.ok) { flash("Artwork replaced.", true); await load(); }
      else flash((await safeJson(res))?.message || "Could not replace the artwork.", false);
    } finally {
      setBusyId(null);
      setReplacing(null);
      if (replaceInput.current) replaceInput.current.value = "";
    }
  };

  const actions = (a: Award) => {
    const held = a._count?.grants ?? 0;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => { setReplacing(a.id); replaceInput.current?.click(); }}
          disabled={busyId === a.id}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white/60 hover:border-white/30 disabled:opacity-40"
        >
          Replace art
        </button>
        <button
          onClick={() => void patch(a, { archived: !a.archivedAt })}
          disabled={busyId === a.id}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black disabled:opacity-40"
        >
          {a.archivedAt ? "Unarchive" : "Archive"}
        </button>
        {/* Delete is offered only when nobody holds it — the server refuses
            otherwise, and archiving is the answer in that case. */}
        {held === 0 && (
          <button
            onClick={() => void remove(a)}
            disabled={busyId === a.id}
            className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border border-[#FF4D4D]/30 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white disabled:opacity-40"
          >
            {busyId === a.id ? "Working..." : "Delete"}
          </button>
        )}
      </div>
    );
  };

  const medals = awards.filter((a) => a.kind === "MEDAL");
  const plaques = awards.filter((a) => a.kind === "PLAQUE");
  const heldLabel = (a: Award) => {
    const n = a._count?.grants ?? 0;
    return n === 0 ? "Not given yet" : `Given ${n} time${n === 1 ? "" : "s"}`;
  };

  return (
    <div className="space-y-10">
      <input
        ref={replaceInput}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && replacing) void replaceArt(replacing, f); }}
      />

      {/* Create */}
      <div className="bg-white/5 border border-white/10 p-8 space-y-6">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Create an Award</h2>

        <div className="flex gap-2">
          {(["MEDAL", "PLAQUE"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${
                kind === k ? "bg-primary text-black border-primary" : "bg-background border-white/10 text-white/50 hover:border-white/30"
              }`}
            >
              {k === "MEDAL" ? "Medal — square, pinned (up to 3)" : "Plaque — 4:1, under the name"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder={kind === "MEDAL" ? "Tournament Champion" : "2026 Winter Invitational"}
                className="w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="Awarded to the winner of a sanctioned event"
                className="w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Artwork</label>
              {/* The native control stays hidden: browsers render it differently
                  (Firefox shows a faint "Browse…" that reads as plain text), so
                  a real button opens the picker, as the other uploads do. */}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="shrink-0 px-6 py-2.5 bg-background border border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all active:scale-95"
                >
                  {file ? "Change file" : "Browse"}
                </button>
                <span className={`text-xs truncate ${file ? "text-white/70" : "text-white/25"}`}>
                  {file ? file.name : "No file chosen"}
                </span>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">{GUIDE[kind]}</p>
            </div>
            <button
              onClick={create}
              disabled={creating || !name.trim() || !file}
              className="px-8 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-40"
            >
              {creating ? "Creating..." : "Create Award"}
            </button>
          </div>

          {/* Preview at real display sizes, on the profile's dark surface. */}
          <div className="bg-black border border-white/10 p-6 flex flex-col justify-center gap-5 min-h-[220px]">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Preview — as it appears on a profile</p>
            {preview ? (
              kind === "MEDAL" ? (
                <div className="flex items-end gap-6">
                  <div className="text-center">
                    <Medal name={name || "Medal"} imageUrl={preview} sizeClass="w-[72px] h-[72px]" showDetail={false} />
                    <p className="text-[9px] text-white/30 mt-2">Pinned, 72px</p>
                  </div>
                  <div className="text-center">
                    <Medal name={name || "Medal"} imageUrl={preview} sizeClass="w-[160px] h-[160px]" showDetail={false} />
                    <p className="text-[9px] text-white/30 mt-2">Detail</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Plaque name={name || "Award name"} imageUrl={preview} size="lg" />
                  <p className="text-[9px] text-white/30">Under the name, ~360×90</p>
                </div>
              )
            ) : (
              <p className="text-xs text-white/20">Choose artwork to see it here.</p>
            )}
          </div>
        </div>

        {message && <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-white/30">Loading the award catalog...</p>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/50 mb-5">Medals ({medals.length})</h2>
            {medals.length === 0 ? (
              <p className="text-sm text-white/30">No medals yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {medals.map((a) => (
                  <div key={a.id} className={`bg-background border p-5 ${a.archivedAt ? "border-white/5 opacity-50" : "border-white/10"}`}>
                    <Medal name={a.name} imageUrl={a.imageUrl} description={a.description} sizeClass="w-24 h-24 mx-auto" showDetail={false} />
                    <p className="text-sm font-bold text-white mt-3 truncate">{a.name}</p>
                    <p className="text-[10px] text-white/40">{heldLabel(a)}{a.archivedAt ? " · Archived" : ""}</p>
                    {actions(a)}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/50 mb-5">Plaques ({plaques.length})</h2>
            {plaques.length === 0 ? (
              <p className="text-sm text-white/30">No plaques yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {plaques.map((a) => (
                  <div key={a.id} className={`bg-background border p-5 ${a.archivedAt ? "border-white/5 opacity-50" : "border-white/10"}`}>
                    <Plaque name={a.name} imageUrl={a.imageUrl} size="lg" />
                    <p className="text-[10px] text-white/40 mt-3">
                      {heldLabel(a)}{a.archivedAt ? " · Archived" : ""}{a.description ? ` · ${a.description}` : ""}
                    </p>
                    {actions(a)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
