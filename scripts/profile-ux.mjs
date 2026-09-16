// UX/UI audit of /profile/[id] and /profile/edit on the trinity stack.
// Captures screenshots + measures: fold depth, text sizes, contrast, tap
// targets, heading outline, a11y names, overflow, timing, console errors,
// keyboard order, and leftover jargon strings.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { writeFileSync, mkdirSync } from "node:fs";

const FRONTEND = process.env.FRONTEND || "http://localhost:3003";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:4003";
const OUT = process.env.OUT || "/tmp/profile-ux";
mkdirSync(OUT, { recursive: true });

const JARGON = /ID_[0-9A-F]|REGISTERED_|PROFILE_DATA_SESSION|SYNCHRONIZED|WIN_RATE|VICTORY|DEFEAT|Pilot|Operator|Arena|Combat|Uplink|Callsign|Telemetry|Protocol|Operative/i;


/** Never hard-code it: env first, then the repo-root .env, like the other
 *  smoke scripts. */
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

async function apiSignin(identifier, password) {
  const r = await fetch(`${BACKEND}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const j = await r.json();
  return j.token;
}

const hydrated = (page) =>
  page.waitForFunction(() => {
    const el = document.querySelector("h1, button, a[href]");
    return el && Object.keys(el).some((k) => k.startsWith("__react"));
  }, null, { timeout: 30000 });

const overlayGone = (page) =>
  page.waitForFunction(() => !document.querySelector('div.fixed.inset-0[class*="z-[100]"]'), null, { timeout: 15000 }).catch(() => {});

// Everything measured inside the page in one evaluate.
const AUDIT = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const doc = document.documentElement;
  const __cv = document.createElement("canvas"); __cv.width = __cv.height = 1;
  const __cx = __cv.getContext("2d", { willReadFrequently: true });
  const parseRGBA = (s) => {
    if (!s || s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    __cx.clearRect(0, 0, 1, 1); __cx.fillStyle = "#000"; __cx.fillStyle = s;
    if (__cx.fillStyle === "#000000" && !/^(#000|rgb\(0, 0, 0\)|black)/.test(s) && !/oklab|oklch|color\(|rgba?\(/.test(s)) return null;
    __cx.fillRect(0, 0, 1, 1);
    const d = __cx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    // un-premultiply is not needed for getImageData (already straight alpha)
    return { r: d[0], g: d[1], b: d[2], a };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const effectiveBg = (el) => {
    let bg = { r: 0, g: 0, b: 0, a: 1 }; // page is pure black
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(e);
    chain.reverse();
    for (const e of chain) {
      const c = parseRGBA(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) bg = blend(c, bg);
    }
    return bg;
  };
  const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const texts = [];
  const sizeHist = {};
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    const fs = parseFloat(cs.fontSize);
    const fw = parseInt(cs.fontWeight, 10);
    const fg = parseRGBA(cs.color);
    const bg = effectiveBg(el);
    const fgB = blend(fg, bg);
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity || "1");
    const fgO = blend({ ...fgB, a: opacity }, bg);
    const cr = contrast(fgO, bg);
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const key = `${fs}px`;
    sizeHist[key] = (sizeHist[key] || 0) + 1;
    texts.push({
      text: t.slice(0, 60), fs, fw, ls: cs.letterSpacing, tt: cs.textTransform,
      color: cs.color, cr: +cr.toFixed(2), large, passes: large ? cr >= 3 : cr >= 4.5,
      top: Math.round(r.top + window.scrollY), tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === "string") ? el.className.slice(0, 80) : "",
      mixBlend: cs.mixBlendMode,
    });
  }

  const interactive = [...document.querySelectorAll("a[href], button, [role=button], input, select, textarea, summary")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map((e) => {
      const r = e.getBoundingClientRect();
      const name = (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || "").trim().slice(0, 50);
      return { tag: e.tagName.toLowerCase(), name, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + window.scrollY), href: e.getAttribute("href") || "" };
    });

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
    tag: h.tagName.toLowerCase(), text: h.textContent.trim().slice(0, 60), top: Math.round(h.getBoundingClientRect().top + window.scrollY), fs: getComputedStyle(h).fontSize,
  }));

  const imgsNoAlt = [...document.querySelectorAll("img")].filter((i) => !i.getAttribute("alt")).length;
  const unnamedButtons = [...document.querySelectorAll("button")].filter((b) => !(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent.trim())).length;

  const jargon = texts.filter((t) => /ID_[0-9A-F]|REGISTERED_|PROFILE_DATA_SESSION|SYNCHRONIZED|WIN_RATE|VICTORY|DEFEAT/i.test(t.text)).map((t) => t.text);

  const h1 = document.querySelector("h1");
  const h1r = h1 && h1.getBoundingClientRect();
  const h1Overflow = h1 ? h1.scrollWidth > h1.clientWidth + 1 : false;

  return {
    vw, vh, scrollH: doc.scrollHeight, scrollW: doc.scrollWidth, clientW: doc.clientWidth,
    hOverflow: doc.scrollWidth > doc.clientWidth,
    sizeHist,
    tiny: texts.filter((t) => t.fs < 11).length,
    textCount: texts.length,
    lowContrast: texts.filter((t) => !t.passes).sort((a, b) => a.cr - b.cr),
    contrastFails: texts.filter((t) => !t.passes).length,
    smallTargets: interactive.filter((i) => i.w < 44 || i.h < 44),
    interactiveCount: interactive.length,
    interactive,
    headings, imgsNoAlt, unnamedButtons, jargon,
    h1: h1 ? { text: h1.textContent.trim(), fs: getComputedStyle(h1).fontSize, w: Math.round(h1r.width), overflow: h1Overflow, mix: getComputedStyle(h1).mixBlendMode } : null,
    tracking: texts.filter((t) => t.fs <= 10 && /em$/.test(t.ls) === false && parseFloat(t.ls) >= 2.5).length,
  };
};

let report_hiddenByMotion = 0;
async function audit(page, label, url, viewport) {
  await page.setViewportSize(viewport);
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  const onCon = (m) => { if (m.type() === "error" && !/Failed to load resource|beacon/.test(m.text())) errors.push("console: " + m.text()); };
  page.on("pageerror", onErr); page.on("console", onCon);

  // Layout-shift observer.
  await page.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
  });

  const t0 = Date.now();
  const profileResp = page.waitForResponse((r) => /\/users\/[^/]+\/profile/.test(r.url()), { timeout: 30000 }).catch(() => null);
  const matchesResp = page.waitForResponse((r) => /\/users\/[^/]+\/matches/.test(r.url()), { timeout: 30000 }).catch(() => null);
  await page.goto(`${FRONTEND}${url}`, { waitUntil: "domcontentloaded" });
  const tDom = Date.now() - t0;
  await hydrated(page);
  const tHyd = Date.now() - t0;
  const pr = await profileResp;
  const tProfile = pr ? Date.now() - t0 : null;
  await matchesResp;
  await overlayGone(page);
  await page.waitForTimeout(1800); // stagger/FadeIn animations settle
  // Scroll to the bottom to trigger whileInView, then back to top.
  await page.evaluate(async () => { const s = document.documentElement.scrollHeight; for (let y = 0; y < s; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${label}-fold.png` });
  // Screenshots are the honest view; measurements should not be fooled by
  // rows motion has left at opacity 0 because they never entered the viewport.
  report_hiddenByMotion = await page.evaluate(() => { let n = 0; document.querySelectorAll('[style*="opacity"]').forEach((e) => { if (parseFloat(e.style.opacity) === 0) { n++; e.style.opacity = "1"; } }); return n; });
  await page.screenshot({ path: `${OUT}/${label}-full.png`, fullPage: true });
  const data = await page.evaluate(AUDIT);
  data.hiddenByMotion = report_hiddenByMotion;
  data.cls = await page.evaluate(() => +(window.__cls || 0).toFixed(3));
  data.timing = { domcontentloaded: tDom, hydrated: tHyd, profileResponse: tProfile };
  data.errors = errors;
  data.profileStatus = pr ? pr.status() : null;
  page.off("pageerror", onErr); page.off("console", onCon);
  return data;
}

async function keyboardOrder(page, n = 25) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Tab");
  const seq = [];
  for (let i = 0; i < n; i++) {
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return { tag: e.tagName.toLowerCase(), name: (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || "").trim().slice(0, 40), outline: cs.outlineStyle + " " + cs.outlineWidth, boxShadow: cs.boxShadow !== "none", top: Math.round(r.top + window.scrollY) };
    });
    seq.push(info);
    await page.keyboard.press("Tab");
  }
  return seq;
}

async function main() {
  const adminToken = await apiSignin("admin", adminPassword());
  if (!adminToken) throw new Error("admin signin failed");

  // Give caleb a bio so the bio path renders (restored at the end).
  const me = await fetch(`${BACKEND}/users/caleb-ruiz/profile`).then((r) => r.json());
  const calebId = me.id;
  const before = me.bio;
  await fetch(`${BACKEND}/auth/users/${calebId}/profile`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ bio: "Standard player since 2024.\nMostly Pokémon TCG, some Magic on weekends. Looking for a regular Thursday group." }),
  }).then(async (r) => console.log("bio seed", r.status, r.ok ? "" : await r.text()));

  const browser = await chromium.launch();
  const report = {};

  // --- Anonymous viewer ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    report["anon-desktop-caleb"] = await audit(page, "anon-desktop-caleb", "/profile/caleb-ruiz", { width: 1440, height: 900 });
    report["anon-desktop-caleb"].keyboard = await keyboardOrder(page, 22);
    report["anon-mobile-caleb"] = await audit(page, "anon-mobile-caleb", "/profile/caleb-ruiz", { width: 390, height: 844 });
    report["anon-desktop-marcus"] = await audit(page, "anon-desktop-marcus", "/profile/marcus-vogel", { width: 1440, height: 900 });
    report["anon-desktop-missing"] = await audit(page, "anon-desktop-missing", "/profile/does-not-exist", { width: 1440, height: 900 });
    // Lightbox + hover states on caleb's page.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FRONTEND}/profile/caleb-ruiz`, { waitUntil: "domcontentloaded" });
    await hydrated(page); await overlayGone(page);
    await page.getByRole("heading", { name: "Gallery" }).waitFor({ state: "visible", timeout: 20000 });
    const galleryBtn = page.getByTitle("View full size").first();
    if (await galleryBtn.count()) {
      await galleryBtn.scrollIntoViewIfNeeded();
      await galleryBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/anon-desktop-lightbox.png` });
      report.lightboxInfo = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const btns = [...document.querySelectorAll('button')].filter(b => b.closest('[role="dialog"]')).map(b => (b.getAttribute('aria-label')||b.title||b.textContent).trim()); return { hasDialog: !!d, dialogButtons: btns, focusIn: !!(document.activeElement && document.activeElement.closest('[role="dialog"]')) }; });
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
      report.lightboxEscape = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    }
    // Medal hover detail.
    const medal = page.locator("header, div").filter({ has: page.locator("img[alt]") }).first();
    const medalImgs = page.locator("h1").locator("xpath=..").locator("img");
    report.medalImgCount = await medalImgs.count();
    if (report.medalImgCount) { await medalImgs.first().hover(); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/anon-desktop-medal-hover.png` }); }
    await ctx.close();
  }

  // --- Admin viewer (sees Award button on others, Edit on self) ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem("token", t); } catch {} }, adminToken);
    const page = await ctx.newPage();
    report["admin-desktop-caleb"] = await audit(page, "admin-desktop-caleb", "/profile/caleb-ruiz", { width: 1440, height: 900 });
    report["admin-desktop-self"] = await audit(page, "admin-desktop-self", "/profile", { width: 1440, height: 900 });
    report["admin-mobile-self"] = await audit(page, "admin-mobile-self", "/profile", { width: 390, height: 844 });
    report["admin-mobile-caleb"] = await audit(page, "admin-mobile-caleb", "/profile/caleb-ruiz", { width: 390, height: 844 });
    // Edit page
    report["admin-desktop-edit"] = await audit(page, "admin-desktop-edit", "/profile/edit", { width: 1440, height: 900 });
    report["admin-mobile-edit"] = await audit(page, "admin-mobile-edit", "/profile/edit", { width: 390, height: 844 });
    await ctx.close();
  }

  // --- Caleb himself on desktop (own rich profile: edit button + awards + gallery) ---
  // Caleb's password is unknown; use an admin password reset? Skip — the self view is
  // covered by admin-self; own-profile-with-content differs only by the Edit button.

  await browser.close();

  // Restore the bio.
  await fetch(`${BACKEND}/auth/users/${calebId}/profile`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ bio: "" }),
  }).then((r) => console.log("bio restore", r.status));

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

  // Console summary
  for (const [k, v] of Object.entries(report)) {
    if (!v || !v.timing) continue;
    console.log(`\n=== ${k} ===`);
    console.log(`hiddenByMotion=${v.hiddenByMotion}`);
    console.log(`viewport ${v.vw}x${v.vh}  page height ${v.scrollH}px (${(v.scrollH / v.vh).toFixed(1)} screens)  hOverflow=${v.hOverflow} (${v.scrollW}/${v.clientW})  CLS=${v.cls}`);
    console.log(`timing ms: dom ${v.timing.domcontentloaded}  hydrated ${v.timing.hydrated}  profile ${v.timing.profileResponse} (status ${v.profileStatus})`);
    console.log(`text nodes ${v.textCount}; <11px: ${v.tiny}; contrast fails ${v.contrastFails}; sizes:`, JSON.stringify(v.sizeHist));
    console.log(`h1:`, JSON.stringify(v.h1));
    console.log(`headings:`, v.headings.map((h) => `${h.tag}(${h.fs})@${h.top} "${h.text}"`).join(" | "));
    console.log(`interactive ${v.interactiveCount}, small (<44) ${v.smallTargets.length}:`, v.smallTargets.map((s) => `${s.tag}"${s.name}"${s.w}x${s.h}`).slice(0, 14).join(", "));
    console.log(`imgs no alt ${v.imgsNoAlt}; unnamed buttons ${v.unnamedButtons}; jargon:`, JSON.stringify(v.jargon));
    console.log(`low contrast (worst 12):`, v.lowContrast.slice(0, 12).map((t) => `"${t.text}" ${t.fs}px cr=${t.cr}`).join(" | "));
    if (v.errors.length) console.log(`errors:`, v.errors.slice(0, 5));
    if (v.keyboard) console.log(`tab order:`, v.keyboard.map((k) => k ? `${k.tag}:${k.name}[${k.outline}${k.boxShadow ? "+shadow" : ""}]` : "∅").join(" → "));
  }
  console.log("lightbox closes on Esc:", report.lightboxEscape, "medal imgs:", report.medalImgCount);
}

main().catch((e) => { console.error(e); process.exit(1); });
