"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import DjLogo, { type LogoStyle } from "@/components/DjLogo";

interface Props {
  name: string;
  tagline: string | null;
  eventDate: string;
  url: string;
  eventId: string;
  djName: string;
  logoStyle: string | null;
}

export default function PosterCard({
  name,
  tagline,
  eventDate,
  url,
  eventId,
  djName,
  logoStyle
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const validLogoStyle = (
    ["vinyl", "equalizer", "headphones", "wave", "monogram"] as const
  ).includes(logoStyle as LogoStyle)
    ? (logoStyle as LogoStyle)
    : null;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 720,
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
      {/* Toolbar — beim Druck ausgeblendet */}
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
          🖨️ A4 drucken
        </button>
      </div>

      <p className="no-print text-center text-white/40 text-xs mb-6 px-4 max-w-3xl mx-auto">
        Im Druck-Dialog{" "}
        <strong className="text-white/70">„Hintergrundgrafik drucken"</strong>{" "}
        aktivieren, damit die Neon-Farben gedruckt werden.
      </p>

      <div className="poster-stage flex justify-center pb-16 px-4">
        <article className="poster-card">
          {/* Top-Banner mit Slogan */}
          <div className="poster-top-banner">
            <span>DEIN SONG. DEIN MOMENT.</span>
          </div>

          <div className="poster-content">
            {/* Eyebrow */}
            <div className="poster-eyebrow">
              <span className="eb-dot" /> Wunschsong an {djName}{" "}
              <span className="eb-dot" />
            </div>

            {/* Titel — Event-Name */}
            <h1 className="poster-title">{name}</h1>

            {tagline && <p className="poster-tagline">{tagline}</p>}

            <p className="poster-date">{dateLabel}</p>

            {/* QR-Sektion mit Sprechblasen-Icons links/rechts */}
            <div className="poster-qr-row">
              <div className="poster-qr-side poster-qr-left">
                <PhoneIcon />
                <span className="qr-label qr-label-pink">SCAN MICH!</span>
                <ArrowCurve direction="right" />
              </div>

              <div className="poster-qr-frame">
                <canvas ref={canvasRef} className="poster-qr" />
              </div>

              <div className="poster-qr-side poster-qr-right">
                <HeadphonesIcon />
                <span className="qr-label qr-label-cyan">
                  DEIN SONG
                  <br />
                  LÄUFT!
                </span>
              </div>
            </div>

            {/* Steps-Sektion */}
            <h3 className="poster-steps-heading">
              <span className="note">♪</span> SO EINFACH GEHT&apos;S:
            </h3>

            <div className="poster-steps">
              <div className="step">
                <div className="step-num step-num-pink">1</div>
                <div className="step-icon">
                  <PhoneIcon small />
                </div>
                <div className="step-label">
                  QR CODE
                  <br />
                  SCANNEN
                </div>
              </div>

              <div className="step">
                <div className="step-num step-num-purple">2</div>
                <div className="step-icon">
                  <SpotifyIcon />
                </div>
                <div className="step-label">
                  LIEBLINGSSONG
                  <br />
                  AUS SPOTIFY WÄHLEN
                </div>
              </div>

              <div className="step">
                <div className="step-num step-num-cyan">3</div>
                <div className="step-icon">
                  <PaperPlaneIcon />
                </div>
                <div className="step-label">
                  WUNSCH
                  <br />
                  ABSENDEN
                </div>
                <div className="step-sublabel">{djName} LEGT&apos;S AUF!</div>
              </div>
            </div>

            {/* Dezente Push-Zeile */}
            <p className="poster-push-hint">
              🔔 Wir benachrichtigen dich, wenn dein Song läuft.
            </p>

            {/* Bottom-CTA-Box */}
            <div className="poster-bottom-cta">
              SCAN &amp; WÜNSCH DIR JETZT{" "}
              <span className="cta-highlight">DEINEN SONG!</span>
            </div>

            {/* Footer */}
            <div className="poster-footer">
              {validLogoStyle ? (
                <span className="footer-logo">
                  <DjLogo style={validLogoStyle} size={20} />
                </span>
              ) : (
                <span className="footer-mark">w</span>
              )}
              <span className="footer-text">
                wishbeat <span className="footer-sep">·</span>{" "}
                <span className="footer-handle">zamy82</span>
              </span>
            </div>
          </div>
        </article>
      </div>

      <style jsx global>{`
        .poster-stage {
          color-scheme: dark;
        }

        /* A4 hoch: 210x297mm */
        .poster-card {
          width: 210mm;
          min-height: 297mm;
          background: #0a0a16;
          border-radius: 3mm;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          position: relative;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          color: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          display: flex;
          flex-direction: column;
        }

        /* Top-Banner */
        .poster-top-banner {
          background: linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%);
          color: #ffffff;
          text-align: center;
          padding: 5mm 8mm;
          font-weight: 900;
          font-size: 16pt;
          letter-spacing: 0.04em;
        }

        .poster-content {
          padding: 8mm 12mm 6mm 12mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 1;
        }

        /* Eyebrow */
        .poster-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #22d3ee;
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 4mm;
        }

        .eb-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff2e93;
          display: inline-block;
        }

        /* Titel */
        .poster-title {
          font-size: 36pt;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.05;
          margin: 0;
          padding: 0 4px 0.05em 4px;
          background: linear-gradient(135deg, #ff2e93 0%, #ff75c5 35%, #22d3ee 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow:
            0 0 30px rgba(255, 46, 147, 0.35),
            0 0 60px rgba(34, 211, 238, 0.18);
          max-width: 180mm;
        }

        .poster-tagline {
          font-size: 14pt;
          color: #ff75c5;
          font-style: italic;
          font-weight: 500;
          margin: 3mm 0 0 0;
        }

        .poster-date {
          font-size: 9pt;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #9ca3af;
          margin: 2mm 0 0 0;
        }

        /* QR-Sektion */
        .poster-qr-row {
          margin: 6mm 0 6mm 0;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 4mm;
          width: 100%;
        }

        .poster-qr-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2mm;
          position: relative;
        }

        .qr-label {
          font-weight: 900;
          font-size: 11pt;
          letter-spacing: 0.06em;
          text-align: center;
          line-height: 1.1;
        }

        .qr-label-pink {
          color: #ff2e93;
          text-shadow: 0 0 12px rgba(255, 46, 147, 0.55);
        }

        .qr-label-cyan {
          color: #22d3ee;
          text-shadow: 0 0 12px rgba(34, 211, 238, 0.55);
        }

        /* QR-Rahmen mit Neon-Glow */
        .poster-qr-frame {
          padding: 4mm;
          background: #ffffff;
          border: 3px solid #22d3ee;
          border-radius: 3mm;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.05),
            0 0 25px rgba(34, 211, 238, 0.55),
            0 0 50px rgba(34, 211, 238, 0.25);
        }

        .poster-qr {
          display: block;
          width: 70mm !important;
          height: 70mm !important;
        }

        /* Steps */
        .poster-steps-heading {
          margin: 4mm 0 4mm 0;
          font-size: 14pt;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.04em;
        }

        .note {
          color: #22d3ee;
          margin-right: 4px;
        }

        .poster-steps {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6mm;
          width: 100%;
          max-width: 170mm;
          margin: 0 auto;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2mm;
        }

        .step-num {
          width: 9mm;
          height: 9mm;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 11pt;
        }

        .step-num-pink {
          background: #ff2e93;
          box-shadow: 0 0 12px rgba(255, 46, 147, 0.45);
        }
        .step-num-purple {
          background: #a855f7;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.45);
        }
        .step-num-cyan {
          background: #22d3ee;
          color: #0a0a16;
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.45);
        }

        .step-icon {
          height: 14mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-label {
          font-size: 9.5pt;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #ffffff;
          line-height: 1.2;
        }

        .step-sublabel {
          font-size: 7.5pt;
          color: #ff2e93;
          margin-top: 1mm;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        /* Push-Hinweis */
        .poster-push-hint {
          margin: 5mm 0 3mm 0;
          font-size: 9pt;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Bottom-CTA-Box */
        .poster-bottom-cta {
          margin: 3mm 0 4mm 0;
          width: 100%;
          max-width: 170mm;
          padding: 4mm 6mm;
          background: rgba(255, 46, 147, 0.08);
          border: 2px solid;
          border-image: linear-gradient(90deg, #ff2e93, #22d3ee) 1;
          border-radius: 2mm;
          text-align: center;
          font-weight: 900;
          font-size: 13pt;
          color: #ffffff;
          letter-spacing: 0.03em;
        }

        .cta-highlight {
          background: linear-gradient(90deg, #ff2e93, #22d3ee);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* Footer */
        .poster-footer {
          margin-top: auto;
          padding-top: 3mm;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 9pt;
        }

        .footer-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 5mm;
          height: 5mm;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2e93, #22d3ee);
          color: #ffffff;
          font-size: 8pt;
          font-weight: 900;
        }

        .footer-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 6mm;
          height: 6mm;
        }

        .footer-logo svg {
          width: 100%;
          height: 100%;
        }

        .footer-text {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 700;
        }

        .footer-sep {
          color: rgba(255, 255, 255, 0.25);
        }

        .footer-handle {
          color: #a855f7;
          font-weight: 800;
        }

        /* Druck-Ansicht */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            background: #0a0a16 !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .poster-stage {
            padding: 0 !important;
          }

          .poster-card {
            box-shadow: none;
            border-radius: 0;
            width: 210mm;
            height: 297mm;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   Inline SVG-Icons fuer Print-Schaerfe
   ──────────────────────────────────────────────────────────── */

function PhoneIcon({ small = false }: { small?: boolean }) {
  const size = small ? 28 : 36;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="1.8"
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <line x1="11" y1="18.5" x2="13" y2="18.5" />
      <rect x="9" y="6" width="6" height="4" rx="0.5" stroke="#22d3ee" />
      <path d="M8 14 L10 13 L11 14 L13 12 L16 14" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg
      width={36}
      height={36}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
    >
      <path d="M4 14 V12 a8 8 0 0 1 16 0 v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.2" />
      <rect x="17" y="14" width="4" height="6" rx="1.2" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="#1DB954"
      style={{ filter: "drop-shadow(0 0 8px rgba(29,185,84,0.45))" }}
    >
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.55-1.04 8.46-.59 11.65 1.34.36.22.47.69.26 1.03Zm1.46-3.24a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.98-1.4a.94.94 0 0 1-.55-1.79c4.38-1.34 9.81-.69 13.5 1.6.45.27.6.86.32 1.28Zm.13-3.36c-3.86-2.3-10.24-2.51-13.93-1.39a1.12 1.12 0 1 1-.66-2.14c4.23-1.3 11.27-1.05 15.71 1.6a1.12 1.12 0 1 1-1.12 1.93Z" />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
    >
      <path d="M3 11 L21 3 L13 21 L11 13 L3 11 Z" />
      <path d="M11 13 L21 3" />
    </svg>
  );
}

function ArrowCurve({ direction }: { direction: "left" | "right" }) {
  // Geschwungener Pfeil von "SCAN MICH!" zum QR-Code (zeigt nach rechts)
  return (
    <svg
      width={44}
      height={28}
      viewBox="0 0 44 28"
      fill="none"
      stroke="#ff2e93"
      strokeWidth="2"
      strokeLinecap="round"
      style={{
        position: "absolute",
        bottom: -8,
        [direction === "right" ? "right" : "left"]: -28,
        filter: "drop-shadow(0 0 6px rgba(255,46,147,0.5))"
      }}
    >
      <path d="M2 14 Q 20 0, 38 14" />
      <path d="M30 8 L38 14 L32 20" />
    </svg>
  );
}
