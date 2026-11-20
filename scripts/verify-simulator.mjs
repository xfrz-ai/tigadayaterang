import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Numeric checks only: no screenshots are taken.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const base = process.env.VERIFY_URL || "http://localhost:3000";
const errors = [];
async function open(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
    ...options,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(base, { waitUntil: "networkidle" });
  return page;
}
const sim = (page) =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__relaySim ?? null)));
const show = async (page) => {
  await page.evaluate(() => document.querySelector("#simulasi").scrollIntoView());
  await page.waitForFunction(() => window.__relaySim);
};
/** Waits until the given vehicle is parked, open, and no box is moving. */
const settled = (page, vehicle, timeout = 15000) =>
  page.waitForFunction(
    (v) => {
      const s = window.__relaySim;
      return s && s.vehicle === v && s.phase === "ready" && s.moving === 0;
    },
    vehicle,
    { timeout },
  );
async function add(page, kind, count) {
  await page.locator(".loadsim-kind", { hasText: kind }).click();
  await page.getByLabel("Jumlah barang").fill(String(count));
  await page.locator(".loadsim-submit").click();
}
const chatText = async (page) =>
  new URL(
    await page.locator(".loadsim-actions a").getAttribute("href"),
  ).searchParams.get("text");

try {
  const page = await open();
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("main > section")]
        .slice(0, 3)
        .map((s) => s.id),
    ),
    ["home", "services", "simulasi"],
    "Simulator sits right below the services",
  );
  assert.equal(
    await page
      .getByRole("navigation", { name: "Navigasi utama" })
      .getByRole("link", { name: "Simulasi" })
      .getAttribute("href"),
    "#simulasi",
  );
  assert.equal(
    await page.locator(".loadsim-scene canvas").count(),
    0,
    "Scene waits until the section is near",
  );

  await show(page);
  let s = await sim(page);
  assert.equal(s.vehicle, null, "No vehicle before a choice");
  assert(await page.locator(".loadsim-submit").isDisabled(), "Add waits for a vehicle");

  // Small goods: the van drives in and opens.
  await page.locator(".loadsim-vehicle", { hasText: "Barang kecil" }).click();
  await page.waitForFunction(() => window.__relaySim?.phase === "arriving");
  const arriving = await sim(page);
  assert(arriving.x < 0, "Van drives in from behind");
  await settled(page, "van");
  s = await sim(page);
  assert.equal(s.x, 0, "Van parks in the bay");
  assert.equal(s.wing, 1, "Van side is lifted");
  assert.deepEqual(s.camera, arriving.camera, "Camera stays fixed");

  await add(page, "Kardus sedang", 6);
  await page.waitForFunction(() => window.__relaySim?.moving > 0);
  await settled(page, "van");
  s = await sim(page);
  assert.equal(s.inside, 6, "Six boxes packed inside the van");
  assert.equal(
    await page.locator(".loadsim-meter-top strong").innerText(),
    "13%",
    "0,48 of 3,7 m³ in use",
  );

  // A pallet is taller than the van: it waits on the pad and the truck is offered.
  await add(page, "Palet", 1);
  await settled(page, "van");
  s = await sim(page);
  assert.equal(s.inside, 6);
  assert.equal(s.onPad, 1, "Pallet left on the pad");
  const alert = page.locator(".loadsim-alert");
  assert.match(await alert.innerText(), /1 barang tidak muat di van/);
  assert.match(await chatText(page), /Catatan: 1 barang belum muat di van\./);

  await alert.getByRole("button", { name: "Ganti ke truk" }).click();
  await page.waitForFunction(() => window.__relaySim?.phase === "unloading");
  await settled(page, "truck", 20000);
  s = await sim(page);
  assert.equal(s.inside, 7, "Everything packed into the truck");
  assert.equal(s.onPad, 0);
  assert.equal(await alert.count(), 0, "Nothing left over");
  const text = await chatText(page);
  for (const line of [
    "Armada: Truk (truk box), terisi ±",
    "- Kardus sedang (50 × 40 × 40 cm) × 6",
    "- Palet (120 × 80 × 130 cm) × 1",
  ])
    assert(text.includes(line), `WhatsApp message has "${line}"`);

  // Without the pallet the van would do, and the panel says so.
  await page.getByRole("button", { name: "Kurangi satu palet" }).click();
  await settled(page, "truck");
  assert.equal((await sim(page)).inside, 6, "Removed box leaves the truck");
  assert(
    await page.getByRole("button", { name: "Pakai van" }).isVisible(),
    "Suggests the smaller vehicle",
  );
  await page.getByRole("button", { name: "Kosongkan" }).click();
  await settled(page, "truck");
  s = await sim(page);
  assert.equal(s.inside + s.onPad, 0, "Clearing empties the truck");
  assert(s.drawCalls < 120, `Batched draw calls (${s.drawCalls})`);

  // Parked truck stays inside the stage, without page overflow.
  for (const width of [1920, 1440, 1280, 1195]) {
    await page.setViewportSize({ width, height: 1000 });
    await show(page);
    await settled(page, "truck");
    const fit = await page.evaluate(() => {
      const c = document
        .querySelector(".loadsim-scene canvas")
        .getBoundingClientRect();
      const [l, t, r, b] = window.__relaySim.parts.vehicle;
      return l >= 0 && t >= 0 && r <= c.width && b <= c.height;
    });
    assert(fit, `${width}px: truck fits the stage`);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px: no horizontal overflow`,
    );
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#home").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__relaySim?.running === false);

  // Desktop only: phones, tablets and touch screens get neither the section,
  // its links, nor the 3D scene.
  for (const options of [
    { viewport: { width: 1194, height: 834 } },
    { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true },
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    { viewport: { width: 1366, height: 1024 }, hasTouch: true, isMobile: true },
  ]) {
    const small = await open(options);
    const label = `${options.viewport.width}px${options.hasTouch ? " touch" : ""}`;
    assert(await small.locator("#simulasi").isHidden(), `${label}: simulator hidden`);
    const shown = await small.evaluate(() =>
      [...document.querySelectorAll('a[href="#simulasi"]')].filter(
        (a) => a.getClientRects().length,
      ).length,
    );
    assert.equal(shown, 0, `${label}: no links to the simulator`);
    await small.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await small.waitForTimeout(500);
    assert.equal(
      await small.locator(".loadsim-scene canvas").count(),
      0,
      `${label}: 3D scene never loads`,
    );
    await small.context().close();
  }

  // Reduced motion: every change lands at once.
  const still = await open({ reducedMotion: "reduce" });
  await show(still);
  await still.locator(".loadsim-vehicle", { hasText: "Barang besar" }).click();
  await settled(still, "truck", 1500);
  await add(still, "Kardus besar", 3);
  await still.waitForFunction(() => window.__relaySim?.inside === 3, null, {
    timeout: 1500,
  });
  assert.equal((await sim(still)).running, false, "Reduced motion honored");

  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "placement below services and navigation",
      "lazy loading and no vehicle before a choice",
      "van drives in, parks and lifts its side; fixed camera",
      "boxes packed inside and the meter",
      "pallet left over, truck offered, load moved to the truck",
      "WhatsApp message lists the load",
      "removing, van suggestion and clearing",
      "truck fits the stage at 1195-1920px, no overflow",
      "hidden with its links and scene on phones, tablets and touch screens",
      "pauses offscreen; reduced motion jumps to the end",
    ],
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/simulator-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
