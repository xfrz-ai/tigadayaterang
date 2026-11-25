"use client";
import dynamic from "next/dynamic";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { journeyAt, nearStop, stopProgress, STOP_COUNT } from "./journey-timeline";
import { services, type Service } from "./service-data";
import type { JourneyProgress } from "./ServicesJourney";
import { scrollToY } from "./smooth-scroll";
import { useLazyScene } from "./use-lazy-scene";

const ServicesJourney = dynamic(() => import("./ServicesJourney"), { ssr: false });

/** The services in the order the journey reaches them. */
const STOPS = (["road", "ocean", "air"] as const)
  .map((kind) => services.find((s) => s.kind === kind))
  .filter((s): s is Service => !!s)
  .slice(0, STOP_COUNT);

/**
 * Services as a journey: the section pins while the scroll drives a truck
 * down a winding road, a ship along a winding sea lane and a plane up into
 * the air. At each stop the camera closes in on the vehicle and its service
 * is explained beside it; scrolling on carries the journey to the next one.
 */
export default function Services() {
  const track = useRef<HTMLDivElement>(null),
    pin = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const progress = useMemo<JourneyProgress>(
    () => ({ value: journeyAt(0), listeners: new Set() }),
    [],
  );
  const { loaded, running, reduced } = useLazyScene(stage);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const el = track.current,
      box = pin.current;
    if (!el || !box) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const p = -rect.top / Math.max(1, rect.height - innerHeight);
      const x = journeyAt(p, motion.matches);
      progress.value = x;
      progress.listeners.forEach((listener) => listener());
      let current = -1;
      for (let i = 0; i < STOPS.length; i++) {
        const k = nearStop(x, i);
        box.style.setProperty(`--near-${i}`, k.toFixed(3));
        if (k > 0.6) current = i;
      }
      setActive(current);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    motion.addEventListener("change", queue);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
      motion.removeEventListener("change", queue);
    };
  }, [progress]);
  /** Scrolls to where stop `i` is explained. */
  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY;
    scrollToY(top + stopProgress(i) * (el.offsetHeight - innerHeight));
  }, []);
  return (
    <section className="journey" id="services" aria-labelledby="journey-heading">
      <div className="journey-intro">
        <span className="eyebrow">LAYANAN KAMI / TIGA JALUR, SATU MITRA</span>
        <h2 id="journey-heading">
          Solusi Kargo yang Aman
          <br className="journey-heading-break" /> dan Bisa Diandalkan.
        </h2>
      </div>
      <div className="journey-track" ref={track}>
        <div className="journey-pin" ref={pin}>
          <div className="journey-stage" ref={stage} aria-hidden="true">
            {loaded && (
              <ServicesJourney progress={progress} running={running} reduced={reduced} />
            )}
          </div>
          {STOPS.map((service, i) => (
            <article
              key={service.kind}
              className={`journey-stop${active === i ? " is-active" : ""}`}
              data-service={service.kind}
              style={{ "--k": `var(--near-${i}, 0)` } as CSSProperties}
            >
              <h3 className="journey-title">
                <span className="journey-word">{service.lines[0]}</span>{" "}
                <span className="journey-word">{service.lines[1]}</span>
              </h3>
              <div className="journey-card">
                <span className="journey-step">
                  0{i + 1} / 0{STOPS.length}
                </span>
                <p>{service.detail}</p>
              </div>
            </article>
          ))}
          <nav className="journey-steps" aria-label="Pilih layanan">
            {STOPS.map((service, i) => (
              <button
                key={service.kind}
                type="button"
                aria-current={active === i ? "step" : undefined}
                onClick={() => goTo(i)}
              >
                <span aria-hidden="true">0{i + 1}</span> {service.lines[1]}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
