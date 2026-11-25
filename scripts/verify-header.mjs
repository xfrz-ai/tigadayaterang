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
  await scrollTo(0);
  const desk = await measure();
  // Menu on the left, the logo centred, today's hours and contact on the right.
  const layout = await page.evaluate(() => {
    const R = (s) => document.querySelector(s).getBoundingClientRect();
    const brand = R(".header .brand"),
      menu = R(".menu-toggle"),
      hours = R(".header-hours"),
      cta = R(".header-cta");
    return {
      centred: Math.abs((brand.left + brand.right) / 2 - innerWidth / 2) <= 1,
      order:
        menu.right < brand.left &&
        brand.right < hours.left &&
        hours.right < cta.left,
      round: [".menu-toggle", ".header-cta"].every(
        (s) =>
          parseFloat(getComputedStyle(document.querySelector(s)).borderRadius) >=
          document.querySelector(s).offsetHeight / 2,
      ),
      hours: document.querySelector(".header-hours").innerText,
      links: !!document.querySelector(".header nav"),
    };
  });
  assert(layout.centred, "1440px: logo centred");
  assert(layout.order, "1440px: menu, logo, hours, contact");
  assert(layout.round, "1440px: pill buttons");
  assert(!layout.links, "1440px: section links only in the menu");
  assert.match(
    layout.hours,
    /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu), \d{1,2} \w{3} \d{4}\s+\d\d\.\d\d WIB\s*(Buka)?$/,
    "1440px: today's date and time",
  );

  const results = {};
  // iPad Pro 11" and Air landscape, iPad landscape, iPad portrait, phones.
  for (const [width, height, hero, stuck] of [
    [1920, 1080, 105, 80],
    [1440, 900, 105, 80],
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
    // Every screen: the header stays at the top, tighter, once scrolled.
    await scrollTo(2500);
    const mid = await measure();
    assert(
        mid.top === 0 && mid.height === stuck,
        `${width}px: header stays at the top, ${stuck}px tall`,
      );
    assert(!mid.overflow, `${width}px: no horizontal overflow`);
    const gone = (box) => box.x + box.width <= 1;

    // The menu button opens a panel that slides in from the left edge.
    const drawer = page.locator(".drawer-panel");
    const shut = await drawer.boundingBox();
    assert(gone(shut), `${width}px: closed panel waits off screen`);
    await page.getByRole("button", { name: "Buka menu" }).click();
    const sliding = await drawer.boundingBox();
    await page.waitForTimeout(600);
    const box = await drawer.boundingBox();
    assert(
      Math.abs(box.x) <= 1 &&
        box.y === 0 &&
        box.height === height &&
        sliding.x < box.x,
      `${width}px: panel slid in to the left edge, full height`,
    );
    const inside = await page.evaluate(() => {
      const p = document.querySelector(".drawer-panel").getBoundingClientRect();
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const head = R(".drawer-head"),
        nav = R(".drawer nav"),
        foot = R(".drawer-foot");
      const hours = document.querySelector(".drawer-hours");
      return {
        order: head.bottom <= nav.top && nav.bottom <= foot.top,
        footAtBottom: foot.bottom <= p.bottom && foot.bottom >= p.bottom - 40,
        logo: !!document.querySelector(".drawer-head .brand img"),
        hours: /\d\d\.\d\d WIB/.test(hours.innerText) && foot.top <= R(".drawer-hours").top,
        social: [...document.querySelectorAll(".drawer-social a")].map((a) =>
          a.getAttribute("aria-label"),
        ),
        locked:
          document.documentElement.scrollHeight > innerHeight &&
          // Hidden by the menu, clipped by the stopped smooth scroller.
          ["hidden", "clip"].includes(
            getComputedStyle(document.documentElement).overflow,
          ),
        focus: document.activeElement.getAttribute("aria-label"),
      };
    });
    assert(inside.logo && inside.order, `${width}px: logo, links, then social`);
    assert(inside.footAtBottom, `${width}px: social icons at the bottom`);
    assert(inside.hours, `${width}px: today's date and time in the menu`);
    assert.deepEqual(inside.social, ["Facebook", "Threads", "Instagram"]);
    assert(inside.locked, `${width}px: page behind the menu does not scroll`);
    assert.equal(inside.focus, "Tutup menu", "Focus moves into the menu");
    // Escape closes it; the backdrop does too.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    assert(gone(await drawer.boundingBox()), "Escape closes it");
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.waitForTimeout(500);
    await page.mouse.click(width - 10, height / 2);
    await page.waitForTimeout(500);
    assert(gone(await drawer.boundingBox()), "Backdrop closes it");
    // Jumping to a section from the menu leaves its heading clear of the header.
    await page.getByRole("button", { name: "Buka menu" }).click();
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    await nav.getByRole("link", { name: "Testimoni" }).click();
    // Long enough for the glide to finish before the next width starts.
    await page.waitForTimeout(2000);
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
    results[width] = { top: top.height, scrolled: stuck && mid.height };
  }

  // The hero layout itself is unchanged on desktop.
  await page.setViewportSize({ width: 1440, height: 900 });
  await scrollTo(0);
  assert.equal((await measure()).copyTop, desk.copyTop);

  assert.deepEqual(errors, [], "No browser errors");
  const report = {
    passed: true,
    checks: [
      "menu button left, logo centred, today's date and time and contact right; pill buttons",
      "header fixed at the top on every screen, tightened after scrolling",
      "hero copy below the header; no overflow",
      "menu slides in from the left at every width: logo, links, date and time, social icons",
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
