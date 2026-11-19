"use client";
import dynamic from "next/dynamic";
import About from "@/components/About";
import Brand from "@/components/Brand";
import Footer from "@/components/Footer";
import MenuDrawer, { NAV_LINKS } from "@/components/MenuDrawer";
import Contact from "@/components/Contact";
import { WhatsAppIcon } from "@/components/icons";
import Services from "@/components/Services";
import Testimonials from "@/components/Testimonials";
import WhyUs from "@/components/WhyUs";
import { EXTERNAL, whatsappChat } from "@/lib/site";
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
  const [menu, setMenu] = useState(false),
    [paused, setPaused] = useState(false),
    [ready, setReady] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  // On tablets and phones the header is fixed; it tightens once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
  const chatUrl = whatsappChat();
  return (
    <main>
      <section className="hero" id="home">
        <header className={scrolled ? "header is-scrolled" : "header"}>
          <Brand />
          <nav aria-label="Navigasi utama" className="nav">
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <a className="header-cta" href={chatUrl} {...EXTERNAL}>
            <span className="header-cta-label">Hubungi kami</span>
            <WhatsAppIcon />
          </a>
          <button
            className="menu-toggle"
            aria-label="Buka menu"
            aria-expanded={menu}
            aria-controls="menu-drawer"
            onClick={() => setMenu(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 6.5h18M3 12h18M9 17.5h12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="red-dot" /> JASA LOGISTIK DARAT · LAUT · UDARA
          </div>
          <h1>
            Kirim aman.
            <br />
            <span>Tarif bersahabat.</span>
          </h1>
          <p>
            Dari paket kecil sampai muatan palet, kami antar barang Anda dengan
            teliti dan tepat waktu,
            <br className="desktop-break" /> ke seluruh Jabodetabek hingga
            mancanegara. Harga jelas sejak awal.
          </p>
          <div className="hero-actions">
            <a className="button primary" href={chatUrl} {...EXTERNAL}>
              Cek tarif sekarang <Arrow />
            </a>
            <a className="watch-button" href="#services">
              <span className="play-icon">
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M6 2v8M2.8 6.8 6 10l3.2-3.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Lihat layanan kami
            </a>
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
        <div className="scene-status">
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
      </section>
      <Services />
      <About />
      <WhyUs />
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
          <a className="button primary" href={chatUrl} {...EXTERNAL}>
            Rencanakan pengiriman <Arrow />
          </a>
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
      <Contact />
      <Footer />
      <MenuDrawer open={menu} onClose={() => setMenu(false)} />
    </main>
  );
}
