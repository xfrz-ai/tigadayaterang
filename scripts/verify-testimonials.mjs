import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Numeric and DOM checks only: no screenshots are taken.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const area = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

try {
  const data = await readFile("components/testimonial-data.ts", "utf8");
  assert(data.includes("DRAFT"), "Sample reviews stay marked as draft");
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#kenapa-kami").nextElementSibling.id,
    ),
    "testimoni",
    "Testimonials follow the reasons to choose us",
  );
  assert.equal(await page.locator(".testimonial-slide").count(), 2);
  for (const slide of await page.locator(".testimonial-slide").all())
    assert.equal(
      await slide.locator(".testimonial-photo img").count(),
      2,
      "Two photos per review",
    );
  const ld = await page
    .locator('script[type="application/ld+json"]')
    .innerHTML();
  assert(
    !/"Review"|AggregateRating/.test(ld),
    "Draft reviews are kept out of structured data",
  );

  for (const width of [1920, 1440, 1100, 1024, 820, 701, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#testimoni").scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const r = await page.evaluate(() => {
      const R = (el) => el.getBoundingClientRect().toJSON();
      const slide = document.querySelector(".testimonial-slide.is-active");
      const header = document.querySelector(".header");
      const nav = header.querySelector(".nav");
      const links = [...nav.querySelectorAll("a")].map(R);
      return {
        panel: R(document.querySelector(".testimonial-panel")),
        squares: R(document.querySelector(".testimonial-nav")),
        photos: [...slide.querySelectorAll(".testimonial-photo")].map(R),
        captions: [...slide.querySelectorAll(".photo-caption")].map(R),
        text: [
          "blockquote",
          ".testimonial-author",
          ".testimonial-quote > svg",
        ].map((s) => R(slide.querySelector(s))),
        loaded: [...slide.querySelectorAll("img")].every(
          (i) => i.complete && i.naturalWidth === 600,
        ),
        navFolded: getComputedStyle(nav).display === "none",
        navFits:
          links.every((l, i) => !i || l.left > links[i - 1].right) &&
          links.at(-1).right < R(header.querySelector(".header-cta")).left - 10,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const inside = (b) =>
      b.left >= r.panel.left &&
      b.right <= r.panel.right &&
      b.top >= r.panel.top &&
      b.bottom <= r.panel.bottom;
    assert(r.photos.every(inside), `${width}px: photos stay in the panel`);
    assert(inside(r.squares), `${width}px: squares stay in the panel`);
    for (const b of [...r.photos, ...r.text])
      assert.equal(
        area(r.squares, b),
        0,
        `${width}px: squares overlap nothing`,
      );
    r.captions.forEach((c, i) =>
      assert(
        c.left >= r.photos[i].left && c.right <= r.photos[i].right,
        `${width}px: caption sits on its photo`,
      ),
    );
    assert(r.loaded, `${width}px: photos load`);
    assert(r.navFolded || r.navFits, `${width}px: header links fit`);
    assert(!r.overflow, `${width}px: no horizontal overflow`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#testimoni").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Tampilkan testimoni 2" }).click();
  await page.waitForTimeout(500);
  const slides = await page.evaluate(() =>
    [...document.querySelectorAll(".testimonial-slide")].map((s) => ({
      active: s.classList.contains("is-active"),
      inert: s.inert,
    })),
  );
  assert.deepEqual(slides, [
    { active: false, inert: true },
    { active: true, inert: false },
  ]);
  assert.equal(
    await page
      .getByRole("button", { name: "Tampilkan testimoni 2" })
      .getAttribute("aria-current"),
    "true",
  );
  // Gallery: open a photo, step through with the keyboard, close.
  await page
    .locator(".testimonial-slide.is-active .testimonial-photo")
    .first()
    .click();
  const viewer = page.locator(".photo-dialog");
  assert(await viewer.isVisible(), "Photo opens in the gallery");
  const shown = () => viewer.locator("img").getAttribute("src");
  assert.equal(await shown(), "/images/pengiriman/paket-siap-kirim.jpg");
  await page.keyboard.press("ArrowRight");
  assert.equal(await shown(), "/images/pengiriman/karung-jalur-laut.jpg");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await shown(),
    "/images/pengiriman/karton-ditimbang.jpg",
    "Gallery wraps around",
  );
  await page.getByRole("button", { name: "Foto sebelumnya" }).click();
  assert.equal(await shown(), "/images/pengiriman/karung-jalur-laut.jpg");
  await page.keyboard.press("Escape");
  assert(!(await viewer.isVisible()), "Escape closes the gallery");
  for (const [width, height] of [
    [1440, 900],
    [390, 700],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .locator(".testimonial-slide.is-active .testimonial-photo")
      .first()
      .click();
    assert(
      await viewer.evaluate((d) => {
        const b = d.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth;
      }),
      `${width}px: gallery fits the screen`,
    );
    await page.getByRole("button", { name: "Tutup galeri" }).click();
  }
  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "placed after the reasons section, two reviews with two photos each",
      "draft reviews kept out of structured data",
      "panel, photos, captions and squares fit at 320–1920px",
      "header links fit or fold into the menu",
      "review switching with inert hidden slide",
      "photo gallery: open, arrows, buttons, wrap, close, fits the screen",
      "no browser or network errors",
    ],
  };
  await writeFile(
    "artifacts/testimonials-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
