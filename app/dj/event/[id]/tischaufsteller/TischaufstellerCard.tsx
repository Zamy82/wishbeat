"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import QRCode from "qrcode";

interface Props {
  name: string;
  tagline: string | null;
  eventDate: string;
  url: string;
  eventId: string;
}

const DJ_NAME = "DJ ZAMY";

// Eine Tisch-Aufsteller-Karte (A6 Hochformat).
// Wird viermal pro A4-Seite gerendert.
function Card({
  name,
  tagline,
  eventDate,
  url,
  qrIndex
}: {
  name: string;
  tagline: string | null;
  eventDate: string;
  url: string;
  qrIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 600,
      margin: 1,
      color: { dark: "#0a0a12", light: "#ffffff" },
      errorCorrectionLevel: "M"
    });
  }, [url]);

  const dateLabel = new Date(eventDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="ta-card" data-qr-index={qrIndex}>
      <div className="ta-band" />
      <div className="ta-content">
        <div className="ta-eyebrow">
          <span className="ta-dot" /> Wunschsong an {DJ_NAME}
        </div>
        <h2 className="ta-title">{name}</h2>
        {tagline && <p className="ta-tagline">{tagline}</p>}
        <p className="ta-date">{dateLabel}</p>

        <div className="ta-qr-wrap">
          <canvas ref={canvasRef} className="ta-qr" />
        </div>

        <p className="ta-cta">📱 Scan & wünsch!</p>

        <p className="ta-steps">
          <span>1. Scannen</span>
          <span className="ta-step-sep">·</span>
          <span>2. Song wählen</span>
          <span className="ta-step-sep">·</span>
          <span>3. Senden</span>
        </p>

        <div className="ta-footer">
          <span className="ta-brand-mark">w</span>
          <span className="ta-brand-text">wishbeat</span>
        </div>
      </div>
    </div>
  );
}

export default function TischaufstellerCard({
  name,
  tagline,
  eventDate,
  url,
  eventId
}: Props) {
  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Toolbar — beim Drucken ausgeblendet */}
      <div className="no-print min-h-[80px] flex items-center justify-between gap-3 px-4 py-4 max-w-3xl mx-auto">
        <Link
          href={`/dj/event/${eventId}`}
          className="text-white/40 hover:text-white text-sm transition"
        >
          ← Zurück
        </Link>
        <button
          onClick={handlePrint}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white font-semibold text-sm hover:opacity-90 transition"
        >
          🖨️ A4 drucken — 4 Aufsteller
        </button>
      </div>

      {/* Hinweise */}
      <div className="no-print max-w-3xl mx-auto px-4 mb-6 text-white/50 text-xs space-y-1">
        <p>
          📐 <strong className="text-white/80">A4 hoch</strong> mit 4 identischen
          Karten — entlang der gestrichelten Linien auseinanderschneiden, dann
          in der Mitte falten = fertiger Tisch-Aufsteller.
        </p>
        <p>
          🖨 Im Druck-Dialog{" "}
          <strong className="text-white/80">„Hintergrundgrafik drucken"</strong>{" "}
          aktivieren — sonst werden die Farben nicht gedruckt.
        </p>
      </div>

      {/* A4-Bogen mit 4 Karten */}
      <div className="ta-stage flex justify-center pb-16 px-4">
        <div className="ta-sheet">
          {[0, 1, 2, 3].map((i) => (
            <Card
              key={i}
              name={name}
              tagline={tagline}
              eventDate={eventDate}
              url={url}
              qrIndex={i}
            />
          ))}
          {/* Schnittlinien dekorativ — auch im Druck sichtbar */}
          <div className="ta-cut-h" />
          <div className="ta-cut-v" />
        </div>
      </div>

      <style jsx global>{`
        .ta-stage {
          color-scheme: light;
        }

        /* A4-Bogen — 210x297mm. Im Browser etwas geschrumpft fuer Vorschau */
        .ta-sheet {
          width: 210mm;
          height: 297mm;
          background: #ffffff;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          position: relative;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Eine einzelne A6-Karte = 105x148.5mm (gerundet) */
        .ta-card {
          background: #2a1f3d;
          color: #ffffff;
          position: relative;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .ta-band {
          height: 8mm;
          background: linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%);
          flex-shrink: 0;
        }

        .ta-content {
          padding: 5mm 6mm 4mm 6mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 1;
        }

        .ta-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 6.5pt;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #22d3ee;
          font-weight: 700;
        }

        .ta-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #ff2e93;
          display: inline-block;
        }

        .ta-title {
          font-size: 18pt;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 2mm 0 0 0;
          padding: 0 2px 0.08em 2px;
          background: linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .ta-tagline {
          font-size: 8pt;
          color: #a78bfa;
          margin: 1.5mm 0 0 0;
          font-style: italic;
          font-weight: 500;
          line-height: 1.2;
        }

        .ta-date {
          font-size: 6.5pt;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #94a3b8;
          margin: 1.5mm 0 0 0;
        }

        .ta-qr-wrap {
          margin: 3mm 0 2mm 0;
          padding: 2mm;
          background: #ffffff;
          border: 2px solid #22d3ee;
          border-radius: 2mm;
        }

        .ta-qr {
          display: block;
          width: 52mm !important;
          height: 52mm !important;
        }

        .ta-cta {
          font-size: 10pt;
          font-weight: 800;
          margin: 1.5mm 0 1.5mm 0;
          color: #ffffff;
        }

        .ta-steps {
          font-size: 7pt;
          color: #cbd5e1;
          margin: 0 0 2mm 0;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .ta-step-sep {
          color: #a855f7;
          font-weight: 700;
        }

        .ta-footer {
          margin-top: auto;
          padding-top: 2mm;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 7pt;
        }

        .ta-brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 4mm;
          height: 4mm;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2e93, #22d3ee);
          color: #ffffff;
          font-size: 7pt;
          font-weight: 900;
        }

        .ta-brand-text {
          color: rgba(255, 255, 255, 0.65);
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        /* Schnittlinien als Overlay — horizontal mittig und vertikal mittig */
        .ta-cut-h {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 0;
          border-top: 1px dashed rgba(255, 255, 255, 0.7);
          transform: translateY(-0.5px);
          pointer-events: none;
        }

        .ta-cut-v {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 0;
          border-left: 1px dashed rgba(255, 255, 255, 0.7);
          transform: translateX(-0.5px);
          pointer-events: none;
        }

        /* Druck-Ansicht — exakt A4 */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            background: #ffffff !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .ta-stage {
            padding: 0 !important;
          }

          .ta-sheet {
            box-shadow: none;
            width: 210mm;
            height: 297mm;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}
