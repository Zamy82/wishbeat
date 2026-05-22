import { ImageResponse } from "next/og";

// Dynamisch generierte App-Icons — Next.js erkennt das automatisch
// und liefert sie als /icon (any) + manifest-fähige Größen aus.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 320,
          fontWeight: 900,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 100
        }}
      >
        Z
      </div>
    ),
    size
  );
}
