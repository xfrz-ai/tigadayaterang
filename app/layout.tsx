import type { Metadata, Viewport } from "next";
import { services } from "@/components/service-data";
import {
  ADDRESS,
  FAVICON,
  LOGO,
  PHONE,
  SITE_AREA,
  SITE_AREA_CITIES,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LEGAL_NAME,
  SITE_LOCALITY,
  SITE_NAME,
  SITE_REGION,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_URL,
  THEME_COLOR,
  WHATSAPP,
} from "@/lib/site";
import "./globals.css";

const SHARE_IMAGE = {
  // Bump ?v= when public/og.png changes so WhatsApp and Facebook refetch it.
  url: "/og.png?v=2",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "3 Daya Terang — Kirim aman. Tarif bersahabat. Jasa logistik darat, laut, dan udara.",
};
const SHARE_DESCRIPTION =
  "Dari paket kecil sampai muatan palet, kami antar barang Anda dengan teliti dan tepat waktu ke seluruh Jabodetabek hingga mancanegara. Harga jelas sejak awal.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "logistics",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: FAVICON, type: "image/png", sizes: "100x100" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

// Structured data: who the business is, the site, and the services offered.
const organizationId = `${SITE_URL}/#organization`;
const areaServed = [
  { "@type": "AdministrativeArea", name: SITE_AREA },
  ...SITE_AREA_CITIES.map((name) => ({ "@type": "City", name })),
];
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      legalName: SITE_LEGAL_NAME,
      alternateName: SITE_LEGAL_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}${LOGO}`,
      slogan: SITE_TAGLINE,
      description: SITE_DESCRIPTION,
      address: {
        "@type": "PostalAddress",
        streetAddress: `${ADDRESS.building}, ${ADDRESS.street}, ${ADDRESS.area}`,
        addressLocality: SITE_LOCALITY,
        addressRegion: SITE_REGION,
        postalCode: ADDRESS.postalCode,
        addressCountry: "ID",
      },
      telephone: PHONE.schema,
      contactPoint: [
        { name: "Kantor", telephone: PHONE.schema },
        { name: "WhatsApp", telephone: WHATSAPP.schema, url: WHATSAPP.href },
      ].map((point) => ({
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "ID",
        availableLanguage: "id",
        ...point,
      })),
      areaServed,
      knowsLanguage: "id",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Layanan logistik 3 Daya Terang",
        itemListElement: services.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: service.title,
            serviceType: service.title,
            description: service.summary,
            provider: { "@id": organizationId },
            areaServed,
          },
        })),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "id-ID",
      publisher: { "@id": organizationId },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      inLanguage: "id-ID",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": organizationId },
      primaryImageOfPage: `${SITE_URL}/og.png`,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
