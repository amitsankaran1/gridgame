/**
 * End-to-end pass over the whole app against a real Postgres and a real browser.
 *
 * There is no unit-test layer on purpose: almost every interesting behaviour here
 * is a Server Component reading Postgres, a Server Function writing it, or a drag
 * landing on a pixel. Mocking any of those would test the mock. So this drives
 * the built app the way a person does.
 *
 *   npm run build && npm start   (with DATABASE_URL pointing at a scratch DB)
 *   BASE=http://localhost:3000 ADMIN_PASSWORD=... node tests/e2e.mjs
 *
 * Needs playwright-core and a Chromium; neither is a project dependency:
 *   npm i --no-save playwright-core && npx playwright install chromium
 * Point CHROME at the binary if playwright can't find one itself.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("ADMIN_PASSWORD is not set");
  process.exit(1);
}

let failures = 0;
let checks = 0;
const group = (name) => console.log(`\n── ${name}`);

function ok(condition, label, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROME });

/** A fresh browser context is a fresh person: no cookie, so no player row. */
async function person(width = 900) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1000 },
    // The share fallback copies to the clipboard, and the test reads it back.
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (err) => {
    failures += 1;
    console.log(`  ✗ uncaught page error: ${err.message}`);
  });
  return { ctx, page };
}

const settle = (page) => page.waitForLoadState("networkidle");

/**
 * Wait until React has actually attached. Typing into a controlled input before
 * hydration puts the characters in the DOM where React never sees them, so the
 * form stays "empty" and its submit button stays disabled — which looks exactly
 * like a product bug and isn't one.
 */
const hydrated = (page, selector = "form") =>
  page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
    },
    selector,
    { timeout: 15_000 },
  );

/**
 * Walk a fresh player through onboarding: Continue off the intro, then initials
 * and a colour. `color` picks a specific swatch so a test can assert on it; the
 * default keeps older call sites explicit about selecting one.
 */
async function setInitials(page, initials, color = "slate") {
  await page.goto(`${BASE}/`);
  const next = page.getByRole("button", { name: "Continue" });
  if ((await next.count()) > 0) {
    await next.click();
    await page.locator("#initials").waitFor({ state: "visible" });
  }
  await hydrated(page, "form.initials-form");
  await page.fill("#initials", initials);
  if (color) await page.locator(`.swatch[data-color="${color}"]`).click();
  await page.click("form.initials-form button[type=submit]");
  await page.waitForSelector(".plane-square", { timeout: 10_000 });
}

/**
 * Labels that have escaped their square. Used for both the splash schematic
 * and the real board — the same bug looks the same in both places.
 */
const escapedLabels = (containerSel, labelSel) => (page) =>
  page.evaluate(
    ({ containerSel: c, labelSel: l }) => {
      const box = document.querySelector(c).getBoundingClientRect();
      return [...document.querySelectorAll(l)]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < box.left - 0.5 || r.right > box.right + 0.5 ||
            r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5
          );
        })
        .map((el) => el.textContent.trim());
    },
    { containerSel, labelSel },
  );

/**
 * Axis labels have to stay readable when a mark sits on that edge. Opacity 0
 * used to count as "fading" and made the left axis vanish on a phone.
 */
const axisLabelReport = (page) =>
  page.evaluate(() => {
    const square = document.querySelector(".plane-square").getBoundingClientRect();
    return ["top", "bottom", "left", "right"].map((edge) => {
      const el = document.querySelector(`.plane-label-${edge}`);
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        edge,
        text: (el.textContent || "").trim(),
        opacity: Number(s.opacity),
        visible: typeof el.checkVisibility === "function" ? el.checkVisibility() : s.opacity !== "0",
        clipped:
          r.left < square.left - 0.5 ||
          r.right > square.right + 0.5 ||
          r.top < square.top - 0.5 ||
          r.bottom > square.bottom + 0.5,
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
  });

/**
 * Dots now animate in when the board opens up. Their transforms are mid-flight
 * for a few hundred milliseconds, so anything measuring geometry has to let the
 * entrance finish or it measures a dot that is still 30% of its final size.
 */
const settleAnimations = (page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
  );

/**
 * The share sheet opens on a first placement and is modal, so anything behind
 * it is unclickable until it goes. Every flow that places a dot and then keeps
 * using the board goes through here.
 */
async function dismissSheet(page) {
  // The sheet opens in an effect after the first-commit render, so
  // networkidle can win that race and we'd leave a modal sitting on the board.
  const sheet = page.locator("dialog.sheet[open]");
  try {
    await sheet.waitFor({ timeout: 1_500 });
  } catch {
    return;
  }
  await page.getByRole("button", { name: "not now" }).click();
  await page.waitForFunction(() => !document.querySelector("dialog.sheet[open]"));
}

/** Drag the marker to a normalised -1…1 point and commit it. */
async function placeAt(page, x, y) {
  const box = await page.locator(".plane-square").boundingBox();
  const INSET = 24;
  const px = box.x + INSET + ((x + 1) / 2) * (box.width - INSET * 2);
  const py = box.y + INSET + ((-y + 1) / 2) * (box.height - INSET * 2);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px, py);
  await page.mouse.up();
  await page.getByRole("button", { name: /Place me here|Move me here/ }).click();
  // Modal share sheet makes the board inert, so the new dot is attached but
  // not "visible" to Playwright until the sheet is dismissed.
  await page.waitForSelector(".plane-dot", { state: "attached", timeout: 10_000 });
  await settle(page);
  await settleAnimations(page);
  await dismissSheet(page);
  return { px, py };
}

// ───────────────────────────────────────────────────────────── empty state
group("No grid is up");
{
  const { ctx, page } = await person();
  await page.goto(`${BASE}/`);
  ok(await page.getByText("Between rounds").isVisible(), "home explains there is no grid");
  await page.goto(`${BASE}/archive`);
  ok(await page.getByText("The first grid to come down").isVisible(), "archive has an empty state");
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────── admin
group("Admin");
const admin = await person();
{
  await admin.page.goto(`${BASE}/admin`);
  await hydrated(admin.page, "form.stack");
  await admin.page.fill("#password", "definitely-not-the-password");
  await admin.page.click("button[type=submit]");
  await admin.page.waitForSelector(".error");
  ok(
    (await admin.page.locator(".error").textContent())?.includes("Wrong password"),
    "a wrong password is refused",
  );

  await admin.page.fill("#password", PASSWORD);
  await admin.page.click("button[type=submit]");
  await admin.page.waitForSelector("text=Live grid", { timeout: 10_000 });
  ok(true, "the right password signs in");

  await hydrated(admin.page, "form.stack");
  const forms = admin.page.locator("form.stack");
  const newGrid = forms.last();
  await newGrid.locator("input").nth(0).fill("Test week");
  await newGrid.locator("input").nth(1).fill("low maintenance");
  await newGrid.locator("input").nth(2).fill("high maintenance");
  await newGrid.locator("input").nth(3).fill("not chill");
  await newGrid.locator("input").nth(4).fill("chill");
  await newGrid.getByRole("button", { name: "Put it up" }).click();
  await admin.page.waitForSelector(".card-title:has-text('Test week')", { timeout: 10_000 });
  ok(true, "a typed grid goes live");
}

// ──────────────────────────────────────── the share preview image
group("The share preview image");
{
  const { ctx, page } = await person();
  await page.goto(`${BASE}/`);

  // An unfurler reads the tag, not the route, and a relative og:image is
  // ignored by every one of them — which is how a share preview silently
  // becomes blank.
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  ok(
    typeof og === "string" && /^https?:\/\//.test(og),
    "og:image is an absolute URL",
    og ?? "(missing)",
  );
  ok(
    (await page.locator('meta[name="twitter:card"]').getAttribute("content")) ===
      "summary_large_image",
    "…and twitter is told to render it large",
  );

  const res = await ctx.request.get(`${BASE}/opengraph-image`);
  ok(res.status() === 200, "the image renders", `status ${res.status()}`);
  ok(
    res.headers()["content-type"] === "image/png",
    "…as a png",
    res.headers()["content-type"],
  );
  const bytes = Buffer.from(await res.body());
  // PNG magic, then width and height from the IHDR chunk.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  ok(
    bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    "…that is really a png, not an error page",
  );
  ok(width === 1200 && height === 630, "…at 1200x630", `${width}x${height}`);

  await ctx.close();
}

// ────────────────────────────────────────────────────────────── splash
group("The splash");
{
  const { ctx, page } = await person(390);
  await page.goto(`${BASE}/`);
  ok(await page.locator(".splash-plane").isVisible(), "a first-timer gets the explainer");
  ok((await page.locator(".splash-steps li").count()) === 2, "…with the two beats");
  ok(
    (await page.getByText(
      "This week is a 2-axis grid. Place yourself, then see where everyone else landed.",
    ).count()) > 0,
    "…and the intro body",
  );
  ok(
    (await page.getByText("You get one dot. You can move it later.").count()) > 0 &&
      (await page.getByText("Nobody else shows until you place yours.").count()) > 0,
    "…that say you get one moveable dot, and nobody else shows yet",
  );
  ok(
    (await page.getByText("high maintenance").count()) > 0 &&
      (await page.getByText("not chill").count()) > 0,
    "…and this week's real axis labels, so you know what you're answering",
  );
  ok(await page.getByRole("button", { name: "Continue" }).isVisible(), "Continue advances to the profile");
  ok(!(await page.locator("#initials").isVisible()), "the initials field is not on the intro");
  ok((await page.locator(".swatch:visible").count()) === 0, "…and neither is the colour picker");

  const splashEscaped = await escapedLabels(".splash-board", ".splash-label")(page);
  ok(
    splashEscaped.length === 0,
    "splash axis labels sit inside the square",
    splashEscaped.join(", "),
  );
  const splashEdges = await page.evaluate(() => {
    const board = document.querySelector(".splash-board").getBoundingClientRect();
    const mid = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return {
        x: (r.left + r.right) / 2 - board.left,
        y: (r.top + r.bottom) / 2 - board.top,
      };
    };
    return {
      top: mid(".splash-label-top"),
      bottom: mid(".splash-label-bottom"),
      left: mid(".splash-label-left"),
      right: mid(".splash-label-right"),
      w: board.width,
      h: board.height,
    };
  });
  ok(splashEdges.top.y < splashEdges.h * 0.25, "the top label sits on the top edge");
  ok(splashEdges.bottom.y > splashEdges.h * 0.75, "the bottom label sits on the bottom edge");
  ok(splashEdges.left.x < splashEdges.w * 0.25, "the left label sits on the left edge");
  ok(splashEdges.right.x > splashEdges.w * 0.75, "the right label sits on the right edge");

  ok((await page.locator(".splash-you, .splash-you-label").count()) === 0, "no leftover orange-you on the splash");
  ok((await page.locator(".splash-me-halo").count()) === 1, "ownership on the schematic is a halo ring");
  const splashFill = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = "var(--dot-me)";
    document.body.appendChild(probe);
    const me = getComputedStyle(probe).color;
    probe.remove();
    const mark = document.querySelector(".splash-me-mark");
    return { fill: mark ? getComputedStyle(mark).fill : null, me };
  });
  ok(
    splashFill.fill && splashFill.me && splashFill.fill !== splashFill.me,
    "…and the mark is not the leftover orange-for-me",
    JSON.stringify(splashFill),
  );

  ok(
    (await page.getByRole("link", { name: "Submit" }).count()) === 1 &&
      (await page.getByRole("link", { name: "Ideas" }).count()) === 0,
    "the nav says Submit, not Ideas",
  );
  ok(
    (await page.getByRole("link", { name: "Submit" }).getAttribute("href")) === "/ideas",
    "…and still points at /ideas",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(overflow === 0, "it doesn't scroll sideways at 390px", `overflow ${overflow}px`);

  // The diagram is decoration — the steps carry the meaning.
  ok(
    (await page.locator(".splash-square").getAttribute("aria-hidden")) === "true",
    "the diagram is hidden from screen readers rather than read out as noise",
  );

  const schematicBefore = await page.locator(".splash-board").boundingBox();
  await page.getByRole("button", { name: "Continue" }).click();
  ok(await page.getByRole("heading", { name: "Who you are" }).isVisible(), "Continue opens the profile");
  ok(await page.locator("#initials").isVisible(), "…with the initials field");
  ok((await page.locator(".swatch").count()) === 8, "…and the colour picker");
  ok(
    await page.locator('form.initials-form button[type="submit"]').isDisabled(),
    "the form stays disabled until a colour is chosen",
  );
  await page.locator('.swatch[data-color="plum"]').click();
  await page.locator('.swatch[data-color="slate"]').click();
  const picked = await page.locator(".swatch.is-selected").evaluateAll((swatches) =>
    swatches.map((swatch) => swatch.getAttribute("data-color")),
  );
  ok(
    picked.length === 1 && picked[0] === "slate",
    "changing colour leaves exactly the new swatch selected",
    JSON.stringify(picked),
  );
  ok(
    (await page.getByRole("button", { name: "Take me to the board" }).count()) === 1,
    "the profile CTA is Take me to the board",
  );
  const overflowProfile = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(overflowProfile === 0, "the profile doesn't scroll sideways at 390px", `overflow ${overflowProfile}px`);
  const schematicOnProfile = await page.locator(".splash-board").boundingBox();
  ok(
    schematicBefore &&
      schematicOnProfile &&
      Math.abs(schematicOnProfile.y - schematicBefore.y) < 1 &&
      Math.abs(schematicOnProfile.height - schematicBefore.height) < 1,
    "the schematic does not jump when you continue",
    JSON.stringify({ before: schematicBefore, after: schematicOnProfile }),
  );

  await page.getByRole("button", { name: "Back" }).click();
  ok(await page.getByRole("button", { name: "Continue" }).isVisible(), "back restores the intro");
  ok(!(await page.locator("#initials").isVisible()), "…and hides the form");
  const schematicAfterBack = await page.locator(".splash-board").boundingBox();
  ok(
    schematicBefore &&
      schematicAfterBack &&
      Math.abs(schematicAfterBack.y - schematicBefore.y) < 1 &&
      Math.abs(schematicAfterBack.height - schematicBefore.height) < 1,
    "…without a layout jump",
    JSON.stringify({ before: schematicBefore, after: schematicAfterBack }),
  );

  // Setting initials is the only thing that retires it.
  await setInitials(page, "SPL");
  ok((await page.locator(".splash-plane").count()) === 0, "it is gone once you have initials");
  await page.reload();
  ok((await page.locator(".splash-plane").count()) === 0, "…and stays gone");
  await ctx.close();
}

// ───────────────────────────────────────────────── the reveal gate
group("The reveal gate");
const alice = await person();
{
  await alice.page.goto(`${BASE}/`);
  ok(await alice.page.locator(".splash-plane").isVisible(), "a new visitor sees the intro");
  await alice.page.getByRole("button", { name: "Continue" }).click();
  ok(await alice.page.locator("#initials").isVisible(), "…and is asked for initials after Continue");

  await setInitials(alice.page, "AAA");
  ok(await alice.page.locator(".plane-square").isVisible(), "the square renders once initials are set");
  ok(
    (await alice.page.locator(".plane-dot").count()) === 0,
    "no dots are drawn before you commit",
  );
  ok(
    (await alice.page.getByText("hidden until you commit").count()) > 0,
    "the locked state says why the board is empty",
  );
}

// Bob commits first, so there is something for Alice to be locked out of.
const bob = await person();
{
  await setInitials(bob.page, "BBB");
  await placeAt(bob.page, 0.5, 0.5);
  ok((await bob.page.locator(".plane-dot").count()) === 1, "committing reveals your own dot");
}

{
  // The gate is the point: Bob's coordinates must not be in the bytes Alice gets.
  await alice.page.reload();
  const html = await alice.page.content();
  ok(!html.includes("BBB"), "another player's initials are not in the locked payload");
  const res = await alice.ctx.request.get(`${BASE}/`);
  const raw = await res.text();
  ok(!raw.includes("BBB"), "…nor in the raw server response");
  ok(
    (await alice.page.getByText(/One person is already out there/).count()) > 0,
    "the locked board still reports the headcount",
  );

  // The splash renders for people who have not committed, so it is behind the
  // same gate. Its diagram is schematic — if it ever became real data, this is
  // where that would show up.
  const newcomer = await person();
  const splashHtml = await (await newcomer.ctx.request.get(`${BASE}/`)).text();
  await newcomer.page.goto(`${BASE}/`);
  ok(await newcomer.page.locator(".splash-plane").isVisible(), "a newcomer sees the splash");
  ok(!splashHtml.includes("BBB"), "…and it does not leak a plotted player's initials");
  ok(
    (await newcomer.page.locator(".plane-dot").count()) === 0,
    "…and draws no real dots",
  );
  await newcomer.page.getByRole("button", { name: "Continue" }).click();
  ok(
    (await newcomer.page.locator(".plane-dot").count()) === 0,
    "…nor on the profile screen",
  );
  ok(!(await newcomer.page.content()).includes("BBB"), "…and the profile does not leak them either");
  await newcomer.ctx.close();
}

// ─────────────────────────────────────────────────── placing and moving
group("Placing and moving");
{
  await placeAt(alice.page, -0.5, -0.5);
  await alice.page.reload();
  ok((await alice.page.locator(".plane-dot").count()) === 2, "both dots appear once you commit");
  ok((await alice.page.locator(".plane-dot.is-me").count()) === 1, "exactly one dot is marked yours");

  await alice.page.getByRole("button", { name: "show as list" }).click();
  const row = alice.page.locator("tr.is-me");
  const x = Number(await row.locator("td").nth(1).textContent());
  const y = Number(await row.locator("td").nth(2).textContent());
  ok(
    Math.abs(x - -0.5) <= 0.02 && Math.abs(y - -0.5) <= 0.02,
    "a drag round-trips through the database within 0.02",
    `got ${x}, ${y}`,
  );

  await alice.page.getByRole("button", { name: "Move me" }).click();
  // Your committed dot must give way to the marker while you aim: two marks
  // and two labels stacked on one coordinate is unreadable.
  ok(
    (await alice.page.locator(".plane-dot.is-me").count()) === 0 &&
      (await alice.page.locator(".plane-marker").count()) === 1,
    "moving replaces your dot with the marker rather than drawing both",
  );
  await placeAt(alice.page, 0.9, -0.9);
  await alice.page.reload();
  await alice.page.getByRole("button", { name: "show as list" }).click();
  const moved = alice.page.locator("tr.is-me");
  ok(
    Math.abs(Number(await moved.locator("td").nth(1).textContent()) - 0.9) <= 0.02,
    "moving replaces the dot rather than adding one",
  );
  ok(
    (await alice.page.locator(".plane-dot").count()) === 2,
    "…and the board still has two dots, not three",
  );
}

// ─────────────────────────────────────────── a tie, at a phone width
group("A three-way tie at 390px");
const tie = [];
{
  for (const initials of ["CCC", "DDD", "EEE"]) {
    const p = await person(390);
    await setInitials(p.page, initials);
    await placeAt(p.page, 0.2, 0.2);
    tie.push(p);
  }
  const page = tie[2].page;
  await page.reload();
  await settle(page);
  await settleAnimations(page);

  ok((await page.locator(".plane-dot").count()) === 5, "every dot is drawn");
  ok((await page.locator(".plane-cluster").count()) === 1, "the tie gets one cluster ring");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(overflow === 0, "the page does not scroll sideways at 390px", `overflow ${overflow}px`);

  // PR #3: labels live inside the square so the square can stay full-width on
  // a phone. Outside labels take their width out of the square; 16px padding
  // either side of a 390px viewport leaves 358px. A 3-column outside layout
  // lands well under 300.
  const boardGeom = await page.evaluate(() => {
    const square = document.querySelector(".plane-square").getBoundingClientRect();
    return { w: Math.round(square.width), vw: document.documentElement.clientWidth };
  });
  ok(
    boardGeom.w >= boardGeom.vw - 40,
    "the board stays full-width on a phone",
    `${boardGeom.w}px in a ${boardGeom.vw}px viewport`,
  );
  const axisEscaped = await escapedLabels(".plane-square", ".plane-label")(page);
  ok(axisEscaped.length === 0, "axis labels sit inside the square", axisEscaped.join(", "));
  const axisEdges = await page.evaluate(() => {
    const box = document.querySelector(".plane-square").getBoundingClientRect();
    const mid = (edge) => {
      const r = document.querySelector(`.plane-label-${edge}`).getBoundingClientRect();
      return { x: (r.left + r.right) / 2 - box.left, y: (r.top + r.bottom) / 2 - box.top };
    };
    return {
      top: mid("top"),
      bottom: mid("bottom"),
      left: mid("left"),
      right: mid("right"),
      w: box.width,
      h: box.height,
    };
  });
  ok(axisEdges.top.y < axisEdges.h * 0.25, "the top axis label sits on the top edge");
  ok(axisEdges.bottom.y > axisEdges.h * 0.75, "the bottom axis label sits on the bottom edge");
  ok(axisEdges.left.x < axisEdges.w * 0.25, "the left axis label sits on the left edge");
  ok(axisEdges.right.x > axisEdges.w * 0.75, "the right axis label sits on the right edge");

  const clipped = await page.evaluate(() => {
    const square = document.querySelector(".plane-square");
    const box = square.getBoundingClientRect();
    return [...document.querySelectorAll(".plane-dot-label")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left < box.left - 0.5 || r.right > box.right + 0.5 ||
          r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5
        );
      })
      .map((el) => el.textContent);
  });
  ok(clipped.length === 0, "no dot label is clipped by the square", clipped.join(", "));

  const overlapping = await page.evaluate(() => {
    const marks = [...document.querySelectorAll(".plane-dot-mark")].map((el) =>
      el.getBoundingClientRect(),
    );
    const hits = [];
    for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        const a = marks[i], b = marks[j];
        const dx = a.x + a.width / 2 - (b.x + b.width / 2);
        const dy = a.y + a.height / 2 - (b.y + b.height / 2);
        if (Math.hypot(dx, dy) < (a.width + b.width) / 2) hits.push([i, j]);
      }
    }
    return hits;
  });
  ok(overlapping.length === 0, "tied dots are fanned out, not stacked", JSON.stringify(overlapping));

  const small = await page.evaluate(() =>
    [...document.querySelectorAll(".button")]
      // A closed <dialog> is display:none, so the share sheet's buttons measure
      // zero while it is shut. Nothing you cannot tap needs a tap target — the
      // sheet's own buttons are measured while it is open instead.
      .filter((el) => el.checkVisibility())
      .map((el) => ({ label: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((b) => b.h < 44),
  );
  ok(small.length === 0, "every visible button clears a 44px tap target", JSON.stringify(small));
}

// ─────────────────────────────────────────── axis labels under an edge mark
group("Axis labels stay readable under an edge mark");
{
  // The production bug: a two-word left label ("Low Maintenance") vanished on
  // a 390px phone when someone sat mid-left, because `.is-crowded` set
  // opacity: 0. Overflow clip and ink colour were fine; the fade was not.
  const { ctx, page } = await person(390);
  await setInitials(page, "EDG");

  const spots = [
    { x: -1, y: 0, on: "left" },
    { x: 1, y: 0, on: "right" },
    { x: 0, y: 1, on: "top" },
    { x: 0, y: -1, on: "bottom" },
  ];
  for (const [i, spot] of spots.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Move me" }).click();
    await placeAt(page, spot.x, spot.y);
    const report = await axisLabelReport(page);
    for (const label of report) {
      ok(
        label.visible && label.opacity >= 0.5 && !label.clipped && label.w > 0 && label.h > 0 && label.text.length > 0,
        `${label.edge} axis label stays readable with a mark on the ${spot.on} edge`,
        JSON.stringify(label),
      );
    }
  }

  const texts = Object.fromEntries((await axisLabelReport(page)).map((l) => [l.edge, l.text]));
  ok(
    texts.left.split(/\s+/).length >= 2 && /maintenance/i.test(texts.left),
    "the left axis is a two-word label like the production case",
    texts.left,
  );
  ok(
    texts.right.split(/\s+/).length >= 2 && /maintenance/i.test(texts.right),
    "…and so is the right",
    texts.right,
  );

  await ctx.close();
}

// ───────────────────────────────────────────────────── colours
// After the tie, deliberately: that test counts every dot on the board, and a
// player created here would be one more than it expects.
group("Player colours");
{
  const { ctx, page } = await person();
  await setInitials(page, "TEA", "teal");
  await placeAt(page, -0.3, 0.4);

  ok(
    (await page.locator('.plane-dot.is-me[data-color="teal"]').count()) === 1,
    "the colour you picked is the colour your dot is drawn in",
  );

  // Ownership has to survive everyone choosing their own colour, so it is
  // carried by the halo rather than by hue. If this regresses, "which one is
  // me" silently stops being answerable on a board where someone else picked
  // your colour too.
  const halo = await page.evaluate(() => {
    const mark = document.querySelector(".plane-dot.is-me .plane-dot-mark");
    return getComputedStyle(mark).boxShadow;
  });
  ok(halo !== "none" && halo.length > 0, "your own dot is ringed, not just tinted", halo);

  // Every palette entry has to be legible on both grounds; the dark values are
  // re-derived rather than reused, and nothing else checks that they exist.
  const resolved = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return ["clay", "moss", "plum", "sky", "ochre", "teal", "rose", "slate"].map((n) => [
      n,
      root.getPropertyValue(`--c-${n}`).trim(),
    ]);
  });
  ok(
    resolved.every(([, value]) => /^#[0-9a-f]{6}$/i.test(value)),
    "all eight palette tokens resolve",
    JSON.stringify(resolved),
  );

  const darkCtx = await browser.newContext({ colorScheme: "dark" });
  const darkPage = await darkCtx.newPage();
  await darkPage.goto(`${BASE}/`);
  const darkResolved = await darkPage.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return ["clay", "moss", "plum", "sky", "ochre", "teal", "rose", "slate"].map((n) =>
      root.getPropertyValue(`--c-${n}`).trim(),
    );
  });
  ok(
    darkResolved.every((v, i) => /^#[0-9a-f]{6}$/i.test(v) && v !== resolved[i][1]),
    "…and every one of them is re-derived for dark rather than reused",
    JSON.stringify(darkResolved),
  );
  await darkCtx.close();

  await page.getByRole("button", { name: "show as list" }).click();
  ok(
    (await page.locator('tr.is-me .plot-chip[data-color="teal"]').count()) === 1,
    "the list view carries the same colour chip as the board",
  );

  await ctx.close();
}

// ─────────────────────────────────────────────── keyboard and contrast
group("Reachable without a pointer");
{
  // The square is the entire app. Pointer-only would mean a keyboard user can
  // only ever commit to dead centre, because that is where the marker starts.
  const { ctx, page } = await person();
  await setInitials(page, "KBD");

  const focused = await page.evaluate(() => {
    const sq = document.querySelector(".plane-square");
    sq.focus();
    return document.activeElement === sq;
  });
  ok(focused, "the square can take focus");

  const readingOf = () => page.locator(".plane-readout").textContent();
  ok((await readingOf())?.trim() === "dead centre", "the marker starts at centre, and says so");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const nudged = await readingOf();
  ok(
    nudged !== null && nudged.trim() !== "dead centre",
    "arrow keys move the marker",
    `readout: ${nudged}`,
  );

  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  ok((await readingOf()) !== nudged, "shift+arrow takes a bigger step");

  // …and the whole thing round-trips: commit by keyboard, read it back.
  await page.getByRole("button", { name: "Place me here" }).click();
  await settle(page);
  await dismissSheet(page);
  await page.getByRole("button", { name: "show as list" }).click();
  const row = page.locator("tr.is-me");
  const x = Number(await row.locator("td").nth(1).textContent());
  const y = Number(await row.locator("td").nth(2).textContent());
  ok(x > 0 && y > 0, "a dot placed entirely by keyboard saves", `got ${x}, ${y}`);

  // :focus-visible only matches real keyboard focus, so tab to it rather than
  // calling .focus() — a scripted focus would report no ring and look like a bug.
  let ring = { on: "nothing", width: "0px", style: "none" };
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        on: el.className || el.tagName.toLowerCase(),
        isButton: el.classList.contains("button"),
        width: s.outlineWidth,
        style: s.outlineStyle,
      };
    });
    if (at.isButton) { ring = at; break; }
  }
  ok(
    ring.style !== "none" && parseFloat(ring.width) >= 2,
    "keyboard focus draws a visible ring",
    JSON.stringify(ring),
  );

  await ctx.close();
}

group("Dark mode");
{
  const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  const paint = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return { bg: body.backgroundColor, fg: body.color };
  });
  const rgb = (v) => v.match(/\d+/g).map(Number);
  const luma = (v) => {
    const [r, g, b] = rgb(v);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  ok(luma(paint.bg) < 0.25, "the page is dark when the system is", JSON.stringify(paint));
  ok(luma(paint.fg) > 0.6, "…and the text inverts with it", JSON.stringify(paint));
  ok(
    (await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).includes("dark"),
    "color-scheme is declared, so form controls follow too",
  );
  await ctx.close();
}

// ─────────────────────────────────────────────── the share sheet
group("The share sheet");
{
  const { ctx, page } = await person(390);
  await setInitials(page, "SHT");

  // Place by hand, not through placeAt — that helper dismisses the sheet, and
  // the sheet is what this group is about.
  const commit = async () => {
    const box = await page.locator(".plane-square").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
    await page.getByRole("button", { name: /Place me here|Move me here/ }).click();
    await settle(page);
  };

  await commit();
  await page.locator("dialog.sheet[open]").waitFor({ timeout: 10_000 });
  const sheet = page.locator("dialog.sheet[open]");
  ok((await sheet.count()) === 1, "placing yourself opens the share sheet");
  ok(
    (await sheet.getByRole("button", { name: "Share" }).count()) === 1,
    "…with a share button in it",
  );
  ok(
    (await sheet.getByRole("link", { name: "Suggest one" }).getAttribute("href")) === "/ideas",
    "…and a link to suggest next week's grid",
  );

  // It opens on the reveal, so it must not sit on top of the reveal.
  const clear = await page.evaluate(() => {
    const s = document.querySelector("dialog.sheet").getBoundingClientRect();
    const sq = document.querySelector(".plane-square").getBoundingClientRect();
    return sq.bottom <= s.top + 1;
  });
  ok(clear, "…and does not cover the board it just revealed");

  const smallInSheet = await page.evaluate(() =>
    [...document.querySelectorAll("dialog.sheet .button")]
      .map((el) => ({ label: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((b) => b.h < 44),
  );
  ok(
    smallInSheet.length === 0,
    "…and its buttons clear a 44px tap target while it is open",
    JSON.stringify(smallInSheet),
  );

  await page.getByRole("button", { name: "not now" }).click();
  await page.waitForFunction(() => !document.querySelector("dialog.sheet[open]"));
  ok(true, "'not now' closes it");

  // Moving your dot is not a moment worth interrupting.
  await page.getByRole("button", { name: "Move me" }).click();
  await commit();
  ok(
    (await page.locator("dialog.sheet[open]").count()) === 0,
    "moving your dot afterwards does not reopen it",
  );

  // Escape is free with <dialog>, but only if showModal() was used.
  const { ctx: ctx2, page: p2 } = await person(390);
  await setInitials(p2, "ESC");
  const box = await p2.locator(".plane-square").boundingBox();
  await p2.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  await p2.getByRole("button", { name: "Place me here" }).click();
  await settle(p2);
  await p2.waitForSelector("dialog.sheet[open]");
  await p2.keyboard.press("Escape");
  await p2.waitForFunction(() => !document.querySelector("dialog.sheet[open]"));
  ok(true, "Escape closes it");
  ok(
    (await p2.evaluate(() => document.querySelector("dialog.sheet").matches(":modal"))) === false,
    "…and it is a real modal, so focus was trapped while open",
  );
  await ctx2.close();
  await ctx.close();
}

// ────────────────────────────────────────────────────────────── sharing
group("Sharing");
{
  const { ctx, page } = await person(390);
  await page.goto(`${BASE}/`);
  ok(
    (await page.getByRole("button", { name: "Share" }).count()) === 0,
    "no share button before you have initials",
  );

  await setInitials(page, "SHR");
  ok(
    (await page.getByRole("button", { name: "Share" }).count()) === 0,
    "…nor while the board is still locked to you",
  );

  await placeAt(page, -0.3, 0.4);
  const share = page.getByRole("button", { name: "Share" });
  ok((await share.count()) === 1, "it appears once you have placed yourself");
  ok(!(await share.isDisabled()), "…and is enabled once the URL is known");

  // Tier one: the native share sheet. Stub it, because a real one would open an
  // OS dialog the browser can't dismiss — what matters is the payload.
  const stubShare = (fn) =>
    page.evaluate((body) => {
      Object.defineProperty(navigator, "share", {
        value: body === null ? undefined : eval(body),
        configurable: true,
        writable: true,
      });
    }, fn);

  await page.evaluate(() => {
    window.__shared = null;
  });
  await stubShare(`(data) => { window.__shared = data; return Promise.resolve(); }`);
  await share.click();
  const shared = await page.evaluate(() => window.__shared);
  ok(shared !== null, "clicking it opens the share sheet where there is one");
  ok(shared?.url === `${BASE}/`, "…with the board's own URL, no query string", shared?.url);
  ok(
    typeof shared?.text === "string" && shared.text.includes("maintenance"),
    "…and this week's question in the text",
    shared?.text,
  );

  // Dismissing the sheet is a choice, not a failure: it must not silently copy.
  await page.evaluate(async () => {
    await navigator.clipboard.writeText("SENTINEL");
  });
  await stubShare(
    `() => Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" }))`,
  );
  await share.click();
  await page.waitForTimeout(200);
  ok(
    (await page.evaluate(() => navigator.clipboard.readText())) === "SENTINEL",
    "dismissing the sheet does not copy the link behind your back",
  );

  // Tier two: no share sheet, so fall back to the clipboard.
  await stubShare(null);
  await share.click();
  await page.waitForSelector("text=Link copied");
  ok(
    (await page.evaluate(() => navigator.clipboard.readText())) === `${BASE}/`,
    "without a share sheet it copies the link instead",
    await page.evaluate(() => navigator.clipboard.readText()),
  );

  // Tier three: neither works — the link still has to be gettable.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("blocked"));
  });
  await share.click();
  await page.waitForSelector(".share-url");
  ok(
    (await page.locator(".share-url").inputValue()) === `${BASE}/`,
    "with neither, the URL is shown as selectable text rather than a dead button",
  );
  await ctx.close();
}

// ────────────────────────────────────────────────────────────── ideas
group("Ideas");
{
  const page = alice.page;
  await page.goto(`${BASE}/ideas`);
  await hydrated(page, "form.stack");
  ok(
    (await page.getByText("Name both ends of each axis. If we like it, it becomes a future week.").count()) > 0,
    "ideas says what the four fields are for",
  );
  ok((await page.getByText("Five waiting at a time.").count()) === 0, "…and does not mention a waiting cap");
  ok((await page.getByText("Nothing from you yet").count()) > 0, "ideas has an empty state");

  const inputs = page.locator("form.stack .input");
  await inputs.nth(0).fill("indoors");
  await inputs.nth(1).fill("outdoors");
  await inputs.nth(2).fill("cheap");
  await inputs.nth(3).fill("expensive");
  await page.getByRole("button", { name: "Submit idea" }).click();
  await settle(page);
  await page.reload();
  await hydrated(page, "form.stack");
  ok((await page.locator(".card-list .card").count()) === 1, "a submitted idea shows up under Yours");
  ok(
    (await page.locator(".tag").first().textContent())?.trim() === "pending",
    "a new idea is pending",
  );

}

group("A sixth pending idea");
{
  // Its own person: the count is only what this loop wrote, so sharing one
  // with another group would make this assertion depend on their submits.
  const { ctx, page } = await person();
  await setInitials(page, "SIX");
  await page.goto(`${BASE}/ideas`);
  await hydrated(page, "form.stack");
  const inputs = page.locator("form.stack .input");
  const submit = page.getByRole("button", { name: /Submit idea|Sending/ });

  for (const n of [1, 2, 3, 4, 5, 6]) {
    for (const [i, v] of [[0, `l${n}`], [1, `r${n}`], [2, `b${n}`], [3, `t${n}`]]) {
      await inputs.nth(i).fill(v);
    }
    await submit.click();
    await settle(page);
    await page.waitForFunction(
      (want) => document.querySelectorAll(".card-list .card").length === want,
      n,
      { timeout: 15_000 },
    );
  }
  ok((await page.locator(".card-list .card").count()) === 6, "a sixth idea is accepted");
  ok((await page.locator(".error").count()) === 0, "…without an error");
  await ctx.close();
}

group("Typing while a submit is still in flight");
{
  // The form clears itself on success, and the action plus its revalidation can
  // outlast the moment someone starts typing the next one. Clearing whatever
  // happens to be in the fields at that point eats their input.
  const { ctx, page } = await person();
  await setInitials(page, "RCE");
  await page.goto(`${BASE}/ideas`);
  await hydrated(page, "form.stack");
  const inputs = page.locator("form.stack .input");
  const submit = page.getByRole("button", { name: /Submit idea|Sending/ });

  for (const [i, v] of [[0, "a"], [1, "b"], [2, "c"], [3, "d"]]) await inputs.nth(i).fill(v);
  await submit.click();
  // Don't wait for it: start typing the next idea straight away, exactly as a
  // person would.
  for (const [i, v] of [[0, "next"], [1, "one"], [2, "still"], [3, "here"]]) {
    await inputs.nth(i).fill(v);
  }
  await settle(page);
  const kept = await inputs.evaluateAll((els) => els.map((el) => el.value));
  ok(
    kept.join("|") === "next|one|still|here",
    "the reset does not wipe what was typed while the submit was in flight",
    JSON.stringify(kept),
  );
  ok(!(await submit.isDisabled()), "…and the form is still submittable");
  await ctx.close();
}

// ─────────────────────────────────────────── promote, archive, revisit
group("Promote an idea, archive the old grid");
{
  // How many dots the live grid actually ended up with — every group above adds
  // its own people, so this is read, not assumed.
  await alice.page.goto(`${BASE}/`);
  const placedThisGrid = await alice.page.locator(".plane-dot").count();
  // The preview image has to follow the live grid, or a group chat gets last
  // week's question. This promotion is the only grid change in the run.
  const ogBefore = (await (await alice.ctx.request.get(`${BASE}/opengraph-image`)).body()).length;

  await admin.page.goto(`${BASE}/admin`);
  await hydrated(admin.page, "form.stack");
  const queued = await admin.page
    .locator(".card-list .card .card-title")
    .first()
    .textContent();
  await admin.page.getByRole("button", { name: "Put it up" }).first().click();
  await settle(admin.page);
  const live = await admin.page
    .locator("h2:has-text('Live grid') + * .meta, .card .meta")
    .first()
    .textContent();
  ok(
    live?.includes(queued.split("↔")[0].trim()),
    "a queued idea can be promoted to the live grid",
    `queued ${queued} · live ${live}`,
  );

  await alice.page.goto(`${BASE}/archive`);
  const cards = alice.page.locator(".card-list .card");
  ok((await cards.count()) === 1, "the old grid moved to the archive");
  const card = await cards.first().textContent();
  const claimed = Number(card.match(/(\d+) dots?/)?.[1]);
  ok(claimed === placedThisGrid, "the archive card counts its dots", card);

  await cards.first().locator("a").click();
  await alice.page.waitForSelector(".plane-square");
  ok(
    (await alice.page.locator(".plane-dot").count()) === placedThisGrid,
    "an archived board is readable in full",
  );

  // An archived board is open reading, so a stranger sees it too.
  const stranger = await person();
  await stranger.page.goto(alice.page.url());
  ok(
    (await stranger.page.locator(".plane-dot").count()) === placedThisGrid,
    "…including to someone who never plotted",
  );
  ok(
    (await stranger.page.locator(".plane-dot.is-me").count()) === 0,
    "…with no dot marked as theirs",
  );
  await stranger.ctx.close();

  // The new grid is a fresh board: Alice has no dot on it, so she is locked out.
  await alice.page.goto(`${BASE}/`);
  ok(
    (await alice.page.locator(".plane-dot").count()) === 0,
    "a new grid locks everyone out again",
  );
  ok(
    (await alice.page.getByText("hidden until you commit").count()) > 0,
    "…and says so",
  );

  const ogAfter = (await (await alice.ctx.request.get(`${BASE}/opengraph-image`)).body()).length;
  ok(
    ogAfter !== ogBefore,
    "the share preview image is redrawn for the new grid",
    `${ogBefore} → ${ogAfter} bytes`,
  );
}

// ──────────────────────────────────────────────── an empty board
group("An empty board");
{
  // "0 people are already on the board — hidden until you place yourself"
  // promises a crowd that isn't there. This runs before anyone has plotted.
  const { ctx, page } = await person(390);
  await setInitials(page, "ONE");
  ok(
    (await page.getByText("Nobody here yet. You'd be first.").count()) > 0,
    "an empty board says so plainly",
    await page.locator(".meta").first().textContent(),
  );
  ok(
    (await page.getByText(/^0 people/).count()) === 0,
    "…and never says \"0 people are already on the board\"",
  );

  await placeAt(page, 0.1, 0.1);
  ok(
    (await page.getByText("Just you, so far.").count()) > 0,
    "being the only dot reads as being first, not as \"1 person has plotted\"",
    await page.locator(".meta").first().textContent(),
  );
  await ctx.close();
}

// ──────────────────────────────────────────────────────── bad input
group("Bad input and bad URLs");
{
  const { ctx, page } = await person();
  const notFound = await ctx.request.get(`${BASE}/archive/not-a-uuid`);
  ok(notFound.status() === 404, "a non-uuid archive id 404s", `got ${notFound.status()}`);
  const missing = await ctx.request.get(`${BASE}/archive/00000000-0000-4000-8000-000000000000`);
  ok(missing.status() === 404, "an unknown archive id 404s", `got ${missing.status()}`);

  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: "Continue" }).click();
  await hydrated(page, "form.initials-form");
  await page.fill("#initials", "ab");
  ok(
    await page.locator("form.initials-form button[type=submit]").isDisabled(),
    "two characters can't be submitted",
  );
  // pressSequentially, not fill(): maxLength=3 truncates a whole-string fill
  // before React's onChange ever sees the characters it would have stripped.
  await page.fill("#initials", "");
  await page.locator("#initials").pressSequentially("a-b!c@d");
  ok(
    (await page.inputValue("#initials")) === "ABC",
    "the field upper-cases and strips punctuation as you type",
    await page.inputValue("#initials"),
  );
  await ctx.close();
}

// ──────────────────────────────────────────────────── admin authorisation
group("Admin authorisation");
{
  // Every admin action re-checks for itself, because a Server Function POSTs to
  // the page's own route and no page-level guard covers it. Prove it: replay a
  // signed-in admin's action request from a context with no admin cookie.
  const { ctx, page } = await person();
  await page.goto(`${BASE}/admin`);
  await hydrated(page, "form.stack");
  ok(await page.locator("#password").isVisible(), "a signed-out visitor only sees the login");

  let action = null;
  admin.page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) action = req;
  });
  await admin.page.goto(`${BASE}/admin`);
  await hydrated(admin.page, "form.stack");
  await admin.page.getByRole("button", { name: "Take it down" }).click();
  await settle(admin.page);
  ok(action !== null, "captured a real admin action request to replay");

  if (action) {
    const replay = await ctx.request.post(action.url(), {
      headers: {
        "next-action": action.headers()["next-action"],
        "content-type": action.headers()["content-type"] ?? "text/plain;charset=UTF-8",
      },
      data: action.postData() ?? "[]",
    });
    const body = await replay.text();
    ok(
      !replay.ok() || body.includes("error") || body.includes("Not authorised"),
      "the same action replayed without the admin cookie does not succeed",
      `status ${replay.status()}`,
    );
    // And prove it by effect, not just by response: nothing may be live now.
    await page.goto(`${BASE}/`);
    ok(
      (await page.getByText("Between rounds").count()) > 0,
      "…the grid the admin took down stayed down",
    );
  }
  await ctx.close();
}

for (const p of [alice, bob, admin, ...tie]) await p.ctx.close();
await browser.close();

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
