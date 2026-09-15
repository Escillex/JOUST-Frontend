// Headless UI smoke test for the home page editor (docs/home-blocks-plan.md).
//
// Drives a real headless Chromium through /admin/editor and asserts that every
// edit reaches the PUBLIC page: tagline, marquee heading, hidden section,
// dragged section order, and a hero slide uploaded through the crop flow —
// including that removing it deletes the file. Defaults to the trinity stack.
//
// Prereqs (one-time, user runs — Core Rule 2):
//   cd new && npm i -D playwright && npx playwright install chromium
// Then, with the stack up:
//   cd new && node scripts/home-editor-smoke.mjs
//
// Env overrides: FRONTEND (default http://localhost:3003),
//                BACKEND  (default http://127.0.0.1:4003),
//                SHOTS    (screenshot directory),
//                ADMIN_PASSWORD (else read from the repo-root .env).
//
// It leaves the instance as it found it: the shipped copy, order and visibility
// are restored at the end.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FRONTEND = process.env.FRONTEND || "http://localhost:3003";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:4003";
const SHOTS = process.env.SHOTS || "/tmp";

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (const rel of ["../../.env", "../../server/.env"]) {
    try {
      const m = readFileSync(new URL(rel, import.meta.url), "utf8").match(/^ADMIN_PASSWORD=(.*)$/m);
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

const publicHtml = async () => {
  const r = await fetch(`${FRONTEND}/?cachebust=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
  return r.text();
};

async function main() {
  const signin = await fetch(`${BACKEND}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin", password: adminPassword() }),
  });
  const token = (await signin.json()).token;
  check("api signin", !!token);

  const patch = (path, body) =>
    fetch(`${BACKEND}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // Known starting point: every section shown, shipped order.
  for (const key of ["hero", "shop", "tournaments"]) await patch(`/home/blocks/${key}`, { visible: true });
  await patch("/home/blocks/reorder", { keys: ["hero", "shop", "tournaments"] });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  await context.addInitScript((t) => { try { localStorage.setItem("token", t); } catch {} }, token);
  const page = await context.newPage();
  const pageErrors = [];
  const failed = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) pageErrors.push("console: " + m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && /\/api\/backend\//.test(r.url())) failed.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(`${FRONTEND}/admin/editor`, { waitUntil: "domcontentloaded" });
  // Hydration, not networkidle.
  await page.waitForFunction(() => {
    const b = document.querySelector("button");
    return b && Object.keys(b).some((k) => k.startsWith("__react"));
  }, null, { timeout: 30000 });
  await page.getByText("HOME PAGE EDITOR", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  check("editor renders for an admin", true);

  // The rail lists every section and its parts, two levels deep.
  for (const label of ["Hero Tagline", "Hero Slides", "Hero Buttons", "Store Heading", "Store Products", "Tournaments Heading"]) {
    let ok = true;
    try {
      await page.locator(`button[aria-label="${label}"]`).waitFor({ state: "visible", timeout: 5000 });
    } catch { ok = false; }
    check(`rail lists "${label}"`, ok);
  }

  // The preview is the real page in an iframe, not a replica.
  const frameEl = page.locator('iframe[title="Home page preview"]');
  await frameEl.waitFor({ state: "visible", timeout: 20000 });
  const frame = await frameEl.contentFrame();
  let heroInFrame = false;
  try {
    await frame.locator("section").first().waitFor({ state: "visible", timeout: 20000 });
    heroInFrame = true;
  } catch {}
  check("preview iframe renders the live page", heroInFrame);

  // 1. Tagline.
  const tagline = `Tagline check ${Date.now()}`;
  await page.locator('button[aria-label="Hero Tagline"]').click();
  const textarea = page.locator("#hero-description");
  await textarea.waitFor({ state: "visible", timeout: 10000 });
  await textarea.fill(tagline);
  const savePatch = page.waitForResponse(
    (r) => r.url().includes("/api/backend/home/blocks/hero") && r.request().method() === "PATCH",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  const patchRes = await savePatch;
  check("tagline save returns 200", patchRes.status() === 200, String(patchRes.status()));
  check("public page shows the new tagline", (await publicHtml()).includes(tagline));

  // 2. Store marquee heading.
  await page.locator('button[aria-label="Store Heading"]').click();
  const labelInput = page.locator("#section-label");
  await labelInput.waitFor({ state: "visible", timeout: 10000 });
  const marquee = `MARKET ${Date.now() % 100000}`;
  await labelInput.fill(marquee);
  const shopPatch = page.waitForResponse(
    (r) => r.url().includes("/api/backend/home/blocks/shop") && r.request().method() === "PATCH",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await shopPatch;
  check("public page shows the renamed marquee", (await publicHtml()).includes(marquee));

  // 3. The product catalogue is a labelled list inside the Store section.
  await page.locator('button[aria-label="Store Products"]').click();
  await page.getByRole("button", { name: "New product" }).waitFor({ state: "visible", timeout: 10000 });
  check("product list renders inside the Store section", true);

  // 4. Hide and show the tournaments section. Waiters are armed BEFORE the
  //    click — a response can land before a listener attached afterwards.
  const waitTournaments = () =>
    page.waitForResponse(
      (r) => r.url().includes("/api/backend/home/blocks/tournaments") && r.request().method() === "PATCH",
      { timeout: 20000 },
    );
  let hidden = waitTournaments();
  await page.locator('button[aria-label="Hide Tournaments"]').click();
  await hidden;
  check("hidden section disappears from the public page", !/Nothing scheduled/.test(await publicHtml()));
  const shown = waitTournaments();
  await page.locator('button[aria-label="Show Tournaments"]').click();
  await shown;
  check("shown again brings it back", /Nothing scheduled|TOURNAMENTS/.test(await publicHtml()));

  // 5. Drag the store section above the hero.
  // The initial app loader keeps a fixed, invisible overlay on top for ~800ms
  // after it fades. Playwright's .click() waits that out on its own; raw mouse
  // input does not, so the drag below has to.
  await page.waitForFunction(() => !document.querySelector('div.fixed.inset-0[class*="z-[100]"]'), null, { timeout: 20000 });
  const handles = page.locator('button[aria-label^="Reorder"]');
  check("every section has a drag handle", (await handles.count()) === 3);
  const src = await handles.nth(1).boundingBox();
  const dst = await handles.nth(0).boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const travel = dst.y + dst.height / 2 - (src.y + src.height / 2);
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2 + (travel * i) / 12, { steps: 2 });
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
  // Armed before the drop: the reorder PATCH only fires on mouse up.
  const reorderRes = page
    .waitForResponse((r) => r.url().includes("/api/backend/home/blocks/reorder"), { timeout: 8000 })
    .catch(() => null);
  await page.mouse.up();
  const reorderOk = (await reorderRes)?.status() === 200;
  check("drag-to-reorder writes the new order", reorderOk);
  if (reorderOk) {
    const cfg = await (await fetch(`${BACKEND}/home`)).json();
    check("store now leads the page", cfg.blocks[0].key === "shop", cfg.blocks.map((b) => b.key).join(" > "));
    await patch("/home/blocks/reorder", { keys: ["hero", "shop", "tournaments"] });
  }

  // 6. Upload a hero slide through the filmstrip's crop flow, then remove it
  //    from the strip — the case the list exists for.
  await page.locator('button[aria-label="Hero Slides"]').click();
  await page.waitForTimeout(500);
  const tilesBefore = await page.locator('button[aria-label^="Select item"]').count();
  const slidePatch = page.waitForResponse(
    (r) => r.url().includes("/api/backend/home/blocks/hero") && r.request().method() === "PATCH",
    { timeout: 40000 },
  );
  await page.locator("input[type=file]").first().setInputFiles(
    fileURLToPath(new URL("../public/placeholder.png", import.meta.url)),
  );
  await page.getByRole("button", { name: "Save crop" }).click({ timeout: 20000 });
  await slidePatch;
  await page.waitForTimeout(800);
  const tilesAfter = await page.locator('button[aria-label^="Select item"]').count();
  check("uploading adds a tile to the filmstrip", tilesAfter === tilesBefore + 1, `${tilesBefore} → ${tilesAfter}`);

  const cfgAfterUpload = await (await fetch(`${BACKEND}/home`)).json();
  const slides = cfgAfterUpload.blocks.find((b) => b.key === "hero").content.slides;
  const uploaded = slides[slides.length - 1];
  check("the uploaded slide is stored on the hero block", !!uploaded?.image, uploaded?.image ?? "none");
  check("public hero renders the uploaded slide", (await publicHtml()).includes(uploaded.image));

  const removePatch = page.waitForResponse(
    (r) => r.url().includes("/api/backend/home/blocks/hero") && r.request().method() === "PATCH",
    { timeout: 20000 },
  );
  // The × on the tile itself: no scrolling, whatever the slide's position.
  await page.locator(`button[aria-label="Remove item ${tilesAfter}"]`).click({ force: true });
  await removePatch;
  await page.waitForTimeout(1500);

  const assetsAfter = await (await fetch(`${BACKEND}/images/assets`)).json();
  const cfgAfterRemove = await (await fetch(`${BACKEND}/home`)).json();
  check(
    "removing the slide drops it from the block",
    cfgAfterRemove.blocks.find((b) => b.key === "hero").content.slides.length === slides.length - 1,
  );
  check(
    "removing the slide deletes its uploaded file",
    !assetsAfter.some((a) => a.url === uploaded.image),
  );

  await page.screenshot({ path: `${SHOTS}/home-editor.png`, fullPage: false });

  // Leave the tagline and heading as they were.
  await patch("/home/blocks/shop", { content: { label: "STORE" } });
  const hero = (await (await fetch(`${BACKEND}/home`)).json()).blocks.find((b) => b.key === "hero");
  await patch("/home/blocks/hero", {
    content: {
      ...hero.content,
      description:
        "Experience the next level of hobby gaming. Professional tournaments, high-fidelity community, and the best gear, all in one place.",
    },
  });

  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  check("no failed API calls", failed.length === 0, failed.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
