"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { useUser } from "../components/UserProvider";
import {
  MAIL_FIELDS,
  SECURITY_FIELDS,
  GOOGLE_FIELDS,
  BACKUP_FIELDS,
  type SettingField,
} from "../components/admin/settingsFields";

/** Mirrors GET /admin/settings. Secrets report configured-or-not, never a value. */
interface Setting {
  key: string;
  name: string;
  value: string | null;
  secret: boolean;
  configured: boolean;
}

const STEPS = [
  { key: "mail", title: "Email delivery", blurb: "Sign-in codes and address verification are sent over SMTP. Nothing that depends on email works until this does." },
  { key: "security", title: "Security", blurb: "Two-factor sign-in and Google sign-in. Both are off on a fresh deployment." },
  { key: "backups", title: "Backups", blurb: "Scheduled snapshots of the database. Optional, but cheaper to switch on now than to wish for later." },
  { key: "finish", title: "Finish", blurb: "What this deployment ended up with." },
] as const;

export default function SetupPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const isAdmin = !!user?.roles?.includes("ADMIN");

  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [mailProved, setMailProved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS);
    if (res.ok) setSettings((await safeJson(res)) ?? []);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const settingOf = (name: string) => settings.find((s) => s.name === name);
  const valueOf = (name: string) => drafts[name] ?? settingOf(name)?.value ?? "";

  /** Saves every field the step touched. One PATCH per field is what the API
   *  takes; the wizard just stops the user pressing Save seven times. */
  const saveStep = async (fields: SettingField[]) => {
    const dirty = fields.filter((f) => drafts[f.name] !== undefined);
    if (!dirty.length) return true;
    setSaving(true);
    setMessage(null);
    try {
      for (const f of dirty) {
        const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.name, value: drafts[f.name] }),
        });
        if (!res.ok) {
          const data = await safeJson(res);
          setMessage({ text: `${f.label}: ${data?.message ?? "could not save."}`, ok: false });
          return false;
        }
      }
      setDrafts((d) => {
        const next = { ...d };
        for (const f of dirty) delete next[f.name];
        return next;
      });
      await load();
      setMessage({ text: `Saved ${dirty.length} setting${dirty.length > 1 ? "s" : ""}.`, ok: true });
      return true;
    } finally {
      setSaving(false);
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
      // The transport's own error is the useful part: "535 authentication
      // failed" names the problem, "could not send" does not.
      setMailProved(!!data?.delivered);
      setTestResult({
        ok: !!data?.delivered,
        text: data?.delivered ? data.message : `${data?.message ?? "Could not send."} ${data?.error ?? ""}`.trim(),
      });
    } catch {
      setTestResult({ ok: false, text: "Connection failed." });
    } finally {
      setTesting(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.SETUP.COMPLETE, { method: "POST" });
      if (res.ok) router.push("/admin");
      else setMessage({ text: (await safeJson(res))?.message ?? "Could not finish setup.", ok: false });
    } finally {
      setFinishing(false);
    }
  };

  const label = "text-[10px] font-bold text-white/40 uppercase tracking-widest";
  const input =
    "w-full h-10 bg-background border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded-sm placeholder:text-white/15";

  const field = (f: SettingField) => {
    const setting = settingOf(f.name);
    return (
      <div key={f.name} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label className={label} htmlFor={`setting-${f.name}`}>{f.label}</label>
          {setting?.secret && (
            <span className="text-[9px] uppercase tracking-widest text-white/25">
              {setting.configured ? "configured ••••" : "not set"}
            </span>
          )}
        </div>
        {f.options ? (
          <select
            id={`setting-${f.name}`}
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
            id={`setting-${f.name}`}
            type={setting?.secret ? "password" : "text"}
            value={drafts[f.name] ?? (setting?.secret ? "" : valueOf(f.name))}
            onChange={(e) => setDrafts((d) => ({ ...d, [f.name]: e.target.value }))}
            placeholder={f.placeholder ?? (setting?.secret ? "••••••••" : "")}
            className={input}
          />
        )}
        {f.help && <p className="text-[10px] text-white/25 leading-relaxed">{f.help}</p>}
      </div>
    );
  };

  if (loading) {
    return <main className="min-h-screen bg-[#1B1B1B] flex items-center justify-center text-white/40 text-sm">Loading…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#1B1B1B] flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-white">Administrators only</h1>
          <p className="text-sm text-white/40 leading-relaxed">
            Setup configures the whole deployment — mail, sign-in and backups — so it is limited to
            administrator accounts.
          </p>
          <Link href="/auth" className="inline-block text-xs font-semibold text-primary hover:underline">
            Sign in as an administrator →
          </Link>
        </div>
      </main>
    );
  }

  const current = STEPS[step];
  const stepFields: SettingField[] =
    current.key === "mail" ? MAIL_FIELDS
    : current.key === "security" ? [...SECURITY_FIELDS, ...GOOGLE_FIELDS]
    : current.key === "backups" ? BACKUP_FIELDS
    : [];

  const next = async () => {
    if (await saveStep(stepFields)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const enforcement = valueOf("TWO_FACTOR_ENFORCEMENT");
  const transport = valueOf("MAIL_TRANSPORT");

  return (
    <main className="min-h-screen bg-[#1B1B1B] py-12 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Setup</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Configure this deployment</h1>
          <p className="text-sm text-white/40 leading-relaxed">
            Everything here is also in Admin → Settings. This walks it in the order that works:
            prove mail before switching on anything that depends on it.
          </p>
        </header>

        {/* Stepper. Every step stays clickable — this is a checklist, not a gate. */}
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                onClick={() => setStep(i)}
                className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-widest border transition-colors ${
                  i === step
                    ? "border-primary text-primary bg-primary/5"
                    : i < step
                      ? "border-white/10 text-white/50 hover:text-white"
                      : "border-white/5 text-white/25 hover:text-white/50"
                }`}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          ))}
        </ol>

        <section className="bg-background border border-white/10 p-6 space-y-6">
          <div>
            <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">{current.title}</h2>
            <p className="text-[11px] text-white/25 mt-2 leading-relaxed">{current.blurb}</p>
          </div>

          {current.key !== "finish" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">{stepFields.map(field)}</div>
          )}

          {current.key === "mail" && (
            <div className="pt-4 border-t border-white/5 space-y-2">
              <label className={label} htmlFor="setup-test-to">Send a test email</label>
              <p className="text-[10px] text-white/25 leading-relaxed">
                Save the fields above first. The test connects and authenticates with what is stored,
                so a wrong SMTP key reports itself here rather than at somebody&apos;s sign-in.
              </p>
              <div className="flex gap-2">
                <input
                  id="setup-test-to"
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
              {transport === "console" && (
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Transport is <span className="text-white/60">console</span>: messages are written to
                  the server log and nobody receives them. That is a working configuration for a
                  private instance — just not one where two-factor should be turned on.
                </p>
              )}
            </div>
          )}

          {current.key === "security" && enforcement !== "off" && !mailProved && (
            <p className="text-[11px] text-[#FFB020] leading-relaxed border-l-2 border-[#FFB020] pl-3">
              Two-factor is set to <span className="font-semibold">{enforcement}</span>, but no test
              email has been delivered in this session. Email is the second factor — if codes do not
              arrive, nobody can sign in, including you. Go back and send a test first.
            </p>
          )}

          {current.key === "security" && (
            <div className="border border-white/5 bg-white/[0.02] p-5 space-y-2">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Google Client ID</p>
              <p className="text-[11px] text-white/40 leading-relaxed">
                From your own Google Cloud project — the consent screen names whoever runs this site.
                Register{" "}
                <code className="text-primary bg-black/40 px-1.5 py-0.5">{origin || "this site's address"}</code>{" "}
                under <span className="text-white/70">Authorized JavaScript origins</span>. No redirect
                URI and no client secret are needed.
              </p>
            </div>
          )}

          {current.key === "finish" && (
            <dl className="divide-y divide-white/5 border border-white/5">
              {[
                ["Mail transport", valueOf("MAIL_TRANSPORT") || "console"],
                ["SMTP host", valueOf("MAIL_HOST") || "—"],
                ["SMTP password", settingOf("MAIL_PASS")?.configured ? "configured" : "not set"],
                ["Test email delivered", mailProved ? "yes" : "not in this session"],
                ["Two-factor", valueOf("TWO_FACTOR_ENFORCEMENT") || "off"],
                ["Google sign-in", valueOf("GOOGLE_SIGNIN_ENABLED") === "true" ? "enabled" : "off"],
                ["Scheduled backups", valueOf("BACKUP_ENABLED") === "true" ? `on (${valueOf("BACKUP_CRON") || "0 3 * * *"})` : "off"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <dt className="text-[11px] text-white/40 uppercase tracking-widest">{k}</dt>
                  <dd className="text-sm text-white/80 text-right break-all">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {message && (
            <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="text-[11px] text-white/40 hover:text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
            >
              ← Back
            </button>
            {current.key === "finish" ? (
              <button
                onClick={finish}
                disabled={finishing}
                className="px-5 h-10 bg-primary text-black text-xs font-semibold rounded-sm hover:brightness-90 transition-colors disabled:opacity-40"
              >
                {finishing ? "Finishing…" : "Finish setup"}
              </button>
            ) : (
              <button
                onClick={next}
                disabled={saving}
                className="px-5 h-10 bg-primary text-black text-xs font-semibold rounded-sm hover:brightness-90 transition-colors disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save & continue"}
              </button>
            )}
          </div>
        </section>

        <p className="text-[11px] text-white/25">
          Nothing here is permanent — every value stays editable in{" "}
          <Link href="/admin" className="text-white/50 hover:text-primary">Admin → Settings</Link>, and
          this page can be run again at any time.
        </p>
      </div>
    </main>
  );
}
