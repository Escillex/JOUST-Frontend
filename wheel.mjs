import { chromium } from "playwright";
const SITE = "https://trinity.escillex.com";
const tok = (await (await fetch(`${SITE}/api/backend/auth/signin`, { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: "Mira Calder", password: "trinity123" }) })).json()).token;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript((t) => { try { localStorage.setItem("token", t); } catch {} }, tok);
const p = await ctx.newPage();
const warn = []; p.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warn.push(m.text().slice(0, 90)); });
await p.goto(`${SITE}/tournaments`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);

const title = () => p.locator("h2, h1").filter({ hasText: /./ }).first();
const shown = async () => (await p.locator('a:has-text("ENTER TOURNAMENT")').first()
  .locator("xpath=preceding::h2[1]").textContent().catch(() => null))?.trim().replace(/\s+/g, " ");

const carousel = p.locator('h3:has-text("MY TOURNAMENTS")').locator("xpath=ancestor::div[2]");
const box = await carousel.boundingBox();
const before = await shown();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200);
await p.mouse.wheel(0, 120);
await p.waitForTimeout(700);
const after1 = await shown();
await p.mouse.wheel(0, 120);
await p.waitForTimeout(700);
const after2 = await shown();
await p.mouse.wheel(0, -120);
await p.waitForTimeout(700);
const back = await shown();
console.log(JSON.stringify({ before, after1, after2, back }, null, 1));

// At the first slide, an upward wheel must let the PAGE scroll instead.
const y0 = await p.evaluate(() => window.scrollY);
await p.mouse.wheel(0, -400);
await p.waitForTimeout(400);
await p.mouse.wheel(0, -400);
await p.waitForTimeout(600);
console.log("page scrollY start:", y0, "-> after up-wheel at first slide:", await p.evaluate(() => window.scrollY));
console.log("console warnings:", [...new Set(warn)].slice(0, 3));
await b.close();
