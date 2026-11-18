import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: "Relay — Good things. Delivered.",
  description:
    "A connected approach to freight, warehousing, and last-mile delivery. Keep your business moving with Relay.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
