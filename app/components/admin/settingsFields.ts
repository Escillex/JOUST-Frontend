/**
 * The settings catalog the UI renders — labels, help text, placeholders.
 *
 * Shared by `SettingsPanel` (the admin tab) and `/setup` (the first-run wizard)
 * because the help strings ARE the documentation for these knobs: the order to
 * turn things on, what locks people out, what a provider will reject. Two
 * copies drift, and the copy that drifts is the one somebody is reading while
 * they configure a live deployment.
 */
export interface SettingField {
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  options?: string[];
}

export const MAIL_FIELDS: SettingField[] = [
  { name: "MAIL_TRANSPORT", label: "Transport", options: ["console", "smtp"], help: "console = write to the server log and send nothing. smtp = actually send." },
  { name: "MAIL_HOST", label: "SMTP host", placeholder: "smtp-relay.brevo.com", help: "Any SMTP provider works — Brevo, Gmail, Mailjet, a school relay." },
  { name: "MAIL_PORT", label: "Port", placeholder: "587", help: "587 for STARTTLS, 465 for implicit TLS." },
  { name: "MAIL_USER", label: "Username", placeholder: "you@example.com", help: "Often not your account address — Brevo issues a login like 8a1b2c001@smtp-brevo.com." },
  { name: "MAIL_PASS", label: "Password / SMTP key", help: "Stored encrypted and never shown again. Leave blank to keep the current one. Needs SETTINGS_ENCRYPTION_KEY in the environment." },
  { name: "MAIL_FROM", label: "From", placeholder: "JOUST <noreply@example.com>", help: "Some providers force this to match the authenticated account, and most reject a domain they have not verified." },
  { name: "MAIL_REPLY_TO", label: "Reply-to", placeholder: "(optional)" },
];

export const SECURITY_FIELDS: SettingField[] = [
  {
    name: "TWO_FACTOR_ENFORCEMENT",
    label: "Two-factor enforcement",
    options: ["all", "staff", "off"],
    help: "off (the default) = email gates nothing: no sign-in codes and no address check at registration, so the site works before mail is set up. staff = admins and organizers get codes. all = everyone does, and new accounts verify their address. Turn it on only after \"Send test email\" actually delivers — codes that never arrive lock people out. Dev Tools can override this until restart.",
  },
];

/** Google sign-in, configured per deployment. The Client ID belongs to whoever
 *  runs this site — their own Google Cloud project — so Google's consent screen
 *  names them, not the developer who wrote the code. */
export const GOOGLE_FIELDS: SettingField[] = [
  {
    name: "GOOGLE_SIGNIN_ENABLED",
    label: "Google sign-in",
    options: ["false", "true"],
    help: "The button appears on the sign-in page only when this is true AND a Client ID is set.",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    label: "OAuth Client ID",
    placeholder: "1234567890-abc123.apps.googleusercontent.com",
    help: "From your own Google Cloud project. Public by design — no client secret is needed or stored.",
  },
  {
    name: "GOOGLE_ALLOWED_DOMAIN",
    label: "Allowed domain (optional)",
    placeholder: "school.edu",
    help: "Only accept Google accounts from this Workspace domain. Leave empty to accept any Google account.",
  },
];

/** Backups. The knobs also live in Dev Tools; the wizard shows them because a
 *  deployment that has never been backed up is the one that needs it most. */
export const BACKUP_FIELDS: SettingField[] = [
  { name: "BACKUP_ENABLED", label: "Scheduled backups", options: ["false", "true"], help: "Runs the snapshot job on the schedule below. Full backups are encrypted with SETTINGS_ENCRYPTION_KEY — without that variable set, none can be written." },
  { name: "BACKUP_CRON", label: "Schedule", placeholder: "0 3 * * *", help: "Standard cron. The default is 03:00 daily." },
  { name: "BACKUP_RETENTION", label: "Keep this many", placeholder: "14", help: "Older snapshots are deleted as new ones are taken." },
  { name: "BACKUP_ALLOW_RESTORE", label: "Allow restore", options: ["false", "true"], help: "A restore overwrites the whole database, so it is refused unless this is on. A safety copy is taken first either way." },
];

/** Registering participants. Off by default: the manage page hides Participant
 *  Management and the add-guest / add-registered-user routes refuse, so nobody
 *  is added to a roster until a deployment deliberately allows it. Players
 *  joining themselves (the invite link) are never affected. */
export const PARTICIPATION_FIELDS: SettingField[] = [
  {
    name: "DEV_BULK_GUESTS",
    label: "Allow Bulk Guest Creation",
    options: ["false", "true"],
    help: "The switch for the bulk guest generator on a tournament's Players tab. Off = the Bulk Guest Creation panel is hidden and the batch route refuses, which keeps a fat-fingered Generate Guests from flooding a roster with placeholder players. It is a toggle for that one control only — adding a single guest and inviting a registered player are unaffected.",
  },
];
