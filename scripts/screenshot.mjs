/**
 * Renders the live board at phone widths and reports the two things that have
 * actually broken before: horizontal overflow, and a dot label clipped by the
 * square's overflow:hidden. Both were invisible until something rendered them.
 *
 * Needs a browser and playwright-core, neither of which is a project dependency:
 *   npm i --no-save playwright-core && npx playwright install chromium
 *   npm run dev
 *   OUT=/tmp/shots PLAYER=<a player uuid with a plot> node scripts/screenshot.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const OUT = process.env.OUT ?? "./screenshots";
const PLAYER = process.env.PLAYER;
const URL = process.env.URL ?? "http://localhost:3000/";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const results = [];

for (const width of [360, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });
  // A revealed board is the interesting one; without the cookie you'd only ever
  // screenshot the locked state.
  if (PLAYER) {
    await ctx.addCookies([
      { name: "gg_player", value: PLAYER, domain: "localhost", path: "/" },
    ]);
  }
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/board-${width}.png`, fullPage: true });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const dots = await page.locator(".plane-dot").count();
  const clipped = await page.evaluate(() => {
    const square = document.querySelector(".plane-square");
    if (!square) return [];
    const box = square.getBoundingClientRect();
    return [...document.querySelectorAll(".plane-dot-label")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left < box.left - 0.5 ||
          r.right > box.right + 0.5 ||
          r.top < box.top - 0.5 ||
          r.bottom > box.bottom + 0.5
        );
      })
      .map((el) => el.textContent);
  });

  results.push({ width, overflow, dots, clipped: clipped.join(",") || "none" });
  await ctx.close();
}

console.table(results);
await browser.close();
const bad = results.filter((r) => r.overflow !== 0 || r.clipped !== "none");
if (bad.length) process.exit(1);
