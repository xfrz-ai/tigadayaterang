"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { WhatsAppIcon } from "./icons";
import { useLazyScene } from "./use-lazy-scene";

const ContactScene = dynamic(() => import("./ContactScene"), { ssr: false });

/** Closing call to action: a red panel with the copy beside a parked truck. */
export default function Contact({ onContact }: { onContact: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const { loaded, running } = useLazyScene(stage);
  return (
    <section
      className="contact section"
      id="hubungi-kami"
      aria-labelledby="contact-heading"
    >
      <div className="contact-panel">
        <div className="contact-copy">
          <span className="eyebrow">KIRIM BERSAMA 3 DAYA TERANG</span>
          <h2 id="contact-heading">
            Punya kiriman?
            <br />
            <span>Kami siap berangkat.</span>
          </h2>
          <p>
            Ceritakan barang, asal, dan tujuannya. Tim kami bantu pilih jalur
            dan jadwal yang paling pas, lalu mengawal kiriman Anda sampai tiba.
          </p>
          <button className="button outline" onClick={onContact}>
            Hubungi kami
            <WhatsAppIcon />
          </button>
        </div>
        <div
          className="contact-scene"
          ref={stage}
          role="img"
          aria-label="Ilustrasi 3D truk hitam 3 Daya Terang yang siap berangkat, dengan beberapa kardus di atas palet di sampingnya"
        >
          {loaded && <ContactScene running={running} />}
        </div>
      </div>
    </section>
  );
}
