import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// The services journey: numeric and DOM checks only, no screenshots.
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
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(base, { waitUntil: "networkidle" });
  return page;
}
/** Scrolls to progress `p` through the pinned track and lets the ride settle. */
async function scrollTrack(page, p, wait = 2200) {
  await page.evaluate((p) => {
    const t = document.querySelector(".journey-track");
    const top = t.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + p * (t.offsetHeight - innerHeight), behavior: "instant" });
  }, p);
  await page.waitForFunction(() => window.__relayJourney, null, { timeout: 15000 });
  await page.waitForTimeout(wait);
}
/** The journey's state and what each stop shows. */
const look = (page) =>
  page.evaluate(() => {
    const j = window.__relayJourney;
    const stops = [...document.querySelectorAll(".journey-stop")].map((el) => ({
      kind: el.dataset.service,
      opacity: +getComputedStyle(el).opacity,
    }));
    const pin = document.querySelector(".journey-pin").getBoundingClientRect();
    const current = document.querySelector(".journey-steps [aria-current]");
    return {
      x: j.x,
      s: j.s,
      zoom: j.zoom,
      clock: j.clock,
      stops,
      pinned: Math.abs(pin.top) < 1 && Math.abs(pin.height - innerHeight) < 1,
      current: current ? current.textContent.trim() : null,
    };
  });
// Mid-stop scroll progress (journey-timeline stopProgress).
const STOP_AT = [0.17, 0.47, 0.77];
const NAMES = ["Transportasi Darat", "Kargo Laut", "Kargo Udara"];

try {
  const page = await open({ width: 1440, height: 900 });
  // Straight after About, with the heading and three stops, drone hidden.
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("main > section")].slice(1, 3).map((s) => s.id),
    ),
    ["tentang-kami", "services"],
    "Services follow About",
  );
  assert.match(
    await page.locator("#journey-heading").innerText(),
    /Solusi Kargo yang Aman\s+dan Bisa Diandalkan\./,
  );
  assert.deepEqual(
    await page.locator(".journey-stop h3").allTextContents(),
    NAMES,
    "Three stops, in order",
  );
  assert.equal(await page.locator('[data-service="drone"]').count(), 0, "Drone hidden");
  assert.equal(await page.locator(".journey-card a").count(), 0, "No buttons in the cards");

  // Start: zoomed out on the road, no stop shown.
  await scrollTrack(page, 0);
  const start = await look(page);
  assert(start.pinned, "Journey pinned to the screen");
  assert(start.stops.every((s) => s.opacity === 0), "No stop shown at the start");
  const zoom = start.zoom;

  // Each stop: the same zoom, and only that stop's text shows.
  const atStops = [];
  for (const [i, p] of STOP_AT.entries()) {
    await scrollTrack(page, p);
    const at = await look(page);
    atStops.push(at);
    assert(at.pinned, `Stop ${i + 1}: pinned`);
    assert(Math.abs(at.x - (i + 1)) < 0.01, `Stop ${i + 1}: journey there`);
    assert.equal(at.zoom, zoom, `Stop ${i + 1}: no zooming in`);
    at.stops.forEach((s, j) =>
      assert.equal(s.opacity, i === j ? 1 : 0, `Stop ${i + 1}: only its text shows`),
    );
    assert.match(at.current, new RegExp(["Darat", "Laut", "Udara"][i]), "Step marked");
  }
  assert(
    atStops[0].s < atStops[1].s && atStops[1].s < atStops[2].s,
    "The vehicle moves on along the route",
  );
  // Between stops: the same zoom, nothing explained.
  await scrollTrack(page, 0.32);
  const between = await look(page);
  assert.equal(between.zoom, zoom, "No zooming out between stops");
  assert(between.stops.every((s) => s.opacity === 0), "No stop shown on the way");
  assert(between.s > atStops[0].s && between.s < atStops[1].s, "On the way to stop 2");

  // The step buttons glide to a stop.
  await scrollTrack(page, STOP_AT[0]);
  await page.getByRole("button", { name: "Udara", exact: true }).click();
  await page.waitForTimeout(3500);
  const jumped = await look(page);
  assert(Math.abs(jumped.x - 3) < 0.05, "Step button goes to its stop");

  // Off screen the scene stops animating.
  await page.locator("#hubungi-kami").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const away = (await look(page)).clock;
  await page.waitForTimeout(600);
  assert.equal((await look(page)).clock, away, "Paused off screen");
  await page.close();

  // Phones: the name above the vehicle, the card below, nothing overflowing.
  const phone = await open({ width: 390, height: 844 });
  await scrollTrack(phone, STOP_AT[0]);
  const layout = await phone.evaluate(() => {
    const stop = document.querySelector('.journey-stop[data-service="road"]');
    const title = stop.querySelector("h3").getBoundingClientRect();
    const card = stop.querySelector(".journey-card").getBoundingClientRect();
    const steps = document.querySelector(".journey-steps").getBoundingClientRect();
    const header = document.querySelector(".header").getBoundingClientRect();
    return {
      order: header.bottom <= title.top && title.bottom < card.top && card.bottom < steps.top,
      inside: card.left >= 0 && card.right <= innerWidth && steps.right <= innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert(layout.order, "390px: header, name, card, steps from top to bottom");
  assert(layout.inside && !layout.overflow, "390px: nothing overflows");
  await phone.close();

  // Reduced motion: no travel, one stop after another; nothing animates.
  const still = await open({ width: 1440, height: 900 }, { reducedMotion: "reduce" });
  await scrollTrack(still, 0.32, 800);
  const a = await look(still);
  assert.equal(a.x, 1, "Reduced motion: still at the first stop");
  assert.equal(a.stops[0].opacity, 1, "Reduced motion: its text shown");
  await scrollTrack(still, 0.5, 800);
  assert.equal((await look(still)).x, 2, "Reduced motion: then the next stop");
  assert.equal((await look(still)).clock, 0, "Reduced motion: nothing animates");
  await still.close();

  assert.deepEqual(errors, [], "No browser errors or missing assets");
  const report = {
    passed: true,
    checks: [
      "follows About; heading, three stops in order, drone hidden",
      "cards hold the explanation only, no button",
      "pinned; starts with no stop shown",
      "each stop: only its text shows, step marked",
      "one zoom throughout; between stops nothing shown, vehicle moves on",
      "step buttons go to a stop",
      "paused off screen",
      "phones: name above, card below, no overflow",
      "reduced motion: stop to stop, no animation",
    ],
  };
  await writeFile("artifacts/services-verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
