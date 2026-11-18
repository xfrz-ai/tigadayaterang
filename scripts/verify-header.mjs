import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Numeric and DOM checks only: no screenshots are taken.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const measure = () =>
  page.evaluate(() => {
    const h = document.querySelector(".header").getBoundingClientRect();
    const copy = document.querySelector(".hero-copy").getBoundingClientRect();
    return {
      top: h.top,
      bottom: h.bottom,
      height: h.height,
      copyTop: copy.top + scrollY,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
const scrollTo = async (y) => {
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    y,
  );
  await page.waitForTimeout(400);
};

try {
  await page.goto(base, { waitUntil: "networkidle" });
  // Desktop keeps the header in the hero: it scrolls away with the page.
  await scrollTo(0);
  const desk = await measure();
  await scrollTo(1500);
  assert((await measure()).bottom <= 0, "1440px: header scrolls away");
  assert(
    !(await page.getByRole("button", { name: "Buka menu" }).isVisible()) &&
      (await page
        .locator(".drawer")
        .evaluate((d) => getComputedStyle(d).display)) === "none",
    "1440px: links inline, no menu panel",
  );

  const results = {};
  // iPad Pro 11" and Air landscape, iPad landscape, iPad portrait, phones.
  for (const [width, height, hero, stuck] of [
    [1194, 834, 105, 72],
    [1180, 820, 105, 72],
    [1024, 768, 105, 72],
    [820, 1180, 105, 72],
    [768, 1024, 105, 72],
    [390, 844, 83, 64],
    [320, 700, 83, 64],
  ]) {
    await page.setViewportSize({ width, height });
    await scrollTo(0);
    const top = await measure();
    assert.equal(top.height, hero, `${width}px: full header at the top`);
    assert(
      top.copyTop >= top.bottom,
      `${width}px: hero copy starts below the header`,
    );
    await scrollTo(2500);
    const mid = await measure();
    assert(
      mid.top === 0 && mid.height === stuck,
      `${width}px: header stays at the top, ${stuck}px tall`,
    );
    assert(!mid.overflow, `${width}px: no horizontal overflow`);

    // The menu button opens a panel that slides in from the right edge.
    const drawer = page.locator(".drawer-panel");
    const shut = await drawer.boundingBox();
    assert(shut.x >= width - 1, `${width}px: closed panel waits off screen`);
    await page.getByRole("button", { name: "Buka menu" }).click();
    const sliding = await drawer.boundingBox();
    await page.waitForTimeout(600);
    const box = await drawer.boundingBox();
    assert(
      Math.abs(box.x + box.width - width) <= 1 &&
        box.y === 0 &&
        box.height === height &&
        sliding.x > box.x,
      `${width}px: panel slid in to the right edge, full height`,
    );
    const inside = await page.evaluate(() => {
      const p = document.querySelector(".drawer-panel").getBoundingClientRect();
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const head = R(".drawer-head"),
        nav = R(".drawer nav"),
        foot = R(".drawer-foot");
      return {
        order: head.bottom <= nav.top && nav.bottom <= foot.top,
        footAtBottom: foot.bottom <= p.bottom && foot.bottom >= p.bottom - 40,
        logo: !!document.querySelector(".drawer-head .brand img"),
        social: [...document.querySelectorAll(".drawer-social a")].map((a) =>
          a.getAttribute("aria-label"),
        ),
        locked:
          document.documentElement.scrollHeight > innerHeight &&
          getComputedStyle(document.documentElement).overflow === "hidden",
        focus: document.activeElement.getAttribute("aria-label"),
      };
    });
    assert(inside.logo && inside.order, `${width}px: logo, links, then social`);
    assert(inside.footAtBottom, `${width}px: social icons at the bottom`);
    assert.deepEqual(inside.social, ["Facebook", "Threads", "Instagram"]);
    assert(inside.locked, `${width}px: page behind the menu does not scroll`);
    assert.equal(inside.focus, "Tutup menu", "Focus moves into the menu");
    // Escape closes it; the backdrop does too.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    assert((await drawer.boundingBox()).x >= width - 1, "Escape closes it");
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.waitForTimeout(500);
    await page.mouse.click(10, height / 2);
    await page.waitForTimeout(500);
    assert((await drawer.boundingBox()).x >= width - 1, "Backdrop closes it");
    // Jumping to a section from the menu leaves its heading clear of the header.
    await page.getByRole("button", { name: "Buka menu" }).click();
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    await nav.getByRole("link", { name: "Testimoni" }).click();
    await page.waitForTimeout(900);
    const heading = await page.evaluate(() => {
      const h = document.querySelector(".header").getBoundingClientRect();
      const t = document
        .querySelector("#testimoni .eyebrow")
        .getBoundingClientRect();
      return { header: h.bottom, eyebrow: t.top };
    });
    assert(
      heading.eyebrow >= heading.header,
      `${width}px: section heading not hidden under the header`,
    );
    results[width] = { top: top.height, scrolled: mid.height };
  }

  // The hero layout itself is unchanged on desktop.
  await page.setViewportSize({ width: 1440, height: 900 });
  await scrollTo(0);
  assert.equal((await measure()).copyTop, desk.copyTop);

  assert.deepEqual(errors, [], "No browser errors");
  const report = {
    passed: true,
    checks: [
      "desktop header scrolls away as before",
      "tablet and phone header fixed at the top, tightened after scrolling",
      "hero copy below the header; no overflow",
      "menu slides in from the right: logo, links, social icons at the bottom",
      "scroll lock, focus, Escape and backdrop close",
      "section links land below the header",
    ],
    heights: results,
  };
  await writeFile(
    "artifacts/header-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
