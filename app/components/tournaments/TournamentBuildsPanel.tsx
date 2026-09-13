"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  API_ENDPOINTS,
  UPLOAD_TIMEOUT_MS,
  authenticatedFetch,
  displayNameOf,
  profileHref,
  safeJson,
} from "../../utils/api";
import type { BuildKind, BuildsResponse, TournamentBuild } from "../../tournaments/types";
import BuildView, { BuildStatusChip } from "../content/BuildView";
import ContentActions from "../content/ContentActions";
import { useToast } from "../ui/Toast";

/**
 * The tournament page's Builds tab (todo.md obj. 4.3): what each player brought.
 *
 * A build is a photo, a plain-text list or an https link — game-agnostic on
 * purpose. The organizer decides per tournament whether builds are optional
 * (shown as submitted) or required (each one approved before the start), when
 * others may see them, and whether they lock at the start.
 */
const TEXT_MAX = 4000;

const VISIBILITY_TEXT: Record<string, string> = {
  PUBLIC: "Visible to everyone",
  AFTER_COMPLETION: "Revealed when the tournament ends",
  STAFF_ONLY: "Seen only by the organizers",
};

interface Props {
  tournamentId: string;
  tournamentStatus: string;
  viewerId?: string;
  viewerRoles?: string[];
  /** The viewer is an entrant who has not been forfeited. */
  isActiveEntrant: boolean;
}

export default function TournamentBuildsPanel({ tournamentId, tournamentStatus, viewerId, viewerRoles, isActiveEntrant }: Props) {
  const [data, setData] = useState<BuildsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.BUILDS.LIST(tournamentId)).then(async (res) => {
      const body = await safeJson(res);
      if (!alive) return;
      if (res.ok && body) {
        setData(body);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => { alive = false; };
  }, [tournamentId, tick]);

  if (failed && !data) {
    return (
      <p className="text-xs text-[#FF4D4D] py-10 text-center">
        Could not load builds. Check the connection and{" "}
        <button onClick={load} className="underline">try again</button>.
      </p>
    );
  }
  if (!data) return <p className="text-xs text-white/30 py-10 text-center">Loading builds…</p>;

  const { settings, canManage, mine } = data;
  const others = data.builds.filter((b) => b.userId !== viewerId);
  const reviewed = settings.buildsRequired;

  let emptyText = "No builds have been shared yet.";
  if (!canManage && settings.buildVisibility === "STAFF_ONLY") emptyText = "Builds for this tournament are seen only by its organizers.";
  else if (!canManage && settings.buildVisibility === "AFTER_COMPLETION" && tournamentStatus !== "COMPLETED")
    emptyText = "Builds are revealed when the tournament ends.";

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="h-[2px] w-12 bg-primary" />
          <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.6em]">BUILDS</span>
        </div>
        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic">Player Builds</h2>
      </div>

      {/* The rules, stated plainly — a player should know before submitting who
          will see it and whether it can still change. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Rule label="Builds" value={settings.buildsRequired ? "Required — checked by organizers" : "Optional"} strong={settings.buildsRequired} />
        <Rule label="Who sees them" value={VISIBILITY_TEXT[settings.buildVisibility]} />
        <Rule
          label="Changes"
          value={settings.locked ? "Locked" : settings.buildsLockAtStart ? "Allowed until the tournament starts" : "Allowed until the tournament ends"}
        />
      </div>

      {canManage && settings.buildsRequired && (
        <Link
          href={`/tournaments/${tournamentId}/manage`}
          className="inline-flex px-6 py-3 border border-primary/40 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
        >
          Review builds on the manage page
        </Link>
      )}

      {isActiveEntrant && (
        <div className="border-2 border-component-border bg-component-background p-6 md:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest">Your build</h3>
            {mine && <BuildStatusChip status={mine.status} reviewed={reviewed} />}
          </div>

          {mine?.status === "REJECTED" && mine.reviewNote && (
            <p className="text-xs text-[#FF4D4D] border border-[#FF4D4D]/30 bg-[#FF4D4D]/5 px-4 py-3">
              Rejected: {mine.reviewNote.replace(/[.\s]+$/, "")}. Fix it and submit again.
            </p>
          )}

          {mine && !editing ? (
            <div className="space-y-4">
              <div className="max-w-xl">
                <BuildView build={mine} alt="Your build" />
              </div>
              {!settings.locked && (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setEditing(true)}
                    className="px-6 py-2.5 border-2 border-component-border text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/30"
                  >
                    Replace
                  </button>
                  <WithdrawButton tournamentId={tournamentId} onDone={load} />
                </div>
              )}
              {settings.buildsRequired && mine.status !== "APPROVED" && !settings.locked && (
                <p className="text-[11px] text-white/40">
                  The tournament cannot start until every entrant&apos;s build is approved.
                </p>
              )}
              {settings.buildsRequired && mine.status === "APPROVED" && !settings.locked && (
                <p className="text-[11px] text-white/40">Replacing an approved build sends it back for review.</p>
              )}
            </div>
          ) : settings.locked ? (
            <p className="text-xs text-white/40">Builds are locked for this tournament.</p>
          ) : (
            <BuildForm
              tournamentId={tournamentId}
              required={settings.buildsRequired}
              onCancel={mine ? () => setEditing(false) : undefined}
              onSaved={() => {
                setEditing(false);
                load();
              }}
            />
          )}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
            {canManage ? "All builds" : "Shared builds"}
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">{others.length}</span>
        </div>

        {others.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-white/5">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-[0.3em] px-4">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {others.map((b) => (
              <BuildCard
                key={b.id}
                build={b}
                showStatus={canManage || reviewed}
                reviewed={reviewed}
                viewerRoles={viewerRoles}
                onRemoved={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Rule({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border border-component-border bg-component-background px-5 py-4">
      <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mb-1">{label}</p>
      <p className={`text-[11px] font-black uppercase tracking-wider ${strong ? "text-primary" : "text-white/70"}`}>{value}</p>
    </div>
  );
}

function BuildCard({
  build,
  showStatus,
  reviewed,
  viewerRoles,
  onRemoved,
}: {
  build: TournamentBuild;
  showStatus: boolean;
  reviewed: boolean;
  viewerRoles?: string[];
  onRemoved: () => void;
}) {
  const name = displayNameOf(build.user, "Player");
  return (
    <div className="border border-component-border bg-component-background p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        {build.user && !build.user.isGuest ? (
          <Link href={profileHref(build.user)} className="text-sm font-black uppercase tracking-tight truncate hover:text-primary">
            {name}
          </Link>
        ) : (
          <span className="text-sm font-black uppercase tracking-tight truncate">{name}</span>
        )}
        {showStatus && <BuildStatusChip status={build.status} reviewed={reviewed} />}
      </div>
      <BuildView build={build} alt={`${name}'s build`} />
      <div className="flex justify-end">
        <ContentActions targetType="TOURNAMENT_BUILD" targetId={build.id} viewerRoles={viewerRoles} onRemoved={onRemoved} />
      </div>
    </div>
  );
}

function WithdrawButton({ tournamentId, onDone }: { tournamentId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // No window.confirm (Core Rule 5): the first press arms, the second acts.
  const [armed, setArmed] = useState(false);

  const go = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    const res = await authenticatedFetch(API_ENDPOINTS.BUILDS.MINE(tournamentId), { method: "DELETE" });
    const data = await safeJson(res);
    setBusy(false);
    setArmed(false);
    if (!res.ok) {
      toast(data?.message || "Could not withdraw the build.", "error");
      return;
    }
    toast("Build withdrawn.", "success");
    onDone();
  };

  return (
    <button
      onClick={go}
      disabled={busy}
      className={`px-6 py-2.5 border-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-all ${
        armed ? "border-[#FF4D4D] text-[#FF4D4D]" : "border-component-border text-white/40 hover:text-white hover:border-white/30"
      }`}
    >
      {busy ? "Withdrawing…" : armed ? "Press again to withdraw" : "Withdraw"}
    </button>
  );
}

function BuildForm({
  tournamentId,
  required,
  onSaved,
  onCancel,
}: {
  tournamentId: string;
  required: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const [kind, setKind] = useState<BuildKind>("IMAGE");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setError(null);
    if (kind === "IMAGE" && !file) return setError("Choose an image to upload.");
    if (kind === "TEXT" && !text.trim()) return setError("Write the build out, or choose image or link instead.");
    if (kind === "LINK" && !/^https:\/\/\S+$/i.test(url.trim())) return setError("A build link must be a full https:// address.");

    const form = new FormData();
    form.append("kind", kind);
    if (kind === "IMAGE" && file) form.append("image", file);
    if (kind === "TEXT") form.append("text", text.trim());
    if (kind === "LINK") form.append("url", url.trim());

    setBusy(true);
    const res = await authenticatedFetch(API_ENDPOINTS.BUILDS.MINE(tournamentId), {
      method: "PUT",
      body: form,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) {
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(" ") : msg || "The build could not be saved.");
      return;
    }
    toast(required ? "Build submitted for review." : "Build saved.", "success");
    onSaved();
  };

  const tab = (k: BuildKind, label: string) => (
    <button
      type="button"
      onClick={() => { setKind(k); setError(null); }}
      className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
        kind === k ? "bg-primary border-primary text-black" : "border-component-border text-white/40 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tab("IMAGE", "Photo")}
        {tab("TEXT", "Text")}
        {tab("LINK", "Link")}
      </div>

      {kind === "IMAGE" && (
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="shrink-0 px-6 py-2.5 bg-background border border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all active:scale-95"
            >
              {file ? "Change file" : "Browse"}
            </button>
            <span className={`text-xs truncate ${file ? "text-white/70" : "text-white/25"}`}>{file ? file.name : "No file chosen"}</span>
          </div>
          <p className="text-[10px] text-white/30">A clear photo of the whole build. PNG, JPEG or WebP, up to 8 MB.</p>
        </div>
      )}

      {kind === "TEXT" && (
        <div className="space-y-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            rows={10}
            placeholder={"One entry per line, e.g.\n4 Pikachu ex\n3 Iono"}
            className="w-full bg-black border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <p className="text-[10px] text-white/25 text-right">{text.length}/{TEXT_MAX}</p>
        </div>
      )}

      {kind === "LINK" && (
        <div className="space-y-1">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            inputMode="url"
            className="w-full h-11 bg-black border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <p className="text-[10px] text-white/30">A page that shows the build, such as a deck-builder site. https only.</p>
        </div>
      )}

      {error && <p className="text-xs text-[#FF4D4D]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-8 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          {busy ? "Saving…" : required ? "Submit for review" : "Save build"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border-2 border-component-border text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
