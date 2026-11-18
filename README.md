# 3 Daya Terang — Barang tiba. Bisnis melaju.

The landing page for 3 Daya Terang (https://3dayaterang.id). All visitor-facing copy is in Indonesian. A responsive logistics landing page in Next.js, React Three Fiber, and Three.js. All hero objects are procedural geometry rendered live in WebGL; no models, hero images, or video assets are used.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run build` for a static production export in `out/`. This export can be deployed to any static host. The included Sites manifest uses `out`.

## Scene

- Fixed orthographic camera with responsive framing.
- Custom extruded truck cabins, glazing, mirrors, grilles, tires, wheel hubs, cargo bodies, and open-sided trailers.
- Warehouse with recessed loading bays, animated roller doors, roof equipment, solar arrays, and facade signage.
- Moving forklifts with lifting cargo, walking workers with animated limbs, pallets, parcels, road markings, and a dispatch building.
- Independent continuous loops. Trucks ease to a stop and depart, with wheel rotation calculated from distance traveled. Offscreen wrapping keeps route restarts out of view.
- Toon materials, a three-step shading ramp, black geometry outlines, and restrained contact shadows.
- Static geometry batched by material; pixel density capped at 1.75. Rendering pauses when the scene is offscreen or the tab is hidden. Reduced-motion preferences start the scene paused.

`components/models.ts` contains model construction and batching. `components/LogisticsScene.tsx` owns the camera and animation. `app/page.tsx` contains the HTML interface. `app/globals.css` contains responsive styling. DM Sans is self-hosted under its included SIL Open Font License.

## Interactions

Navigation links scroll to real sections. On tablets and phones (up to 1194px, which covers every iPad except the 12.9-inch in landscape) the header stays fixed at the top and tightens after scrolling, and the section links move into a panel that slides in from the right (`components/MenuDrawer.tsx`: logo, links, social icons at the bottom; Escape or the backdrop closes it); `node scripts/verify-header.mjs` checks it. The hero's "Lihat layanan kami" link jumps to the services. The pause control works independently of the animation. The enquiry modal creates a downloadable shipment brief locally. No enquiry is sent and no data is stored or sent to a backend; connect a real business endpoint before using it to receive leads.

## Verification

```sh
npm run typecheck
npm run build
node scripts/verify.mjs
```

Browser verification requires Google Chrome and a running local server. Set `VERIFY_URL` to test another origin. The script checks simultaneous animation, a fixed camera, rendering calls, pause/resume, reduced motion, navigation, responsive overflow, dialog behavior, download generation, and browser errors. Results are written as JSON to ignored `artifacts/`; no screenshots are taken.

## Animated service cards

The Services section directly below the hero presents road transportation (Transportasi Darat), ocean freight (Kargo Laut), and air freight (Kargo Udara). Service copy lives in `components/service-data.ts`, shared by the cards, the enquiry form and the structured data; drone delivery is defined there but hidden (`available: false`) until it launches. `components/Services.tsx` contains the responsive HTML cards; `ServiceIllustration.tsx` manages each orthographic view; `service-models.ts` builds and animates the vehicles. The road card reuses the hero's truck, and all four share the original toon material and outline system. Shipping containers reuse cached geometries.

Each card loads as it approaches the viewport, runs independently while visible, and pauses offscreen, when the tab is hidden, or when reduced motion is enabled. Hover or keyboard focus sends the vehicle once out of the card ahead of it and back in from behind, speeds up the animation, and highlights the enquiry button. The ocean card has a dolphin leaping alongside the ship. Selecting a service opens the existing shipment brief with that service selected.

Run `node scripts/verify-services.mjs` against the dev server (or set `VERIFY_URL`) to check animation, hover, service selection, responsive columns, offscreen pausing, reduced motion, and preservation of the original hero.

## About section (Tentang Kami)

The company introduction for PT Tiga Daya Terang (based in Bekasi, serving Jabodetabek) sits between the services and how-it-works sections. `components/About.tsx` holds the copy and layout. `AboutScene.tsx` frames the scene from the same isometric direction as the service cards, and `about-model.ts` builds it: an open-sided box truck with loaded pallets, a stack of parcels, and a worker who carries a box from the stack into the truck on an 8-second loop. The truck reuses the shared chassis and cab (`truckChassis` and `truckWheels` in `models.ts`).

On desktop and tablet the truck's roof corner tucks under the second heading line without covering letters. The heading and the scene both scale with the container width (`cqw` units), so the overlap holds at every size. On phones the scene sits below the heading.

Run `node scripts/verify-about.mjs` to check section order and navigation, copy and structured data, the loading loop, the heading overlap at several widths, scene fit, the CTA, offscreen pausing, and reduced motion.

## Reasons to choose us (Kenapa memilih kami)

`components/WhyUs.tsx` follows the about section: an intro with a call to action, and four reasons in two staggered columns (one column below 900px). The icons are isometric SVG drawings built with `components/iso.tsx`, which projects simple 3D boxes, decals and paths with the same camera direction as the WebGL scenes, so they match the 3D style without extra canvases. The clock hand on the first icon turns slowly and stops for reduced motion.

Run `node scripts/verify-why.mjs` to check placement, the icons, layout at 320–1920px, the animation and the CTA.

## Testimonials (Testimoni)

`components/Testimonials.tsx` shows the reviews in `components/testimonial-data.ts`, one at a time. Each review has two shipment photos from `public/images/pengiriman/`. The square buttons switch reviews; the hidden review is `inert`. Clicking a photo opens a gallery dialog that steps through all photos with buttons or the arrow keys.

**The quotes, names and ratings are draft sample copy.** Replace them with real customer reviews, with the customer's permission, before launch. They are deliberately left out of the structured data.

Run `node scripts/verify-testimonials.mjs` to check placement, layout at 320–1920px, the header, review switching and the gallery.

## Call to action (Hubungi kami)

`components/Contact.tsx` is the last section before the footer: a brand-red panel with the invitation copy and a "Hubungi kami" button (it opens the same enquiry form as the header button), beside a 3D scene. `contact-model.ts` builds a black-and-red box truck parked facing the copy, with a loaded pallet and two loose boxes at the kerb; `ContactScene.tsx` frames it like the other scenes. The truck idles with small exhaust puffs. Shadows and lane lines skip tone mapping so their reds match the CSS panel. Below 900px the scene moves under the copy.

The scenes share `use-lazy-scene.ts` (load near the viewport, pause offscreen, when the tab is hidden or for reduced motion) and `scene-frame.ts` (camera fitting and layout diagnostics).

Run `node scripts/verify-contact.mjs` to check placement, the panel colour, lazy loading, layout at 320–1920px, the CTA, offscreen pausing and reduced motion.

## Footer

`components/Footer.tsx`: the brand and social icons on top, then the office address with a Google Maps link, two columns of links (page sections; services, the quote form and the contact section) and the office and WhatsApp numbers, then the copyright line. The address, phone numbers and social profiles are constants in `lib/site.ts`, shared with the structured data. Icons are Simple Icons glyphs (CC0) in `components/icons.tsx`.

**The social icons link to each platform's home page until the company's profile URLs are added** to `SOCIAL` in `lib/site.ts`. Add them to the Organization's `sameAs` in `app/layout.tsx` at the same time.

Run `node scripts/verify-footer.mjs` to check the content and links, the structured data, and the layout at 320–1920px.

## SEO

- Site constants (domain, legal name, location, service area, title, description, keywords) are in `lib/site.ts`. Change the domain there.
- `app/layout.tsx` sets `lang="id"`, the title and description, canonical URL, Open Graph and X cards, robots directives, and JSON-LD (`Organization` with legal name, street address in Bekasi, office and WhatsApp numbers, Jabodetabek service area and the service catalogue, `WebSite`, `WebPage`).
- Generated at build time: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, the 1200×630 share image `/og.png`, and `/apple-touch-icon.png`. These use `dynamic = "force-static"` because the site is a static export.
- After deploying, verify the domain in Google Search Console and submit `https://3dayaterang.id/sitemap.xml`.

## Deploy to Cloudflare Workers

The site is a static export served as Workers static assets (`wrangler.jsonc` points at `out/`, no Worker script).

In Cloudflare: **Workers & Pages → Create → Import a repository**, select this repo, then set:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Node 22 is pinned in `.node-version`. `public/_headers` sets long-lived caching for `/_next/static/*` and `/fonts/*`. Unknown paths serve `404.html`.
