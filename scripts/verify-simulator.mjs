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
  const plus = page.getByRole("button", {
    name: `Tambah ${kind.toLowerCase()}`,
    exact: true,
  });
  const counter = page.getByLabel(`Jumlah ${kind.toLowerCase()}`);
  const before = Number(await counter.innerText());
  for (let i = 0; i < count; i++) await plus.click();
  assert.equal(
    await counter.innerText(),
    String(before + count),
    `${kind} counter goes up by ${count}`,
  );
}

try {
  const page = await open();
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("main > section")]
        .slice(0, 4)
        .map((s) => s.id),
    ),
    ["home", "tentang-kami", "services", "simulasi"],
    "Simulator sits right below the services",
  );
  // The link sits in the menu panel, which is closed (inert) until opened.
  assert.equal(
    (await page.locator('#menu-drawer nav a[href="#simulasi"]').textContent()).trim(),
    "Simulasi",
  );
  assert.equal(
    await page.locator(".loadsim-scene canvas").count(),
    0,
    "Scene waits until the section is near",
  );

  await show(page);
  let s = await sim(page);
  assert.equal(s.vehicle, null, "No vehicle before a choice");
  assert(
    await page.getByRole("button", { name: "Tambah palet", exact: true }).isDisabled(),
    "Add waits for a vehicle",
  );

  // Inter-island: the lane floods into a quay, then the ship sails in, ties
  // up and drops its side.
  await page.locator(".loadsim-vehicle", { hasText: "Antar pulau" }).click();
  await page.waitForFunction(
    () => {
      const s = window.__relaySim;
      return s?.phase === "away" && s.sea > 0 && s.sea < 1;
    },
    null,
    { polling: 16 },
  );
  await page.waitForFunction(() => window.__relaySim?.phase === "arriving");
  const arriving = await sim(page);
  assert.equal(arriving.sea, 1, "Lane flooded before the ship comes in");
  assert(arriving.x < 0, "Ship sails in from behind");
  await settled(page, "ship");
  s = await sim(page);
  assert.equal(s.x, 0, "Ship lies alongside the quay");
  assert.equal(s.wing, 1, "Drop side is down");
  assert.deepEqual(s.camera, arriving.camera, "Camera stays fixed");
  assert.equal(
    await page.locator(".loadsim-tag").innerText(),
    "KAPAL KARGO / 4,8 × 2,2 × 1,6 M",
  );

  await add(page, "Kardus sedang", 6);
  await page.waitForFunction(() => window.__relaySim?.moving > 0);
  await settled(page, "ship");
  s = await sim(page);
  assert.equal(s.inside, 6, "Six boxes on deck");
  assert.equal(
    await page.locator(".loadsim-meter-top strong").innerText(),
    "3%",
    "0,48 of 16,9 m³ in use",
  );
  await add(page, "Palet", 1);
  await settled(page, "ship");
  assert.equal((await sim(page)).inside, 7, "A pallet fits on deck");

  // To the truck: the load goes back to the quay, the ship sails off, the
  // water drains and the truck takes everything.
  await page.locator(".loadsim-vehicle", { hasText: "Barang besar" }).click();
  await page.waitForFunction(() => window.__relaySim?.phase === "unloading");
  await settled(page, "truck", 25000);
  s = await sim(page);
  assert.equal(s.sea, 0, "Water drained for the truck");
  assert.equal(s.runway, 0, "Plain road for the truck");
  assert.equal(s.inside, 7, "Everything packed into the truck");
  assert.equal(s.onPad, 0);

  // More pallets than the truck takes: they wait on the pad and the panel
  // offers a chat with the team.
  await add(page, "Palet", 6);
  await settled(page, "truck");
  s = await sim(page);
  assert(s.onPad > 0, "Left-over pallets wait on the pad");
  const alert = page.locator(".loadsim-alert");
  assert.match(await alert.innerText(), /barang tidak muat di truk/);
  assert(
    await alert.getByRole("link", { name: "Konsultasi armada" }).isVisible(),
    "Offers a chat with the team",
  );
  await page.getByRole("button", { name: "Kurangi satu palet" }).click();
  await settled(page, "truck");
  s = await sim(page);
  assert.equal(s.inside + s.onPad, 12, "Removed box leaves the load");
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

  // Fast shipping: the camera pulls back on an empty stage, then the plane
  // taxis in, opens its cargo door and takes pallets.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await show(page);
  await settled(page, "truck");
  const close = await sim(page);
  await page.locator(".loadsim-vehicle", { hasText: "Kirim cepat" }).click();
  await page.waitForFunction(
    () => window.__relaySim?.vehicle === "plane" && window.__relaySim.phase === "arriving",
    null,
    { timeout: 15000 },
  );
  const taxiing = await sim(page);
  assert(taxiing.frame >= 0, "Camera reframes before the plane arrives");
  assert.notEqual(taxiing.frame, close.frame, "The plane has its own framing");
  assert(taxiing.zoom < close.zoom * 0.95, "Wider framing for the plane");
  assert(taxiing.x < 0, "Plane taxis in from behind");
  assert.equal(taxiing.runway, 1, "Lane paved into a runway before the plane comes in");
  assert.equal(taxiing.sea, 0);
  await settled(page, "plane", 20000);
  s = await sim(page);
  assert.equal(s.wing, 1, "Cargo door is up");
  assert.deepEqual(s.camera, taxiing.camera, "Camera holds still while the plane moves");
  await add(page, "Palet", 2);
  await add(page, "Kardus besar", 4);
  await settled(page, "plane");
  s = await sim(page);
  assert.equal(s.inside, 6, "Pallets and boxes packed in the hold");
  assert.equal(
    await page.locator(".loadsim-tag").innerText(),
    "PESAWAT KARGO / 3,6 × 2,0 × 1,6 M",
  );
  for (const width of [1920, 1440, 1280, 1195]) {
    await page.setViewportSize({ width, height: 1000 });
    await show(page);
    await settled(page, "plane");
    const fit = await page.evaluate(() => {
      const c = document
        .querySelector(".loadsim-scene canvas")
        .getBoundingClientRect();
      const [l, t, r, b] = window.__relaySim.parts.vehicle;
      return l >= 0 && t >= 0 && r <= c.width && b <= c.height;
    });
    assert(fit, `${width}px: plane fits the stage`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await show(page);
  await page.getByRole("button", { name: "Kosongkan" }).click();
  await page.locator(".loadsim-vehicle", { hasText: "Antar pulau" }).click();
  await settled(page, "ship", 20000);
  s = await sim(page);
  assert.equal(s.frame, arriving.frame, "Back to the ship's framing");
  assert.equal(s.sea, 1, "Lane flooded again");
  assert.equal(s.runway, 0, "Runway gone under the water");
  assert.deepEqual(
    s.camera.map((v) => +v.toFixed(4)),
    arriving.camera.map((v) => +v.toFixed(4)),
    "Camera returns to where it was for the ship",
  );
  for (const width of [1920, 1440, 1280, 1195]) {
    await page.setViewportSize({ width, height: 1000 });
    await show(page);
    await settled(page, "ship");
    const fit = await page.evaluate(() => {
      const c = document
        .querySelector(".loadsim-scene canvas")
        .getBoundingClientRect();
      const [l, t, r, b] = window.__relaySim.parts.vehicle;
      return l >= 0 && t >= 0 && r <= c.width && b <= c.height;
    });
    assert(fit, `${width}px: ship fits the stage`);
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
  await still.locator(".loadsim-vehicle", { hasText: "Antar pulau" }).click();
  await settled(still, "ship", 1500);
  assert.equal((await sim(still)).sea, 1, "Flooding jumps to the end too");
  await still.locator(".loadsim-vehicle", { hasText: "Barang besar" }).click();
  await settled(still, "truck", 1500);
  assert.equal(
    await still.locator(".loadsim-panel a").count(),
    0,
    "No WhatsApp link in the panel while everything fits",
  );

  // More than the truck holds: the alert links to WhatsApp with the load.
  await add(still, "Palet", 7);
  const consult = still.getByRole("link", { name: "Konsultasi armada" });
  await consult.waitFor({ timeout: 1500 });
  const text = new URL(await consult.getAttribute("href")).searchParams.get("text");
  for (const line of [
    "Armada: Truk (truk box), terisi ±",
    "- Kardus besar (80 × 60 × 60 cm) × 3",
    "- Palet (120 × 80 × 130 cm) × 7",
    "belum muat di truk.",
  ])
    assert(text.includes(line), `WhatsApp message has "${line}"`);

  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "placement below services and navigation",
      "lazy loading and no vehicle before a choice",
      "lane floods, ship sails in, ties up and drops its side; fixed camera",
      "boxes and a pallet packed on deck, and the meter",
      "load moved to the truck as the ship leaves and the water drains",
      "left-over pallets on the pad, chat offered; removing and clearing",
      "WhatsApp message lists the load when the truck is full",
      "truck fits the stage at 1195-1920px, no overflow",
      "plane: lane becomes a runway, camera reframes, taxis in, door up, pallets packed, fits 1195-1920px",
      "camera returns to the ship framing, lane floods again; ship fits 1195-1920px",
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
