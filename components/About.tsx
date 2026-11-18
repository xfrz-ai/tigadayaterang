"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { useLazyScene } from "./use-lazy-scene";

const AboutScene = dynamic(() => import("./AboutScene"), { ssr: false });

const FACTS = [
  ["Berbasis di", "Bekasi"],
  ["Melayani", "Jabodetabek"],
  ["Jalur kirim", "Darat · Laut · Udara"],
] as const;

export default function About({ onContact }: { onContact: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const { loaded, running } = useLazyScene(stage);
  return (
    <section
      className="company"
      id="tentang-kami"
      aria-labelledby="company-heading"
    >
      <div className="company-inner">
        <span className="eyebrow">TENTANG KAMI / PT TIGA DAYA TERANG</span>
        <h2 id="company-heading">
          <span className="company-line">Menjadikan setiap</span>{" "}
          <span className="company-line company-line-indent">
            pengiriman <span className="company-accent">lebih mudah.</span>
          </span>
        </h2>
        <div className="company-stage" ref={stage}>
          <div
            className="company-scene"
            role="img"
            aria-label="Ilustrasi 3D truk 3 Daya Terang dengan sisi terbuka berisi palet barang, sementara seorang pekerja memuat kardus dari tumpukan di dekatnya"
          >
            {loaded && <AboutScene running={running} />}
          </div>
          <div className="company-copy">
            <p>
              PT Tiga Daya Terang adalah perusahaan jasa pengiriman barang,
              logistik, dan ekspedisi yang berbasis di Bekasi dan melayani
              Jabodetabek. Didukung tim profesional yang berpengalaman, kami
              mengirim berbagai jenis barang dengan cepat, aman, dan terpercaya,
              lewat pilihan pengiriman yang menyesuaikan kebutuhan Anda.
            </p>
            <dl className="company-facts">
              {FACTS.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <button className="button outline" onClick={onContact}>
              Diskusikan kiriman Anda
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 18 18 6M6 6h12v12"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
