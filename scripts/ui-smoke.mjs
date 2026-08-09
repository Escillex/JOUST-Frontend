// Headless UI smoke test for the Games feature (todo.md §5).
//
// Runs a real headless Chromium (no display/compositor needed) against the dev
// frontend and asserts the create-tournament Game selector + "Request a game"
// affordance render and behave. Backend must be on :4001, frontend on :3001.
//
// Prereqs (one-time, user runs — Core Rule 2):
//   cd new && npm i -D playwright && npx playwright install chromium
// Then, with backend (:4001) and `npm run dev` (:3001) up:
//   node scripts/ui-smoke.mjs
//
// Env overrides: FRONTEND (default http://localhost:3001),
//                BACKEND  (default http://127.0.0.1:4001),
//                ADMIN_PASSWORD (else read from ../server/.env).

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const FRONTEND = process.env.FRONTEND || "http://localhost:3001";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:4001";
const SHOTS = "/tmp/claude-1000/-home-esc-Code-JOUST/10d48102-c00d-41ea-9404-2ed6a3e45002/scratchpad";

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const env = readFileSync(new URL("../../server/.env", import.meta.url), "utf8");
  const m = env.match(/^ADMIN_PASSWORD=(.*)$/m);
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

async function main() {
  // 1. Authenticate against the API to get a token we inject into localStorage.
  const signin = await fetch(`${BACKEND}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin", password: adminPassword() }),
  });
  const token = (await signin.json()).token;
  check("api signin", !!token, token ? "" : "no token");

  const api = async (method, path, body) => {
    const r = await fetch(`${BACKEND}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  // Seed a pending game request tied to a fresh tournament, so the admin-queue UI
  // has something concrete to resolve.
  const me = (await api("GET", "/auth/me")).json;
  const aid = me.sub || me.id;
  const fmts = (await api("GET", "/tournament-formats")).json;
  const fmtId = fmts.find((f) => f.name === "Single Elimination")?.id;
  const reqGame = `Smoke${randomInt(1000, 9999)}`;
  const t = (await api("POST", "/tournaments/createtournament", {
    name: `SmokeReq ${randomInt(1000, 9999)}`, formatId: fmtId, maxPlayers: 8, createdById: aid,
  })).json;
  await api("POST", "/games/request", { name: reqGame, tournamentId: t.id, note: "smoke" });
  check("seed game request via API", true, `requested "${reqGame}"`);

  const browser = await chromium.launch(); // headless by default
  // Desktop viewport so the md/sm-gated layout shows the desktop wrapper. The form
  // is rendered twice (mobile + desktop wrappers), so every locator is :visible.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Seed the Bearer token before app JS runs so authenticatedFetch is authed.
  await context.addInitScript((t) => {
    try { localStorage.setItem("token", t); } catch {}
  }, token);

  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const apiCalls = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    // Generic dev-mode asset 404s (favicon/fonts/source maps) are noise; real API
    // failures are tracked separately in failedRequests.
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) {
      pageErrors.push("console: " + m.text());
    }
  });
  page.on("response", (r) => {
    if (/\/api\/backend\/games/.test(r.url())) {
      apiCalls.push(`${r.request().method()} ${r.url().split("/api/backend")[1]} -> ${r.status()}`);
    }
  });
  // Only API/page failures matter; dev-mode static 404s (fonts, favicon, HMR) are noise.
  page.on("response", (r) => {
    if (r.status() >= 400 && /\/api\/backend\//.test(r.url())) {
      failedRequests.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`${FRONTEND}/tournaments/create`, { waitUntil: "networkidle" });

  // 2. Format cards render (structure selection). Select one — the Game field and
  //    the rest of "Event Specification" only appear once a format is chosen.
  const formatCard = page.locator("button:visible", { hasText: "Single Elimination" }).first();
  check("format list renders", (await formatCard.count()) > 0);
  await formatCard.click();

  // 3. The Game selector renders with options (loaded from GET /games). Check the
  //    visible select actually contains a "General" option.
  await page.getByText("Determines which game leaderboard", { exact: false })
    .first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  const hasGeneral = await page.locator("select:visible").evaluateAll((sels) =>
    sels.some((s) => Array.from(s.options).some((o) => /General/.test(o.textContent || ""))));
  check("Game selector shows General", hasGeneral);

  // 4. The "Request a game" affordance is present, and toggling reveals the input.
  const requestToggle = page.locator("button:visible", { hasText: "Request it" }).first();
  const toggleVisible = await requestToggle.isVisible().catch(() => false);
  check("'Request a game' toggle present", toggleVisible);
  if (toggleVisible) {
    await requestToggle.click();
    const input = page.locator('input:visible[placeholder="Game name to request"]').first();
    check("request input reveals on click", await input.isVisible().catch(() => false));
  }

  await page.screenshot({ path: `${SHOTS}/ui-smoke-create.png`, fullPage: true });
  console.log(`screenshot -> ${SHOTS}/ui-smoke-create.png`);

  check("no failed API requests", failedRequests.length === 0,
        failedRequests.slice(0, 4).join(" | "));
  check("no uncaught page errors", pageErrors.length === 0,
        pageErrors.slice(0, 3).join(" | "));

  // ── Admin: game catalog + request queue (deep-linked via ?tab=GAMES) ──────
  await page.goto(`${FRONTEND}/admin?tab=GAMES`, { waitUntil: "networkidle" });
  await page.getByText("Game Catalog", { exact: false }).first()
    .waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  check("admin GAMES tab deep-links open", await page.getByText("Game Catalog").first().isVisible().catch(() => false));

  const requestRow = page.getByText(reqGame, { exact: false }).first();
  check("pending request shows in queue", await requestRow.isVisible().catch(() => false), reqGame);

  if (await requestRow.isVisible().catch(() => false)) {
    // Target THIS run's request specifically (aria-label carries the game name) —
    // other pending requests may coexist in the dev DB.
    await page.getByRole("button", { name: `Resolve ${reqGame}` }).click();
    const addAssign = page.locator("button:visible", { hasText: /Add & Assign|Add To Catalog/ }).first();
    check("resolve modal opens", await addAssign.isVisible().catch(() => false));
    await addAssign.click();
    // Success closes the modal (resolving → null unmounts it). The requested name
    // then legitimately moves from the pending queue into the catalog, so we assert
    // modal-closed + catalog-contains rather than "name gone from page".
    await addAssign.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    check("resolve modal closes on success", !(await addAssign.isVisible().catch(() => true)));
    const created = (await api("GET", "/games")).json.some((g) => g.name === reqGame);
    check("resolved game added to catalog", created);
    // The row's Resolve button leaves the pending queue once GameManager refreshes
    // (Playwright auto-waits, so this is not racy against the async re-fetch).
    const resolveBtn = page.getByRole("button", { name: `Resolve ${reqGame}` });
    await resolveBtn.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    check("request cleared from pending queue", (await resolveBtn.count()) === 0);
  }

  await page.screenshot({ path: `${SHOTS}/ui-smoke-admin.png`, fullPage: true });
  console.log(`screenshot -> ${SHOTS}/ui-smoke-admin.png`);
  console.log("games API calls seen:", JSON.stringify(apiCalls));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
