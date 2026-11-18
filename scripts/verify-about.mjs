import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Numeric checks only: no screenshots are taken.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1.5,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__relayAbout)));
const showAbout = async () => {
  await page.locator("#tentang-kami").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__relayAbout?.running);
  await page.waitForTimeout(350);
};

/**
 * Where the truck roof meets the heading: for each rendered text run, how far
 * the roof rises above that run's baseline (in em; negative means below).
 */
const roofAgainstHeading = () =>
  page.evaluate(() => {
    const canvas = document
      .querySelector(".company-scene canvas")
      .getBoundingClientRect();
    const roof = window.__relayAbout.roof.map(([x, y]) => [
      canvas.left + x,
      canvas.top + y,
    ]);
    const heading = document.querySelector("#company-heading");
    const size = parseFloat(getComputedStyle(heading).fontSize);
    const runs = [];
    for (const node of heading.querySelectorAll(
      ".company-line, .company-accent",
    ))
      for (const child of node.childNodes)
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const b of range.getClientRects()) {
            let top = Infinity;
            for (let i = 0; i < 4; i++) {
              const [x1, y1] = roof[i],
                [x2, y2] = roof[(i + 1) % 4];
              for (let k = 0; k <= 80; k++) {
                const x = x1 + ((x2 - x1) * k) / 80;
                if (x >= b.left && x <= b.right)
                  top = Math.min(top, y1 + ((y2 - y1) * k) / 80);
              }
            }
            // DM Sans ascent is 0.992em: the baseline sits that far below the box top.
            const baseline = b.top + 0.992 * size;
            runs.push({
              text: child.textContent.trim(),
              rise: Number.isFinite(top) ? (baseline - top) / size : null,
            });
          }
        }
    return {
      runs,
      headingBottom: heading.getBoundingClientRect().bottom,
      roofTop: Math.min(...roof.map((p) => p[1])),
    };
  });

try {
  await page.goto(base, { waitUntil: "networkidle" });
  // Order: hero, services, about, how it works.
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("main > section")].map((s) => s.id),
    ),
    [
      "home",
      "services",
      "tentang-kami",
      "kenapa-kami",
      "testimoni",
      "how-it-works",
      "hubungi-kami",
    ],
  );
  assert.deepEqual(
    await page
      .getByRole("navigation", { name: "Navigasi utama" })
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((a) => [a.textContent.trim(), a.getAttribute("href")]),
      ),
    [
      ["Layanan", "#services"],
      ["Tentang kami", "#tentang-kami"],
      ["Testimoni", "#testimoni"],
      ["Cara kerja", "#how-it-works"],
    ],
  );
  assert.match(
    await page.locator("#company-heading").innerText(),
    /Menjadikan setiap\s+pengiriman lebih mudah\./,
  );
  const copy = await page.locator(".company-copy").innerText();
  for (const fact of ["PT Tiga Daya Terang", "Bekasi", "Jabodetabek"])
    assert(copy.includes(fact), `About copy mentions ${fact}`);
  const jsonLd = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerHTML(),
  );
  const org = jsonLd["@graph"].find((n) => n["@type"] === "Organization");
  assert.equal(org.legalName, "PT Tiga Daya Terang");
  assert.equal(org.address.addressLocality, "Bekasi");
  assert(org.areaServed.some((a) => a.name === "Jabodetabek"));

  await showAbout();
  const before = await state();
  await page.waitForTimeout(1200);
  const after = await state();
  assert(after.time > before.time, "About scene animates on its own");
  assert.notEqual(after.workerX, before.workerX, "Worker walks");
  assert.deepEqual(after.camera, before.camera, "Camera stays fixed");
  assert(after.drawCalls < 120, "Static geometry is batched");
  // Over one full loading round the worker both carries and sets down a box.
  const carrying = await page.evaluate(
    () =>
      new Promise((done) => {
        const seen = new Set(),
          start = performance.now();
        const tick = () => {
          seen.add(window.__relayAbout.carrying);
          if (performance.now() - start < 8300) requestAnimationFrame(tick);
          else done([...seen]);
        };
        tick();
      }),
  );
  assert.deepEqual(carrying.sort(), [false, true], "Box is loaded each round");

  for (const width of [1920, 1440, 1100, 820, 700]) {
    await page.setViewportSize({ width, height: 1000 });
    await showAbout();
    const { runs } = await roofAgainstHeading();
    const under = runs.filter((r) => r.rise !== null);
    assert(under.length > 0, `${width}px: roof sits under the heading`);
    for (const r of under)
      assert(
        r.rise <= 0.05,
        `${width}px: roof stays below the baseline of "${r.text}" (${r.rise.toFixed(2)}em)`,
      );
    assert(
      under.some((r) => r.rise > -0.25),
      `${width}px: roof tucks up to the second line`,
    );
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await showAbout();
    const { headingBottom, roofTop } = await roofAgainstHeading();
    assert(roofTop > headingBottom, `${width}px: no overlap with the heading`);
  }
  for (const width of [1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await showAbout();
    const fit = await page.evaluate(() => {
      const s = document
        .querySelector(".company-scene")
        .getBoundingClientRect();
      return Object.values(window.__relayAbout.parts).every(
        ([l, t, r, b]) => l >= 0 && t >= 0 && r <= s.width && b <= s.height,
      );
    });
    assert(fit, `${width}px: truck, parcels and worker stay inside the scene`);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px: no horizontal overflow`,
    );
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await showAbout();
  await page.getByRole("button", { name: "Diskusikan kiriman Anda" }).click();
  assert(await page.locator(".quote-dialog").isVisible(), "CTA opens the form");
  await page.keyboard.press("Escape");

  await page.locator("#home").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const away = await state();
  assert(!away.running, "Pauses when scrolled away");
  await page.waitForTimeout(400);
  assert.equal((await state()).time, away.time, "Clock stays frozen offscreen");
  await showAbout();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(250);
  assert(!(await state()).running, "Reduced motion honored");

  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "section order and navigation",
      "company copy and structured data",
      "worker loading loop, fixed camera",
      "roof tucks under the heading without covering letters",
      "no heading overlap on phones",
      "scene pieces fit at every width, no overflow",
      "CTA opens the form",
      "offscreen pause, reduced motion",
      "no browser or network errors",
    ],
    drawCalls: after.drawCalls,
  };
  await writeFile(
    "artifacts/about-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
