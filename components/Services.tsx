"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ServiceKind } from "./service-models";

const ServiceIllustration = dynamic(() => import("./ServiceIllustration"), {
  ssr: false,
});
type Service = {
  kind: ServiceKind;
  title: string;
  lines: [string, string];
  description: string;
  /** Set to false to hide a service that is not offered yet. */
  available: boolean;
};
const allServices: Service[] = [
  {
    kind: "road",
    title: "Road Transportation",
    lines: ["Road", "Transportation"],
    description:
      "A red delivery truck with rotating wheels travels past cargo boxes.",
    available: true,
  },
  {
    kind: "ocean",
    title: "Ocean Freight",
    lines: ["Ocean", "Freight"],
    description: "A container ship floats gently among moving ripples.",
    available: true,
  },
  {
    kind: "air",
    title: "Air Freight",
    lines: ["Air", "Freight"],
    description:
      "A cargo aircraft with rotating engine fans moves gently in flight.",
    available: true,
  },
  {
    kind: "drone",
    title: "Drone Parcel Delivery",
    lines: ["Drone", "Parcel Delivery"],
    description: "A four-rotor delivery drone hovers with a suspended package.",
    // Hidden until the drone service launches.
    available: false,
  },
];
export const services = allServices.filter((s) => s.available);
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
          aria-label={`Enquire about ${service.title}`}
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
          <span className="eyebrow">OUR SERVICES / EVERY WAY FORWARD</span>
          <h2 id="cargo-services-heading">
            We Provide Safe and
            <br className="cargo-heading-break" /> Reliable Cargo Solutions.
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
