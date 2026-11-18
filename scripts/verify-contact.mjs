import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Numeric and DOM checks only: no screenshots are taken.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__relayContact)));
const showContact = async () => {
  await page.locator("#hubungi-kami").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__relayContact?.running);
  await page.waitForTimeout(350);
};
const overlap = ([l1, t1, r1, b1], [l2, t2, r2, b2]) =>
  Math.max(0, Math.min(r1, r2) - Math.max(l1, l2)) *
  Math.max(0, Math.min(b1, b2) - Math.max(t1, t2));

try {
  await page.goto(base, { waitUntil: "networkidle" });
  // The call to action replaces the old "harapan" band, right before the footer.
  assert.equal(
    await page.evaluate(() => {
      const s = document.querySelector("#hubungi-kami");
      return `${s.previousElementSibling.id} > ${s.nextElementSibling.tagName}`;
    }),
    "how-it-works > FOOTER",
  );
  assert.equal(await page.locator("#harapan").count(), 0, "Old band removed");
  assert.equal(
    await page.getByText("BERFOKUS PADA YANG PALING PENTING").count(),
    0,
  );
  assert.match(
    await page.locator("#contact-heading").innerText(),
    /Punya kiriman\?\s+Kami siap berangkat\./,
  );
  const look = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".contact-panel"));
    return { bg: s.backgroundColor, border: s.borderTopWidth };
  });
  assert.equal(look.bg, "rgb(237, 65, 53)", "Panel uses the brand red");
  assert.equal(look.border, "1px");
  assert.equal(
    await page.evaluate(() => !!window.__relayContact),
    false,
    "Scene loads only near the viewport",
  );

  await showContact();
  const before = await state();
  await page.waitForTimeout(800);
  const after = await state();
  assert(after.time > before.time, "Truck idles while visible");
  assert.deepEqual(after.camera, before.camera, "Camera stays fixed");
  assert(after.drawCalls < 40, "Static geometry is batched");

  const layouts = {};
  for (const [width, lines] of [
    [1920, 2],
    [1440, 2],
    [1100, 2],
    [901, 2],
    [820, 2],
    [390, 2],
    [320, 3],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await showContact();
    const r = await page.evaluate(() => {
      const R = (sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        return [b.left, b.top, b.right, b.bottom];
      };
      const h2 = document.querySelector("#contact-heading");
      return {
        panel: R(".contact-panel"),
        button: R(".contact-copy .button"),
        copy: R(".contact-copy"),
        canvas: R(".contact-scene canvas"),
        lines: Math.round(
          h2.getBoundingClientRect().height /
            parseFloat(getComputedStyle(h2).lineHeight),
        ),
        parts: window.__relayContact.parts,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(r.lines, lines, `${width}px: heading on ${lines} lines`);
    const [cl, ct, cr, cb] = r.canvas;
    for (const [name, [l, t, rr, b]] of Object.entries(r.parts))
      assert(
        l >= 0 && t >= 0 && rr <= cr - cl && b <= cb - ct,
        `${width}px: ${name} stays inside the scene`,
      );
    assert.equal(
      overlap(r.parts.boxes, r.parts.lettering),
      0,
      `${width}px: boxes leave the lettering clear`,
    );
    const [pl, pt, pr, pb] = r.panel,
      [bl, bt, br, bb] = r.button;
    assert(
      bl >= pl && bt >= pt && br + 6 <= pr && bb + 6 <= pb,
      `${width}px: button and its shadow sit inside the panel`,
    );
    // Side by side the copy ends where the scene begins; stacked, above it.
    const stacked = width <= 900;
    assert(
      stacked ? bb + 6 <= ct : r.copy[2] <= cl + 1,
      `${width}px: copy and scene do not overlap`,
    );
    assert(!r.overflow, `${width}px: no horizontal overflow`);
    layouts[width] = { canvas: r.canvas.map(Math.round), stacked };
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await showContact();
  await page
    .locator("#hubungi-kami")
    .getByRole("button", { name: "Hubungi kami" })
    .click();
  assert(await page.locator(".quote-dialog").isVisible(), "CTA opens the form");
  await page.keyboard.press("Escape");

  await page.locator("#home").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const away = await state();
  assert(!away.running, "Pauses when scrolled away");
  await page.waitForTimeout(400);
  assert.equal((await state()).time, away.time, "Clock stays frozen offscreen");
  await showContact();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(250);
  assert(!(await state()).running, "Reduced motion honored");

  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "replaces the old band, right before the footer",
      "brand-red panel, heading copy",
      "scene loads lazily, idles, fixed camera, batched",
      "heading line count at 320-1920px",
      "truck, boxes and lettering inside the scene; boxes clear of the lettering",
      "button inside the panel; copy and scene apart; no overflow",
      "CTA opens the form",
      "offscreen pause, reduced motion",
      "no browser or network errors",
    ],
    drawCalls: after.drawCalls,
    layouts,
  };
  await writeFile(
    "artifacts/contact-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
