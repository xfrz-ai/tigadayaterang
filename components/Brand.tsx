import { LOGO } from "@/lib/site";

/** Logo, name and line of business; links back to the top. */
export default function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Beranda Tiga Daya Terang">
      <img src={LOGO} alt="" width={500} height={500} />
      <span className="brand-text">
        Tiga Daya Terang
        <small>Freight Forwarder &amp; General Supplier</small>
      </span>
    </a>
  );
}
