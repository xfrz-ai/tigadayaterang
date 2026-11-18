import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_FILE, THEME_COLOR } from "@/lib/site";

// Home-screen icon for iOS, rendered at build time to /apple-touch-icon.png
// (the path iOS also requests by default).
export const dynamic = "force-static";

export async function GET() {
  const logo = await readFile(join(process.cwd(), LOGO_FILE));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: THEME_COLOR,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${logo.toString("base64")}`}
        width={140}
        height={140}
        alt=""
      />
    </div>,
    { width: 180, height: 180 },
  );
}
