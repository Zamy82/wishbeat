import { ImageResponse } from "next/og";

// Apple Touch Icon für "Zum Home-Bildschirm hinzufügen" auf iOS
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
          color: "white",
          fontSize: 120,
          fontWeight: 900,
          fontFamily: "system-ui, sans-serif"
        }}
      >
        Z
      </div>
    ),
    size
  );
}
