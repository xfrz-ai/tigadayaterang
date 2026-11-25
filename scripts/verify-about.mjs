import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Numeric and DOM checks only: no screenshots are taken.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
const errors = [];
await mkdir("artifacts", { recursive: true });

async function open(viewport, options = {}) {
  const page = await browser.newPage({ viewport, ...options });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base, { waitUntil: "networkidle" });
  return page;
}
const scrollTo = async (page, y) => {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(400);
};
/** How far the ink has got, and the colours of the first and last letters. */
const fill = (page) =>
  page.evaluate(() => {
    const p = document.querySelector(".about-statement");
    const chars = p.querySelectorAll(".about-char");
    const color = (el) => getComputedStyle(el).color;
    const pin = document.querySelector(".about-pin").getBoundingClientRect();
    return {
      p: parseFloat(getComputedStyle(p).getPropertyValue("--p")),
      letters: chars.length,
      first: color(chars[0]),
      last: color(chars[chars.length - 1]),
      pinTop: pin.top,
      pinHeight: pin.height,
    };
  });
const INK = "color(srgb 0.141176 0.156863 0.152941)";

try {
  const page = await open({ width: 1440, height: 900 });
  // Straight after the hero, before the services.
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("main > section")].slice(0, 3).map((s) => s.id),
    ),
    ["home", "tentang-kami", "services"],
    "About sits between the hero and the services",
  );
  assert.equal(
    await page.locator("#tentang-kami h2").innerText(),
    "TENTANG KAMI",
    "Section label",
  );
  // Readers get the statement once, as plain text.
  const statement = await page.locator("#tentang-kami .sr-only").textContent();
  assert.match(statement, /^Kami percaya setiap kiriman/);
  assert.equal(
    await page.locator(".about-statement [aria-hidden=true]").count(),
    1,
    "Letter spans hidden from readers",
  );
  assert(
    await page.evaluate(() => document.documentElement.classList.contains("lenis")),
    "Smooth scrolling is on",
  );

  const { top, height } = await page.evaluate(() => {
    const s = document.querySelector("#tentang-kami");
    return { top: s.offsetTop, height: s.offsetHeight };
  });
  await scrollTo(page, top - 900);
  const before = await fill(page);
  assert.equal(before.p, 0, "Nothing inked before the section");
  assert.notEqual(before.first, INK);
  // Pinned: the statement stays on screen while the ink moves on.
  const steps = [];
  for (const f of [0.2, 0.5, 0.8]) {
    await scrollTo(page, top + f * (height - 900));
    steps.push(await fill(page));
  }
  assert(
    steps.every((s) => s.pinTop === 0 && s.pinHeight === 900),
    "Statement pinned to the screen",
  );
  assert(
    steps[0].p < steps[1].p && steps[1].p < steps[2].p,
    "Ink advances with the scroll",
  );
  assert.equal(steps[1].first, INK, "Letters behind the front are ink");
  assert.notEqual(steps[1].last, INK, "Letters ahead are still faded");
  await scrollTo(page, top + height - 900);
  const done = await fill(page);
  assert.equal(done.last, INK, "Whole statement inked by the end");

  // A wheel turn glides instead of jumping.
  await scrollTo(page, 0);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(80);
  const gliding = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1500);
  const settled = await page.evaluate(() => scrollY);
  assert(gliding > 0 && gliding < settled, "Wheel scrolling is eased");

  // The menu link glides to the section and lands at its top.
  await scrollTo(page, 0);
  await page.getByRole("button", { name: "Buka menu" }).click();
  await page.waitForTimeout(600);
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Tentang kami" })
    .click();
  await page.waitForTimeout(150);
  const midway = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1800);
  const landed = await page.evaluate(() => ({
    y: scrollY,
    top: document.querySelector("#tentang-kami").getBoundingClientRect().top,
    hash: location.hash,
  }));
  assert(midway > 0 && midway < landed.y, "Menu link glides");
  assert(Math.abs(landed.top - 80) <= 2, "Lands below the fixed header");
  assert.equal(landed.hash, "#tentang-kami");
  await page.close();

  // Phones: still pinned, clear of the fixed header, no overflow.
  const phone = await open({ width: 390, height: 844 });
  const p = await phone.evaluate(() => {
    const s = document.querySelector("#tentang-kami");
    return { top: s.offsetTop, height: s.offsetHeight };
  });
  await scrollTo(phone, p.top + 0.5 * (p.height - 844));
  const mobile = await phone.evaluate(() => {
    const label = document.querySelector(".about-label").getBoundingClientRect();
    const text = document.querySelector(".about-statement").getBoundingClientRect();
    const header = document.querySelector(".header").getBoundingClientRect();
    return {
      clear: label.top >= header.bottom,
      fits: text.bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert(mobile.clear && mobile.fits && !mobile.overflow, "390px: fits below the header");

  await phone.close();

  // Reduced motion: solid from the start, nothing pinned.
  const still = await open({ width: 1440, height: 900 }, { reducedMotion: "reduce" });
  await still.locator("#tentang-kami").scrollIntoViewIfNeeded();
  const solid = await fill(still);
  assert(solid.first === INK && solid.last === INK, "Reduced motion: solid text");

  assert(
    await still.evaluate(
      () =>
        getComputedStyle(document.querySelector(".about-pin")).position === "static" &&
        document.querySelector("#tentang-kami").offsetHeight < innerHeight * 1.3,
    ),
    "Reduced motion: no pinned stretch",
  );
  await still.close();

  assert.deepEqual(errors, [], "No browser errors");
  const report = {
    passed: true,
    checks: [
      "about follows the hero; label and statement",
      "statement read once by screen readers",
      "pinned while the scroll inks it in, letter by letter",
      "wheel scrolling and menu links glide (Lenis)",
      "fits phones below the fixed header",
      "reduced motion: solid, not pinned",
    ],
  };
  await writeFile("artifacts/about-verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
