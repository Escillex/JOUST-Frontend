"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { useToast } from "../ui/Toast";

/** Mirrors a JoustqlManifest plus the file's own name and size
 *  (server/src/backup/joustql.ts). */
interface Backup {
  name: string;
  createdAt: string;
  database: string;
  schemaMigration: string | null;
  trigger: "manual" | "scheduled" | "uploaded" | "pre-restore";
  alias: string | null;
  description: string | null;
  pinned: boolean;
  sanitized: boolean;
  encrypted: boolean;
  /** Format 2 only. Which key opens the file — and therefore whether it can be
   *  restored anywhere but here. */
  encryption?: "none" | "serverKey" | "passphrase";
  payloadBytes: number;
  fileBytes: number;
}

const bytes = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Always shown, even when a backup is aliased: the alias says what it is for,
 *  the timestamp says which one it is. */
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

const TRIGGER_LABEL: Record<Backup["trigger"], string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  uploaded: "Imported",
  "pre-restore": "Safety copy",
};

export default function BackupPanel() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [directory, setDirectory] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [sanitized, setSanitized] = useState(false);
  /** Locks a full backup to a passphrase instead of this server's key, so the
   *  file can be restored somewhere else. Never stored anywhere. */
  const [passphrase, setPassphrase] = useState("");
  /** Set when the server answers PASSPHRASE_REQUIRED, so we can ask instead of
   *  reporting a failure. Holds what we were trying to do. */
  const [needPass, setNeedPass] = useState<
    { kind: "import"; file: File } | { kind: "restore"; backup: Backup } | null
  >(null);
  const [openPass, setOpenPass] = useState("");
  const [creating, setCreating] = useState(false);

  // Which row is expanded for restore, and what has been typed into its
  // confirmation box. No window.confirm anywhere in this project.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [restartState, setRestartState] = useState<"restoring" | "restarting" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUPS);
    const data = await safeJson(res);
    if (res.ok && data) {
      setBackups(data.backups ?? []);
      setDirectory(data.directory ?? "");
      setDemoPassword(data.sanitizedPassword ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUPS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: alias.trim() || undefined,
          description: description.trim() || undefined,
          sanitized,
          // A sanitized export is written unencrypted by design, so a
          // passphrase on one would be silently ignored — don't send it.
          passphrase: !sanitized && passphrase.trim() ? passphrase.trim() : undefined,
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        toast(sanitized ? "Sanitized export created" : "Backup created", "success");
        setAlias(""); setDescription(""); setPassphrase("");
        await load();
      } else {
        toast(data?.message || "Could not create the backup", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setCreating(false);
    }
  };

  const patch = async (name: string, body: Record<string, unknown>) => {
    setBusyRow(name);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP(name), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await load();
      else toast((await safeJson(res))?.message || "Could not update the backup", "error");
    } finally {
      setBusyRow(null);
    }
  };

  const remove = async (name: string) => {
    setBusyRow(name);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP(name), { method: "DELETE" });
      if (res.ok) { toast("Backup deleted", "success"); await load(); }
      else toast((await safeJson(res))?.message || "Could not delete the backup", "error");
    } finally {
      setBusyRow(null);
    }
  };

  /** The download is an authenticated request, so it cannot be a plain <a
   *  href>: the Bearer token would not travel. Fetch it and hand the browser a
   *  blob instead. */
  const download = async (name: string) => {
    setBusyRow(name);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP_DOWNLOAD(name));
      if (!res.ok) { toast("Could not download the backup", "error"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast("Could not download the backup", "error");
    } finally {
      setBusyRow(null);
    }
  };

  const importFile = async (file: File, withPass?: string) => {
    const body = new FormData();
    body.append("file", file);
    if (withPass) body.append("passphrase", withPass);
    setBusyRow("import");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP_IMPORT, { method: "POST", body });
      const data = await safeJson(res);
      if (res.ok) {
        toast("Backup imported", "success");
        setNeedPass(null); setOpenPass("");
        await load();
      } else if (data?.code === "PASSPHRASE_REQUIRED") {
        // Not a failure — the file is fine, we just have not been given the key.
        setNeedPass({ kind: "import", file });
      } else {
        toast(data?.message || "That file was rejected", "error");
      }
    } finally {
      setBusyRow(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  /** After a restore the server exits so the container restarts it; poll the
   *  unauthenticated health route until it answers, then reload. */
  const waitForServer = async () => {
    setRestartState("restarting");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "/api/backend"}${API_ENDPOINTS.HEALTH}`,
          { cache: "no-store" },
        );
        if (res.ok) { window.location.reload(); return; }
      } catch { /* still down — that is the expected case here */ }
    }
    setRestartState(null);
    toast("The server has not come back yet. Check the container.", "error");
  };

  const restore = async (b: Backup, withPass?: string) => {
    setBusyRow(b.name);
    setRestartState("restoring");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP_RESTORE(b.name), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withPass ? { passphrase: withPass } : {}),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setRestartState(null);
        if (data?.code === "PASSPHRASE_REQUIRED") {
          setNeedPass({ kind: "restore", backup: b });
          return;
        }
        toast(data?.message || "Restore failed", "error");
        return;
      }
      setConfirming(null); setTyped("");
      setNeedPass(null); setOpenPass("");
      if (data?.restarting) await waitForServer();
      else { setRestartState(null); toast("Restored.", "success"); await load(); }
    } catch {
      setRestartState(null);
      toast("Could not reach the server", "error");
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {restartState && (
        <div className="bg-amber-500/10 border border-amber-500/40 p-6 flex items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
            {restartState === "restoring"
              ? "Restoring the database..."
              : "Server restarting — this page reloads when it is back."}
          </p>
        </div>
      )}

      {/* Create */}
      <div className="bg-neutral-900 border border-neutral-800 p-8">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-primary/30" />
          Create a Backup
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Alias (optional)
            </label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="defense-baseline"
              className="w-full bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
            />
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest italic">
              An aliased backup is pinned, so rolling deletion never takes it.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Snapshot taken before the format rework"
              className="w-full bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
            />
          </div>
        </div>

        {!sanitized && (
          <div className="mt-6 space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Passphrase (optional)
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
              placeholder="Leave empty to lock it to this server"
              className="w-full bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
            />
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic leading-relaxed">
              {passphrase.trim()
                ? "This file will open on any JOUST server with this passphrase — that is how you move a snapshot between prod, dev and a test instance. Nobody can recover it for you."
                : "Without one, the backup is locked to this server's SETTINGS_ENCRYPTION_KEY and will not open anywhere else."}
            </p>
          </div>
        )}

        <button
          onClick={() => setSanitized(!sanitized)}
          className={`mt-6 w-full px-6 py-4 text-left border transition-all ${
            sanitized ? "bg-primary/10 border-primary" : "bg-neutral-950 border-neutral-800 hover:border-neutral-600"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full ${sanitized ? "bg-primary animate-pulse" : "bg-neutral-600"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${sanitized ? "text-primary" : "text-neutral-400"}`}>
              Sanitized export {sanitized ? "— on" : "— off"}
            </span>
          </div>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic mt-2 leading-relaxed">
            {sanitized
              ? `Addresses become @example.invalid and every account gets the password "${demoPassword}". Tournaments, matches and standings are untouched. This is the copy that may leave the building.`
              : "A full backup holds real addresses and password hashes. It is the one to restore from, and is encrypted at rest — to this server's key unless you give it a passphrase below."}
          </p>
        </button>

        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={create}
            disabled={creating}
            className="px-8 py-3 bg-primary text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
          >
            {creating ? "Working..." : "Back Up Now"}
          </button>

          <input
            ref={fileInput}
            type="file"
            accept=".joustql"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busyRow === "import"}
            className="px-8 py-3 bg-neutral-950 border border-neutral-700 text-neutral-300 text-[10px] font-black uppercase tracking-widest hover:border-neutral-500 disabled:opacity-50 transition-all active:scale-95"
          >
            {busyRow === "import" ? "Importing..." : "Import .joustql"}
          </button>
        </div>

        {directory && (
          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest italic mt-6">
            Stored in {directory} · retention and schedule are set in Dev Tools
          </p>
        )}
      </div>

      {/* List */}
      <div className="bg-neutral-900 border border-neutral-800 p-8">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400 mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-neutral-700" />
          Snapshots
        </h2>

        {loading ? (
          <p className="text-neutral-600 italic text-sm">Reading the backup directory...</p>
        ) : backups.length === 0 ? (
          <p className="text-neutral-600 italic text-sm">
            No backups yet. Press &quot;Back Up Now&quot; — the database is small, so it takes seconds.
          </p>
        ) : (
          <div className="divide-y divide-neutral-800">
            {backups.map((b) => (
              <div key={b.name} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-black text-white">{when(b.createdAt)}</span>
                      {b.alias && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/15 text-primary">
                          {b.alias}
                        </span>
                      )}
                      {b.pinned && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Pinned</span>
                      )}
                      {b.sanitized && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-neutral-800 text-neutral-300">
                          Sanitized
                        </span>
                      )}
                      {b.encrypted && (
                        /* "Encrypted" alone does not answer the question that
                           matters when you are holding a file: can it be opened
                           somewhere else? */
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            b.encryption === "passphrase" ? "text-primary" : "text-neutral-500"
                          }`}
                          title={
                            b.encryption === "passphrase"
                              ? "Opens on any JOUST server with the passphrase it was exported with."
                              : "Locked to this server's SETTINGS_ENCRYPTION_KEY — it will not open elsewhere."
                          }
                        >
                          {b.encryption === "passphrase" ? "Passphrase" : "This server only"}
                        </span>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-xs text-neutral-400 mt-1.5">{b.description}</p>
                    )}
                    <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1.5">
                      {TRIGGER_LABEL[b.trigger]} · {bytes(b.fileBytes)} · schema {b.schemaMigration ?? "unknown"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void download(b.name)}
                      disabled={busyRow === b.name}
                      className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-50 transition-all"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => void patch(b.name, { pinned: !b.pinned })}
                      disabled={busyRow === b.name}
                      className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-50 transition-all"
                    >
                      {b.pinned ? "Unpin" : "Pin"}
                    </button>
                    {/* This one only opens the confirmation; the amber button
                        inside it is what restores. Both used to read "Restore",
                        so clicking this one again after typing the database name
                        collapsed the panel and threw the typing away — which
                        looks exactly like a restore that ran and did nothing. */}
                    <button
                      onClick={() => {
                        const open = confirming === b.name;
                        setConfirming(open ? null : b.name);
                        if (!open) setTyped("");
                      }}
                      aria-expanded={confirming === b.name}
                      disabled={busyRow === b.name}
                      className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-background disabled:opacity-50 transition-all"
                    >
                      {confirming === b.name ? "Cancel" : "Restore…"}
                    </button>
                    <button
                      onClick={() => void remove(b.name)}
                      disabled={busyRow === b.name}
                      className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {confirming === b.name && (
                  <div className="mt-5 bg-neutral-950 border border-amber-500/30 p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                      This replaces the entire database
                    </p>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Everything currently in <span className="text-white font-bold">{b.database}</span> is
                      replaced by this snapshot. A safety copy of the current state is taken first, and the
                      server restarts afterwards. Type <span className="text-white font-bold">{b.database}</span> to continue.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={b.database}
                        className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-all text-foreground"
                      />
                      <button
                        onClick={() => void restore(b)}
                        disabled={typed !== b.database || busyRow === b.name}
                        className="px-8 py-2.5 bg-amber-500 text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all active:scale-95"
                      >
                        {busyRow === b.name ? "Restoring…" : "Replace database"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asked for only when the server says the file needs one, so the common
          case — an unencrypted or server-keyed file — never sees a prompt. */}
      {needPass && (
        <div className="border border-amber-500/40 bg-amber-500/[0.06] p-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Passphrase required
          </p>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            {needPass.kind === "import"
              ? `"${needPass.file.name}" was exported with a passphrase. Enter it to read the file.`
              : `"${needPass.backup.name}" was exported with a passphrase. Enter it to restore from it.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="password"
              value={openPass}
              onChange={(e) => setOpenPass(e.target.value)}
              autoComplete="off"
              placeholder="Passphrase"
              className="flex-1 min-w-[220px] bg-neutral-950 border border-neutral-800 px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-all text-foreground"
            />
            <button
              onClick={() => {
                const pass = openPass;
                if (needPass.kind === "import") void importFile(needPass.file, pass);
                else void restore(needPass.backup, pass);
              }}
              disabled={!openPass.trim() || busyRow !== null}
              className="px-8 py-2.5 bg-amber-500 text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all active:scale-95"
            >
              Unlock
            </button>
            <button
              onClick={() => { setNeedPass(null); setOpenPass(""); }}
              className="px-6 py-2.5 border border-neutral-800 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:border-neutral-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ResetSection databaseName={backups[0]?.database ?? ""} onDone={load} />
    </div>
  );
}

/**
 * Emptying the database for debugging.
 *
 * Kept beside the backups on purpose: this is only a reasonable thing to offer
 * because a safety copy is taken automatically, and that is the machinery
 * sitting directly above it. The typed confirmation is the same shape the
 * restore control uses.
 */
function ResetSection({
  databaseName,
  onDone,
}: {
  databaseName: string;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"content" | "everything">("content");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const run = async () => {
    setBusy(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.BACKUP_RESET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, confirm: typed }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        toast(data?.message || "Database reset", "success");
        setOpen(false);
        setTyped("");
        await onDone();
      } else {
        toast(data?.message || "Could not reset the database", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-red-500/30 bg-red-500/[0.04] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
            Reset the database
          </p>
          <p className="mt-2 text-[11px] text-neutral-400 leading-relaxed max-w-xl">
            Empties tournament data so you can test against a clean instance. A
            safety backup is taken first, automatically — this is recoverable,
            but only from that file.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="px-6 py-2.5 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
        >
          {open ? "Cancel" : "Reset"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-red-500/20 pt-4">
          <div className="flex flex-wrap gap-2">
            {(["content", "everything"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                  scope === s
                    ? "bg-red-500/15 border-red-500 text-red-300"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {s === "content" ? "Tournament data" : "Everything"}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            {scope === "content"
              ? "Clears tournaments, matches, standings, notifications and awards given. Accounts, games, formats, the store and the home page are kept."
              : "Also clears accounts, games, formats, awards and the store. Only this server's settings and your own administrator account survive."}
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Type {databaseName || "the database name"} to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={databaseName}
              className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 transition-all text-foreground"
            />
            <button
              onClick={() => void run()}
              disabled={!typed || typed !== databaseName || busy}
              className="px-8 py-2.5 bg-red-500 text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all active:scale-95"
            >
              {busy ? "Resetting..." : "Delete data"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
