// Headless Playwright + API verification for the 2026-09-18 follow-ups:
//   · guests are excluded from the "Invite Player" picker on /manage
//   · a rejected or reset reported score rolls back the deciding game
//     (series score −1 AND the closed game log reopened), so the tracker
//     never shows "has won the series" on a match still being played.
//
// Targets the trinity stack (FRONTEND http://localhost:3003, BACKEND
// http://127.0.0.1:4003). Run from new/:
//   node scripts/verify-match-rollback.mjs

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const BACKEND = process.env.BACKEND || "http://127.0.0.1:4003";
const FRONTEND = process.env.FRONTEND || "http://localhost:3003";

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (const p of ["../../.env", "../../server/.env"]) {
    try {
      const env = readFileSync(new URL(p, import.meta.url), "utf8");
      const m = env.match(/^ADMIN_PASSWORD=(.*)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
    } catch {}
  }
  throw new Error("ADMIN_PASSWORD not found in ../.env or ../server/.env");
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

async function request(method, path, token, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 220)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
const api = (m, p, t, b) => request(m, p, t, b);

async function staffToken() {
  const signin = await request("POST", "/auth/signin", null, { identifier: "admin", password: adminPassword() });
  // A fresh seed flags the admin for a forced password change; its token is a
  // password_change-purpose token that session APIs refuse. Complete the change
  // with the changeToken handed back and sign in again.
  if (signin.passwordChangeRequired) {
    await request("POST", "/auth/password/forced-change", null, {
      changeToken: signin.changeToken,
      newPassword: adminPassword() + "x2",
    });
    const again = await request("POST", "/auth/signin", null, { identifier: "admin", password: adminPassword() + "x2" });
    return again.token;
  }
  return signin.token;
}

async function main() {
  const at = await staffToken();
  check("admin sign-in", !!at);

  const ts = randomInt(100000, 999999);

  // ── Catalog ────────────────────────────────────────────────────────────
  let games = await api("GET", "/games", null, null);
  if (!games || games.length === 0) {
    games = [await api("POST", "/games", at, { name: `VerifyGame${ts}` })];
  }
  const game = games[0];
  const formats = await api("GET", "/tournament-formats", null, null);
  const fmt = formats.find(
    (f) => f.name === "Single Elimination" || f.system === "SINGLE_ELIMINATION",
  );
  check("single-elimination format available", !!fmt, fmt?.id ?? "none");

  // ── Accounts ───────────────────────────────────────────────────────────
  const makePlayer = async (tag) => {
    const username = `${tag}_${String(ts).slice(-6)}`;
    await request("POST", "/auth/signup", null, {
      identifier: username,
      email: `${username}@example.com`,
      password: "password123",
    }).catch(() => {});
    const auth = await request("POST", "/auth/signin", null, { identifier: username, password: "password123" });
    const payload = JSON.parse(Buffer.from(auth.token.split(".")[1], "base64").toString());
    return { username, id: payload.id, token: auth.token };
  };
  const p1 = await makePlayer("vlp");
  const p2 = await makePlayer("vlq");
  const p3 = await makePlayer("vlr");
  check("player accounts ready", !!(p1.id && p2.id && p3.id), `${p1.username}, ${p2.username}, ${p3.username}`);

  // ── Tournament A · Invite Player probe (OPEN, one guest + one joined player) ─
  const A = await api("POST", "/tournaments/createtournament", at, {
    name: `VerifyInvite${ts}`,
    formatId: fmt.id,
    gameId: game.id,
    maxPlayers: 4,
    isPrivate: false,
    startNow: true,
  });
  const guestName = `Guest${ts}`;
  await api("POST", `/tournaments/${A.id}/participants/guest`, at, { username: guestName });
  await request("POST", `/tournaments/${A.id}/participants/join`, p2.token, { userId: p2.id });
  check("invite tournament seeded", !!A.id, `guest=${guestName}, joined=${p2.username}, free=${p3.username}`);

  // ── Tournament B · reject/reset rollback ───────────────────────────────
  const B = await api("POST", "/tournaments/createtournament", at, {
    name: `VerifyRollback${ts}`,
    formatId: fmt.id,
    gameId: game.id,
    maxPlayers: 2,
    isPrivate: false,
    startNow: true,
  });
  await request("POST", `/tournaments/${B.id}/participants/join`, p1.token, { userId: p1.id });
  await request("POST", `/tournaments/${B.id}/participants/join`, p2.token, { userId: p2.id });
  await api("POST", `/tournaments/starttournament/${B.id}`, at, {});
  const BDetail = await api("GET", `/tournaments/${B.id}`, null, null);
  const match = (BDetail.rounds ?? []).flatMap((r) => r.matches ?? []).find((m) => m.player1Id && m.player2Id);
  check("tournament B has a real match", !!match, match?.id ?? "none");
  if (!match) process.exitCode = 1;
  const mid = match.id;
  await api("POST", `/matches/${mid}/start`, at, {});
  const started = await api("GET", `/matches/${mid}`, null, null);
  check("match started (ONGOING)", started.status === "ONGOING", started.status);

  // Players on the tracker: game after game until the series is decided and
  // the deciding game is deferred into pending verification.
  const trackGame = async (winnerUserId) => {
    await api("POST", `/matches/${mid}/tracker/open`, p1.token, {});
    return api("POST", `/matches/${mid}/tracker/submit-game`, p1.token, { winnerId: winnerUserId });
  };
  let pending = null;
  let reports = 0;
  for (let i = 0; i < 6; i++) {
    await trackGame(p1.id);
    reports++;
    const m = await api("GET", `/matches/${mid}`, null, null);
    if (m.reportedWinnerId) { pending = m; break; }
  }
  check(
    "deciding game reported by p1 → pending verification",
    pending && pending.reportedWinnerId === p1.id && pending.status === "ONGOING",
    `score ${pending?.player1Score}-${pending?.player2Score} after ${reports} tracked game(s)`,
  );

  const logsFor = async () => api("GET", `/matches/${mid}/tracker`, null, null);
  const decidingLog = (logs) =>
    logs.filter((l) => !l.trackerActive && l.winnerId === p1.id && l.completedAt)
      .sort((a, b) => b.gameNumber - a.gameNumber)[0];
  const decidingBefore = decidingLog(await logsFor());
  check("deciding game log is closed before reject", !!decidingBefore, `log#${decidingBefore?.gameNumber}`);

  // ── REJECT ─────────────────────────────────────────────────────────────
  const winKey =
    pending.reportedWinnerId === (pending.player1?.id ?? pending.player1Id)
      ? "player1Score"
      : "player2Score";
  const otherKey = winKey === "player1Score" ? "player2Score" : "player1Score";
  const winsReq = pending[winKey];
  await api("POST", `/matches/${mid}/reject-report`, at, {});
  const afterReject = await api("GET", `/matches/${mid}`, null, null);
  check("reject clears the pending winner", afterReject.reportedWinnerId === null, `reportedWinnerId=${afterReject.reportedWinnerId}`);
  check("reject leaves the match ONGOING", afterReject.status === "ONGOING", afterReject.status);
  check(
    "reject rolls the deciding win back",
    afterReject[winKey] === Math.max(0, winsReq - 1) && afterReject[otherKey] === 0,
    `${afterReject.player1Score}-${afterReject.player2Score} (${pending.player1Score}-${pending.player2Score}; needs ${winsReq} to decide)`,
  );
  const reopened = (await logsFor()).find((l) => l.id === decidingBefore.id);
  check(
    "reject reopens the deciding game log",
    reopened && reopened.trackerActive && reopened.winnerId === null && reopened.completedAt === null,
    `log#${decidingBefore.gameNumber}: active=${reopened?.trackerActive} winner=${reopened?.winnerId}`,
  );

  // ── VERIFY then RESET ──────────────────────────────────────────────────
  // Re-submit on the reopened log (the tracker flow) → pending again → staff verify.
  await api("POST", `/matches/${mid}/tracker/submit-game`, p1.token, { winnerId: p1.id });
  const pendingAgain = await api("GET", `/matches/${mid}`, null, null);
  check(
    "deciding game can be re-reported after reject",
    pendingAgain.reportedWinnerId === p1.id,
    `score ${pendingAgain.player1Score}-${pendingAgain.player2Score}`,
  );
  await api("POST", `/matches/${mid}/verify`, at, {});
  const verified = await api("GET", `/matches/${mid}`, null, null);
  check(
    "verify completes the match",
    verified.status === "COMPLETED" && verified.winnerId === p1.id,
    `${verified.status} winner=${verified.winnerId}`,
  );

  await api("POST", `/matches/${mid}/reset`, at, {});
  const afterReset = await api("GET", `/matches/${mid}`, null, null);
  check(
    "reset returns the match to ONGOING",
    afterReset.status === "ONGOING" && afterReset.winnerId === null && afterReset.reportedWinnerId === null,
    `status=${afterReset.status} winner=${afterReset.winnerId}`,
  );
  check(
    "reset rolls the deciding win back",
    afterReset[winKey] === Math.max(0, winsReq - 1) && afterReset[otherKey] === 0,
    `${afterReset.player1Score}-${afterReset.player2Score} (needs ${winsReq} to decide)`,
  );
  const reopened2 = (await logsFor()).find((l) => l.id === decidingBefore.id);
  check(
    "reset reopens the deciding game log",
    reopened2 && reopened2.trackerActive && reopened2.winnerId === null && reopened2.completedAt === null,
    `log#${decidingBefore.gameNumber}: active=${reopened2?.trackerActive} winner=${reopened2?.winnerId}`,
  );

  // ── PLAYWRIGHT UI ──────────────────────────────────────────────────────
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    try { localStorage.setItem("token", t); } catch {}
  }, at);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // A · Invite Player picker excludes the guest
  await page.goto(`${FRONTEND}/tournaments/${A.id}/manage`, { waitUntil: "domcontentloaded" });
  const inviteBtn = page.locator("button:visible", { hasText: "Invite Player" }).first();
  await inviteBtn.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  check("manage page shows 'Invite Player' (OPEN)", await inviteBtn.isVisible().catch(() => false));
  await inviteBtn.click();
  const search = page.locator("input:visible[placeholder*='Type to search']").first();
  await search.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  check("Invite Player modal opens", await search.isVisible().catch(() => false));

  const resultFor = async (username) => {
    await search.fill(username);
    await page.waitForTimeout(500);
    const opt = page.locator("div.absolute.z-50 button:visible", { hasText: username }).first();
    const optVisible = await opt.isVisible().catch(() => false);
    const noMatch = await page.getByText("No matches found").isVisible().catch(() => false);
    return { optVisible, noMatch };
  };

  const guestQ = await resultFor(guestName);
  check("guest is excluded from Invite Player", !guestQ.optVisible && guestQ.noMatch, guestName);
  const joinedQ = await resultFor(p2.username);
  check("already-joined player is excluded", !joinedQ.optVisible && joinedQ.noMatch, p2.username);
  const freeQ = await resultFor(p3.username);
  check("uninvited registered player IS listed", freeQ.optVisible && !freeQ.noMatch, p3.username);

  // B · the reverted match's drawer is not stuck (SE → pairings is NOT the
  // default tab, so the draw handle must be given explicitly)
  await page.goto(`${FRONTEND}/tournaments/${B.id}?matchId=${mid}&tab=pairings`, { waitUntil: "domcontentloaded" });
  const submit = page.getByText("Submit Game Result").first();
  await submit.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  check("drawer opens with a live game (submit controls present)", await submit.isVisible().catch(() => false));
  const stuck = await page.getByText("has won the series").count().catch(() => 0);
  check("tracker does not claim a series winner on the rolled-back match", stuck === 0);
  const awaiting = await page.getByText("Awaiting Organizer Verification").count().catch(() => 0);
  check("no pending-verification banner after reject/reset", awaiting === 0);
  const pageOk = pageErrors.filter((e) => !/Failed to load resource/.test(e));
  check("no uncaught page errors", pageOk.length === 0, pageOk.slice(0, 2).join(" | "));

  await browser.close();

  // ── Report ─────────────────────────────────────────────────────────────
  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
  if (failures.length) {
    console.error("Failed:" + failures.map((f) => `\n  ✗ ${f.name} — ${f.detail}`).join(""));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ fatal:", e.message ?? e);
  process.exit(1);
});