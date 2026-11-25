import type { CSSProperties, ReactNode } from "react";

// Outline icons from Lucide (ISC licence), drawn in the tag's text colour.
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const ICONS: Record<string, ReactNode> = {
  land: (
    <g {...line}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </g>
  ),
  sea: (
    <g {...line}>
      <path d="M12 10.19V14M12 2v3M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6M19.38 20A11.6 11.6 0 0 0 21 14l-8.19-3.64a2 2 0 0 0-1.62 0L3 14a11.6 11.6 0 0 0 2.81 7.76M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </g>
  ),
  air: (
    <g {...line}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </g>
  ),
};

/** The three ways we ship, pinned across the headline like stickers. */
const TAGS = [
  { key: "land", label: "Logistik darat" },
  { key: "sea", label: "Logistik laut" },
  { key: "air", label: "Logistik udara" },
] as const;

/**
 * Hero headline: two lines of big type with the services stuck over it at an
 * angle. The tags drop in one after another and straighten on hover; each one
 * jumps to the services section.
 */
export default function HeroTitle() {
  return (
    <div className="hero-title">
      <h1>
        <span className="hero-line">Kirim aman.</span>{" "}
        <span className="hero-line hero-accent">
          Tarif <br className="hero-break" />
          bersahabat.
        </span>
      </h1>
      <ul className="hero-tags" aria-label="Layanan kami">
        {TAGS.map(({ key, label }, i) => (
          <li
            key={key}
            className={`hero-tag hero-tag-${key}`}
            style={{ "--i": i } as CSSProperties}
          >
            <a href="#services">
              <span className="hero-tag-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  {ICONS[key]}
                </svg>
              </span>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
