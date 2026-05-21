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

export default function FlyerCard({ name, tagline, eventDate, url, eventId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 560,
      margin: 1,
      color: { dark: "#0a0a12", light: "#ffffff" },
      errorCorrectionLevel: "M"
    });
  }, [url]);

  function handlePrint() {
    window.print();
  }

  const dateLabel = new Date(eventDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <>
      {/* Toolbar — wird beim Drucken ausgeblendet */}
      <div className="no-print min-h-[80px] flex items-center justify-between gap-3 px-4 py-4 max-w-3xl mx-auto">
        <Link
          href={`/dj/event/${eventId}`}
          className="text-white/40 hover:text-white text-sm transition"
        >
          ← Zurück
        </Link>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white font-semibold text-sm hover:opacity-90 transition"
          >
            🖨️ Drucken
          </button>
        </div>
      </div>

      {/* Hinweis am Bildschirm */}
      <p className="no-print text-center text-white/40 text-sm mb-6 px-4">
        So sieht der ausgedruckte Flyer aus. Klick auf <strong className="text-white/70">Drucken</strong>{" "}
        — am besten in A5 oder A4, schwarz/weiß reicht. Mehrere pro Seite gehen auch.
      </p>

      {/* Flyer-Karte */}
      <div className="flyer-stage flex justify-center pb-16 px-4">
        <article className="flyer-card">
          {/* Dekorativer Header-Streifen */}
          <div className="flyer-band" />

          {/* Inhalt */}
          <div className="flyer-content">
            <div className="flyer-eyebrow">
              <span className="dot" /> Wunschsong an den DJ
            </div>

            <h1 className="flyer-title">{name}</h1>

            {tagline && <p className="flyer-tagline">{tagline}</p>}

            <p className="flyer-date">{dateLabel}</p>

            {/* QR-Code */}
            <div className="flyer-qr-wrap">
              <canvas ref={canvasRef} className="flyer-qr" />
            </div>

            <p className="flyer-cta">📱 Scan & wünsch dir einen Song</p>

            {/* 3 Schritte */}
            <ol className="flyer-steps">
              <li>
                <span className="step-num">1</span>
                <span>Code mit der Handy-Kamera scannen</span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span>Lieblingssong aus Spotify auswählen</span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span>Wunsch absenden — DJ legt&apos;s auf</span>
              </li>
            </ol>

            {/* Footer */}
            <div className="flyer-footer">
              <div className="flyer-url">{url.replace(/^https?:\/\//, "")}</div>
              <div className="flyer-brand">
                <span className="brand-mark">w</span>
                <span>wishbeat</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <style jsx global>{`
        /* Bildschirm-Darstellung */
        .flyer-stage {
          color-scheme: light;
        }

        .flyer-card {
          background: #ffffff;
          color: #0a0a12;
          width: 148mm;
          min-height: 210mm;
          border-radius: 4mm;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
          overflow: hidden;
          position: relative;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        }

        .flyer-band {
          height: 12mm;
          background: linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%);
        }

        .flyer-content {
          padding: 10mm 12mm 8mm 12mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .flyer-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 9pt;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b21a8;
          font-weight: 600;
        }

        .flyer-eyebrow .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff2e93;
          display: inline-block;
        }

        .flyer-title {
          font-size: 32pt;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
          margin: 6mm 0 0 0;
          background: linear-gradient(135deg, #ff2e93 0%, #a855f7 60%, #22d3ee 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .flyer-tagline {
          font-size: 13pt;
          color: #475569;
          margin: 3mm 0 0 0;
          font-style: italic;
          font-weight: 500;
        }

        .flyer-date {
          font-size: 10pt;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
          margin: 2mm 0 0 0;
        }

        .flyer-qr-wrap {
          margin: 8mm 0 5mm 0;
          padding: 4mm;
          background: #ffffff;
          border: 2px solid #0a0a12;
          border-radius: 3mm;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        }

        .flyer-qr {
          display: block;
          width: 62mm !important;
          height: 62mm !important;
        }

        .flyer-cta {
          font-size: 14pt;
          font-weight: 700;
          margin: 3mm 0 6mm 0;
          color: #0a0a12;
        }

        .flyer-steps {
          list-style: none;
          padding: 0;
          margin: 0 0 8mm 0;
          display: flex;
          flex-direction: column;
          gap: 3mm;
          width: 100%;
          max-width: 100mm;
        }

        .flyer-steps li {
          display: flex;
          align-items: center;
          gap: 4mm;
          text-align: left;
          font-size: 10.5pt;
          color: #334155;
        }

        .step-num {
          flex-shrink: 0;
          width: 8mm;
          height: 8mm;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2e93, #a855f7);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 11pt;
        }

        .flyer-footer {
          margin-top: auto;
          width: 100%;
          padding-top: 4mm;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8.5pt;
          color: #94a3b8;
        }

        .flyer-url {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: -0.01em;
        }

        .flyer-brand {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 700;
          color: #475569;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 5mm;
          height: 5mm;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2e93, #22d3ee);
          color: #ffffff;
          font-size: 9pt;
          font-weight: 900;
        }

        /* Druck-Ansicht */
        @media print {
          @page {
            size: A5 portrait;
            margin: 0;
          }

          html,
          body {
            background: #ffffff !important;
            background-image: none !important;
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .flyer-stage {
            padding: 0 !important;
          }

          .flyer-card {
            box-shadow: none;
            border-radius: 0;
            width: 148mm;
            height: 210mm;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}
