import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
  page.evaluate(() => JSON.parse(JSON.stringify(window.__relayServices || {})));
const scrollToServices = async () => {
  await page.locator("#services").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => Object.keys(window.__relayServices || {}).length === 3,
  );
  await page.waitForTimeout(450);
};
try {
  const source = await readFile("app/page.tsx", "utf8");
  for (const removed of [
    "BETTER CONNECTED",
    "INSIDE THE 3 DAYA TERANG HUB",
    "A LITTLE FURTHER GOES A LONG WAY",
    "note-cross",
  ])
    assert(!source.includes(removed), `Hero no longer shows "${removed}"`);
  // Everything above the exported wrapper: imports, timing and the World
  // (camera and animation). The wrapper only holds the no-WebGL fallback copy.
  const heroWorld = (src) =>
    src.slice(0, src.indexOf("export default function LogisticsScene"));
  assert.equal(
    heroWorld(await readFile("components/LogisticsScene.tsx", "utf8")),
    heroWorld(
      execFileSync(
        "git",
        [
          "show",
          "45b46d2f2ac819f9ec93847b3060ec4c1eaa2c73:components/LogisticsScene.tsx",
        ],
        { encoding: "utf8" },
      ),
    ),
    "Hero camera and animation are unchanged",
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await scrollToServices();
  assert.equal(await page.locator(".cargo-service-card").count(), 3);
  assert.equal(
    await page.locator('[data-service="drone"]').count(),
    0,
    "Drone service is hidden",
  );
  assert.equal(
    await page.locator("option", { hasText: "Drone" }).count(),
    0,
    "Drone is not offered in the enquiry form",
  );
  assert.match(
    await page.locator("#cargo-services-heading").innerText(),
    /Solusi Kargo yang Aman\s+dan Bisa Diandalkan\./,
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".hero").nextElementSibling.id,
    ),
    "services",
  );
  const before = await state();
  await page.waitForTimeout(900);
  const after = await state();
  for (const kind of ["road", "ocean", "air"]) {
    assert(after[kind].running, `${kind} runs automatically`);
    assert(after[kind].time > before[kind].time, `${kind} clock advances`);
    assert.notEqual(
      after[kind].motion,
      before[kind].motion,
      `${kind} moving detail animates`,
    );
    assert.deepEqual(
      after[kind].camera,
      before[kind].camera,
      `${kind} camera stays fixed`,
    );
    assert.equal(after[kind].travel, 0, `${kind} rests in the centre`);
    assert.deepEqual(
      after[kind].rootRotation,
      [0, 0, 0],
      `${kind} scene does not rotate`,
    );
  }
  // Hover drive-through: out ahead (+), back in from behind (-), rest at 0.
  const sampleTrip = (kind, ms) =>
    page.evaluate(
      ([kind, ms]) =>
        new Promise((done) => {
          const samples = [],
            start = performance.now();
          const tick = () => {
            samples.push(window.__relayServices[kind].travel);
            if (performance.now() - start < ms) requestAnimationFrame(tick);
            else done(samples);
          };
          tick();
        }),
      [kind, ms],
    );
  const tripsBefore = (await state()).air.trips;
  await page.locator('[data-service="air"]').hover();
  const samples = await sampleTrip("air", 2000);
  const firstOut = samples.findIndex((v) => v > 0.5),
    firstIn = samples.findIndex((v) => v < -0.5);
  assert(firstOut >= 0, "Vehicle drives forward out of the card");
  assert(firstIn > firstOut, "Vehicle re-enters from behind after leaving");
  assert.equal(samples.at(-1), 0, "Vehicle settles back in the centre");
  const hover = await state();
  assert.equal(hover.air.trips, tripsBefore + 1, "One trip per hover");
  assert(hover.air.speed > 1.4, "Hover accelerates smoothly");
  assert(
    hover.road.travel === 0 && hover.ocean.travel === 0,
    "Only the hovered card's vehicle moves",
  );
  await page.waitForTimeout(1200);
  const stillHovered = await state();
  assert.equal(stillHovered.air.trips, tripsBefore + 1, "Trip does not repeat");
  assert.equal(stillHovered.air.travel, 0, "Vehicle stays in the centre");
  const arrow = page.getByRole("button", {
    name: "Tanya layanan Kargo Udara",
  });
  assert.equal(
    await arrow.evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(36, 40, 39)",
  );
  await arrow.click();
  assert(await page.locator(".quote-dialog").isVisible());
  assert.equal(
    await page.getByLabel("Layanan yang dibutuhkan").inputValue(),
    "Kargo Udara",
  );
  await page.keyboard.press("Escape");
  for (const [name, value] of [
    ["Transportasi Darat", "Transportasi Darat"],
    ["Kargo Laut", "Kargo Laut"],
  ]) {
    await page.getByRole("button", { name: `Tanya layanan ${name}` }).click();
    assert.equal(
      await page.getByLabel("Layanan yang dibutuhkan").inputValue(),
      value,
    );
    await page.keyboard.press("Escape");
  }
  // The last enquiry leaves focus on its arrow, which keeps that card engaged.
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1800);
  assert(
    Object.values(await state()).every((s) => s.travel === 0),
    "Vehicles are back in the centre after hover",
  );
  for (const [width, columns] of [
    [1440, 3],
    [820, 2],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("#services").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const boxes = await page
      .locator(".cargo-service-card")
      .evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      );
    const firstRow = boxes.filter((b) => Math.abs(b.top - boxes[0].top) < 2);
    assert.equal(firstRow.length, columns, `${width}px cards per row`);
    if (columns === 2) {
      const grid = await page
        .locator(".cargo-service-grid")
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      const last = boxes.at(-1);
      assert(
        Math.abs(last.left + last.width / 2 - (grid.left + grid.width / 2)) < 2,
        "Odd last card is centred",
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#hubungi-kami").scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  const offscreen = await state();
  assert(
    Object.values(offscreen).every((s) => !s.running),
    "All offscreen cards pause",
  );
  await page.waitForTimeout(500);
  const still = await state();
  for (const kind of Object.keys(still))
    assert.equal(
      still[kind].time,
      offscreen[kind].time,
      "Offscreen clocks stay frozen",
    );
  await scrollToServices();
  assert(
    Object.values(await state()).every((s) => s.running),
    "Visible cards resume",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(250);
  assert(
    Object.values(await state()).every((s) => !s.running),
    "Reduced motion honored",
  );
  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "hero copy trimmed, 3D scene unchanged",
      "directly below hero",
      "drone hidden from cards and form",
      "three independent animations",
      "fixed orthographic cameras",
      "hover drive-through: out ahead, in from behind, once",
      "hover acceleration and arrow",
      "all service CTA selections",
      "3 / 2+1 centred / 1 responsive grid",
      "offscreen pause and resume",
      "reduced motion",
      "no browser or network errors",
    ],
    drawCalls: Object.fromEntries(
      Object.entries(after).map(([key, v]) => [key, v.drawCalls]),
    ),
  };
  await writeFile(
    "artifacts/services-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
