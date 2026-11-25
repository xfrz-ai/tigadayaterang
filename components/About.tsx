"use client";
import { type CSSProperties, useEffect, useRef } from "react";

const STATEMENT =
  "Kami percaya setiap kiriman layak diurus dengan serius. Karena itu tim kami turun langsung, dari gudang sampai barang tiba di tujuan, lewat darat, laut, maupun udara, dengan tarif yang jelas sejak awal.";

/** Letters the colour fades over, from red at the front to ink behind it. */
const TRAIL = 14;

/**
 * Each word is kept whole on its line; each letter carries its place in the
 * text and its own fixed tilt, lift and zoom for when the scroll jumbles it.
 */
const WORDS = (() => {
  let i = 0;
  return STATEMENT.split(" ").map((word) =>
    [...word].map((char) => {
      const n = i++;
      return {
        char,
        i: n,
        tilt: `${(((n * 37) % 17) - 8) * 0.6}deg`,
        lift: `${(((n * 53) % 11) - 5) * 0.016}em`,
        zoom: 0.04 + ((n * 29) % 7) * 0.012,
      };
    }),
  );
})();
const LETTERS = WORDS.reduce((n, w) => n + w.length, 0);

/**
 * About: one big statement filling the screen. It stays pinned while the page
 * scrolls, and the scroll inks it in letter by letter, a red front with solid
 * ink behind. While the page is moving, the letters around the front jumble:
 * zoomed, tilted and knocked off the line, settling once scrolling stops.
 * With reduced motion it is simply solid and still.
 */
export default function About() {
  const section = useRef<HTMLElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = section.current,
      body = text.current;
    if (!el || !body) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      // How much the letters are jumbled: 1 while scrolling, easing to 0.
      jumble = 0,
      lastScroll = -Infinity;
    const update = (now: number) => {
      frame = 0;
      if (motion.matches) {
        body.style.setProperty("--p", String(LETTERS + TRAIL));
        body.style.setProperty("--v", "0");
        return;
      }
      // Starts as the section's top nears the top of the screen and is done a
      // little before the pinned stretch ends, so the full statement holds.
      const rect = el.getBoundingClientRect();
      const start = innerHeight * 0.3;
      const span = start + (rect.height - innerHeight) * 0.85;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / span));
      body.style.setProperty("--p", (progress * (LETTERS + TRAIL)).toFixed(2));
      const target = now - lastScroll < 140 ? 1 : 0;
      jumble += (target - jumble) * (target ? 0.2 : 0.1);
      if (jumble < 0.004) jumble = 0;
      body.style.setProperty("--v", jumble.toFixed(3));
      // Keep easing until the letters have settled.
      if (jumble > 0) queue();
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      lastScroll = performance.now();
      queue();
    };
    update(performance.now());
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", queue);
    motion.addEventListener("change", queue);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", queue);
      motion.removeEventListener("change", queue);
    };
  }, []);
  return (
    <section
      className="about"
      id="tentang-kami"
      ref={section}
      aria-labelledby="about-heading"
    >
      <div className="about-pin">
        <h2 className="about-label" id="about-heading">
          Tentang kami
        </h2>
        <p
          className="about-statement"
          ref={text}
          style={{ "--trail": TRAIL } as CSSProperties}
        >
          <span className="sr-only">{STATEMENT}</span>
          <span aria-hidden="true">
            {WORDS.map((word, w) => (
              <span key={w}>
                <span className="about-word">
                  {word.map(({ char, i, tilt, lift, zoom }) => (
                    <span
                      key={i}
                      className="about-char"
                      style={
                        {
                          "--i": i,
                          "--tilt": tilt,
                          "--lift": lift,
                          "--zoom": zoom,
                        } as CSSProperties
                      }
                    >
                      {char}
                    </span>
                  ))}
                </span>{" "}
              </span>
            ))}
          </span>
        </p>
      </div>
    </section>
  );
}
