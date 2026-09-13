"use client";

import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../../utils/api";
import type { BuildVisibility, BuildsResponse, TournamentBuild } from "../../../tournaments/types";
import BuildView, { BuildStatusChip } from "../../content/BuildView";

/**
 * Build settings and the deck check (todo.md obj. 4.3), on the manage page.
 *
 * Optional builds (the default) are shown as players submit them, so there is
 * no queue — only the settings and a count. Required builds are the mode where
 * organizers actually validate: every account-holding entrant needs an approved
 * build before the tournament can start, and this panel is where that happens.
 */
const VISIBILITY: [BuildVisibility, string][] = [
  ["AFTER_COMPLETION", "After the tournament ends"],
  ["PUBLIC", "Everyone, as submitted"],
  ["STAFF_ONLY", "Organizers only"],
];

interface Props {
  tournamentId: string;
  status: string;
  /** Changes whenever the roster or status does, so the entrant list follows. */
  refreshKey: string;
  setMessage: (msg: string, kind?: "success" | "error" | "info") => void;
}

export default function BuildsReviewPanel({ tournamentId, status, refreshKey, setMessage }: Props) {
  const [data, setData] = useState<BuildsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.BUILDS.LIST(tournamentId)).then(async (res) => {
      const body = await safeJson(res);
      if (alive && res.ok && body) setData(body);
    });
    return () => { alive = false; };
  }, [tournamentId, refreshKey, tick]);

  if (!data) {
    return (
      <div className="bg-[#000000] border border-white/20 rounded p-6">
        <h3 className="text-sm font-semibold text-white">Builds</h3>
        <p className="text-xs text-[#888888] mt-3">Loading…</p>
      </div>
    );
  }

  const { settings } = data;
  const started = status === "ONGOING" || status === "COMPLETED";

  const save = async (patch: Partial<Pick<BuildsResponse["settings"], "buildsRequired" | "buildVisibility" | "buildsLockAtStart">>) => {
    setSaving(true);
    const res = await authenticatedFetch(API_ENDPOINTS.BUILDS.SETTINGS(tournamentId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await safeJson(res);
    setSaving(false);
    if (!res.ok) {
      setMessage(body?.message || "Could not save the build settings.", "error");
      return;
    }
    load();
  };

  const byUser = new Map(data.builds.map((b) => [b.userId, b]));
  const entrants = data.entrants ?? [];
  const counts = entrants.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-[#000000] border border-white/20 rounded p-6 space-y-5">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold text-white">Builds</h3>
        <div className="h-[1px] flex-1 bg-white/10" />
      </div>

      <div className="space-y-3">
        <Toggle
          label="Require builds"
          hint={
            settings.buildsRequired
              ? "Every entrant needs an approved build before the tournament can start. Guests are exempt."
              : "Players may share a build if they want to. Nothing is reviewed."
          }
          checked={settings.buildsRequired}
          disabled={saving || started}
          onChange={(v) => void save({ buildsRequired: v })}
        />
        <Toggle
          label="Lock at start"
          hint={settings.buildsLockAtStart ? "Builds cannot change once the tournament starts." : "Builds can change until the tournament ends."}
          checked={settings.buildsLockAtStart}
          disabled={saving || started}
          onChange={(v) => void save({ buildsLockAtStart: v })}
        />
        {started && (
          <p className="text-[10px] text-[#888888]">Requiring and locking are fixed once the tournament starts. Visibility can change at any time.</p>
        )}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider">Who can see builds</label>
          <select
            value={settings.buildVisibility}
            disabled={saving}
            onChange={(e) => void save({ buildVisibility: e.target.value as BuildVisibility })}
            className="w-full h-10 bg-[#111] border border-white/15 rounded px-3 text-xs text-white focus:outline-none focus:border-primary disabled:opacity-50"
          >
            {VISIBILITY.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          {settings.buildsRequired && (
            <p className="text-[10px] text-[#888888]">Only approved builds are ever shown to players.</p>
          )}
        </div>
      </div>

      {settings.buildsRequired ? (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex flex-wrap gap-2 text-[10px] text-[#888888]">
            <span>{counts.APPROVED ?? 0} approved</span>·
            <span>{counts.PENDING ?? 0} waiting</span>·
            <span>{counts.REJECTED ?? 0} rejected</span>·
            <span>{counts.MISSING ?? 0} missing</span>
          </div>
          {entrants.length === 0 ? (
            <p className="text-xs text-[#888888]">No entrants yet.</p>
          ) : (
            <div className="space-y-2">
              {/* Waiting on review first — that is the work to do. */}
              {[...entrants]
                .sort((a, b) => order(a.status) - order(b.status) || a.name.localeCompare(b.name))
                .map((e) => (
                  <EntrantRow
                    key={e.userId}
                    name={e.name}
                    status={e.status}
                    build={byUser.get(e.userId)}
                    tournamentId={tournamentId}
                    locked={status === "COMPLETED"}
                    onReviewed={load}
                    setMessage={setMessage}
                  />
                ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-[#888888] pt-2 border-t border-white/10">
          {data.builds.length} build{data.builds.length === 1 ? "" : "s"} shared. They appear on the tournament&apos;s Builds tab.
        </p>
      )}
    </div>
  );
}

const order = (s: string) => ({ PENDING: 0, REJECTED: 1, MISSING: 2, APPROVED: 3, GUEST: 4 } as Record<string, number>)[s] ?? 5;

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="min-w-0">
        <span className="block text-xs text-white">{label}</span>
        <span className="block text-[10px] text-[#888888] leading-relaxed mt-0.5">{hint}</span>
      </span>
      <span className={`shrink-0 mt-0.5 w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-primary" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function EntrantRow({
  name,
  status,
  build,
  tournamentId,
  locked,
  onReviewed,
  setMessage,
}: {
  name: string;
  status: string;
  build?: TournamentBuild;
  tournamentId: string;
  locked: boolean;
  onReviewed: () => void;
  setMessage: Props["setMessage"];
}) {
  const [open, setOpen] = useState(status === "PENDING");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const review = async (decision: "APPROVED" | "REJECTED") => {
    if (!build) return;
    if (decision === "REJECTED" && !note.trim()) {
      setMessage("Tell the player why the build was rejected.", "error");
      return;
    }
    setBusy(true);
    const res = await authenticatedFetch(API_ENDPOINTS.BUILDS.REVIEW(tournamentId, build.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, ...(note.trim() ? { note: note.trim() } : {}) }),
    });
    const body = await safeJson(res);
    setBusy(false);
    if (!res.ok) {
      setMessage(body?.message || "Could not save the review.", "error");
      return;
    }
    setMessage(decision === "APPROVED" ? `Approved ${name}'s build.` : `Rejected ${name}'s build.`, "success");
    setNote("");
    setOpen(false);
    onReviewed();
  };

  return (
    <div className="border border-white/10 rounded">
      <button
        type="button"
        onClick={() => build && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-3 h-11 text-left ${build ? "hover:bg-white/[0.03]" : "cursor-default"}`}
      >
        <span className="text-sm text-white truncate">{name}</span>
        <BuildStatusChip status={status as never} />
      </button>
      {open && build && (
        <div className="px-3 pb-3 space-y-3">
          <BuildView build={build} alt={`${name}'s build`} compact />
          {build.status === "REJECTED" && build.reviewNote && (
            <p className="text-[10px] text-[#FF4D4D]">Rejected: {build.reviewNote}</p>
          )}
          {!locked && (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 300))}
                placeholder="Note to the player (required to reject)"
                className="w-full h-9 bg-[#111] border border-white/15 rounded px-3 text-xs text-white focus:outline-none focus:border-primary placeholder:text-white/25"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void review("APPROVED")}
                  disabled={busy || build.status === "APPROVED"}
                  className="flex-1 h-9 rounded bg-primary text-black text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void review("REJECTED")}
                  disabled={busy}
                  className="flex-1 h-9 rounded border border-[#FF4D4D]/50 text-[#FF4D4D] text-[10px] font-bold uppercase tracking-wider hover:bg-[#FF4D4D]/10 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
