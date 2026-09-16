"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, UPLOAD_TIMEOUT_MS, authenticatedFetch, resolveImageUrl, safeJson } from "../../utils/api";
import type { Game, GalleryImage } from "../../tournaments/types";
import ProfileSection, { Icons } from "./ProfileSection";
import { formStyles } from "./formStyles";

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
    <ProfileSection title="Gallery" icon={Icons.gallery}>
      <div className={`${formStyles.card} flex flex-col gap-5`}>
        <div className="flex flex-col gap-1">
          <p className={formStyles.label}>One image per game</p>
          <p className={formStyles.help}>
            Shown at the top of your public profile. Other players can report an image; admins can remove it.
          </p>
        </div>

        {failed && !mine ? (
          <p className={formStyles.error}>Could not load your gallery. Check the connection and reload.</p>
        ) : !mine ? (
          <p className={formStyles.help}>Loading…</p>
        ) : !mine.eligible ? (
          <p className="text-sm text-white/75 border border-component-border px-4 py-3">{mine.requirement}</p>
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
              <p className={formStyles.help}>
                {games.length === 0 ? "No games are set up yet." : "You have an image for every game."}
              </p>
            )}
          </>
        )}
      </div>
    </ProfileSection>
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
        className={`shrink-0 ${formStyles.btnSecondary}`}
      >
        {file ? "Change file" : label}
      </button>
      <span className={`text-xs truncate ${file ? "text-white/80" : "text-white/55"}`}>{file ? file.name : "No file chosen"}</span>
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
    <div className="border border-dashed border-component-border p-4 md:p-5 flex flex-col gap-3">
      <p className={formStyles.label}>Add an image</p>
      <select
        aria-label="Game"
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        className={formStyles.input}
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
        aria-label="Caption"
        className={formStyles.input}
      />
      <p className={formStyles.help}>PNG, JPEG or WebP, up to 8 MB. Large images are scaled down to 1600px.</p>
      {error && <p className={formStyles.error} role="alert">{error}</p>}
      <div>
        <button onClick={save} disabled={busy} className={formStyles.btnPrimary}>
          {busy ? "Uploading…" : "Add to gallery"}
        </button>
      </div>
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
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary font-poppins">{image.gameName}</p>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
          placeholder="Caption (optional)"
          aria-label={`Caption for ${image.gameName}`}
          className={formStyles.input}
        />
        <FilePicker file={file} onFile={setFile} label="Replace image" />
        {error && <p className={formStyles.error} role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={busy || !dirty} className={formStyles.btnPrimary}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className={armed ? formStyles.btnDanger : formStyles.btnSecondary}
          >
            {armed ? "Press again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
