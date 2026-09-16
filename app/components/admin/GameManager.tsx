"use client";
import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { Game, GameRequest } from "../../tournaments/types";
import GameIconField from "./GameIconField";
import GameIcon from "../ui/GameIcon";
import ImageUpload from "../ui/ImageUpload";
import { useImageUpload } from "../../utils/useImageUpload";

interface Props {
  /** Reports the pending-request count up so the admin tab can badge it. */
  onPendingCountChange?: (count: number) => void;
}

/** Admin-managed game catalog (todo.md §5). Games are first-class taxonomy: every
 *  tournament names one, and the catalog starts empty. Organizers cannot
 *  create games — they request them (queued here + a GAME_REQUESTED bell
 *  notification), and an admin adds them and resolves the request from this panel. */
export default function GameManager({ onPendingCountChange }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trackingMode, setTrackingMode] = useState<"POINTS" | "HP">("POINTS");
  // The icon is held until the game exists: it is stored against a game id, and
  // there is no id until the create call comes back.
  const [pendingIcon, setPendingIcon] = useState<{ file: File; preview: string } | null>(null);
  const { upload: uploadIcon, uploading: iconUploading } = useImageUpload();

  // Inline edit of an existing game. The PATCH route and its DTO have always
  // accepted these; nothing on the frontend ever called them, so a typo in a
  // description or a wrong tracking mode meant deleting the game and remaking it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editTracking, setEditTracking] = useState<"POINTS" | "HP">("POINTS");
  const [savingEdit, setSavingEdit] = useState(false);

  // Resolve-request modal
  const [resolving, setResolving] = useState<GameRequest | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);

  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    try {
      // includeSystem: the admin catalog is the one place the retired "General"
      // placeholder stays visible, so its historical tournaments can be found and
      // reassigned. It is not offered anywhere a game gets chosen.
      const res = await authenticatedFetch(`${API_ENDPOINTS.GAMES.BASE}?includeSystem=true`);
      if (res.ok) setGames((await safeJson(res)) || []);
    } catch {
      setError("Failed to load games");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.GAMES.REQUESTS);
      if (res.ok) {
        const data: GameRequest[] = (await safeJson(res)) || [];
        const pending = data.filter((r) => r.status === "PENDING");
        setRequests(pending);
        onPendingCountChange?.(pending.length);
      }
    } catch {
      /* non-fatal — the catalog still works without the queue */
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    fetchGames();
    fetchRequests();
  }, [fetchGames, fetchRequests]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTrackingMode("POINTS");
    setError("");
    // The preview is an object URL; drop it or the blob is held for the life of
    // the page.
    if (pendingIcon) URL.revokeObjectURL(pendingIcon.preview);
    setPendingIcon(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError("Name is required");
    setError("");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.GAMES.BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description || undefined,
          trackingMode,
        }),
      });
      if (res.ok) {
        const created = await safeJson(res);
        if (pendingIcon && created?.id) {
          // Best-effort: the game is already in the catalog, so a failed icon is
          // a missing picture, not a failed create. It can be added per row.
          await uploadIcon(API_ENDPOINTS.IMAGES.UPLOAD_GAME_ICON(created.id), pendingIcon.file);
        }
        setIsCreating(false);
        resetForm();
        fetchGames();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Creation failed");
      }
    } catch {
      setError("Network error while saving game");
    }
  };

  const startEdit = (g: Game) => {
    setEditingId(g.id);
    setEditDescription(g.description ?? "");
    setEditTracking(g.trackingMode === "HP" ? "HP" : "POINTS");
    setError("");
  };

  const handleSaveEdit = async (id: string) => {
    setSavingEdit(true);
    setError("");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.GAMES.DETAILS(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Empty clears it: `description` is nullable, and the DTO writes the
          // field whenever it is present.
          description: editDescription.trim(),
          trackingMode: editTracking,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchGames();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Could not save the game");
      }
    } catch {
      setError("Network error while saving game");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.GAMES.DELETE(id), { method: "DELETE" });
      if (res.ok) {
        fetchGames();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Failed to delete game");
      }
    } catch {
      setError("Failed to delete game");
    } finally {
      setDeletingId(null);
    }
  };

  // Resolve a request by creating the game (name from the request), reassigning
  // the originating tournament onto it, then marking the request RESOLVED. Each
  // step is best-effort-ordered: a duplicate-name game is reused rather than
  // failing the whole flow.
  const handleResolveCreate = async (r: GameRequest) => {
    setResolveBusy(true);
    setError("");
    try {
      let gameId: string | null = null;
      const createRes = await authenticatedFetch(API_ENDPOINTS.GAMES.BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: r.name }),
      });
      if (createRes.ok) {
        gameId = (await safeJson(createRes))?.id ?? null;
      } else {
        // Name already exists (or invalid) — fall back to the existing game.
        const existing = games.find((g) => g.name.toLowerCase() === r.name.toLowerCase());
        gameId = existing?.id ?? null;
        if (!gameId) {
          const data = await safeJson(createRes);
          setError(data?.message || "Could not create the game");
          setResolveBusy(false);
          return;
        }
      }
      if (gameId && r.tournamentId) {
        await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.REASSIGN_GAME(r.tournamentId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
      }
      await authenticatedFetch(API_ENDPOINTS.GAMES.RESOLVE_REQUEST(r.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setResolving(null);
      await Promise.all([fetchGames(), fetchRequests()]);
    } catch {
      setError("Network error while resolving the request");
    } finally {
      setResolveBusy(false);
    }
  };

  const handleDismiss = async (r: GameRequest) => {
    setResolveBusy(true);
    try {
      await authenticatedFetch(API_ENDPOINTS.GAMES.RESOLVE_REQUEST(r.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      setResolving(null);
      await fetchRequests();
    } finally {
      setResolveBusy(false);
    }
  };

  const labelCls = "text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block";
  const inputCls = "w-full bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-all hover:bg-white/[0.02]";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Game Catalog</h3>
          <p className="text-[10px] text-white/60 uppercase tracking-widest mt-1">
            Every tournament names a game, and no tournament can be created until this catalog has one. Retired system entries stay listed so their old tournaments can be reassigned.
          </p>
        </div>
        <button
          onClick={() => { if (isCreating) resetForm(); setIsCreating(!isCreating); }}
          className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-black transition-all shrink-0"
        >
          {isCreating ? "CANCEL" : "+ ADD GAME"}
        </button>
      </div>

      {/* Pending request queue */}
      {requests.length > 0 && (
        <div className="border border-primary/20 bg-primary/[0.04]">
          <div className="px-6 py-3 border-b border-primary/20 flex items-center gap-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              Pending Game Requests
            </span>
            <span className="text-[10px] font-black text-black bg-primary rounded-full px-2 py-0.5">
              {requests.length}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {requests.map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black text-white uppercase tracking-widest truncate">{r.name}</div>
                  <div className="text-[10px] text-white/60 uppercase tracking-widest mt-1">
                    {r.requestedBy?.username ? `by ${r.requestedBy.username}` : "by unknown"}
                    {r.tournament?.name ? ` · for “${r.tournament.name}”` : ""}
                  </div>
                  {r.note && <div className="text-[10px] text-white/60 italic mt-1 line-clamp-1">{r.note}</div>}
                </div>
                <button
                  onClick={() => setResolving(r)}
                  aria-label={`Resolve ${r.name}`}
                  className="px-4 py-1.5 shrink-0 bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCreating && (
        <div className="bg-white/5 border border-white/10 p-8 space-y-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col gap-1.5 w-24 shrink-0">
              <label className={labelCls}>Icon</label>
              <ImageUpload
                currentUrl={pendingIcon?.preview}
                aspectRatio="aspect-square"
                label={pendingIcon ? "REPLACE" : "ADD ICON"}
                uploading={iconUploading}
                onUpload={(file) =>
                  setPendingIcon({ file, preview: URL.createObjectURL(file) })
                }
                onDelete={pendingIcon ? () => setPendingIcon(null) : undefined}
              />
            </div>
            <p className="text-[10px] text-white/60 leading-relaxed self-end pb-1 sm:max-w-[16rem]">
              Square image · cropped to 1:1 · stored at 256×256 · transparency kept. Optional — a
              game with no icon shows its first letter.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Game Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beyblade" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Default Tracking</label>
              <select value={trackingMode} onChange={(e) => setTrackingMode(e.target.value === "HP" ? "HP" : "POINTS")} className={inputCls}>
                <option value="POINTS" className="bg-background text-white">Points</option>
                <option value="HP" className="bg-background text-white">HP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={inputCls} />
            </div>
          </div>
          <button onClick={handleCreate} className="w-full py-3 bg-primary text-black font-black text-[10px] uppercase tracking-[0.3em] hover:brightness-110 transition-all">
            Add To Catalog
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
          ERROR: {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-[10px] text-white/60 uppercase tracking-widest">Loading catalog…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <div key={g.id} className="bg-background border border-white/5 p-6 hover:border-white/20 transition-all flex flex-col justify-between min-h-[120px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {/* The retired placeholder is not editable anywhere, icon
                      included — it just shows whatever it has. */}
                  {g.isBuiltin ? (
                    <GameIcon game={g} size="row" />
                  ) : (
                    <GameIconField game={g} onChanged={fetchGames} />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest break-words">{g.name}</h4>
                    {g.isBuiltin && (
                      <span className="text-[10px] font-black text-[#FFCC00]/70 uppercase tracking-[0.2em]">Retired — not assignable</span>
                    )}
                  </div>
                </div>
                {!g.isBuiltin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => (editingId === g.id ? setEditingId(null) : startEdit(g))}
                      title={editingId === g.id ? "Stop editing" : "Edit description and tracking"}
                      className={`text-[10px] font-black uppercase tracking-widest transition-colors px-2 py-1 ${
                        editingId === g.id ? "text-primary" : "text-white/60 hover:text-white"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={deletingId === g.id}
                      title="Delete game"
                      className="text-[10px] text-white/60 hover:text-red-500 transition-colors p-2 -m-2 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      {deletingId === g.id ? "…" : "✕"}
                    </button>
                  </div>
                )}
              </div>
              {editingId === g.id ? (
                <div className="flex flex-col gap-3 mt-3">
                  <div>
                    <label className={labelCls} htmlFor={`desc-${g.id}`}>Description</label>
                    <input
                      id={`desc-${g.id}`}
                      type="text"
                      value={editDescription}
                      maxLength={400}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Optional"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`track-${g.id}`}>Default Tracking</label>
                    <select
                      id={`track-${g.id}`}
                      value={editTracking}
                      onChange={(e) => setEditTracking(e.target.value === "HP" ? "HP" : "POINTS")}
                      className={inputCls}
                    >
                      <option value="POINTS" className="bg-background text-white">Points</option>
                      <option value="HP" className="bg-background text-white">HP</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveEdit(g.id)}
                      disabled={savingEdit}
                      className="flex-1 py-2 bg-primary text-black font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={savingEdit}
                      className="px-4 py-2 border border-white/15 text-white/60 font-black text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {/* Changing the mode does not rewrite tournaments already
                      created from this game — it is the default they inherit. */}
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Tracking is the default a new tournament inherits. Tournaments already created keep
                    the rules they were made with.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-white/60 leading-relaxed italic mt-2 line-clamp-2">
                    {g.description || "No description."}
                  </p>
                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{g.trackingMode || "POINTS"}</span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                      {g._count?.tournaments ?? 0} tournament{(g._count?.tournaments ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolve-request modal */}
      {resolving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !resolveBusy && setResolving(null)}
        >
          <div
            className="w-full max-w-md bg-[#111] border border-white/20 p-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Resolve Request</h4>
              <p className="text-[10px] text-white/60 uppercase tracking-widest mt-2">
                Requested game: <span className="text-primary">{resolving.name}</span>
              </p>
              {resolving.tournament?.name && (
                <p className="text-[10px] text-white/60 uppercase tracking-widest mt-1">
                  For tournament: {resolving.tournament.name}
                </p>
              )}
            </div>

            <p className="text-[10px] text-white/60 leading-relaxed">
              Adds <span className="text-white">{resolving.name}</span> to the catalog
              {resolving.tournamentId ? " and reassigns the requesting tournament onto it." : "."}
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleResolveCreate(resolving)}
                disabled={resolveBusy}
                className="flex-1 py-3 bg-primary text-black font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all disabled:opacity-50"
              >
                {resolveBusy ? "Working…" : resolving.tournamentId ? "Add & Assign" : "Add To Catalog"}
              </button>
              <button
                onClick={() => handleDismiss(resolving)}
                disabled={resolveBusy}
                className="px-4 py-3 bg-background border border-white/20 text-white/60 font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
            <button
              onClick={() => setResolving(null)}
              disabled={resolveBusy}
              className="w-full text-[10px] font-black text-white/60 uppercase tracking-widest hover:text-white/60 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
