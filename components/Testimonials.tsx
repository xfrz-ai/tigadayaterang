"use client";
import { useRef, useState } from "react";
import { testimonials } from "./testimonial-data";

const photos = testimonials.flatMap((review) =>
  review.photos.map((photo) => ({ ...photo, review })),
);
const pad = (n: number) => String(n).padStart(2, "0");

function QuoteMark() {
  return (
    <svg viewBox="0 0 50 40" fill="none" aria-hidden="true">
      {[0, 26].map((x) => (
        <path
          key={x}
          transform={`translate(${x} 0)`}
          d="M4 3h14a2 2 0 0 1 2 2v13c0 9-5 15.5-13 18.5l-1.6-3.3c4.6-2.4 7-6 7.5-10.7H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
function Stars({ rating }: { rating: number }) {
  return (
    <span className="testimonial-stars">
      <span className="sr-only">Rating {rating} dari 5</span>
      {Array.from({ length: rating }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="m12 2.6 2.8 6 6.6.7-4.9 4.5 1.4 6.5L12 17l-5.9 3.3 1.4-6.5-4.9-4.5 6.6-.7Z"
          />
        </svg>
      ))}
    </span>
  );
}
function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={back ? "M20 12H5m6-6-6 6 6 6" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Testimonials() {
  const [active, setActive] = useState(0),
    [photo, setPhoto] = useState(0);
  const viewer = useRef<HTMLDialogElement>(null);
  const shown = photos[photo];
  const step = (by: number) =>
    setPhoto((p) => (p + by + photos.length) % photos.length);
  return (
    <section
      className="testimonials section"
      id="testimoni"
      aria-labelledby="testimonials-heading"
    >
      <div className="testimonials-head">
        <div>
          <span className="eyebrow">TESTIMONI / CERITA PELANGGAN</span>
          <h2 id="testimonials-heading">
            Kiriman sampai utuh,
            <br />
            pelanggan <span>tenang.</span>
          </h2>
        </div>
        <p>
          Cerita dari pelanggan kami, lengkap dengan dokumentasi barangnya:
          ditimbang, dikemas, dan dicatat sebelum berangkat.
        </p>
      </div>
      <div
        className="testimonial-panel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Testimoni pelanggan"
      >
        <div className="testimonial-slides" aria-live="polite">
          {testimonials.map((review, i) => (
            <article
              key={review.name}
              className={`testimonial-slide${i === active ? " is-active" : ""}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${testimonials.length}`}
              inert={i !== active}
            >
              <div className="testimonial-quote">
                <QuoteMark />
                <blockquote>
                  <p>{review.quote}</p>
                </blockquote>
                <footer className="testimonial-author">
                  <span className="testimonial-mark" aria-hidden="true">
                    <span>
                      {review.name[0]}
                      <b>.</b>
                    </span>
                  </span>
                  <div>
                    <cite>{review.name}</cite>
                    <span>{review.detail}</span>
                    <Stars rating={review.rating} />
                  </div>
                </footer>
              </div>
              <div className="testimonial-photos">
                {review.photos.map((p, j) => (
                  <button
                    key={p.src}
                    className="testimonial-photo"
                    aria-label={`Perbesar foto: ${p.alt}`}
                    onClick={() => {
                      setPhoto(photos.findIndex((x) => x.src === p.src));
                      viewer.current?.showModal();
                    }}
                  >
                    <img
                      src={p.src}
                      alt={p.alt}
                      width={600}
                      height={400}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="photo-caption" aria-hidden="true">
                      {pad(j + 1)} · {p.caption}
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="testimonial-nav">
          {testimonials.map((review, i) => (
            <button
              key={review.name}
              aria-label={`Tampilkan testimoni ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
            >
              <span />
            </button>
          ))}
        </div>
      </div>
      <dialog
        ref={viewer}
        className="photo-dialog"
        aria-label="Galeri foto pengiriman"
        onClick={(e) => {
          if (e.target === viewer.current) viewer.current.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <figure>
          <img src={shown.src} alt={shown.alt} width={600} height={400} />
          <figcaption>
            <span className="photo-count">
              {pad(photo + 1)} / {pad(photos.length)}
            </span>
            <span>
              <strong>{shown.caption}</strong>
              {shown.review.detail}
            </span>
          </figcaption>
        </figure>
        <div className="photo-controls">
          <button aria-label="Foto sebelumnya" onClick={() => step(-1)}>
            <Chevron back />
          </button>
          <button aria-label="Foto berikutnya" onClick={() => step(1)}>
            <Chevron />
          </button>
        </div>
        <button
          className="photo-close"
          aria-label="Tutup galeri"
          onClick={() => viewer.current?.close()}
        >
          ×
        </button>
      </dialog>
    </section>
  );
}
