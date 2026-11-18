# Relay — Good things. Delivered.

A responsive logistics landing page in Next.js, React Three Fiber, and Three.js. All hero objects are procedural geometry rendered live in WebGL; no models, hero images, or video assets are used.

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

Navigation links scroll to real sections. The scene tour and pause control work independently of the animation. The enquiry modal creates a downloadable shipment brief locally. No enquiry is sent and no data is stored or sent to a backend; connect a real business endpoint before using it to receive leads.

## Verification

```sh
npm run typecheck
npm run build
node scripts/verify.mjs
```

Browser verification requires Google Chrome and a running local server. Set `VERIFY_URL` to test another origin. The script checks simultaneous animation, a fixed camera, rendering calls, pause/resume, reduced motion, navigation, responsive overflow, dialog behavior, download generation, and browser errors. Screenshots and results are written to ignored `artifacts/`.

## Animated service cards

The Services section directly below the hero presents road transportation, ocean freight, air freight, and drone parcel delivery. `components/Services.tsx` contains the responsive HTML cards; `ServiceIllustration.tsx` manages each orthographic view; `service-models.ts` builds and animates the vehicles. The road card reuses the hero's truck, and all four share the original toon material and outline system. Shipping containers reuse cached geometries.

Each card loads as it approaches the viewport, runs independently while visible, and pauses offscreen, when the tab is hidden, or when reduced motion is enabled. Hover or keyboard focus smoothly increases animation speed and highlights the enquiry button. Selecting a service opens the existing shipment brief with that service selected.

Run `node scripts/verify-services.mjs` against the dev server (or set `VERIFY_URL`) to check animation, hover, service selection, responsive columns, offscreen pausing, reduced motion, and preservation of the original hero.
