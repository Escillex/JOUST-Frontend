"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, UPLOAD_TIMEOUT_MS, authenticatedFetch, resolveImageUrl, safeJson } from "../../utils/api";
import type { Game, GalleryImage } from "../../tournaments/types";

/**
 * Edit Profile → Gallery (todo.md obj. 4.3). One image per game; posting is
 * unlocked by finishing a tournament without being forfeited, which the
 * server decides and this only reports.
 */
const CAPTION_MAX = 140;

interface Mine {
  eligible: boolean;
  requirement: string;
  images: GalleryImage[];
}

export default function GalleryEditor() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [failed, setFailed] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      authenticatedFetch(API_ENDPOINTS.GALLERY.MINE),
      authenticatedFetch(API_ENDPOINTS.GAMES.BASE),
    ]).then(async ([m, g]) => {
      const mBody = await safeJson(m);
      const gBody = await safeJson(g);
      if (!alive) return;
      if (m.ok && mBody) {
        setMine(mBody);
        setFailed(false);
      } else {
        setFailed(true);
      }
      if (g.ok && Array.isArray(gBody)) setGames(gBody);
    });
    return () => { alive = false; };
  }, [tick]);

  const taken = new Set(mine?.images.map((i) => i.gameId));
  const open = games.filter((g) => !taken.has(g.id));

  return (
    <div className="space-y-6">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/20 flex items-center gap-3">
        <div className="w-2 h-2 bg-primary" />
        GALLERY
      </div>
      <div className="bg-component-background border border-component-border p-6 md:p-8 space-y-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-white">One image per game</p>
          <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
            Shown on your public profile. Other players can report an image; admins can remove it.
          </p>
        </div>

        {failed && !mine ? (
          <p className="text-xs text-[#FF4D4D]">Could not load your gallery. Check the connection and reload.</p>
        ) : !mine ? (
          <p className="text-xs text-white/30">Loading…</p>
        ) : !mine.eligible ? (
          <p className="text-xs text-white/50 border border-white/10 px-4 py-3">{mine.requirement}</p>
        ) : (
          <>
            {mine.images.length > 0 && (
              <div className="space-y-3">
                {mine.images.map((img) => (
                  <GalleryRow key={img.id} image={img} onChanged={load} />
                ))}
              </div>
            )}
            {open.length > 0 ? (
              <AddImage games={open} onAdded={load} />
            ) : (
              <p className="text-[10px] text-white/30">
                {games.length === 0 ? "No games are set up yet." : "You have an image for every game."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilePicker({ file, onFile, label = "Browse" }: { file: File | null; onFile: (f: File | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="shrink-0 px-6 py-2.5 bg-background border border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all active:scale-95"
      >
        {file ? "Change file" : label}
      </button>
      <span className={`text-xs truncate ${file ? "text-white/70" : "text-white/25"}`}>{file ? file.name : "No file chosen"}</span>
    </div>
  );
}

async function put(gameId: string, file: File | null, caption: string) {
  const form = new FormData();
  if (file) form.append("image", file);
  form.append("caption", caption.trim());
  const res = await authenticatedFetch(API_ENDPOINTS.GALLERY.GAME(gameId), {
    method: "PUT",
    body: form,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  const body = await safeJson(res);
  if (res.ok) return null;
  const msg = body?.message;
  return Array.isArray(msg) ? msg.join(" ") : msg || "The image could not be saved.";
}

function AddImage({ games, onAdded }: { games: Game[]; onAdded: () => void }) {
  const [gameId, setGameId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!gameId) return setError("Choose the game this image is for.");
    if (!file) return setError("Choose an image to upload.");
    setBusy(true);
    const err = await put(gameId, file, caption);
    setBusy(false);
    if (err) return setError(err);
    setGameId("");
    setFile(null);
    setCaption("");
    onAdded();
  };

  return (
    <div className="border border-dashed border-white/15 p-5 space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Add an image</p>
      <select
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        className="w-full h-11 bg-background border border-component-border px-3 text-sm text-white focus:outline-none focus:border-primary"
      >
        <option value="">Choose a game…</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <FilePicker file={file} onFile={setFile} />
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
        placeholder="Caption (optional)"
        className="w-full h-11 bg-background border border-component-border px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/20"
      />
      <p className="text-[10px] text-white/30">PNG, JPEG or WebP, up to 8 MB. Large images are scaled down to 1600px.</p>
      {error && <p className="text-xs text-[#FF4D4D]">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="px-8 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-40 transition-all active:scale-95"
      >
        {busy ? "Uploading..." : "Add to gallery"}
      </button>
    </div>
  );
}

function GalleryRow({ image, onChanged }: { image: GalleryImage; onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState(image.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No window.confirm (Core Rule 5): the first press arms, the second deletes.
  const [armed, setArmed] = useState(false);
  const dirty = !!file || caption.trim() !== (image.caption ?? "");

  const save = async () => {
    setError(null);
    setBusy(true);
    const err = await put(image.gameId, file, caption);
    setBusy(false);
    if (err) return setError(err);
    setFile(null);
    onChanged();
  };

  const remove = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    const res = await authenticatedFetch(API_ENDPOINTS.GALLERY.GAME(image.gameId), { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not delete the image.");
      return;
    }
    onChanged();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 border border-component-border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageUrl(image.imageUrl)}
        alt={`${image.gameName} — gallery image`}
        className="w-full sm:w-28 aspect-square object-cover border border-white/10 shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">{image.gameName}</p>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
          placeholder="Caption (optional)"
          className="w-full h-10 bg-background border border-component-border px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/20"
        />
        <FilePicker file={file} onFile={setFile} label="Replace image" />
        {error && <p className="text-xs text-[#FF4D4D]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="px-6 py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className={`px-6 py-2.5 border text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-all ${
              armed ? "border-[#FF4D4D] text-[#FF4D4D]" : "border-component-border text-white/40 hover:text-white"
            }`}
          >
            {armed ? "Press again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
