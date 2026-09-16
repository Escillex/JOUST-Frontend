// Headless UI smoke test for the rebuilt tournament pages (2026-09-16).
//
// Covers what the UX audit found broken: the browse card's facts, the action
// matrix never offering a join the server refuses, the Details list replacing
// the hover-timer panels, URL-driven tabs, and the game icon / "games I play"
// additions.
//
// Prereqs (one-time, user runs — Core Rule 2):
//   cd new && npm i -D playwright && npx playwright install chromium
//
// Against trinity (the default here). NOTE: use the tunnel host, not
// 127.0.0.1:3003 — that origin is absent from next.config `allowedDevOrigins`,
// so Next dev refuses it and the page never hydrates.
//   node scripts/tournament-pages-smoke.mjs
//
// Env overrides: FRONTEND (default http://127.0.0.1:3003),
//                BACKEND  (default http://127.0.0.1:4003),
//                ADMIN_PASSWORD (else read from the repo-root .env).

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const FRONTEND = process.env.FRONTEND || "https://trinity.escillex.com";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:4003";
const SHOTS = process.env.SHOTS || "/tmp";

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (const p of ["../../.env", "../../server/.env"]) {
    try {
      const env = readFileSync(new URL(p, import.meta.url), "utf8");
      const m = env.match(/^ADMIN_PASSWORD=(.*)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, "");
    } catch {}
  }
  return "";
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

/** Wait for React to have rendered, not merely for the network to go quiet:
 *  a hydrated page can still be showing its skeleton. */
async function ready(page, selector, timeout = 20000) {
  try {
    await page.waitForSelector(selector, { timeout, state: "visible" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const signin = await fetch(`${BACKEND}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin", password: adminPassword() }),
  });
  const auth = await signin.json();
  if (!auth.token) throw new Error("admin sign-in failed: " + JSON.stringify(auth).slice(0, 200));

  const api = (path, init = {}) =>
    fetch(`${BACKEND}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${auth.token}`, ...(init.headers || {}) },
    }).then((r) => r.json());

  const tournaments = await fetch(`${BACKEND}/tournaments`).then((r) => r.json());
  const open = tournaments.find((t) => t.status === "OPEN");
  const upcoming = tournaments.find((t) => t.status === "UPCOMING");
  const completed = tournaments.find((t) => t.status === "COMPLETED");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("token", t), auth.token);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // ── BROWSE ───────────────────────────────────────────────────────
  const CARD = 'a[href^="/tournaments/"]:not([href="/tournaments/manage"])';
  await page.goto(`${FRONTEND}/tournaments`, { waitUntil: "domcontentloaded" });
  // The search field is the signal the directory itself rendered — waiting on a
  // tournament link matches the page's own "Manage tournaments" button, which is
  // present while the list is still loading.
  await ready(page, 'input[type="search"]', 30000);
  const gridUp = await ready(page, CARD);
  await page.waitForTimeout(1500);
  check("browse: cards render", gridUp, `${await page.locator(CARD).count()} card(s)`);

  const body = await page.textContent("body");
  check("browse: no carousel controls", !(await page.locator('button[aria-label^="Go to slide"]').count()));
  check("browse: search field present", (await page.locator('input[type="search"]').count()) === 1);
  check(
    "browse: no ID badge on cards",
    !/ID:\s*[0-9a-f]{8}/i.test(body),
    /ID:\s*[0-9a-f]{8}/i.exec(body)?.[0] || "",
  );

  const firstCard = page.locator(CARD).first();
  const cardText = (await firstCard.textContent()) || "";
  check("browse: card shows seats or a result", /seats? left|full|\d+\s*\/\s*\d+|Winner:/i.test(cardText), cardText.replace(/\s+/g, " ").slice(0, 90));

  // The game chip: every seeded tournament names a game.
  const gameNames = [...new Set(tournaments.map((t) => t.game?.name).filter(Boolean))];
  check(
    "browse: game named on a card",
    gameNames.some((g) => body.includes(g)),
    gameNames.slice(0, 3).join(", "),
  );

  // Chess got an icon uploaded; it should render as an <img>, not a letter.
  const icons = await page.locator('img[src*="/uploads/games/"]').count();
  check("browse: game icon renders when set", icons > 0, `${icons} icon img(s)`);

  // Search matches the game name, which the old filter never did.
  if (gameNames[0]) {
    await page.fill('input[type="search"]', gameNames[0]);
    await page.waitForTimeout(400);
    const after = await page.locator(CARD).count();
    check("browse: search matches a game name", after > 0, `${after} result(s) for "${gameNames[0]}"`);
    await page.fill('input[type="search"]', "");
    await page.waitForTimeout(300);
  }

  const finished = await page.getByText(/^Finished · \d+$/).count();
  check("browse: finished collapsed to one line", finished > 0);
  check(
    "browse: finished starts collapsed",
    (await page.getByRole("button", { name: /^Show$/ }).count()) === 1 &&
      (await page.getByText(/#1/).count()) === 0,
  );

  // Grouped by status, with a heading per group.
  const headings = await page.locator("h2").allTextContents();
  check(
    "browse: grid is grouped by status",
    /Open for registration/i.test(headings.join(" ")) || /Happening now/i.test(headings.join(" ")),
    headings.join(" | "),
  );

  // A tournament being played reads as live — red, not the brand green.
  const ongoing = tournaments.filter((t) => t.status === "ONGOING").length;
  if (ongoing > 0) {
    check(
      "browse: live tournaments are marked red",
      (await page.locator('a[class*="FF4D4D"]').count()) > 0 &&
        (await page.getByText(/^Live( ·|$)/).count()) > 0,
      `${ongoing} ongoing`,
    );
  }

  // Status filter: one select rather than the five chips the old sidebar had.
  // "Active" is registration (OPEN + UPCOMING); "Ongoing" is being played.
  const statusSel = page.locator("select").first();
  const statusOpts = (await statusSel.locator("option").allTextContents()).join(" / ");
  check(
    "browse: status filter offers Active / Ongoing / Finished",
    /Active/.test(statusOpts) && /Ongoing/.test(statusOpts) && /Finished/.test(statusOpts),
    statusOpts,
  );

  const liveAll = await page.locator(CARD).count();
  await statusSel.selectOption("ONGOING");
  await page.waitForTimeout(800);
  const onlyOngoing = await page.locator(CARD).count();
  check(
    "browse: Ongoing narrows the list and hides finished",
    onlyOngoing > 0 && onlyOngoing <= liveAll && (await page.getByText(/^Finished · \d+$/).count()) === 0,
    `${liveAll} → ${onlyOngoing}`,
  );

  // Asking for finished must SHOW them, not leave a collapsed line over an
  // empty grid.
  await statusSel.selectOption("FINISHED");
  await page.waitForTimeout(900);
  const finishedRows = await page.locator(CARD).count();
  const collapseStillThere = await page.getByRole("button", { name: /^Show$/ }).count();
  check(
    "browse: Finished shows the rows expanded",
    finishedRows > 0 && collapseStillThere === 0,
    `${finishedRows} row(s), collapse control: ${collapseStillThere}`,
  );

  // Expanding under Finished must not leak into "Any status".
  const more = page.getByRole("button", { name: /^Show \d+ more$/ });
  if (await more.count()) {
    await more.first().click();
    await page.waitForTimeout(700);
  }
  await statusSel.selectOption("ALL");
  await page.waitForTimeout(900);
  check(
    "browse: finished re-collapses on leaving the filter",
    (await page.getByRole("button", { name: /^Show$/ }).count()) === 1 &&
      (await page.getByText(/#1/).count()) === 0,
  );

  // Finished tournaments are rows, not cards: history is scanned, and the
  // winner used to be squeezed into a 9px status chip in a card corner.
  const before = await page.locator(CARD).count();
  const show = page.getByRole("button", { name: /^Show$/ });
  if (await show.count()) {
    await show.first().click();
    await page.waitForTimeout(1200);
    const after = await page.locator(CARD).count();
    check("browse: Show reveals finished rows", after > before, `${before} → ${after}`);

    const lastRow = (await page.locator(CARD).last().textContent()) || "";
    check(
      "browse: a finished row names the champion",
      /#1/.test(lastRow),
      lastRow.replace(/\s+/g, " ").slice(0, 80),
    );
    check(
      "browse: a finished row carries size and an end date",
      /\d+ players?/.test(lastRow) && /[A-Z][a-z]{2} ?\d/.test(lastRow),
    );
    // A row is a fraction of a card; ten of them must still be shorter than the
    // grid they sit under.
    const rowH = await page.locator(CARD).last().evaluate((el) => el.getBoundingClientRect().height);
    check("browse: a finished row is compact", rowH < 90, `${Math.round(rowH)}px tall`);
  } else {
    check("browse: Show reveals finished rows", false, "no Show control");
  }

  await page.screenshot({ path: `${SHOTS}/smoke-browse-desktop.png`, fullPage: false });

  // Phone width — the whole point of the redesign.
  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${FRONTEND}/tournaments`, { waitUntil: "domcontentloaded" });
  await ready(phone, 'input[type="search"]', 30000);
  await ready(phone, CARD);
  await phone.waitForTimeout(1200);
  const scrollW = await phone.evaluate(() => document.documentElement.scrollWidth);
  check("browse@390: no horizontal scroll", scrollW <= 391, `scrollWidth ${scrollW}`);
  const cardsAboveFold = await phone.evaluate(() =>
    [...document.querySelectorAll('a[href^="/tournaments/"]:not([href="/tournaments/manage"])')].filter(
      (a) => a.getBoundingClientRect().top < 844,
    ).length,
  );
  check("browse@390: a card is above the fold", cardsAboveFold > 0, `${cardsAboveFold} visible`);
  await phone.screenshot({ path: `${SHOTS}/smoke-browse-phone.png` });
  await phone.close();

  // ── TOURNAMENT PAGE ──────────────────────────────────────────────
  if (open) {
    await page.goto(`${FRONTEND}/tournaments/${open.id}`, { waitUntil: "domcontentloaded" });
    await ready(page, "h1");
    const t = await page.textContent("body");

    check("open: no hover-timer panel copy", !/Auto-Refresh|Refreshing\.\.\./i.test(t));
    check("open: no machine-speak fallbacks", !/REGISTRATION_CLOSED|FORMAT_DETAILS|TOURNAMENT_NOT_FOUND|REGISTERED USER/.test(t));
    check("open: Details list is visible at rest", /Details/.test(t) && /Venue/.test(t) && /Seats/.test(t));
    check("open: the game is named", !!open.game?.name && t.includes(open.game.name), open.game?.name || "no game");

    const h1Top = await page.locator("h1").first().evaluate((el) => el.getBoundingClientRect().top);
    check("open: name is above the fold", h1Top < 500, `h1 top ${Math.round(h1Top)}px`);

    // Tabs are URL-driven and include Bracket.
    check("open: Bracket tab exists", (await page.getByRole("button", { name: /^Bracket$/ }).count()) > 0);
    await page.getByRole("button", { name: /^Players/ }).click();
    const wroteTab = await page
      .waitForURL(/[?&]tab=players/, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    check("open: tab writes ?tab=", wroteTab, page.url().split("/").pop());

    await page.goto(`${FRONTEND}/tournaments/${open.id}?tab=players`, { waitUntil: "domcontentloaded" });
    await ready(page, "h1");
    const current = await page
      .locator('button[aria-current="page"]')
      .first()
      .textContent()
      .catch(() => "");
    check("open: ?tab=players deep-links", /^Players/.test((current || "").trim()), (current || "").trim());

    await page.screenshot({ path: `${SHOTS}/smoke-tournament-open.png` });
  } else {
    check("open: a tournament to test", false, "none OPEN on this database");
  }

  // The bug the whole action matrix exists for.
  if (upcoming) {
    await page.goto(`${FRONTEND}/tournaments/${upcoming.id}`, { waitUntil: "domcontentloaded" });
    await ready(page, "h1");
    const t = await page.textContent("body");
    const offersJoin = await page.getByRole("button", { name: /^Join tournament$/ }).count();
    check("upcoming: does NOT offer Join", offersJoin === 0);
    check("upcoming: says when registration opens", /Registration (opens|not open)/i.test(t), (t.match(/Registration [^·\n]{0,30}/) || [""])[0].trim());
  } else {
    check("upcoming: a tournament to test", false, "none UPCOMING on this database");
  }

  if (completed) {
    await page.goto(`${FRONTEND}/tournaments/${completed.id}`, { waitUntil: "domcontentloaded" });
    await ready(page, "h1");
    const t = await page.textContent("body");
    check("completed: offers results", /See results/i.test(t));
    check("completed: names the winner or a placement", /Winner:|You finished/i.test(t));
  }

  // ── GAMES I PLAY ─────────────────────────────────────────────────
  const me = await api("/auth/me");
  check("api: /auth/me carries games", Array.isArray(me.games), JSON.stringify(me.games?.map((g) => g.name) ?? me.games));

  await page.goto(`${FRONTEND}/profile/edit`, { waitUntil: "domcontentloaded" });
  // Wait for the settings list itself, not a timer: Next dev compiles this route
  // on first request, and a fixed wait loses that race on a cold server.
  const settingsUp = await ready(page, "text=/Name and username/i", 45000);
  const settings = settingsUp ? await page.textContent("body") : "";
  check("settings: 'Games I play' section listed", /Games I play/i.test(settings), settingsUp ? "" : "settings never rendered");

  await page.goto(`${FRONTEND}/profile/${me.slug || me.id}`, { waitUntil: "domcontentloaded" });
  await ready(page, `text=${me.username}`, 45000);
  await page.waitForTimeout(800);
  const profile = await page.textContent("body");
  check(
    "profile: Plays row when games are set",
    (me.games?.length ?? 0) === 0 || /Plays/i.test(profile),
    `${me.games?.length ?? 0} game(s) declared`,
  );
  await page.screenshot({ path: `${SHOTS}/smoke-profile.png` });

  // ── ADMIN GAME ICONS ─────────────────────────────────────────────
  await page.goto(`${FRONTEND}/admin`, { waitUntil: "domcontentloaded" });
  await ready(page, "text=/^Catalog$/", 45000);
  const catalog = page.getByRole("button", { name: /^Catalog$/i }).first();
  if (await catalog.count()) {
    await catalog.click();
    await page.waitForTimeout(800);
    const gamesTab = page.getByRole("button", { name: /^GAMES$/i }).first();
    if (await gamesTab.count()) await gamesTab.click();
    await page.waitForTimeout(1500);
    const adminIcons = await page.locator('img[src*="/uploads/games/"]').count();
    const addIcon = await page.getByText(/ADD ICON|REPLACE/i).count();
    check("admin: icon controls on the catalog", addIcon > 0, `${addIcon} control(s), ${adminIcons} icon(s)`);

    // Description and tracking mode are editable on an existing game: the PATCH
    // route always accepted them, but nothing called it, so fixing either meant
    // deleting the game and making it again.
    const editBtns = page.getByRole("button", { name: /^Edit$/ });
    const editable = await editBtns.count();
    check("admin: games are editable", editable > 0, `${editable} Edit control(s)`);
    if (editable > 0) {
      await editBtns.first().click();
      await page.waitForTimeout(600);
      const hasDesc = await page.locator('input[id^="desc-"]').count();
      const hasTrack = await page.locator('select[id^="track-"]').count();
      check("admin: edit exposes description and tracking", hasDesc > 0 && hasTrack > 0);
      const modes = await page.locator('select[id^="track-"]').first().locator("option").allTextContents();
      check("admin: tracking offers Points and HP", modes.join(",").toLowerCase().includes("points") && modes.join(",").toLowerCase().includes("hp"), modes.join(" / "));
      await page.getByRole("button", { name: /^Cancel$/ }).first().click();
    }
    await page.screenshot({ path: `${SHOTS}/smoke-admin-games.png` });
  } else {
    check("admin: Catalog reachable", false, "Catalog group not found");
  }

  check("no uncaught page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:\n" + failed.map((f) => `  - ${f.name} ${f.detail}`).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
