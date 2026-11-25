import { whatsappText } from "@/lib/site";

/**
 * Data and packing for the load simulator (components/LoadSimulator.tsx).
 * Everything is measured in 10 cm cells, so a ship, a truck and a plane can
 * be filled box by box and we can tell exactly when something no longer fits.
 */
export const CELL = 0.1; // metres per cell

export type VehicleKind = "ship" | "truck" | "plane";
export type ItemKind = "parcel" | "medium" | "large" | "pallet";
export type Item = { id: number; kind: ItemKind };
/** [length along the vehicle, height, width across] in cells. */
type Cells = readonly [number, number, number];

export type VehicleSpec = {
  kind: VehicleKind;
  /** What the visitor picks: the kind of shipment. */
  need: string;
  name: string;
  model: string;
  cells: Cells;
};
export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  // Open cargo deck of a small inter-island freighter.
  ship: {
    kind: "ship",
    need: "Antar pulau",
    name: "Kapal",
    model: "Kapal kargo",
    cells: [48, 16, 22],
  },
  truck: {
    kind: "truck",
    need: "Barang besar",
    name: "Truk",
    model: "Truk box",
    cells: [38, 20, 18],
  },
  // Main deck of a small twin-turboprop freighter: still takes a pallet.
  plane: {
    kind: "plane",
    need: "Kirim cepat",
    name: "Pesawat",
    model: "Pesawat kargo",
    cells: [36, 16, 20],
  },
};
export const VEHICLE_LIST = [VEHICLES.ship, VEHICLES.truck, VEHICLES.plane];

export type ItemSpec = { kind: ItemKind; name: string; cells: Cells };
export const ITEMS: Record<ItemKind, ItemSpec> = {
  parcel: { kind: "parcel", name: "Paket kecil", cells: [3, 2, 2] },
  medium: { kind: "medium", name: "Kardus sedang", cells: [5, 4, 4] },
  large: { kind: "large", name: "Kardus besar", cells: [8, 6, 6] },
  // A loaded euro pallet, 1.3 m tall.
  pallet: { kind: "pallet", name: "Palet", cells: [12, 13, 8] },
};
export const ITEM_LIST = Object.values(ITEMS);
/** Most boxes the simulation will hold at once. */
export const MAX_ITEMS = 150;

const volumeOf = (c: Cells) => c[0] * c[1] * c[2] * CELL ** 3;
export const itemVolume = (kind: ItemKind) => volumeOf(ITEMS[kind].cells);
export const vehicleVolume = (kind: VehicleKind) =>
  volumeOf(VEHICLES[kind].cells);

/** Indonesian decimal comma, one place. */
export const decimal = (n: number) => n.toFixed(1).replace(".", ",");
/** "120 × 80 × 130 cm": length × width × height. */
export const itemSize = (kind: ItemKind) => {
  const [l, h, w] = ITEMS[kind].cells;
  return `${l * 10} × ${w * 10} × ${h * 10} cm`;
};
/** "2,2 × 1,4 × 1,2 m": length × width × height of the cargo space. */
export const vehicleSize = (kind: VehicleKind) => {
  const [l, h, w] = VEHICLES[kind].cells;
  return [l, w, h].map((c) => decimal(c * CELL)).join(" × ") + " m";
};

/** Where a box sits: its lowest corner in cells, turned 90° or not. */
export type Slot = { x: number; y: number; z: number; turned: boolean };
export type Packing = {
  slots: Map<number, Slot>;
  /** Ids in the order they were placed. */
  order: number[];
  leftovers: number[];
};

/** Share of a box's base that must rest on what is below it. */
const SUPPORT = 0.7;

/**
 * Places boxes one after another on a height map of the floor. Each box takes
 * the first free spot that is low enough and well supported, upright, turned
 * either way. `wall` fills from the back (low x) forwards, a wall at a time,
 * so new boxes never hide behind older ones; `floor` covers the floor first.
 */
export function pack(
  items: readonly Item[],
  [nx, ny, nz]: Cells,
  order: "wall" | "floor" = "wall",
): Packing {
  const height = new Uint8Array(nx * nz);
  const slots = new Map<number, Slot>(),
    placed: number[] = [],
    leftovers: number[] = [];
  type Spot = Slot & { lx: number; lz: number };
  const before = (a: Spot, b: Spot) =>
    (order === "wall"
      ? a.x - b.x || a.y - b.y || a.z - b.z
      : a.y - b.y || a.x - b.x || a.z - b.z) < 0;
  for (const item of items) {
    const [l, h, w] = ITEMS[item.kind].cells;
    let best: Spot | null = null;
    for (const turned of l === w ? [false] : [false, true]) {
      const lx = turned ? w : l,
        lz = turned ? l : w;
      if (lx > nx || lz > nz || h > ny) continue;
      for (let x = 0; x + lx <= nx; x++) {
        if (order === "wall" && best && x > best.x) break;
        for (let z = 0; z + lz <= nz; z++) {
          let top = 0,
            resting = 0;
          for (let i = x; i < x + lx; i++)
            for (let k = z; k < z + lz; k++) {
              const v = height[i * nz + k];
              if (v > top) {
                top = v;
                resting = 1;
              } else if (v === top) resting++;
            }
          if (top + h > ny || resting < lx * lz * SUPPORT) continue;
          const spot = { x, y: top, z, turned, lx, lz };
          if (!best || before(spot, best)) best = spot;
        }
      }
    }
    if (!best) {
      leftovers.push(item.id);
      continue;
    }
    for (let i = best.x; i < best.x + best.lx; i++)
      for (let k = best.z; k < best.z + best.lz; k++)
        height[i * nz + k] = best.y + h;
    slots.set(item.id, {
      x: best.x,
      y: best.y,
      z: best.z,
      turned: best.turned,
    });
    placed.push(item.id);
  }
  return { slots, order: placed, leftovers };
}

export type LoadPlan = Packing & {
  vehicle: VehicleKind;
  /** Cubic metres used and available. */
  used: number;
  capacity: number;
  /** Whole percent of the cargo space in use. */
  percent: number;
};

/**
 * Loads the boxes in the order they were added, so adding one never moves the
 * others. If something is left over, tries again biggest first and keeps that
 * arrangement when it fits more.
 */
export function planLoad(items: readonly Item[], vehicle: VehicleKind): LoadPlan {
  const cells = VEHICLES[vehicle].cells;
  let packing = pack(items, cells);
  if (packing.leftovers.length) {
    const biggestFirst = [...items].sort(
      (a, b) => itemVolume(b.kind) - itemVolume(a.kind),
    );
    const retry = pack(biggestFirst, cells);
    if (retry.leftovers.length < packing.leftovers.length) packing = retry;
  }
  const kinds = new Map(items.map((i) => [i.id, i.kind]));
  const used = packing.order.reduce(
    (sum, id) => sum + itemVolume(kinds.get(id)!),
    0,
  );
  const capacity = vehicleVolume(vehicle);
  return {
    ...packing,
    vehicle,
    used,
    capacity,
    percent: Math.round((used / capacity) * 100),
  };
}

/** How many of each kind, in the order the kinds are listed. */
export function countKinds(items: readonly Item[]) {
  const counts = new Map<ItemKind, number>();
  for (const item of items)
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return ITEM_LIST.filter((s) => counts.has(s.kind)).map((s) => ({
    ...s,
    count: counts.get(s.kind)!,
  }));
}

/** WhatsApp link with the simulated load already written out. */
export function loadMessageUrl(items: readonly Item[], plan: LoadPlan) {
  const vehicle = VEHICLES[plan.vehicle];
  const lines = [
    "Halo 3 Daya Terang, saya sudah mencoba simulasi muat di website dan ingin memesan pengiriman.",
    "",
    `Armada: ${vehicle.name} (${vehicle.model.toLowerCase()}), terisi ±${plan.percent}%`,
    "Barang:",
    ...countKinds(items).map(
      (k) => `- ${k.name} (${itemSize(k.kind)}) × ${k.count}`,
    ),
  ];
  if (plan.leftovers.length)
    lines.push(
      `Catatan: ${plan.leftovers.length} barang belum muat di ${vehicle.name.toLowerCase()}.`,
    );
  lines.push(
    "",
    "Nama:",
    "Dikirim dari:",
    "Tujuan:",
    "Tanggal kirim:",
    "",
    "Terima kasih.",
  );
  return whatsappText(lines.join("\n"));
}
