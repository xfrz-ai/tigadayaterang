import type { ReactNode } from "react";
import { IsoDrawing, ISO, depth, inkLine, shade } from "./iso";

const thin = { ...inkLine, strokeWidth: 1 } as const;

/** A red parcel carrying a clock face, with speed lines behind it. */
function onTimeIcon() {
  const iso = new IsoDrawing().shadow(0.05, 0.05, 1.2, 0.92);
  for (const [y, from] of [
    [0.38, -1.5],
    [0.72, -1.32],
    [1.04, -1.58],
  ] as const)
    iso.path(
      [
        [from, y, 0.65],
        [-1.02, y, 0.65],
      ],
      { ...inkLine, strokeWidth: 1.6 },
    );
  iso.box([-0.85, 0, -0.65], [1.7, 1.25, 1.3], ISO.red, {
    top: ([w, d]) => (
      <rect x={w / 2 - 0.13} y={0} width={0.26} height={d} fill={ISO.deepRed} />
    ),
    front: ([w]) => {
      const cx = w / 2,
        cy = 0.72;
      return (
        <>
          <rect
            x={cx - 0.13}
            y={0}
            width={0.26}
            height={0.2}
            fill={shade(ISO.deepRed, 0.9)}
          />
          <circle cx={cx} cy={cy} r={0.43} fill={ISO.white} {...inkLine} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2;
            return (
              <line
                key={i}
                x1={cx + Math.sin(a) * 0.3}
                y1={cy - Math.cos(a) * 0.3}
                x2={cx + Math.sin(a) * 0.36}
                y2={cy - Math.cos(a) * 0.36}
                {...thin}
              />
            );
          })}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 0.17}
            y2={cy - 0.12}
            {...inkLine}
            strokeWidth={2}
          />
          <g transform={`translate(${cx} ${cy})`}>
            <path
              className="iso-hand"
              d="M0 0V-0.31"
              stroke={ISO.red}
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <circle cx={cx} cy={cy} r={0.045} fill={ISO.ink} />
        </>
      );
    },
    side: ([d]) => (
      <>
        <rect
          x={0.28}
          y={0.3}
          width={d - 0.56}
          height={0.42}
          fill={ISO.white}
          {...thin}
        />
        <path
          d="M0.42 0.4v0.22M0.5 0.4v0.22M0.55 0.4v0.22M0.66 0.4v0.22M0.72 0.4v0.22"
          {...thin}
        />
      </>
    ),
  });
  return iso.svg();
}

/** A taped parcel locked with a red padlock. */
function secureIcon() {
  const iso = new IsoDrawing().shadow(0, 0.18, 1.18, 1.05);
  iso.box([-0.95, 0, -0.75], [1.5, 1.15, 1.3], ISO.wall, {
    top: ([w, d]) => (
      <rect x={0} y={d / 2 - 0.12} width={w} height={0.24} fill={ISO.grey} />
    ),
    side: ([d]) => (
      <rect
        x={d / 2 - 0.12}
        y={0}
        width={0.24}
        height={0.26}
        fill={shade(ISO.grey, 0.9)}
      />
    ),
    front: ([w]) => (
      <>
        <rect
          x={w - 0.62}
          y={0.17}
          width={0.46}
          height={0.26}
          fill={ISO.white}
          {...thin}
        />
        <path d={`M${w - 0.54} 0.26h0.3M${w - 0.54} 0.34h0.2`} {...thin} />
      </>
    ),
  });
  // Padlock standing in front of the parcel; the shackle sits in its mid-plane.
  const body = { x: -0.3, z: 0.72, w: 0.95, h: 0.78, d: 0.34 };
  const cx = body.x + body.w / 2,
    cz = body.z + body.d / 2,
    r = 0.27;
  const shackle: [number, number, number][] = [
    [cx + r, body.h - 0.08, cz],
    ...Array.from({ length: 19 }, (_, i): [number, number, number] => {
      const t = (i / 18) * Math.PI;
      return [cx + Math.cos(t) * r, 1.02 + Math.sin(t) * r, cz];
    }),
    [cx - r, body.h - 0.08, cz],
  ];
  iso.path(shackle, { stroke: ISO.ink, strokeWidth: 7.5 });
  iso.path(shackle, { stroke: ISO.grey, strokeWidth: 4.3 });
  iso.box([body.x, 0, body.z], [body.w, body.h, body.d], ISO.red, {
    front: ([w, h]) => (
      <>
        <circle cx={w / 2} cy={h * 0.42} r={0.08} fill={ISO.ink} />
        <path
          d={`M${w / 2 - 0.035} ${h * 0.42}L${w / 2 - 0.07} ${h * 0.42 + 0.2}H${w / 2 + 0.07}L${w / 2 + 0.035} ${h * 0.42}Z`}
          fill={ISO.ink}
        />
      </>
    ),
  });
  return iso.svg();
}

/** A phone showing 24/7, with a chat bubble popping up beside it. */
function supportIcon() {
  const iso = new IsoDrawing().shadow(0.1, 0.05, 0.85, 0.5);
  // Bubble tail first, so the bubble covers its top edge.
  iso.flat(
    [
      [0.56, 1.55, -0.2],
      [0.82, 1.55, -0.2],
      [0.5, 1.26, -0.2],
    ],
    shade(ISO.red, 0.9),
  );
  iso.box([0.42, 1.45, -0.32], [0.95, 0.6, 0.12], ISO.red, {
    front: ([w, h]) => (
      <>
        {[0.3, 0.5, 0.7].map((k) => (
          <circle key={k} cx={w * k} cy={h / 2} r={0.065} fill={ISO.white} />
        ))}
      </>
    ),
  });
  iso.box([-0.5, 0, -0.08], [1, 1.85, 0.16], ISO.dark, {
    front: ([w, h]) => (
      <>
        <rect
          x={0.08}
          y={0.16}
          width={w - 0.16}
          height={h - 0.4}
          rx={0.05}
          fill={ISO.white}
        />
        <text
          x={w / 2}
          y={0.74}
          textAnchor="middle"
          fontSize={0.33}
          fontWeight={800}
          fill={ISO.red}
          fontFamily="DM Sans, Arial, sans-serif"
        >
          24/7
        </text>
        <rect
          x={0.18}
          y={0.96}
          width={0.5}
          height={0.14}
          rx={0.05}
          fill={ISO.grey}
        />
        <rect
          x={0.32}
          y={1.18}
          width={0.5}
          height={0.14}
          rx={0.05}
          fill="#f6c3bd"
        />
        <rect
          x={w / 2 - 0.12}
          y={h - 0.15}
          width={0.24}
          height={0.05}
          rx={0.025}
          fill={ISO.grey}
        />
      </>
    ),
  });
  return iso.svg();
}

/** A map tile where one route forks three ways, with a pin at each end. */
function flexibleIcon() {
  const x0 = -1,
    z0 = -0.8,
    w = 2,
    d = 1.6,
    top = 0.14;
  const at = (u: number, v: number) => [u * w, v * d] as const;
  const start = at(0.14, 0.86),
    hub = at(0.46, 0.6);
  const ends = [at(0.22, 0.17), at(0.88, 0.22), at(0.86, 0.84)];
  const routes = [
    `M${start} Q${at(0.24, 0.66)} ${hub}`,
    `M${hub} Q${at(0.3, 0.42)} ${ends[0]}`,
    `M${hub} Q${at(0.72, 0.52)} ${ends[1]}`,
    `M${hub} Q${at(0.66, 0.74)} ${ends[2]}`,
  ];
  const iso = new IsoDrawing();
  iso.box([x0, 0, z0], [w, top, d], ISO.wall, {
    top: () => (
      <>
        {routes.map((r) => (
          <path
            key={r}
            d={r}
            fill="none"
            stroke={ISO.ink}
            strokeWidth={0.27}
            strokeLinecap="round"
          />
        ))}
        {routes.map((r) => (
          <path
            key={r}
            d={r}
            fill="none"
            stroke={ISO.white}
            strokeWidth={0.2}
            strokeLinecap="round"
          />
        ))}
        {routes.map((r) => (
          <path
            key={r}
            d={r}
            fill="none"
            stroke={ISO.red}
            strokeWidth={0.045}
            strokeDasharray="0.09 0.08"
          />
        ))}
        <circle cx={start[0]} cy={start[1]} r={0.1} fill={ISO.ink} />
        <circle
          cx={hub[0]}
          cy={hub[1]}
          r={0.07}
          fill={ISO.white}
          {...inkLine}
        />
      </>
    ),
  });
  // Pins, far to near.
  const colors = [ISO.dark, ISO.white, ISO.red];
  ends
    .map(([u, v], i) => ({
      p: [x0 + u, top, z0 + v] as const,
      color: colors[i],
    }))
    .sort((a, b) => depth(a.p) - depth(b.p))
    .forEach(({ p, color }) =>
      iso.billboard(
        p,
        [-8, -25, 8, 0],
        <>
          <path
            d="M0 0C-1.6-5-8-8.6-8-15.4a8 8 0 1 1 16 0C8-8.6 1.6-5 0 0Z"
            fill={color}
            {...inkLine}
          />
          <circle
            cx={0}
            cy={-15.4}
            r={3}
            fill={color === ISO.white ? ISO.ink : ISO.white}
          />
        </>,
      ),
    );
  return iso.svg();
}

type Reason = { title: string; body: string; icon: ReactNode };
const reasons: Reason[] = [
  {
    title: "Tepat Waktu, Sesuai Janji",
    body: "Jadwal kirim disepakati sejak awal dan kami kawal sampai barang diterima. Anda bisa menjanjikan tanggal ke pelanggan dengan yakin.",
    icon: onTimeIcon(),
  },
  {
    title: "Aman Sampai Tujuan",
    body: "Barang ditimbang, dikemas rapi, dan dicatat sebelum berangkat, lalu ditangani dengan hati-hati dari gudang hingga ke tangan penerima.",
    icon: secureIcon(),
  },
  {
    title: "Dukungan 24/7",
    body: "Butuh kabar kiriman atau mau kirim mendadak? Tim kami siap membantu kapan pun, siang maupun malam, termasuk akhir pekan.",
    icon: supportIcon(),
  },
  {
    title: "Fleksibel Sesuai Kebutuhan",
    body: "Dari paket kecil sampai muatan palet, lewat darat, laut, atau udara. Kami bantu pilih jalur yang paling pas untuk barang, jadwal, dan anggaran Anda.",
    icon: flexibleIcon(),
  },
];

export default function WhyUs() {
  return (
    <section
      className="why section"
      id="kenapa-kami"
      aria-labelledby="why-heading"
    >
      <div className="why-intro">
        <span className="eyebrow">KENAPA MEMILIH 3 DAYA TERANG</span>
        <h2 id="why-heading">
          Kiriman Anda,
          <br />
          <span>prioritas kami.</span>
        </h2>
        <p>
          Setiap kiriman membawa janji Anda kepada pelanggan. Kami menjaganya
          lewat jadwal yang jelas, penanganan yang teliti, dan tim yang selalu
          bisa dihubungi.
        </p>
      </div>
      <ul className="why-list">
        {reasons.map((reason) => (
          <li className="why-item" key={reason.title}>
            <span className="why-icon">{reason.icon}</span>
            <div>
              <h3>{reason.title}</h3>
              <p>{reason.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
