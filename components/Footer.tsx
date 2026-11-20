import {
  ADDRESS,
  EXTERNAL as external,
  MAP_URL,
  PHONE,
  SITE_LEGAL_NAME,
  SOCIAL,
  WHATSAPP,
  whatsappChat,
} from "@/lib/site";
import Brand from "./Brand";
import { MapPinIcon, SocialIcon } from "./icons";
import { services } from "./service-data";

const PAGE_LINKS = [
  ["Beranda", "#home"],
  ["Simulasi muat", "#simulasi"],
  ["Tentang kami", "#tentang-kami"],
  ["Kenapa kami", "#kenapa-kami"],
  ["Testimoni", "#testimoni"],
  ["Cara kerja", "#how-it-works"],
] as const;

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <Brand />
        <ul className="footer-social" aria-label="Media sosial">
          {SOCIAL.map(({ name, url }) => (
            <li key={name}>
              <a href={url} aria-label={name} {...external}>
                <SocialIcon name={name} />
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="footer-main">
        <div className="footer-address">
          <h2 className="footer-title">Alamat</h2>
          <address>
            {ADDRESS.building}
            <br />
            {ADDRESS.street},
            <br />
            {ADDRESS.area}, {ADDRESS.city},
            <br />
            {ADDRESS.region} {ADDRESS.postalCode}
          </address>
          <a className="footer-map" href={MAP_URL} {...external}>
            <MapPinIcon />
            Lihat di peta
          </a>
        </div>
        <nav className="footer-nav" aria-label="Navigasi footer">
          <ul>
            {PAGE_LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
          <ul>
            {services.map((s) => (
              <li key={s.kind}>
                <a href="#services">{s.title}</a>
              </li>
            ))}
            <li>
              <a href={whatsappChat()} {...external}>
                Minta penawaran
              </a>
            </li>
            <li>
              <a href="#hubungi-kami">Hubungi kami</a>
            </li>
          </ul>
        </nav>
        <div className="footer-contact">
          <h2 className="footer-title">Kontak</h2>
          <ul>
            <li>
              <a href={PHONE.href}>{PHONE.display}</a>
              <span>Kantor</span>
            </li>
            <li>
              <a href={WHATSAPP.href} {...external}>
                {WHATSAPP.display}
              </a>
              <span>WhatsApp</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <small>Copyright © 2024 {SITE_LEGAL_NAME}</small>
        <a href="#home">Kembali ke atas ↑</a>
      </div>
    </footer>
  );
}
