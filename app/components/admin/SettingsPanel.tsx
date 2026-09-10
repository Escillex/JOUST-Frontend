"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";

/** Mirrors the payload of GET /admin/settings. `value` is null for secrets —
 *  they are write-only, so the API reports whether one is set, never what. */
interface Setting {
  key: string;
  name: string;
  value: string | null;
  secret: boolean;
  configured: boolean;
}

const MAIL_FIELDS: { name: string; label: string; help?: string; placeholder?: string }[] = [
  { name: "MAIL_TRANSPORT", label: "Transport", help: "console = write to the server log and send nothing. smtp = actually send." },
  { name: "MAIL_HOST", label: "SMTP host", placeholder: "smtp-relay.brevo.com", help: "Any SMTP provider works — Brevo, Gmail, Mailjet, a school relay." },
  { name: "MAIL_PORT", label: "Port", placeholder: "587", help: "587 for STARTTLS, 465 for implicit TLS." },
  { name: "MAIL_USER", label: "Username", placeholder: "you@example.com" },
  { name: "MAIL_PASS", label: "Password / SMTP key", help: "Stored encrypted and never shown again. Leave blank to keep the current one." },
  { name: "MAIL_FROM", label: "From", placeholder: "JOUST <noreply@example.com>", help: "Some providers force this to match the authenticated account." },
  { name: "MAIL_REPLY_TO", label: "Reply-to", placeholder: "(optional)" },
];

const SECURITY_FIELDS = [
  {
    name: "TWO_FACTOR_ENFORCEMENT",
    label: "Two-factor enforcement",
    options: ["all", "staff", "off"],
    help: "all = every account. staff = admins and organizers only. off = nobody. This is the stored default; Dev Tools can override it until restart.",
  },
  {
    name: "GOOGLE_SIGNIN_ENABLED",
    label: "Google sign-in",
    options: ["false", "true"],
    help: "Not yet implemented — the toggle is here so the setting exists when it lands.",
  },
];

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS);
    if (res.ok) setSettings((await safeJson(res)) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const valueOf = (name: string) =>
    drafts[name] ?? settings.find((s) => s.name === name)?.value ?? "";

  const save = async (name: string) => {
    const value = drafts[name];
    if (value === undefined) return;
    setSavingKey(name);
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setMessage({ text: `${name} saved.`, ok: true });
        setDrafts((d) => { const next = { ...d }; delete next[name]; return next; });
        await load();
      } else {
        setMessage({ text: data?.message ?? "Could not save.", ok: false });
      }
    } finally {
      setSavingKey(null);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.TEST_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const data = await safeJson(res);
      // The provider's own error is the useful part — surface it verbatim.
      setTestResult({
        ok: !!data?.delivered,
        text: data?.delivered
          ? data.message
          : `${data?.message ?? "Could not send."} ${data?.error ?? ""}`.trim(),
      });
    } catch {
      setTestResult({ ok: false, text: "Connection failed." });
    } finally {
      setTesting(false);
    }
  };

  const label = "text-[10px] font-bold text-white/40 uppercase tracking-widest";
  const input =
    "w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded-sm placeholder:text-white/15";

  const field = (
    f: { name: string; label: string; help?: string; placeholder?: string; options?: string[] },
  ) => {
    const setting = settings.find((s) => s.name === f.name);
    const dirty = drafts[f.name] !== undefined;
    return (
      <div key={f.name} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label className={label}>{f.label}</label>
          {setting?.secret && (
            <span className="text-[9px] uppercase tracking-widest text-white/25">
              {setting.configured ? "configured ••••" : "not set"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {f.options ? (
            <select
              value={valueOf(f.name)}
              onChange={(e) => setDrafts((d) => ({ ...d, [f.name]: e.target.value }))}
              className={input}
            >
              {f.options.map((o) => (
                <option key={o} value={o} className="bg-background">{o}</option>
              ))}
            </select>
          ) : (
            <input
              type={setting?.secret ? "password" : "text"}
              value={drafts[f.name] ?? (setting?.secret ? "" : valueOf(f.name))}
              onChange={(e) => setDrafts((d) => ({ ...d, [f.name]: e.target.value }))}
              placeholder={f.placeholder ?? (setting?.secret ? "••••••••" : "")}
              className={input}
            />
          )}
          <button
            onClick={() => save(f.name)}
            disabled={!dirty || savingKey === f.name}
            className="px-4 h-10 shrink-0 bg-primary text-black text-xs font-semibold rounded-sm hover:brightness-90 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            {savingKey === f.name ? "…" : "Save"}
          </button>
        </div>
        {f.help && <p className="text-[10px] text-white/25 leading-relaxed">{f.help}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {message && (
        <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>
      )}

      <div className="bg-background border border-white/10 p-6 space-y-6">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Email delivery</h3>
          <p className="text-[11px] text-white/25 mt-2 leading-relaxed">
            Stored in the database and applied without a restart. Values fall back to environment
            variables when blank. The password is encrypted at rest and cannot be read back.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {MAIL_FIELDS.map(field)}
        </div>

        <div className="pt-4 border-t border-white/5 space-y-2">
          <label className={label}>Send a test email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className={input}
            />
            <button
              onClick={sendTest}
              disabled={testing || !testTo.trim()}
              className="px-4 h-10 shrink-0 border border-white/20 text-white text-xs font-semibold rounded-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
            >
              {testing ? "Sending…" : "Send test"}
            </button>
          </div>
          {testResult && (
            <p className={`text-[11px] leading-relaxed ${testResult.ok ? "text-primary" : "text-[#FF4D4D]"}`}>
              {testResult.text}
            </p>
          )}
        </div>
      </div>

      <div className="bg-background border border-white/10 p-6 space-y-6">
        <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Security</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {SECURITY_FIELDS.map(field)}
        </div>
      </div>
    </div>
  );
}
