import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Renders the social share card (WhatsApp, Facebook, LinkedIn, X) from the
// live hero: same headline, same 3D scene. The nav, paragraph and buttons are
// hidden and the site address is shown in their place. Run it against a
// running site after changing the hero, then commit public/og.png:
//   npm run dev  →  node scripts/make-og.mjs
const base = process.env.OG_URL || "http://localhost:3000";
const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
const W = 1200;
const H = 630;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      .hero { height: ${H}px !important; min-height: 0 !important; }
      .nav, .header-cta, .menu-toggle, .hero-copy > p, .hero-actions,
      nextjs-portal { display: none !important; }
      .header::after {
        content: "3dayaterang.id";
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }
      .hero-copy { margin-top: 18px !important; }
      .hero-copy h1 {
        font-size: 90px !important;
        letter-spacing: -5px !important;
        margin: 18px 0 0 !important;
      }
      .scene { top: 335px !important; bottom: -60px !important; }
    `,
  });
  await page.waitForSelector(".scene.is-ready", { timeout: 60000 });
  // Let the canvas fade in and the vehicles move into a busy frame.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
