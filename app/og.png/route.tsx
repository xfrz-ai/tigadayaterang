import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_RED, INK, LOGO_FILE, SITE_NAME, THEME_COLOR } from "@/lib/site";

// Social share card (WhatsApp, Facebook, LinkedIn, X), rendered at build time
// to /og.png. The .png path keeps the right content type on static hosts.
export const dynamic = "force-static";
const OG_SIZE = { width: 1200, height: 630 };

export async function GET() {
  const logo = await readFile(join(process.cwd(), LOGO_FILE));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: THEME_COLOR,
        color: INK,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${logo.toString("base64")}`}
            width={60}
            height={60}
            alt=""
          />
          <div style={{ fontSize: 40, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 96,
            lineHeight: 1.04,
            letterSpacing: -4,
          }}
        >
          <div>Barang tiba.</div>
          <div style={{ color: BRAND_RED }}>Bisnis melaju.</div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 3,
          }}
        >
          <div>JASA LOGISTIK DARAT · LAUT · UDARA</div>
          <div style={{ letterSpacing: 0 }}>3dayaterang.id</div>
        </div>
      </div>
      <div
        style={{
          width: 300,
          display: "flex",
          flexDirection: "column",
          background: BRAND_RED,
          color: THEME_COLOR,
        }}
      >
        {["Darat", "Laut", "Udara"].map((mode, i) => (
          <div
            key={mode}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "0 40px",
              fontSize: 44,
              letterSpacing: -1,
              borderTop: i ? `2px solid ${THEME_COLOR}` : "none",
            }}
          >
            <div style={{ fontSize: 20, letterSpacing: 2 }}>{`0${i + 1}`}</div>
            <div>{mode}</div>
          </div>
        ))}
      </div>
    </div>,
    OG_SIZE,
  );
}
