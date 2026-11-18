import type { ServiceKind } from "./service-models";

export type Service = {
  kind: ServiceKind;
  title: string;
  /** Card heading, split over two lines. */
  lines: [string, string];
  /** Alt text for the animated illustration. */
  description: string;
  /** Plain-language summary used in structured data for search engines. */
  summary: string;
  /** Set to false to hide a service that is not offered yet. */
  available: boolean;
};

const allServices: Service[] = [
  {
    kind: "road",
    title: "Transportasi Darat",
    lines: ["Transportasi", "Darat"],
    description:
      "Truk pengiriman merah dengan roda berputar melaju melewati tumpukan kargo.",
    summary:
      "Pengiriman barang via jalur darat menggunakan armada truk untuk distribusi antarkota.",
    available: true,
  },
  {
    kind: "ocean",
    title: "Kargo Laut",
    lines: ["Kargo", "Laut"],
    description:
      "Kapal kontainer berlayar tenang di antara riak ombak, ditemani lumba-lumba yang melompat.",
    summary:
      "Pengiriman kargo dan kontainer via jalur laut untuk muatan besar dan pengiriman antarpulau.",
    available: true,
  },
  {
    kind: "air",
    title: "Kargo Udara",
    lines: ["Kargo", "Udara"],
    description:
      "Pesawat kargo dengan kipas mesin berputar terbang dengan tenang.",
    summary:
      "Pengiriman kargo via jalur udara untuk barang yang perlu sampai lebih cepat.",
    available: true,
  },
  {
    kind: "drone",
    title: "Pengiriman Paket Drone",
    lines: ["Pengiriman", "Paket Drone"],
    description:
      "Drone pengiriman empat baling-baling melayang membawa paket yang tergantung.",
    summary: "Pengiriman paket ringan menggunakan drone.",
    // Hidden until the drone service launches.
    available: false,
  },
];

export const services = allServices.filter((s) => s.available);
