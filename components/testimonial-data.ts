export type ShipmentPhoto = {
  src: string;
  /** Describes the photo for screen readers and search. */
  alt: string;
  /** Short label shown on the photo. */
  caption: string;
};
export type Testimonial = {
  quote: string;
  /** Customer or business name, as they agreed to be credited. */
  name: string;
  /** What was shipped, and where. */
  detail: string;
  rating: 1 | 2 | 3 | 4 | 5;
  photos: [ShipmentPhoto, ShipmentPhoto];
};

/**
 * DRAFT: the quotes, names and ratings below are sample copy written to fill
 * the layout. Replace them with real customer reviews (with the customer's
 * permission) before the site goes live. The photos are the company's own
 * shipment documentation.
 */
export const testimonials: Testimonial[] = [
  {
    quote:
      "Puluhan karton kami ditimbang dan dicatat satu per satu sebelum berangkat, lalu dibungkus wrapping dengan rapi. Semuanya tiba lengkap tanpa ada yang penyok, jadi kami bisa fokus melayani pembeli.",
    name: "Toko Online Perlengkapan Rumah",
    detail: "Kiriman karton · Bekasi → Jakarta",
    rating: 5,
    photos: [
      {
        src: "/images/pengiriman/karton-ditimbang.jpg",
        alt: "Tumpukan karton kiriman pelanggan bernomor tulisan tangan, di samping timbangan digital",
        caption: "Ditimbang & dicatat",
      },
      {
        src: "/images/pengiriman/karton-wrapping.jpg",
        alt: "Karton kiriman dibungkus plastik wrapping di atas palet",
        caption: "Dibungkus wrapping",
      },
    ],
  },
  {
    quote:
      "Paket kecil dan karung kain kami kirim di jadwal yang sama. Tim 3 Daya Terang membantu memilah jalurnya, darat untuk paket dan laut untuk karung. Prosesnya mudah dan barang sampai sesuai perkiraan.",
    name: "Distributor Tekstil",
    detail: "Kiriman paket & karung · Jakarta → luar pulau",
    rating: 5,
    photos: [
      {
        src: "/images/pengiriman/paket-siap-kirim.jpg",
        alt: "Beberapa paket kardus kecil bertumpuk, siap dikirim",
        caption: "Paket siap kirim",
      },
      {
        src: "/images/pengiriman/karung-jalur-laut.jpg",
        alt: "Karung putih berisi kain bertanda tulisan tangan untuk pengiriman jalur laut",
        caption: "Karung jalur laut",
      },
    ],
  },
];
