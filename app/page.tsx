"use client";
import dynamic from "next/dynamic";
import About from "@/components/About";
import Brand from "@/components/Brand";
import Footer from "@/components/Footer";
import HeroTitle from "@/components/HeroTitle";
import MenuDrawer from "@/components/MenuDrawer";
import Contact from "@/components/Contact";
import { WhatsAppIcon } from "@/components/icons";
import LoadSimulator from "@/components/LoadSimulator";
import Services from "@/components/Services";
import { useSmoothScroll } from "@/components/smooth-scroll";
import Testimonials from "@/components/Testimonials";
import TodayHours from "@/components/TodayHours";
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
  // The header is fixed at the top; it tightens once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useSmoothScroll();
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
          <div className="header-start">
            <button
              className="menu-toggle"
              aria-label="Buka menu"
              aria-expanded={menu}
              aria-controls="menu-drawer"
              onClick={() => setMenu(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 8.5h16M4 15.5h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="menu-toggle-label">Menu</span>
            </button>
          </div>
          <Brand />
          <div className="header-end">
            <TodayHours className="header-hours" />
            <a className="header-cta" href={chatUrl} {...EXTERNAL}>
              <span className="header-cta-label">Hubungi kami</span>
              <span className="header-cta-icon">
                <WhatsAppIcon />
              </span>
            </a>
          </div>
        </header>
        <div className="hero-copy">
          <HeroTitle />
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
      </section>
      <About />
      <Services />
      <LoadSimulator />
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
