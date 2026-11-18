"use client";
import dynamic from "next/dynamic";
import About from "@/components/About";
import Brand from "@/components/Brand";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";
import { WhatsAppIcon } from "@/components/icons";
import Services from "@/components/Services";
import Testimonials from "@/components/Testimonials";
import WhyUs from "@/components/WhyUs";
import { services } from "@/components/service-data";
import { useCallback, useEffect, useRef, useState } from "react";
const LogisticsScene = dynamic(() => import("@/components/LogisticsScene"), {
  ssr: false,
});
function Arrow() {
  return (
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
  );
}
export default function Home() {
  const [selectedService, setSelectedService] = useState(
    "Angkutan barang (freight)",
  );
  const [menu, setMenu] = useState(false),
    [paused, setPaused] = useState(false),
    [ready, setReady] = useState(false),
    [tour, setTour] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setPaused(media.matches);
    const onMotion = () => setPaused(media.matches);
    media.addEventListener("change", onMotion);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    if (sceneRef.current) observer.observe(sceneRef.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  function openQuote() {
    setSubmitted(false);
    dialog.current?.showModal();
    setMenu(false);
  }
  return (
    <main>
      <section className="hero" id="home">
        <header className="header">
          <Brand />
          <nav
            aria-label="Navigasi utama"
            className={menu ? "nav open" : "nav"}
          >
            <a href="#services" onClick={() => setMenu(false)}>
              Layanan
            </a>
            <a href="#tentang-kami" onClick={() => setMenu(false)}>
              Tentang kami
            </a>
            <a href="#testimoni" onClick={() => setMenu(false)}>
              Testimoni
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              Cara kerja
            </a>
          </nav>
          <button className="header-cta" onClick={openQuote}>
            <span className="header-cta-label">Hubungi kami</span>
            <WhatsAppIcon />
          </button>
          <button
            className="menu-toggle"
            aria-label={menu ? "Tutup menu" : "Buka menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? "✕" : "☰"}
          </button>
        </header>
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="red-dot" /> JASA LOGISTIK DARAT · LAUT · UDARA
          </div>
          <h1>
            Barang tiba.
            <br />
            <span>Bisnis melaju.</span>
          </h1>
          <p>
            Ambisi besar butuh logistik yang mulus.
            <br className="desktop-break" /> Kami urus perjalanannya, Anda fokus
            melangkah.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={openQuote}>
              Mulai kirim <Arrow />
            </button>
            <button
              className="watch-button"
              onClick={() => {
                setTour(!tour);
                document
                  .getElementById("hub-tour")
                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
            >
              <span className="play-icon">
                {tour ? (
                  "−"
                ) : (
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="m4 2 6 4-6 4z" fill="currentColor" />
                  </svg>
                )}
              </span>
              Lihat kami beraksi
            </button>
          </div>
        </div>
        <div
          className={`scene ${ready ? "is-ready" : ""}`}
          ref={sceneRef}
          role="img"
          aria-label="Ilustrasi 3D pusat logistik: truk pengiriman merah, forklift, pekerja membawa paket, dan gudang dengan pintu bongkar muat yang bergerak"
        >
          <LogisticsScene
            paused={paused || !visible || hidden}
            onReady={onReady}
          />
          {!ready && (
            <div className="scene-loading">
              <span />
              Menyiapkan armada
            </div>
          )}
        </div>
        <div className="scene-status" id="hub-tour">
          <span className={`status-dot ${paused ? "stopped" : ""}`} />
          <button
            onClick={() => setPaused(!paused)}
            aria-label={paused ? "Putar animasi" : "Jeda animasi"}
          >
            {paused ? (
              <svg viewBox="0 0 12 12">
                <path d="m3 2 7 4-7 4z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12">
                <path d="M4 2v8M8 2v8" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
        {tour && (
          <aside className="tour-panel">
            <button
              className="close-small"
              aria-label="Tutup tur"
              onClick={() => setTour(false)}
            >
              ×
            </button>
            <span className="eyebrow">DUNIA KECIL YANG TAK PERNAH DIAM</span>
            <h3>Setiap gerak saling terhubung.</h3>
            <p>
              Ikuti truk yang datang dan pergi, forklift yang sibuk memindahkan
              palet, dan aktivitas di area bongkar muat. Ilustrasi 3D ini
              menghidupkan perjalanan barang Anda bersama 3 Daya Terang.
            </p>
            <a href="#how-it-works" onClick={() => setTour(false)}>
              Lihat cara kerja kami <Arrow />
            </a>
          </aside>
        )}
      </section>
      <Services
        onSelect={(service) => {
          setSelectedService(service);
          openQuote();
        }}
      />
      <About onContact={openQuote} />
      <WhyUs onStart={openQuote} />
      <Testimonials />
      <section className="process section" id="how-it-works">
        <div className="process-intro">
          <span className="eyebrow">
            LEBIH SEDERHANA. LEBIH BANYAK PELUANG.
          </span>
          <h2>
            Alurnya jelas.
            <br />
            Dari gudang ke <span>tujuan.</span>
          </h2>
          <p>
            Logistik yang baik seharusnya terasa ringan. Kami jaga setiap
            bagiannya tetap terhubung, dan Anda selalu tahu perkembangannya.
          </p>
          <button className="button primary" onClick={openQuote}>
            Rencanakan pengiriman <Arrow />
          </button>
        </div>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <h3>Ceritakan kebutuhan Anda.</h3>
              <p>
                Barang apa, berapa banyak, dari mana, dan ke mana. Semuanya
                dimulai dari satu percakapan.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Kami susun rencananya.</h3>
              <p>
                Angkutan, penyimpanan, dan pengantaran dirangkai dalam satu
                rencana yang pas untuk bisnis Anda.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Barang jalan, bisnis melaju.</h3>
              <p>
                Dengan satu kontak yang jelas dan perjalanan yang terkoordinasi,
                langkah berikutnya selalu terlihat.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <Contact onContact={openQuote} />
      <Footer onQuote={openQuote} />
      <dialog
        ref={dialog}
        aria-label="Buat ringkasan pengiriman"
        className="quote-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          className="dialog-close"
          aria-label="Tutup formulir"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        {submitted ? (
          <div className="success-message">
            <span className="success-icon">↗</span>
            <span className="eyebrow">LANGKAH BERIKUTNYA SUDAH SIAP</span>
            <h2>
              Siap kita
              <br />
              berangkatkan.
            </h2>
            <p>
              Ringkasan pengiriman Anda sudah diunduh. Formulir ini belum
              mengirimkan data ke tim kami.
            </p>
            <button
              className="button primary"
              onClick={() => dialog.current?.close()}
            >
              Kembali ke halaman <Arrow />
            </button>
          </div>
        ) : (
          <>
            <span className="eyebrow">RENCANA BESAR DIMULAI DI SINI</span>
            <h2>
              Mau kirim
              <br />
              ke mana?
            </h2>
            <p>
              Buat ringkasan singkat pengiriman Anda sebagai bahan diskusi
              logistik berikutnya.
            </p>
            <form
              ref={form}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const brief = `3 DAYA TERANG — RINGKASAN PENGIRIMAN\n\nNama: ${data.get("name")}\nEmail: ${data.get("email")}\nLayanan: ${data.get("service")}\nAsal: ${data.get("origin")}\nTujuan: ${data.get("destination")}\nDetail: ${data.get("details")}\n\nDibuat di perangkat Anda. Belum ada permintaan yang terkirim.\n`;
                const url = URL.createObjectURL(
                  new Blob([brief], { type: "text/plain" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "3-daya-terang-ringkasan-pengiriman.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setSubmitted(true);
              }}
            >
              <div className="form-row">
                <label>
                  Nama Anda
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Budi Santoso"
                    required
                  />
                </label>
                <label>
                  Email kantor
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="budi@perusahaan.co.id"
                    required
                  />
                </label>
              </div>
              <label>
                Layanan yang dibutuhkan
                <select
                  name="service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.kind}>{s.title}</option>
                  ))}
                  <option>Angkutan barang (freight)</option>
                  <option>Pergudangan &amp; fulfillment</option>
                  <option>Pengantaran last-mile</option>
                  <option>Solusi logistik terpadu</option>
                </select>
              </label>
              <div className="form-row">
                <label>
                  Dikirim dari
                  <input
                    name="origin"
                    placeholder="Kota atau wilayah"
                    required
                  />
                </label>
                <label>
                  Tujuan pengiriman
                  <input
                    name="destination"
                    placeholder="Kota atau wilayah"
                    required
                  />
                </label>
              </div>
              <label>
                Ceritakan sedikit tentang kiriman Anda
                <textarea
                  name="details"
                  rows={3}
                  placeholder="Barang apa, berapa banyak, dan kapan?"
                  required
                />
              </label>
              <button className="button primary" type="submit">
                Buat ringkasan pengiriman <Arrow />
              </button>
              <small>
                Ringkasan diunduh ke perangkat Anda. Data tidak dikirim ke mana
                pun.
              </small>
            </form>
          </>
        )}
      </dialog>
    </main>
  );
}
