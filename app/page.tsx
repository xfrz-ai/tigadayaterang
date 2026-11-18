"use client";
import dynamic from "next/dynamic";
import Services from "@/components/Services";
import { useCallback, useEffect, useRef, useState } from "react";
const LogisticsScene = dynamic(() => import("@/components/LogisticsScene"), {
  ssr: false,
});
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Relay home">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M3 7h20l10 11-10 11H3l10-11z" fill="currentColor" />
        <path d="M3 18h18" stroke="#f6f5f1" strokeWidth="4" />
      </svg>
      relay<span>®</span>
    </a>
  );
}
export default function Home() {
  const [selectedService, setSelectedService] = useState("Freight transport");
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
            aria-label="Main navigation"
            className={menu ? "nav open" : "nav"}
          >
            <a href="#services" onClick={() => setMenu(false)}>
              Our services
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              How it works
            </a>
            <a href="#about" onClick={() => setMenu(false)}>
              Why Relay
            </a>
          </nav>
          <button className="header-cta" onClick={openQuote}>
            Let’s talk <Arrow diagonal />
          </button>
          <button
            className="menu-toggle"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? "✕" : "☰"}
          </button>
        </header>
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="red-dot" /> ALWAYS MOVING FORWARD
          </div>
          <h1>
            Good things.
            <br />
            <span>Delivered.</span>
          </h1>
          <p>
            Big ambitions deserve seamless logistics.
            <br className="desktop-break" /> We connect every mile, so you can
            focus on what’s next.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={openQuote}>
              Let’s get moving <Arrow />
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
              See us in motion
            </button>
          </div>
        </div>
        <div
          className={`scene ${ready ? "is-ready" : ""}`}
          ref={sceneRef}
          role="img"
          aria-label="Animated isometric logistics hub with red delivery trucks, forklifts, workers carrying packages, and a warehouse with moving loading doors"
        >
          <LogisticsScene
            paused={paused || !visible || hidden}
            onReady={onReady}
          />
          {!ready && (
            <div className="scene-loading">
              <span />
              Getting things moving
            </div>
          )}
        </div>
        <div className="hero-note">
          <span className="note-cross">✳</span>
          <p>
            YOUR WORLD.
            <br />
            BETTER CONNECTED.
          </p>
        </div>
        <div className="scene-status" id="hub-tour">
          <span className={`status-dot ${paused ? "stopped" : ""}`} />
          <span>INSIDE THE RELAY HUB</span>
          <span className="status-divider" />
          <button
            onClick={() => setPaused(!paused)}
            aria-label={paused ? "Play animation" : "Pause animation"}
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
              aria-label="Close hub tour"
              onClick={() => setTour(false)}
            >
              ×
            </button>
            <span className="eyebrow">A LITTLE WORLD, ALWAYS AT WORK</span>
            <h3>Every move is connected.</h3>
            <p>
              Follow the trucks, watch the forklifts, and peek inside the
              loading bays. This live 3D illustration brings the Relay journey
              to life.
            </p>
            <a href="#how-it-works" onClick={() => setTour(false)}>
              Explore the process <Arrow />
            </a>
          </aside>
        )}
        <a className="scroll-cue" href="#services">
          A LITTLE FURTHER GOES A LONG WAY <span>↓</span>
        </a>
      </section>
      <Services
        onSelect={(service) => {
          setSelectedService(service);
          openQuote();
        }}
      />
      <section className="process section" id="how-it-works">
        <div className="process-intro">
          <span className="eyebrow">LESS COMPLEXITY. MORE POSSIBILITY.</span>
          <h2>
            A clear path.
            <br />
            From A to <span>what’s next.</span>
          </h2>
          <p>
            Great logistics should feel effortless. We keep the moving parts
            connected, and you in the picture.
          </p>
          <button className="button primary" onClick={openQuote}>
            Find your way forward <Arrow />
          </button>
        </div>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <h3>Tell us where you’re headed.</h3>
              <p>
                Your products, your priorities, your next destination. It all
                starts with a conversation.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>We connect the dots.</h3>
              <p>
                Freight, storage, and delivery come together in a plan shaped
                around your business.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>You keep moving forward.</h3>
              <p>
                With a clear point of contact and a coordinated journey, your
                next step is always in sight.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="about section" id="about">
        <span className="eyebrow">BUILT AROUND WHAT MATTERS</span>
        <h2>
          Behind every package,
          <br />
          there’s a <em>possibility.</em>
        </h2>
        <div className="about-bottom">
          <p>
            A small business taking a big leap. A new idea reaching the world.
            We believe logistics is about more than moving goods. It’s about
            moving you forward.
          </p>
          <button className="button light" onClick={openQuote}>
            Let’s build what’s next <Arrow diagonal />
          </button>
        </div>
        <div className="about-arrow" aria-hidden="true">
          ↗
        </div>
      </section>
      <footer className="footer">
        <Brand />
        <p>Good things. Delivered.</p>
        <span>© {new Date().getFullYear()} Relay · Concept experience</span>
        <a href="#home">Back to the top ↑</a>
      </footer>
      <dialog
        ref={dialog}
        aria-label="Create your shipment brief"
        className="quote-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          className="dialog-close"
          aria-label="Close enquiry"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        {submitted ? (
          <div className="success-message">
            <span className="success-icon">↗</span>
            <span className="eyebrow">YOUR NEXT STEP IS READY</span>
            <h2>
              Let’s get this
              <br />
              moving.
            </h2>
            <p>
              Your shipment brief is ready to download. This concept website
              doesn’t send enquiries to a logistics provider.
            </p>
            <button
              className="button primary"
              onClick={() => dialog.current?.close()}
            >
              Back to the hub <Arrow />
            </button>
          </div>
        ) : (
          <>
            <span className="eyebrow">BIG PLANS START HERE</span>
            <h2>
              Where are
              <br />
              we headed?
            </h2>
            <p>
              Build a quick shipment brief to take into your next logistics
              conversation.
            </p>
            <form
              ref={form}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const brief = `RELAY — SHIPMENT BRIEF\n\nName: ${data.get("name")}\nEmail: ${data.get("email")}\nService: ${data.get("service")}\nOrigin: ${data.get("origin")}\nDestination: ${data.get("destination")}\nDetails: ${data.get("details")}\n\nPrepared locally. No enquiry has been sent.\n`;
                const url = URL.createObjectURL(
                  new Blob([brief], { type: "text/plain" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "relay-shipment-brief.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setSubmitted(true);
              }}
            >
              <div className="form-row">
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    required
                  />
                </label>
                <label>
                  Work email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="alex@company.com"
                    required
                  />
                </label>
              </div>
              <label>
                What do you need?
                <select
                  name="service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  <option>Road Transportation</option>
                  <option>Ocean Freight</option>
                  <option>Air Freight</option>
                  <option>Drone Parcel Delivery</option>
                  <option>Freight transport</option>
                  <option>Warehousing & fulfillment</option>
                  <option>Last-mile delivery</option>
                  <option>A connected logistics solution</option>
                </select>
              </label>
              <div className="form-row">
                <label>
                  Moving from
                  <input name="origin" placeholder="City or region" required />
                </label>
                <label>
                  Going to
                  <input
                    name="destination"
                    placeholder="City or region"
                    required
                  />
                </label>
              </div>
              <label>
                A little about your shipment
                <textarea
                  name="details"
                  rows={3}
                  placeholder="What’s moving, how much, and when?"
                  required
                />
              </label>
              <button className="button primary" type="submit">
                Create shipment brief <Arrow />
              </button>
              <small>
                A downloadable brief. Your details stay in your browser.
              </small>
            </form>
          </>
        )}
      </dialog>
    </main>
  );
}
