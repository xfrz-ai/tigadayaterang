"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { EXTERNAL } from "@/lib/site";
import { IsoDrawing, ISO, inkLine } from "./iso";
import {
  ITEMS,
  ITEM_LIST,
  MAX_ITEMS,
  VEHICLES,
  VEHICLE_LIST,
  countKinds,
  decimal,
  itemSize,
  loadMessageUrl,
  planLoad,
  vehicleSize,
  vehicleVolume,
  type Item,
  type ItemKind,
  type VehicleKind,
} from "./load-sim-data";
import type { SimStatus } from "./load-sim-model";
import { useLazyScene } from "./use-lazy-scene";

const LoadSimScene = dynamic(() => import("./LoadSimScene"), { ssr: false });

const thin = { ...inkLine, strokeWidth: 1 } as const;

/** Small isometric cargo plane: high wing, one engine showing, red fin. */
function planeIcon() {
  const iso = new IsoDrawing().shadow(0, 0, 1.75, 0.8);
  for (const x of [-0.45, 1.3])
    iso.box([x, 0.04, -0.06], [0.22, 0.3, 0.12], ISO.dark);
  iso.box([-1.65, 0.3, -0.32], [3.05, 0.66, 0.64], ISO.white, {
    front: ([fw, fh]) => (
      <>
        <rect x={0} y={fh * 0.66} width={fw} height={fh * 0.1} fill={ISO.red} />
        <rect x={fw * 0.42} y={fh * 0.12} width={fw * 0.36} height={fh * 0.5} fill="none" {...thin} />
      </>
    ),
  });
  iso.box([1.4, 0.36, -0.26], [0.3, 0.52, 0.52], ISO.white, {
    side: ([sw, sh]) => (
      <rect x={sw * 0.12} y={sh * 0.1} width={sw * 0.76} height={sh * 0.3} fill="#647474" {...thin} />
    ),
  });
  iso.box([-0.25, 0.74, 0.74], [0.62, 0.22, 0.22], ISO.red);
  iso.flat(
    [
      [0.4, 0.98, -1.75],
      [0.4, 0.98, 1.75],
      [-0.1, 0.98, 1.75],
      [-0.35, 0.98, 0],
      [-0.1, 0.98, -1.75],
    ].map(([x, y, z]) => [x, y, z] as const),
    ISO.wall,
  );
  for (const [z0, z1] of [
    [0.55, 1.15],
    [1.15, 0.55],
  ])
    iso.path(
      [
        [0.4, 0.55, z0],
        [0.4, 1.15, z1],
      ],
      { ...inkLine, strokeWidth: 2.2 },
    );
  iso.flat(
    [
      [-1.65, 0.97, -0.7],
      [-1.65, 0.97, 0.7],
      [-1.35, 0.97, 0.7],
      [-1.15, 0.97, 0],
      [-1.35, 0.97, -0.7],
    ].map(([x, y, z]) => [x, y, z] as const),
    ISO.wall,
  );
  iso.flat(
    [
      [-1.65, 0.96, 0],
      [-1.5, 1.62, 0],
      [-1.22, 1.62, 0],
      [-0.9, 0.96, 0],
    ].map(([x, y, z]) => [x, y, z] as const),
    ISO.red,
  );
  return iso.svg();
}

/** Small isometric cargo ship on a patch of water: bridge aft, cargo on deck. */
function shipIcon() {
  const iso = new IsoDrawing();
  const water = Array.from({ length: 48 }, (_, i): [number, number, number] => {
    const t = (i / 48) * Math.PI * 2;
    return [0.05 + Math.cos(t) * 2, 0, Math.sin(t) * 0.85];
  });
  iso.path(water, { fill: "#dbe7e6" });
  const [x0, x1, bow, b, top] = [-1.55, 1, 1.6, 0.42, 0.5];
  iso.box([x0, 0.05, -b], [x1 - x0, top - 0.05, b * 2], ISO.dark, {
    front: ([fw, fh]) => (
      <rect x={0} y={fh * 0.72} width={fw} height={fh * 0.28} fill={ISO.red} />
    ),
  });
  iso.flat(
    [
      [x1, top, b],
      [bow, top, 0],
      [bow - 0.1, 0.05, 0],
      [x1, 0.05, b],
    ],
    ISO.dark,
  );
  iso.flat(
    [
      [x0, top, -b],
      [x1, top, -b],
      [bow, top, 0],
      [x1, top, b],
      [x0, top, b],
    ],
    ISO.grey,
  );
  iso.box([x0 + 0.05, top, -0.36], [0.55, 0.5, 0.72], ISO.white, {
    side: ([sw, sh]) => (
      <rect x={sw * 0.15} y={sh * 0.3} width={sw * 0.7} height={sh * 0.2} fill="#647474" {...thin} />
    ),
  });
  iso.box([x0 + 0.1, top + 0.5, -0.3], [0.42, 0.28, 0.6], ISO.white, {
    side: ([sw, sh]) => (
      <rect x={sw * 0.1} y={sh * 0.25} width={sw * 0.8} height={sh * 0.4} fill="#647474" {...thin} />
    ),
  });
  iso.box([x0 + 0.14, top + 0.78, -0.28], [0.2, 0.3, 0.2], ISO.red);
  iso.box([-0.6, top, -0.34], [0.5, 0.36, 0.5], ISO.red);
  iso.box([0, top, -0.34], [0.5, 0.28, 0.5], ISO.wall);
  iso.box([-0.55, top, 0.02], [0.42, 0.24, 0.3], ISO.white);
  iso.box([x0 + 0.62, top, b - 0.05], [x1 - x0 - 0.62, 0.12, 0.05], ISO.white);
  return iso.svg();
}

/** Small isometric ship, truck or plane for the vehicle choices. */
function vehicleIcon(kind: VehicleKind) {
  if (kind === "plane") return planeIcon();
  if (kind === "ship") return shipIcon();
  const iso = new IsoDrawing().shadow(-0.1, 0.1, 1.75, 0.62);
  const [x0, len, h, w] = [-1.5, 2, 1.25, 0.9];
  const cab: [number, number] = [0.75, 0.95];
  iso.box([x0, 0.3, -w / 2], [len, h, w], ISO.red, {
    front: ([fw, fh]) => (
      <rect x={fw * 0.12} y={fh * 0.42} width={fw * 0.76} height={fh * 0.12} fill={ISO.white} />
    ),
  });
  iso.box([x0 + len, 0.3, -w / 2], [cab[0], cab[1], w], ISO.white, {
    front: ([fw]) => (
      <rect x={fw * 0.2} y={0.08} width={fw * 0.62} height={0.3} fill="#647474" {...thin} />
    ),
  });
  for (const cx of [-1.1, -0.55, 0.85]) {
    const pts = Array.from({ length: 20 }, (_, i): [number, number, number] => {
      const t = (i / 20) * Math.PI * 2;
      return [cx + Math.cos(t) * 0.24, 0.26 + Math.sin(t) * 0.24, w / 2 + 0.01];
    });
    iso.flat(pts, ISO.dark);
  }
  return iso.svg();
}

const ICON_COLORS: Record<Exclude<ItemKind, "pallet">, [string, string]> = {
  parcel: [ISO.red, ISO.deepRed],
  medium: [ISO.wall, ISO.grey],
  large: [ISO.white, ISO.red],
};
/** Isometric box in its real proportions, drawn to a common height in CSS. */
function itemIcon(kind: ItemKind) {
  const [cl, ch, cw] = ITEMS[kind].cells;
  const k = 1.5 / Math.max(cl, ch, cw);
  const l = cl * k,
    h = ch * k,
    w = cw * k;
  const iso = new IsoDrawing().shadow(0, 0, l * 0.75, w * 0.8);
  if (kind === "pallet") {
    const base = 0.16;
    iso.box([-l / 2, 0, -w / 2], [l, base, w], ISO.grey);
    iso.box([-l / 2 + 0.03, base, -w / 2 + 0.03], [l - 0.06, h - base, w - 0.06], ISO.wall, {
      top: ([tw, td]) => (
        <>
          <rect x={tw * 0.22} y={0} width={0.07} height={td} fill={ISO.red} />
          <rect x={tw * 0.7} y={0} width={0.07} height={td} fill={ISO.red} />
        </>
      ),
      front: ([fw, fh]) => (
        <>
          <line x1={fw / 2} y1={0} x2={fw / 2} y2={fh} {...thin} />
          <line x1={0} y1={fh / 2} x2={fw} y2={fh / 2} {...thin} />
        </>
      ),
      side: ([sw, sh]) => <line x1={0} y1={sh / 2} x2={sw} y2={sh / 2} {...thin} />,
    });
    return iso.svg();
  }
  const [body, tape] = ICON_COLORS[kind];
  const band = Math.max(0.08, l * 0.14);
  iso.box([-l / 2, 0, -w / 2], [l, h, w], body, {
    top: ([tw, td]) => <rect x={tw / 2 - band / 2} y={0} width={band} height={td} fill={tape} />,
    front: ([fw, fh]) => (
      <>
        <rect x={fw / 2 - band / 2} y={0} width={band} height={fh * 0.45} fill={tape} />
        <rect
          x={fw * 0.6}
          y={fh * 0.48}
          width={fw * 0.28}
          height={fh * 0.24}
          fill={kind === "large" ? ISO.wall : ISO.white}
          {...thin}
        />
      </>
    ),
  });
  return iso.svg();
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const lower = (kind: VehicleKind) => VEHICLES[kind].name.toLowerCase();

/**
 * Load simulator: pick how to ship and a cargo ship docks (the lane floods
 * into a quay), a truck drives in, or a plane taxis up, and opens its side;
 * add boxes and watch them packed inside. When they no longer fit, the
 * leftovers wait on the pad and the panel offers a chat with the team.
 */
export default function LoadSimulator() {
  const stage = useRef<HTMLDivElement>(null);
  const { loaded, running, reduced } = useLazyScene(stage);
  const [vehicle, setVehicle] = useState<VehicleKind | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const nextId = useRef(1);

  const plan = useMemo(
    () => (vehicle ? planLoad(items, vehicle) : null),
    [items, vehicle],
  );
  const kinds = countKinds(items);
  const leftByKind = useMemo(() => {
    const left = new Set(plan?.leftovers ?? []);
    const counts = new Map<ItemKind, number>();
    for (const item of items)
      if (left.has(item.id))
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return counts;
  }, [items, plan]);
  const countOf = new Map(kinds.map((k) => [k.kind, k.count]));
  const room = MAX_ITEMS - items.length;

  function addOne(k: ItemKind) {
    if (!vehicle || room <= 0) return;
    setItems((prev) => [...prev, { id: nextId.current++, kind: k }]);
  }
  function removeOne(k: ItemKind) {
    setItems((prev) => {
      const i = prev.findLastIndex((item) => item.kind === k);
      return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }

  const name = vehicle ? lower(vehicle) : "";
  const busy =
    !!vehicle &&
    (!status ||
      status.vehicle !== vehicle ||
      status.phase !== "ready" ||
      status.moving > 0);
  let message: string;
  if (!vehicle) message = "Pilih jenis kiriman, armada kami datang ke area muat.";
  else if (status && status.vehicle && status.vehicle !== vehicle)
    message =
      status.phase === "unloading"
        ? `Memindahkan muatan dari ${lower(status.vehicle)}…`
        : `${VEHICLES[status.vehicle].name} berangkat, ${name} segera datang…`;
  else if (!status || status.phase === "away" || status.phase === "arriving")
    message = {
      ship: "Kapal berlayar menuju dermaga…",
      truck: "Truk menuju area muat…",
      plane: "Pesawat taxi menuju area muat…",
    }[vehicle];
  else if (status.phase === "opening")
    message = {
      ship: "Menurunkan sisi dek kapal…",
      truck: "Membuka box truk…",
      plane: "Membuka pintu kargo…",
    }[vehicle];
  else if (status.moving > 0) message = "Menyusun barang…";
  else if (!items.length)
    message = `${VEHICLES[vehicle].name} siap dimuat. Tambahkan barang dari panel.`;
  else if (plan?.leftovers.length)
    message = `${plan.order.length} barang di dalam ${name}, ${plan.leftovers.length} tidak muat.`;
  else message = `Semua barang masuk. ${VEHICLES[vehicle].name} terisi ${plan?.percent ?? 0}%.`;

  return (
    <section
      className="loadsim"
      id="simulasi"
      aria-labelledby="loadsim-heading"
    >
      <div className="loadsim-inner">
        <div className="loadsim-head">
          <div>
            <span className="eyebrow">SIMULASI MUAT / COBA SENDIRI</span>
            <h2 id="loadsim-heading">
              Muat barangnya dulu,
              <br /> <span>lihat armada yang pas.</span>
            </h2>
          </div>
          <p>
            Pilih jenis kiriman, lalu tambahkan barang Anda. Simulasi menyusun
            setiap kardus di dalam armada dan memberi tahu kapan muatan perlu
            naik ke truk.
          </p>
        </div>

        <div className="loadsim-body">
          <div className="loadsim-stage" ref={stage}>
            <div
              className="loadsim-scene"
              role="img"
              aria-label={
                vehicle
                  ? `Ilustrasi 3D ${VEHICLES[vehicle].model.toLowerCase()} 3 Daya Terang dengan ${{ ship: "sisi dek terbuka, bersandar di dermaga", truck: "sisi box terangkat", plane: "pintu kargo terbuka" }[vehicle]}. ${plan?.order.length ?? 0} barang tersusun di dalam, terisi ${plan?.percent ?? 0} persen.`
                  : "Ilustrasi 3D area muat 3 Daya Terang yang menunggu armada datang."
              }
            >
              {loaded && (
                <LoadSimScene
                  vehicle={vehicle}
                  items={items}
                  plan={plan}
                  running={running}
                  reduced={reduced}
                  onStatus={setStatus}
                />
              )}
            </div>
            <div className="loadsim-hud" aria-hidden="true">
              <span className="loadsim-tag">
                {vehicle
                  ? `${VEHICLES[vehicle].model} / ${vehicleSize(vehicle)}`
                  : "Area muat / 3 Daya Terang"}
              </span>
              {plan && (
                <span className="loadsim-gauge">
                  <span className="loadsim-gauge-bar">
                    <span style={{ width: `${Math.min(100, plan.percent)}%` }} />
                  </span>
                  {plan.percent}%
                </span>
              )}
            </div>
            <p
              className={`loadsim-status${busy ? " is-busy" : ""}`}
              role="status"
            >
              <span aria-hidden="true" />
              {message}
            </p>
          </div>

          <div className="loadsim-panel">
            <div>
              <fieldset className="loadsim-step">
                <legend className="loadsim-legend">
                  <span>01</span> Pilih jenis kiriman
                </legend>
                <div className="loadsim-vehicles">
                  {VEHICLE_LIST.map((v) => (
                    <label key={v.kind} className="loadsim-option loadsim-vehicle">
                      <input
                        type="radio"
                        name="loadsim-vehicle"
                        value={v.kind}
                        checked={vehicle === v.kind}
                        onChange={() => setVehicle(v.kind)}
                      />
                      <span className="loadsim-option-icon">{vehicleIcon(v.kind)}</span>
                      <strong>{v.need}</strong>
                      <small>{v.model}</small>
                      <small>±{decimal(vehicleVolume(v.kind))} m³</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* The actions sit beside this step's title (see CSS), after
                  the counters in reading order. */}
              <div className="loadsim-goods">
                <fieldset className="loadsim-step" disabled={!vehicle}>
                  <legend className="loadsim-legend">
                    <span>02</span> Tambah barang
                  </legend>
                  <div className="loadsim-kinds">
                    {ITEM_LIST.map((item) => {
                      const n = countOf.get(item.kind) ?? 0;
                      const label = item.name.toLowerCase();
                      return (
                        <div
                          key={item.kind}
                          className={`loadsim-kind${n ? " is-active" : ""}`}
                          role="group"
                          aria-label={item.name}
                        >
                          <span className="loadsim-option-icon">{itemIcon(item.kind)}</span>
                          <span className="loadsim-kind-name">
                            <strong>{item.name}</strong>
                            <small>{itemSize(item.kind)}</small>
                          </span>
                          <div className="loadsim-stepper">
                            <button
                              type="button"
                              aria-label={`Kurangi ${label}`}
                              onClick={() => removeOne(item.kind)}
                              disabled={!n}
                            >
                              −
                            </button>
                            <output aria-label={`Jumlah ${label}`}>{n}</output>
                            <button
                              type="button"
                              aria-label={`Tambah ${label}`}
                              onClick={() => addOne(item.kind)}
                              disabled={room <= 0}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!vehicle && (
                    <p className="loadsim-hint">Pilih jenis kiriman dulu, lalu tambahkan barang.</p>
                  )}
                  {vehicle && room <= 0 && (
                    <p className="loadsim-hint">
                      Simulasi menampung paling banyak {MAX_ITEMS} barang.
                    </p>
                  )}
                </fieldset>
                <div className="loadsim-actions">
                  <button
                    type="button"
                    className="loadsim-clear"
                    onClick={() => setItems([])}
                    disabled={!items.length}
                  >
                    Kosongkan
                  </button>
                </div>
              </div>
            </div>

            {plan && (
              <div className="loadsim-step loadsim-load">
                <h3 className="loadsim-legend">
                  <span>03</span> Muatan
                </h3>
                <div className="loadsim-meter">
                  <div className="loadsim-meter-top">
                    <span>Ruang terpakai</span>
                    <strong>{plan.percent}%</strong>
                  </div>
                  <div
                    className="loadsim-bar"
                    role="meter"
                    aria-label={`Ruang muat ${name} terpakai`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={plan.percent}
                  >
                    <span style={{ width: `${Math.min(100, plan.percent)}%` }} />
                  </div>
                  <small>
                    {decimal(plan.used)} dari {decimal(plan.capacity)} m³ ·{" "}
                    {plan.order.length} barang di dalam {name}
                  </small>
                </div>
                {kinds.length > 0 && (
                  <ul className="loadsim-list">
                    {kinds.map((k) => (
                      <li key={k.kind}>
                        <span className={`loadsim-swatch is-${k.kind}`} aria-hidden="true" />
                        <span className="loadsim-list-name">
                          {k.name}
                          <small>
                            {itemSize(k.kind)}
                            {leftByKind.get(k.kind) ? (
                              <em> · {leftByKind.get(k.kind)} tidak muat</em>
                            ) : null}
                          </small>
                        </span>
                        <b>× {k.count}</b>
                        <button
                          type="button"
                          aria-label={`Kurangi satu ${k.name.toLowerCase()}`}
                          onClick={() => removeOne(k.kind)}
                        >
                          −
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {plan.leftovers.length > 0 && (
                  <div className="loadsim-alert" role="alert">
                    <p>
                      <strong>
                        {plan.leftovers.length} barang tidak muat di {name}.
                      </strong>{" "}
                      {
                        {
                          ship: "Kami bisa siapkan ruang kapal tambahan atau kirim bertahap.",
                          truck: "Kami bisa siapkan armada tambahan atau kirim bertahap.",
                          plane: "Kami bisa atur penerbangan tambahan atau kirim bertahap.",
                        }[plan.vehicle]
                      }
                    </p>
                    <a className="loadsim-switch" href={loadMessageUrl(items, plan)} {...EXTERNAL}>
                      Konsultasi armada <Arrow />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
