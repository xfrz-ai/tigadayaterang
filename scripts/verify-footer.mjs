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
const footer = page.locator("footer.footer");

try {
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#hubungi-kami").nextElementSibling.tagName,
    ),
    "FOOTER",
  );
  assert.match(await footer.locator(".brand").innerText(), /Tiga Daya Terang/);

  // Social links: Facebook, Threads, Instagram, each a drawn glyph.
  const social = await footer.locator(".footer-social a").evaluateAll((as) =>
    as.map((a) => {
      const box = a.querySelector("path").getBBox();
      const r = a.getBoundingClientRect();
      return {
        name: a.getAttribute("aria-label"),
        newTab: a.target === "_blank" && a.rel.includes("noopener"),
        glyph: box.width > 20 && box.height > 20,
        target: Math.min(r.width, r.height),
      };
    }),
  );
  assert.deepEqual(
    social.map((s) => s.name),
    ["Facebook", "Threads", "Instagram"],
  );
  for (const s of social) {
    assert(s.newTab, `${s.name} opens in a new tab`);
    assert(s.glyph, `${s.name} icon draws`);
    assert(s.target >= 40, `${s.name} has a 40px tap target`);
  }

  const address = await footer.locator("address").innerText();
  for (const part of [
    "Ruko Green Village No. 3",
    "Jl. Sirojul Munir RT 010 RW 03",
    "Jatisari, Jatiasih, Kota Bekasi",
    "Jawa Barat 17426",
  ])
    assert(address.includes(part), `Address shows ${part}`);
  const map = await footer
    .getByRole("link", { name: "Lihat di peta" })
    .getAttribute("href");
  assert(
    map.startsWith("https://www.google.com/maps/search/?api=1&query=") &&
      decodeURIComponent(map).includes("Jl. Sirojul Munir"),
    "Map link searches the address",
  );
  assert.equal(
    await footer
      .getByRole("link", { name: "(021) 2928 4542" })
      .getAttribute("href"),
    "tel:+622129284542",
  );
  assert.equal(
    await footer
      .getByRole("link", { name: "0821 1494 4419" })
      .getAttribute("href"),
    "https://wa.me/6282114944419",
  );
  assert.equal(
    (await footer.locator(".footer-bottom small").innerText()).trim(),
    "Copyright © 2024 PT Tiga Daya Terang",
  );
  // Every in-page footer link lands on a real section.
  const missing = await footer
    .locator('.footer-nav a[href^="#"]')
    .evaluateAll((as) =>
      as
        .map((a) => a.getAttribute("href"))
        .filter((h) => !document.querySelector(h)),
    );
  assert.deepEqual(missing, [], "Footer links point at real sections");

  // Structured data carries the street address and phone numbers.
  const jsonLd = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerHTML(),
  );
  const org = jsonLd["@graph"].find((n) => n["@type"] === "Organization");
  assert(org.address.streetAddress.includes("Sirojul Munir"));
  assert.equal(org.address.postalCode, "17426");
  assert.equal(org.telephone, "+62-21-2928-4542");
  assert(
    org.contactPoint.some(
      (c) => c.name === "WhatsApp" && c.telephone === "+62-821-1494-4419",
    ),
  );

  const layouts = {};
  for (const width of [1920, 1440, 1100, 1000, 820, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await footer.scrollIntoViewIfNeeded();
    const r = await page.evaluate(() => {
      const R = (sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      };
      const panel = R(".contact-panel");
      const children = [...document.querySelectorAll(".footer *")].map((el) =>
        el.getBoundingClientRect(),
      );
      return {
        brand: R(".footer .brand"),
        social: R(".footer-social"),
        address: R(".footer-address"),
        nav: R(".footer-nav"),
        contact: R(".footer-contact"),
        line: R(".footer-top"),
        panel,
        inside: children.every(
          (b) => b.width === 0 || (b.left >= 0 && b.right <= innerWidth),
        ),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const { brand, social: so, address: a, nav: n, contact: c } = r;
    const sameRow = (x, y) => Math.abs(x.top - y.top) <= 2;
    if (width > 1000) {
      assert(
        sameRow(a, n) &&
          sameRow(n, c) &&
          a.right <= n.left &&
          n.right <= c.left,
        `${width}px: address, links and contact in one row`,
      );
    } else if (width > 700) {
      assert(
        sameRow(a, c) && a.right <= c.left && n.top >= a.bottom,
        `${width}px: address beside contact, links below`,
      );
    } else {
      assert(
        a.bottom <= c.top && c.bottom <= n.top,
        `${width}px: address, contact, then links`,
      );
    }
    assert(
      brand.right <= so.left || brand.bottom <= so.top,
      `${width}px: brand and social icons do not collide`,
    );
    assert(
      Math.abs(r.line.left - r.panel.left) <= 1 &&
        Math.abs(r.line.right - r.panel.right) <= 1,
      `${width}px: footer lines up with the contact panel`,
    );
    assert(r.inside, `${width}px: footer content stays on screen`);
    assert(!r.overflow, `${width}px: no horizontal overflow`);
    layouts[width] =
      width > 1000 ? "one row" : width > 700 ? "two rows" : "stacked";
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await footer.getByRole("button", { name: "Minta penawaran" }).click();
  assert(await page.locator(".quote-dialog").isVisible(), "Quote opens form");
  await page.keyboard.press("Escape");

  assert.deepEqual(errors, [], "No browser errors");
  const report = {
    passed: true,
    checks: [
      "footer follows the call to action",
      "brand, Facebook / Threads / Instagram icons with tap targets",
      "address, map link, office phone and WhatsApp links",
      "copyright line",
      "footer links reach real sections; quote button opens the form",
      "structured data: street address, postal code, phones",
      "layout at 320-1920px, aligned with the panel, no overflow",
    ],
    layouts,
  };
  await writeFile(
    "artifacts/footer-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
