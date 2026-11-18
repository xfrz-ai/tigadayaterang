"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { services, type Service } from "./service-data";

const ServiceIllustration = dynamic(() => import("./ServiceIllustration"), {
  ssr: false,
});
function ServiceCard({
  service,
  index,
  active,
  onSelect,
}: {
  service: Service;
  index: number;
  active: boolean;
  onSelect: (service: string) => void;
}) {
  const card = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false),
    [loaded, setLoaded] = useState(false),
    [hovered, setHovered] = useState(false);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const preload = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLoaded(true);
          preload.disconnect();
        }
      },
      { rootMargin: "260px" },
    );
    const observer = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.01 },
    );
    preload.observe(el);
    observer.observe(el);
    return () => {
      preload.disconnect();
      observer.disconnect();
    };
  }, []);
  return (
    <article
      ref={card}
      className={`cargo-service-card${hovered ? " is-engaged" : ""}`}
      data-service={service.kind}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
    >
      <div
        className="cargo-service-art"
        role="img"
        aria-label={service.description}
      >
        <span className="cargo-service-index" aria-hidden="true">
          0{index + 1} /
        </span>
        {loaded && (
          <ServiceIllustration
            kind={service.kind}
            running={active && visible}
            hovered={hovered}
          />
        )}
      </div>
      <div className="cargo-service-caption">
        <h3>
          {service.lines[0]}
          <br />
          {service.lines[1]}
        </h3>
        <button
          className="cargo-service-arrow"
          aria-label={`Tanya layanan ${service.title}`}
          onClick={() => onSelect(service.title)}
        >
          <svg
            viewBox="0 0 24 24"
            width="23"
            height="23"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 18 18 6M6 6h12v12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </article>
  );
}
export default function Services({
  onSelect,
}: {
  onSelect: (service: string) => void;
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setActive(!document.hidden && !motion.matches);
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <section
      className="cargo-services"
      id="services"
      aria-labelledby="cargo-services-heading"
    >
      <div className="cargo-services-inner">
        <div className="cargo-services-heading">
          <span className="eyebrow">LAYANAN KAMI / TIGA JALUR, SATU MITRA</span>
          <h2 id="cargo-services-heading">
            Solusi Kargo yang Aman
            <br className="cargo-heading-break" /> dan Bisa Diandalkan.
          </h2>
        </div>
        <div className="cargo-service-grid">
          {services.map((service, index) => (
            <ServiceCard
              key={service.kind}
              service={service}
              index={index}
              active={active}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
