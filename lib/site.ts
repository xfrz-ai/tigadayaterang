/** Site-wide constants used by metadata, structured data and the sitemap. */
export const SITE_URL = "https://3dayaterang.id";
export const SITE_NAME = "3 Daya Terang";
export const SITE_LEGAL_NAME = "PT Tiga Daya Terang";
export const SITE_TAGLINE = "Barang tiba. Bisnis melaju.";
export const SITE_TITLE =
  "3 Daya Terang | Jasa Ekspedisi & Logistik Bekasi–Jabodetabek";
export const SITE_DESCRIPTION =
  "PT Tiga Daya Terang melayani jasa pengiriman barang, logistik, dan ekspedisi dari Bekasi untuk Jabodetabek via darat, laut, dan udara. Cepat, aman, terpercaya.";
/** Where the business is based and the area it serves. */
export const SITE_LOCALITY = "Bekasi";
export const SITE_REGION = "Jawa Barat";
export const SITE_AREA = "Jabodetabek";
export const SITE_AREA_CITIES = [
  "Jakarta",
  "Bogor",
  "Depok",
  "Tangerang",
  "Bekasi",
];
export const SITE_KEYWORDS = [
  "3 Daya Terang",
  "PT Tiga Daya Terang",
  "ekspedisi Bekasi",
  "jasa logistik Bekasi",
  "jasa pengiriman barang Jabodetabek",
  "jasa logistik",
  "jasa ekspedisi",
  "jasa pengiriman barang",
  "ekspedisi darat",
  "transportasi darat",
  "kargo laut",
  "pengiriman antarpulau",
  "kargo udara",
  "pengiriman kargo",
  "perusahaan logistik Indonesia",
];
/** Logo files in public/logo (URL-encoded: the file names contain spaces). */
export const LOGO_FILE = "public/logo/Logo Tiga Daya Terang.png";
export const LOGO = "/logo/Logo%20Tiga%20Daya%20Terang.png";
export const FAVICON = "/logo/Logo%20Tiga%20Daya%20Terang%20-%20favicon.png";
export const THEME_COLOR = "#f6f5f1";
export const BRAND_RED = "#ed4135";
export const INK = "#242827";

/** Office address, shown in the footer and used in the structured data. */
export const ADDRESS = {
  building: "Ruko Green Village No. 3",
  street: "Jl. Sirojul Munir RT 010 RW 03",
  area: "Jatisari, Jatiasih",
  city: "Kota Bekasi",
  region: "Jawa Barat",
  postalCode: "17426",
};
export const ADDRESS_FULL = `${ADDRESS.building}, ${ADDRESS.street}, ${ADDRESS.area}, ${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.postalCode}`;
export const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_FULL)}`;
/** `schema` is the international format used in the structured data. */
export const PHONE = {
  display: "(021) 2928 4542",
  href: "tel:+622129284542",
  schema: "+62-21-2928-4542",
};
export const WHATSAPP = {
  display: "0821 1494 4419",
  href: "https://wa.me/6282114944419",
  schema: "+62-821-1494-4419",
};
/**
 * Social profiles shown in the footer.
 * TODO: these point at each platform's home page until the company's profile
 * URLs are known. Put the real URLs here, and add them to the Organization's
 * `sameAs` in app/layout.tsx.
 */
export const SOCIAL = [
  { name: "Facebook", url: "https://www.facebook.com/" },
  { name: "Threads", url: "https://www.threads.net/" },
  { name: "Instagram", url: "https://www.instagram.com/" },
] as const;
