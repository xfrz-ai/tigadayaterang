"use client";
import Lenis from "lenis";
import { useEffect } from "react";

let lenis: Lenis | null = null;

/**
 * Smooth, eased scrolling for the mouse wheel and trackpad (Lenis), and eased
 * jumps for every in-page "#section" link. Touch scrolling stays native, and
 * with reduced motion Lenis jumps instead of gliding.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const instance = new Lenis({
      autoRaf: true,
      // Scrollable panels (the menu) keep their own native scrolling.
      allowNestedScroll: true,
    });
    lenis = instance;
    // In-page links glide to their section, which lands below the header
    // (Lenis honours the html scroll-padding-top and scroll-margin-top).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as Element).closest?.('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!hash) return;
      const target = hash === "#" ? null : document.getElementById(hash.slice(1));
      if (hash !== "#" && !target) return;
      e.preventDefault();
      // A menu link is clicked while the open menu holds the page still.
      instance.start();
      instance.scrollTo(target ?? 0);
      history.pushState(null, "", hash);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      instance.destroy();
      if (lenis === instance) lenis = null;
    };
  }, []);
}

/** Holds the page still while a panel is open, then lets it scroll again. */
export function lockScroll(locked: boolean) {
  if (locked) lenis?.stop();
  else lenis?.start();
}

/** Glides the page to `y` (jumps when there is no smooth scrolling). */
export function scrollToY(y: number) {
  if (lenis) {
    lenis.start();
    lenis.scrollTo(y);
  } else window.scrollTo({ top: y });
}
