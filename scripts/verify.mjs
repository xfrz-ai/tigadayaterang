import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

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
const url = process.env.VERIFY_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__relayScene?.time > 0.3);
  const before = await page.evaluate(() => window.__relayScene);
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => window.__relayScene);
  assert(after.time > before.time, "Animation advances automatically");
  assert.notEqual(before.forkliftX, after.forkliftX, "Forklifts move");
  assert.notEqual(before.workerX, after.workerX, "Workers walk");
  assert.notEqual(before.doorScale, after.doorScale, "Doors animate");
  assert.deepEqual(before.camera, after.camera, "Isometric camera stays fixed");
  assert(after.drawCalls < 300, "Static geometry is batched");
  await page.getByRole("button", { name: "Jeda animasi", exact: true }).click();
  await page.waitForTimeout(200);
  const stopped = await page.evaluate(() => window.__relayScene.time);
  await page.waitForTimeout(400);
  assert.equal(
    stopped,
    await page.evaluate(() => window.__relayScene.time),
    "Pause freezes animation",
  );
  await page
    .getByRole("button", { name: "Putar animasi", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("link", { name: "Lihat layanan kami" })
      .getAttribute("href"),
    "#services",
  );
  await page
    .getByRole("button", { name: "Mulai kirim barang", exact: true })
    .click();
  assert(await page.locator(".quote-dialog").isVisible());
  await page.getByLabel("Nama Anda").fill("Budi Contoh");
  await page.getByLabel("Email kantor").fill("budi@example.com");
  await page.getByLabel("Dikirim dari").fill("Jakarta");
  await page.getByLabel("Tujuan pengiriman").fill("Bandung");
  await page
    .getByLabel("Ceritakan sedikit tentang kiriman Anda")
    .fill("Dua palet kemasan, siap minggu depan.");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Buat ringkasan pengiriman" }).click();
  const download = await downloaded;
  assert.equal(
    download.suggestedFilename(),
    "3-daya-terang-ringkasan-pengiriman.txt",
  );
  assert(await page.locator(".success-message").isVisible());
  await page.keyboard.press("Escape");
  assert(!(await page.locator(".quote-dialog").isVisible()));
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Buka menu" }).click();
  assert(
    await page.getByRole("navigation", { name: "Navigasi utama" }).isVisible(),
  );
  await page.getByRole("link", { name: "Layanan", exact: true }).click();
  // The menu slides away, then leaves the accessibility tree.
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .waitFor({ state: "hidden", timeout: 2000 });
  assert.equal(new URL(page.url()).hash, "#services");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__relayScene?.paused === true);
  assert(
    await page.getByRole("button", { name: "Putar animasi" }).isVisible(),
    "Reduced motion pauses automatically",
  );
  assert.deepEqual(errors, [], "No browser or network errors");
  const result = {
    passed: true,
    checks: [
      "automatic simultaneous animation",
      "fixed camera",
      "geometry batching",
      "pause/resume",
      "services link",
      "shipment brief download",
      "dialog keyboard dismissal",
      "desktop/tablet/mobile layout",
      "mobile navigation",
      "reduced motion",
      "browser/network errors",
    ],
    drawCalls: after.drawCalls,
    triangles: after.triangles,
  };
  await writeFile(
    "artifacts/verification.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
