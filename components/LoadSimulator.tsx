"use client";
import dynamic from "next/dynamic";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { EXTERNAL, whatsappChat } from "@/lib/site";
import { WhatsAppIcon } from "./icons";
import { IsoDrawing, ISO, inkLine } from "./iso";
import {
  ITEMS,
  ITEM_LIST,
  MAX_ITEMS,
  MAX_QUANTITY,
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

/** Small isometric van or truck for the vehicle choices. */
function vehicleIcon(kind: VehicleKind) {
  const truck = kind === "truck";
  const iso = new IsoDrawing().shadow(
    truck ? -0.1 : -0.05,
    0.1,
    truck ? 1.75 : 1.35,
    0.62,
  );
  const [x0, len, h, w] = truck ? [-1.5, 2, 1.25, 0.9] : [-1.1, 1.45, 0.95, 0.8];
  const cab: [number, number] = truck ? [0.75, 0.95] : [0.62, 0.8];
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
  const wheels = truck ? [-1.1, -0.55, 0.85] : [-0.7, 0.55];
  for (const cx of wheels) {
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
function Plus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const lower = (kind: VehicleKind) => VEHICLES[kind].name.toLowerCase();
const clampQuantity = (n: number) =>
  Math.min(MAX_QUANTITY, Math.max(1, Math.round(n) || 1));

/**
 * Load simulator: pick small or large goods and a van or truck drives in and
 * lifts its side; add boxes and watch them packed inside. When they no longer
 * fit, the leftovers wait on the pad and the panel offers the truck.
 */
export default function LoadSimulator() {
  const stage = useRef<HTMLDivElement>(null);
  const { loaded, running, reduced } = useLazyScene(stage);
  const [vehicle, setVehicle] = useState<VehicleKind | null>(null);
  const [kind, setKind] = useState<ItemKind>("medium");
  const [quantity, setQuantity] = useState("1");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const nextId = useRef(1);

  const plan = useMemo(
    () => (vehicle ? planLoad(items, vehicle) : null),
    [items, vehicle],
  );
  // Everything in the truck would also fit the van: suggest the smaller one.
  const vanWouldDo = useMemo(
    () =>
      vehicle === "truck" &&
      items.length > 0 &&
      planLoad(items, "van").leftovers.length === 0,
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
  const room = MAX_ITEMS - items.length;
  const count = clampQuantity(Number(quantity));

  function add(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    const n = Math.min(count, room);
    if (n <= 0) return;
    const fresh = Array.from({ length: n }, () => ({
      id: nextId.current++,
      kind,
    }));
    setItems((prev) => [...prev, ...fresh]);
  }
  function removeOne(k: ItemKind) {
    setItems((prev) => {
      const i = prev.findLastIndex((item) => item.kind === k);
      return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }
  function nudge(step: number) {
    setQuantity(String(clampQuantity(count + step)));
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
    message = `${VEHICLES[vehicle].name} menuju area muat…`;
  else if (status.phase === "opening") message = `Membuka box ${name}…`;
  else if (status.moving > 0) message = "Menyusun barang…";
  else if (!items.length)
    message = `${VEHICLES[vehicle].name} siap dimuat. Tambahkan barang dari panel.`;
  else if (plan?.leftovers.length)
    message = `${plan.order.length} barang di dalam ${name}, ${plan.leftovers.length} tidak muat.`;
  else message = `Semua barang masuk. ${VEHICLES[vehicle].name} terisi ${plan?.percent ?? 0}%.`;

  const chatUrl =
    plan && items.length ? loadMessageUrl(items, plan) : whatsappChat();

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
                  ? `Ilustrasi 3D ${VEHICLES[vehicle].model.toLowerCase()} 3 Daya Terang dengan sisi box terangkat. ${plan?.order.length ?? 0} barang tersusun di dalam, terisi ${plan?.percent ?? 0} persen.`
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
            <form onSubmit={add}>
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
                      <small>
                        {v.model} · ±{decimal(vehicleVolume(v.kind))} m³
                      </small>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="loadsim-step" disabled={!vehicle}>
                <legend className="loadsim-legend">
                  <span>02</span> Tambah barang
                </legend>
                <div className="loadsim-kinds">
                  {ITEM_LIST.map((item) => (
                    <label key={item.kind} className="loadsim-option loadsim-kind">
                      <input
                        type="radio"
                        name="loadsim-kind"
                        value={item.kind}
                        checked={kind === item.kind}
                        onChange={() => setKind(item.kind)}
                      />
                      <span className="loadsim-option-icon">{itemIcon(item.kind)}</span>
                      <strong>{item.name}</strong>
                      <small>{itemSize(item.kind)}</small>
                    </label>
                  ))}
                </div>
                <div className="loadsim-add">
                  <div className="loadsim-quantity">
                    <button
                      type="button"
                      aria-label="Kurangi jumlah"
                      onClick={() => nudge(-1)}
                      disabled={count <= 1}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_QUANTITY}
                      value={quantity}
                      aria-label="Jumlah barang"
                      onChange={(e) => setQuantity(e.target.value)}
                      onBlur={() => setQuantity(String(count))}
                    />
                    <button
                      type="button"
                      aria-label="Tambah jumlah"
                      onClick={() => nudge(1)}
                      disabled={count >= MAX_QUANTITY}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="button primary loadsim-submit"
                    disabled={!vehicle || room <= 0}
                  >
                    {vehicle ? `Tambah ke ${name}` : "Tambah barang"}
                    <Plus />
                  </button>
                </div>
                {!vehicle && (
                  <p className="loadsim-hint">Pilih jenis kiriman dulu, lalu tambahkan barang.</p>
                )}
                {vehicle && room < count && (
                  <p className="loadsim-hint">
                    Simulasi menampung paling banyak {MAX_ITEMS} barang.
                  </p>
                )}
              </fieldset>
            </form>

            <div className="loadsim-step loadsim-load">
              <h3 className="loadsim-legend">
                <span>03</span> Muatan
              </h3>
              {plan ? (
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
              ) : null}
              {kinds.length ? (
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
              ) : (
                <p className="loadsim-empty">
                  {vehicle
                    ? "Belum ada barang. Pilih jenis barang di atas, lalu tekan Tambah."
                    : "Muatan Anda akan tampil di sini."}
                </p>
              )}

              {plan && plan.leftovers.length > 0 && (
                <div className="loadsim-alert" role="alert">
                  <p>
                    <strong>
                      {plan.leftovers.length} barang tidak muat di {name}.
                    </strong>{" "}
                    {vehicle === "van"
                      ? `Truk box punya ruang ±${decimal(vehicleVolume("truck"))} m³, hampir 4× van.`
                      : "Kami bisa siapkan armada tambahan atau kirim bertahap."}
                  </p>
                  {vehicle === "van" ? (
                    <button
                      type="button"
                      className="loadsim-switch"
                      onClick={() => setVehicle("truck")}
                    >
                      Ganti ke truk <Arrow />
                    </button>
                  ) : (
                    <a className="loadsim-switch" href={chatUrl} {...EXTERNAL}>
                      Konsultasi armada <Arrow />
                    </a>
                  )}
                </div>
              )}
              {vanWouldDo && (
                <div className="loadsim-tip">
                  <p>Semua barang ini muat di van, pilihan yang lebih hemat.</p>
                  <button
                    type="button"
                    className="loadsim-switch"
                    onClick={() => setVehicle("van")}
                  >
                    Pakai van <Arrow />
                  </button>
                </div>
              )}

              <div className="loadsim-actions">
                <a className="button primary" href={chatUrl} {...EXTERNAL}>
                  {plan && items.length ? `Pesan ${name} ini` : "Tanya tim kami"}
                  <WhatsAppIcon />
                </a>
                <button
                  type="button"
                  className="loadsim-clear"
                  onClick={() => setItems([])}
                  disabled={!items.length}
                >
                  Kosongkan
                </button>
              </div>
              <p className="loadsim-note">
                Simulasi menghitung ruang muat saja. Berat, rute, dan tarif
                final dikonfirmasi tim kami.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
