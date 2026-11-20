# 3 Daya Terang — Kirim aman. Tarif bersahabat.

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

## Load simulator (Simulasi muat)

`components/LoadSimulator.tsx` sits directly below the services: a 3D stage on the left and a form on the right. The visitor picks small goods (a blind van, 2,2 × 1,4 × 1,2 m) or large goods (a box truck, 3,8 × 1,8 × 2,0 m). The vehicle drives into the bay and lifts its near side and roof like a wing box. Boxes added from the form (small parcel, medium and large carton, euro pallet) pop up on the loading pad and are lifted into place one by one. Boxes that do not fit stay on the pad, which then reads "TIDAK MUAT", and the panel offers the truck. Switching vehicles unloads the boxes onto the pad, sends the first vehicle away, and loads the next one. When a truck load would fit in the van, the panel suggests the van. The "Pesan … ini" button opens WhatsApp with the vehicle, fill level and box list already written.

- `load-sim-data.ts`: vehicle and box sizes in 10 cm cells, the packing, and the WhatsApp message. Boxes are packed in the order they were added on a height map of the floor: each takes the first spot from the back of the cargo space forwards, upright, turned either way, with at least 70% of its base supported. Adding a box never moves the others. If something is left over, the packing is tried again biggest first and kept when it fits more. It counts space only, not weight.
- `load-sim-model.ts`: the van and truck (the truck reuses the shared chassis and cab), the yard, and the boxes. Each box kind is one instanced mesh per colour, and the ink outlines of every box are one line buffer that is rewritten while boxes move, so 150 boxes cost a handful of draw calls.
- `LoadSimScene.tsx`: frames the truck with its wing up and the pad, works out where off screen begins for the drive in and out, and renders on demand, only while something moves. With reduced motion every change jumps straight to its end.

The simulator is desktop only. On phones and tablets (up to 1194px) and touch-first screens such as a 12.9-inch iPad in landscape, the section and its links in the header, menu panel and footer are hidden, and its 3D scene is never loaded.

Run `node scripts/verify-simulator.mjs` to check placement and navigation, lazy loading, the van arriving and opening, packing and the meter, the left-over pallet and the switch to the truck, the WhatsApp message, removing and clearing, the fit at 1195–1920px, that it is hidden on phones, tablets and touch screens, offscreen pausing and reduced motion.

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
- Generated at build time: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and `/apple-touch-icon.png`. These use `dynamic = "force-static"` because the site is a static export.
- The 1200×630 share image `public/og.png` is a capture of the hero (headline and 3D scene, without the nav, paragraph and buttons). After changing the hero, start the site and run `node scripts/make-og.mjs` (`OG_URL` sets another origin), then bump `?v=` on the image URL in `app/layout.tsx` so WhatsApp and Facebook fetch the new one.
- After deploying, verify the domain in Google Search Console and submit `https://3dayaterang.id/sitemap.xml`.

## Deploy to Cloudflare Workers

The site is a static export served as Workers static assets (`wrangler.jsonc` points at `out/`, no Worker script).

In Cloudflare: **Workers & Pages → Create → Import a repository**, select this repo, then set:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Node 22 is pinned in `.node-version`. `public/_headers` sets long-lived caching for `/_next/static/*` and `/fonts/*`. Unknown paths serve `404.html`.
