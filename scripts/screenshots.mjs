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

// Pin the profile that has real data before the app boots.
await page.addInitScript((id) => localStorage.setItem("fairway-lab/active-profile", id), PROFILE);
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

// --- Stats (rich, real data) ---
await clickTab("^Stats");
await shot("stats.png");

// --- History ---
await clickTab("^History");
await shot("history.png");

// --- Compare (spider charts) ---
await clickTab("^Compare");
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
await hit("Dr", 3);
await hit("PW", 2);
await sleep(600);
await shot("session.png");

await browser.close();
console.log("done →", OUT);
