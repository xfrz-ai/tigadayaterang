"use client";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import { SOCIAL } from "@/lib/site";
import Brand from "./Brand";
import { SocialIcon } from "./icons";
import { lockScroll } from "./smooth-scroll";
import TodayHours from "./TodayHours";

export const NAV_LINKS = [
  ["Tentang kami", "#tentang-kami"],
  ["Layanan", "#services"],
  ["Simulasi", "#simulasi"],
  ["Testimoni", "#testimoni"],
  ["Cara kerja", "#how-it-works"],
] as const;

/**
 * Site menu, opened from the Menu button: a panel that slides in from the left
 * with the logo, the section links, today's date and time and the social icons. The page behind it stops scrolling,
 * Escape or the backdrop closes it, and Tab stays inside while it is open.
 */
export default function MenuDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    root.classList.add("menu-locked");
    lockScroll(true);
    close.current?.focus();
    return () => {
      root.classList.remove("menu-locked");
      lockScroll(false);
      returnTo?.focus({ preventScroll: true });
    };
  }, [open]);
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab" || !panel.current) return;
    const items = panel.current.querySelectorAll<HTMLElement>("a, button");
    const first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  return (
    <div
      className={open ? "drawer is-open" : "drawer"}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer-panel"
        id="menu-drawer"
        ref={panel}
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="drawer-head" onClick={onClose}>
          <Brand />
          <button ref={close} className="drawer-close" aria-label="Tutup menu">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <nav aria-label="Navigasi utama">
          <ul>
            {NAV_LINKS.map(([label, href], i) => (
              <li key={href} style={{ "--i": i } as CSSProperties}>
                <a href={href} onClick={onClose}>
                  {label}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 12h15m-6-6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="drawer-foot">
          <span className="eyebrow">HARI INI</span>
          <TodayHours className="drawer-hours" />
          <span className="eyebrow">IKUTI KAMI</span>
          <ul className="drawer-social">
            {SOCIAL.map(({ name, url }) => (
              <li key={name}>
                <a
                  href={url}
                  aria-label={name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SocialIcon name={name} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
