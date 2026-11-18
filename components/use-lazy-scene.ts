"use client";
import { type RefObject, useEffect, useState } from "react";

/**
 * Loads a WebGL scene once its stage comes near the viewport, and says when it
 * may animate: on screen, tab visible and reduced motion off.
 */
export function useLazyScene(stage: RefObject<HTMLElement | null>) {
  const [loaded, setLoaded] = useState(false),
    [visible, setVisible] = useState(false),
    [active, setActive] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const preload = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLoaded(true);
          preload.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    const observer = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.01 },
    );
    preload.observe(el);
    observer.observe(el);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setActive(!document.hidden && !motion.matches);
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      preload.disconnect();
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [stage]);
  return { loaded, running: active && visible };
}
