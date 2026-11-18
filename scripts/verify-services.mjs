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
    () => Object.keys(window.__relayServices || {}).length === 4,
  );
  await page.waitForTimeout(450);
};
try {
  const source = await readFile("app/page.tsx", "utf8"),
    previous = execFileSync(
      "git",
      ["show", "45b46d2f2ac819f9ec93847b3060ec4c1eaa2c73:app/page.tsx"],
      { encoding: "utf8" },
    );
  const hero = (s) =>
    s.slice(
      s.indexOf('<section className="hero"'),
      s.indexOf("</section>") + 10,
    );
  const normalizeBrand = (text) =>
    text
      .replaceAll("3 Daya Terang", "Relay")
      .replaceAll("3 DAYA TERANG", "RELAY")
      .replace(/\s+/g, " ");
  assert.equal(
    normalizeBrand(hero(source)),
    normalizeBrand(hero(previous)),
    "Hero layout is unchanged apart from branding",
  );
  assert.equal(
    await readFile("components/LogisticsScene.tsx", "utf8"),
    execFileSync(
      "git",
      [
        "show",
        "45b46d2f2ac819f9ec93847b3060ec4c1eaa2c73:components/LogisticsScene.tsx",
      ],
      { encoding: "utf8" },
    ),
    "Hero camera and animation are unchanged",
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await scrollToServices();
  assert.equal(await page.locator(".cargo-service-card").count(), 4);
  assert.match(
    await page.locator("#cargo-services-heading").innerText(),
    /We Provide Safe and\s+Reliable Cargo Solutions\./,
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
  for (const kind of ["road", "ocean", "air", "drone"]) {
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
    assert.deepEqual(
      after[kind].rootRotation,
      [0, 0, 0],
      `${kind} scene does not rotate`,
    );
  }
  await page.locator('[data-service="drone"]').hover();
  await page.waitForTimeout(650);
  const hover = await state();
  assert(hover.drone.speed > 1.4, "Hover accelerates smoothly");
  const arrow = page.getByRole("button", {
    name: "Enquire about Drone Parcel Delivery",
  });
  assert.equal(
    await arrow.evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(36, 40, 39)",
  );
  await arrow.click();
  assert(await page.locator("dialog").isVisible());
  assert.equal(
    await page.getByLabel("What do you need?").inputValue(),
    "Drone Parcel Delivery",
  );
  await page.keyboard.press("Escape");
  for (const [name, value] of [
    ["Road Transportation", "Road Transportation"],
    ["Ocean Freight", "Ocean Freight"],
    ["Air Freight", "Air Freight"],
  ]) {
    await page.getByRole("button", { name: `Enquire about ${name}` }).click();
    assert.equal(
      await page.getByLabel("What do you need?").inputValue(),
      value,
    );
    await page.keyboard.press("Escape");
  }
  await page.mouse.move(0, 0);
  await page
    .locator("#services")
    .screenshot({ path: "artifacts/services-desktop-final.png" });
  for (const [width, columns] of [
    [1440, 4],
    [820, 2],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("#services").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const grid = await page
      .locator(".cargo-service-grid")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    assert.equal(grid, columns, `${width}px grid columns`);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
    await page
      .locator("#services")
      .screenshot({ path: `artifacts/services-${width}-final.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#about").scrollIntoViewIfNeeded();
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
      "hero preserved",
      "directly below hero",
      "four independent animations",
      "fixed orthographic cameras",
      "hover acceleration and arrow",
      "all service CTA selections",
      "4/2/1 responsive grid",
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
