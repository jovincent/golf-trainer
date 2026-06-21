// One-off: capture the README screenshots of the running dev app (port 4040).
// Drives a headless Chromium via Playwright. Not part of the app build, so
// playwright-core isn't a project dependency — install it just for this run:
//
//   npm run dev                 # in another terminal (front 4040 + API 4141)
//   npm i -D playwright-core    # one-off (uninstall after if you like)
//   node scripts/screenshots.mjs
//
// EXEC points at the Chromium that Playwright caches; adjust the version dir if
// your cache differs (ls ~/Library/Caches/ms-playwright). PROFILE is the local
// profile id whose real data fills the read-only tabs.
//
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const EXEC = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/screenshots");
const BASE = "http://localhost:4040";
const PROFILE = "profile_1780856254211"; // Jonathan — real R10 data

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 2 });

// Pin the profile that has real data, and use imperial (yards/mph), before boot.
await page.addInitScript((id) => localStorage.setItem("fairway-lab/active-profile", id), PROFILE);
await page.addInitScript(() => localStorage.setItem("fairway-lab/units", "imperial"));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(1200);

const clickTab = async (name) => {
  await page.getByRole("tab", { name: new RegExp(name) }).click();
  await sleep(900);
};
const shot = async (file, fullPage = false) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(250);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage });
  console.log("saved", file);
};
// Screenshot a single card: the <section> that contains the given heading.
const shotCard = async (heading, file) => {
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: heading }) });
  await card.scrollIntoViewIfNeeded();
  await sleep(400);
  await card.screenshot({ path: `${OUT}/${file}` });
  console.log("saved", file);
};

// --- Stats (rich, real data): full tab + the bullseye and dispersion cards ---
await clickTab("^Stats");
await shot("stats.png");
// Bullseye — select the 7-iron before capturing.
const bullseye = page.locator("section").filter({ has: page.getByRole("heading", { name: "Bullseye by club" }) });
await bullseye.scrollIntoViewIfNeeded();
await bullseye.getByRole("button", { name: "7i", exact: true }).click();
await sleep(400);
await shotCard("Bullseye by club", "bullseye.png");
await shotCard("Dispersion pattern", "dispersion.png");

// --- History: one session expanded into its shot table ---
await clickTab("^History");
// Expand a session with a handful of shots so the shot table reads cleanly.
const sessionToggle = page.locator(".card > button").filter({ hasText: /ball/ });
await sessionToggle.nth(1).click();
await sleep(700);
await shot("history-expanded.png");

// --- Compare (spider charts) — Jonathan vs Boubou only ---
await clickTab("^Compare");
// Auto-selects the first 4 profiles (Jonathan, Jo, Boubou, Annemarie); drop the
// other two so only Jonathan and Boubou remain.
for (const name of ["Jo", "Annemarie"]) {
  await page.getByRole("button", { name, exact: true }).click();
  await sleep(300);
}
await sleep(600);
await shot("compare.png");

// --- Course (carousel) ---
await clickTab("^Course");
await shot("course.png");

// --- Session: connect simulator, arm a club, hit balls → 3D viz + hero stats ---
await clickTab("^Session");
await page.getByRole("button", { name: "Connect" }).click();
await sleep(1000);
const hit = async (club, n) => {
  for (let i = 0; i < n; i++) {
    await page.getByRole("button", { name: new RegExp(`^${club}$`) }).click();
    await sleep(120);
    await page.getByRole("button", { name: /^Hit( a ball)?$/ }).click();
    await sleep(450);
  }
};
await hit("7i", 3);
await hit("PW", 2);
await hit("Dr", 3); // end on a driver so the hero "Last shot" is a Dr
await sleep(600);
await shot("session.png");

await browser.close();
console.log("done →", OUT);
