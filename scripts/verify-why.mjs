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
const area = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

try {
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#tentang-kami").nextElementSibling.id,
    ),
    "kenapa-kami",
    "Reasons follow the about section",
  );
  assert.deepEqual(await page.locator(".why-item h3").allInnerTexts(), [
    "Tepat Waktu, Sesuai Janji",
    "Aman Sampai Tujuan",
    "Dukungan 24/7",
    "Fleksibel Sesuai Kebutuhan",
  ]);
  // Every reason has its own isometric illustration, hidden from readers.
  const icons = await page.locator(".why-icon svg").evaluateAll((svgs) =>
    svgs.map((s) => ({
      hidden: s.getAttribute("aria-hidden") === "true",
      shapes: s.querySelectorAll("polygon, path, circle, rect").length,
    })),
  );
  assert.equal(icons.length, 4);
  for (const icon of icons) {
    assert(icon.hidden, "Icons are decorative");
    assert(icon.shapes > 8, "Icons are drawn");
  }

  for (const width of [1920, 1440, 1280, 1200, 1024, 901, 820, 421, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#kenapa-kami").scrollIntoViewIfNeeded();
    const r = await page.evaluate(() => {
      const R = (el) => el.getBoundingClientRect().toJSON();
      const section = document.querySelector("#kenapa-kami");
      const h2 = section.querySelector("h2");
      return {
        section: R(section),
        headingLines: Math.round(
          h2.getBoundingClientRect().height /
            parseFloat(getComputedStyle(h2).lineHeight),
        ),
        items: [...section.querySelectorAll(".why-item")].map((li) => ({
          box: R(li),
          icon: R(li.querySelector("svg")),
          text: R(li.querySelector("div")),
        })),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(r.headingLines, 2, `${width}px: heading on two lines`);
    for (let i = 0; i < 4; i++) {
      const { box, icon, text } = r.items[i];
      assert(
        box.left >= r.section.left &&
          box.right <= r.section.right &&
          box.bottom <= r.section.bottom + 1,
        `${width}px: reason ${i + 1} stays in the section`,
      );
      assert.equal(area(icon, text), 0, `${width}px: icon clear of the text`);
      assert(text.width >= 180, `${width}px: readable text column`);
      for (let j = i + 1; j < 4; j++)
        assert.equal(
          area(box, r.items[j].box),
          0,
          `${width}px: reasons ${i + 1} and ${j + 1} do not overlap`,
        );
    }
    assert(!r.overflow, `${width}px: no horizontal overflow`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#kenapa-kami").scrollIntoViewIfNeeded();
  const hand = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector(".iso-hand")).transform,
    );
  const before = await hand();
  await page.waitForTimeout(600);
  assert.notEqual(await hand(), before, "Clock hand turns");
  await page.getByRole("button", { name: "Mulai kirim sekarang" }).click();
  assert(await page.locator(".quote-dialog").isVisible(), "CTA opens the form");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await hand();
  await page.waitForTimeout(400);
  assert.equal(await hand(), still, "Reduced motion stops the clock");

  assert.deepEqual(errors, [], "No browser errors");
  const report = {
    passed: true,
    checks: [
      "placed after the about section, four reasons",
      "decorative isometric icons",
      "layout at 320–1920px: two-line heading, no overlap or overflow",
      "clock animation and reduced motion",
      "CTA opens the form",
      "no browser errors",
    ],
  };
  await writeFile(
    "artifacts/why-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
