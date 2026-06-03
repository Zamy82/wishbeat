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

// Titel intelligent splitten:
// "Angie's 40. Geburtstag" -> { lead: "Angie's", bigNumber: "40", trail: "Geburtstag" }
// "Tom wird 50" -> { lead: "Tom", bigNumber: "50", trail: "Jahre!" }
// "Sommerfest 2026" -> { lead: "Sommerfest 2026", bigNumber: null, trail: "" }
function splitTitle(name: string): {
  lead: string;
  bigNumber: string | null;
  trail: string;
} {
  // Pattern A: "X's NUMBER. Y" oder "X NUMBER. Y"
  const a = name.match(/^(.+?)\s+(\d{1,3})\s*\.?\s*(.*)$/);
  if (a && a[1] && a[2]) {
    const lead = a[1].trim();
    const num = a[2];
    let trail = (a[3] || "").trim();
    // Hubsche dt. Synonyme: "Geburtstag" -> "Birthday Bash!"
    if (/^geburtstag/i.test(trail)) trail = "Birthday Bash!";
    if (!trail) trail = "Birthday Bash!";
    return { lead, bigNumber: num, trail };
  }
  // Pattern B: "X wird NUMBER"
  const b = name.match(/^(.+?)\s+wird\s+(\d{1,3})\s*(.*)$/i);
  if (b) {
    return {
      lead: b[1].trim(),
      bigNumber: b[2],
      trail: (b[3] || "Birthday Bash!").trim()
    };
  }
  return { lead: name, bigNumber: null, trail: "" };
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

  const title = splitTitle(name);

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
          {/* Konfetti-Sternchen im Hintergrund */}
          <div className="poster-confetti" aria-hidden>
            <ConfettiBackground />
          </div>

          <div className="poster-content">
            {/* Titel-Block */}
            {title.bigNumber ? (
              <div className="title-stack">
                <span className="title-lead">{title.lead}</span>
                <span className="title-big">
                  <span className="title-big-number">{title.bigNumber}</span>
                  <CrownIcon />
                </span>
                <span className="title-trail">{title.trail}</span>
              </div>
            ) : (
              <h1 className="title-single">{name}</h1>
            )}

            {/* DEIN SONG. DEIN MOMENT. Banner */}
            <div className="poster-banner">DEIN SONG. DEIN MOMENT.</div>

            {/* Eyebrow mit Herzen */}
            <div className="poster-eyebrow">
              <span className="heart">♥</span> Wunschsong an {djName}{" "}
              <span className="heart">♥</span>
            </div>

            {/* QR + Sprechblasen-Icons links/rechts */}
            <div className="poster-qr-row">
              <div className="poster-qr-side">
                <PhoneIcon color="#ff2e93" />
                <span className="qr-label qr-label-pink">SCAN MICH!</span>
                <ArrowPink />
              </div>

              <div className="poster-qr-frame">
                <canvas ref={canvasRef} className="poster-qr" />
              </div>

              <div className="poster-qr-side">
                <HeadphonesIcon color="#22d3ee" />
                <span className="qr-label qr-label-cyan">
                  DEIN SONG
                  <br />
                  LÄUFT!
                </span>
              </div>
            </div>

            {/* Datum-Box mit cyan Rahmen */}
            <div className="poster-date-box">{dateLabel}</div>

            {/* Steps */}
            <h3 className="poster-steps-heading">
              <span className="note">♪</span> SO EINFACH GEHT&apos;S:
            </h3>

            <div className="poster-steps">
              <div className="step">
                <div className="step-num step-num-pink">1</div>
                <div className="step-icon">
                  <PhoneIcon color="#22d3ee" small />
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

            {/* Bottom-CTA */}
            <div className="poster-bottom-cta">DEIN SONG MACHT DIE PARTY!</div>

            {/* Footer */}
            <div className="poster-footer">
              <span className="powered-by">POWERED BY</span>
              {validLogoStyle ? (
                <span className="footer-logo">
                  <DjLogo style={validLogoStyle} size={22} />
                </span>
              ) : (
                <span className="footer-mark">w</span>
              )}
              <span className="footer-brand">wishbeat</span>
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
          background: radial-gradient(
              ellipse at 30% 20%,
              #1a0f24 0%,
              #0a0a16 60%
            ),
            #0a0a16;
          border-radius: 3mm;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          position: relative;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          color: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .poster-confetti {
          position: absolute;
          inset: 0;
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }

        .poster-content {
          position: relative;
          z-index: 1;
          padding: 14mm 14mm 8mm 14mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-height: 297mm;
        }

        /* ───── Titel-Stack (mit grosser Zahl) ───── */
        .title-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          margin-bottom: 3mm;
        }

        .title-lead {
          font-family: var(--font-pacifico), "Brush Script MT", cursive;
          font-size: 56pt;
          line-height: 0.95;
          color: #ff2e93;
          text-shadow:
            0 0 6px #ff2e93,
            0 0 20px rgba(255, 46, 147, 0.7),
            0 0 36px rgba(255, 46, 147, 0.4);
          transform: rotate(-3deg);
          padding: 0 6mm;
        }

        .title-big {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8mm;
          margin-top: -2mm;
        }

        .title-big-number {
          font-size: 130pt;
          font-weight: 900;
          line-height: 1;
          color: transparent;
          -webkit-text-stroke: 2px #ff2e93;
          text-stroke: 2px #ff2e93;
          letter-spacing: -0.02em;
          text-shadow:
            0 0 12px rgba(255, 46, 147, 0.8),
            0 0 32px rgba(255, 46, 147, 0.5),
            0 0 60px rgba(168, 85, 247, 0.4);
        }

        .title-trail {
          font-family: var(--font-pacifico), "Brush Script MT", cursive;
          font-size: 44pt;
          line-height: 0.95;
          color: #ff2e93;
          text-shadow:
            0 0 6px #ff2e93,
            0 0 18px rgba(255, 46, 147, 0.65);
          transform: rotate(-2deg);
          margin-top: -3mm;
          padding: 0 6mm;
        }

        /* Fallback: kein big number — voller Cursive-Titel */
        .title-single {
          font-family: var(--font-pacifico), "Brush Script MT", cursive;
          font-size: 56pt;
          line-height: 1.05;
          color: #ff2e93;
          text-shadow:
            0 0 6px #ff2e93,
            0 0 22px rgba(255, 46, 147, 0.7),
            0 0 40px rgba(255, 46, 147, 0.4);
          margin: 0 0 4mm 0;
          padding: 0 6mm;
          font-weight: normal;
        }

        /* ───── DEIN SONG. DEIN MOMENT. Banner ───── */
        .poster-banner {
          margin: 4mm 0 3mm 0;
          padding: 3mm 12mm;
          background: linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%);
          color: #ffffff;
          font-weight: 900;
          font-size: 15pt;
          letter-spacing: 0.06em;
          border-radius: 1.5mm;
          box-shadow:
            0 0 18px rgba(255, 46, 147, 0.45),
            0 0 38px rgba(34, 211, 238, 0.25);
        }

        /* Eyebrow */
        .poster-eyebrow {
          color: #ffffff;
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 5mm;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .heart {
          color: #ff2e93;
          font-size: 12pt;
          text-shadow: 0 0 8px rgba(255, 46, 147, 0.7);
        }

        /* ───── QR-Sektion ───── */
        .poster-qr-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 6mm;
          width: 100%;
          margin: 2mm 0 3mm 0;
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
          font-size: 12pt;
          letter-spacing: 0.06em;
          text-align: center;
          line-height: 1.1;
        }

        .qr-label-pink {
          color: #ff2e93;
          text-shadow: 0 0 14px rgba(255, 46, 147, 0.7);
        }

        .qr-label-cyan {
          color: #22d3ee;
          text-shadow: 0 0 14px rgba(34, 211, 238, 0.7);
        }

        /* QR-Rahmen mit PINKEM Neon-Glow (statt cyan) */
        .poster-qr-frame {
          padding: 4mm;
          background: #ffffff;
          border: 3px solid #ff2e93;
          border-radius: 3mm;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.05),
            0 0 25px rgba(255, 46, 147, 0.7),
            0 0 60px rgba(255, 46, 147, 0.35);
        }

        .poster-qr {
          display: block;
          width: 70mm !important;
          height: 70mm !important;
        }

        /* Datum-Box mit Cyan-Rahmen */
        .poster-date-box {
          margin: 4mm 0 5mm 0;
          padding: 2.5mm 10mm;
          border: 2px solid #22d3ee;
          border-radius: 1.5mm;
          font-weight: 800;
          font-size: 12pt;
          color: #22d3ee;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(34, 211, 238, 0.55);
          box-shadow:
            inset 0 0 12px rgba(34, 211, 238, 0.15),
            0 0 14px rgba(34, 211, 238, 0.3);
        }

        /* Steps */
        .poster-steps-heading {
          margin: 1mm 0 4mm 0;
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
          box-shadow: 0 0 14px rgba(255, 46, 147, 0.55);
        }
        .step-num-purple {
          background: #a855f7;
          box-shadow: 0 0 14px rgba(168, 85, 247, 0.55);
        }
        .step-num-cyan {
          background: #22d3ee;
          color: #0a0a16;
          box-shadow: 0 0 14px rgba(34, 211, 238, 0.55);
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
          text-shadow: 0 0 6px rgba(255, 46, 147, 0.5);
        }

        /* Bottom CTA */
        .poster-bottom-cta {
          margin: auto auto 4mm auto;
          width: 100%;
          max-width: 170mm;
          padding: 4mm 6mm;
          background: rgba(255, 46, 147, 0.06);
          border: 2px solid #ff2e93;
          border-radius: 1.5mm;
          text-align: center;
          font-weight: 900;
          font-size: 14pt;
          color: #ffffff;
          letter-spacing: 0.06em;
          text-shadow: 0 0 10px rgba(255, 46, 147, 0.6);
          box-shadow:
            0 0 20px rgba(255, 46, 147, 0.4),
            inset 0 0 20px rgba(255, 46, 147, 0.08);
        }

        /* Footer */
        .poster-footer {
          padding-top: 2mm;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 10pt;
        }

        .powered-by {
          color: rgba(255, 255, 255, 0.4);
          font-weight: 700;
          letter-spacing: 0.18em;
          font-size: 8pt;
        }

        .footer-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 6mm;
          height: 6mm;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2e93, #22d3ee);
          color: #ffffff;
          font-size: 9pt;
          font-weight: 900;
        }

        .footer-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 7mm;
          height: 7mm;
        }
        .footer-logo svg {
          width: 100%;
          height: 100%;
        }

        .footer-brand {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 800;
          letter-spacing: 0.02em;
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
   Inline SVGs
   ──────────────────────────────────────────────────────────── */

function CrownIcon() {
  return (
    <svg
      width={64}
      height={48}
      viewBox="0 0 64 48"
      fill="none"
      stroke="#ff2e93"
      strokeWidth="2.5"
      strokeLinejoin="round"
      style={{
        filter: "drop-shadow(0 0 8px rgba(255,46,147,0.75))",
        flexShrink: 0
      }}
    >
      <path d="M6 38 L10 12 L22 28 L32 8 L42 28 L54 12 L58 38 Z" />
      <line x1="6" y1="42" x2="58" y2="42" />
      <circle cx="10" cy="10" r="2.5" fill="#ff2e93" />
      <circle cx="32" cy="5" r="2.5" fill="#ff2e93" />
      <circle cx="54" cy="10" r="2.5" fill="#ff2e93" />
    </svg>
  );
}

function PhoneIcon({
  small = false,
  color = "#22d3ee"
}: {
  small?: boolean;
  color?: string;
}) {
  const size = small ? 28 : 36;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <line x1="11" y1="18.5" x2="13" y2="18.5" />
      <rect x="9" y="6" width="6" height="4" rx="0.5" />
      <path d="M8 14 L10 13 L11 14 L13 12 L16 14" />
    </svg>
  );
}

function HeadphonesIcon({ color = "#22d3ee" }: { color?: string }) {
  return (
    <svg
      width={36}
      height={36}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
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
      style={{ filter: "drop-shadow(0 0 8px rgba(29,185,84,0.55))" }}
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
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.6))" }}
    >
      <path d="M3 11 L21 3 L13 21 L11 13 L3 11 Z" />
      <path d="M11 13 L21 3" />
    </svg>
  );
}

function ArrowPink() {
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
        right: -28,
        filter: "drop-shadow(0 0 6px rgba(255,46,147,0.6))"
      }}
    >
      <path d="M2 14 Q 20 0, 38 14" />
      <path d="M30 8 L38 14 L32 20" />
    </svg>
  );
}

function ConfettiBackground() {
  // 24 zufaellig verteilte Sternchen + Punkte als Konfetti
  const items = [
    { x: 6, y: 4, s: 8, c: "#ff2e93", t: "star" },
    { x: 92, y: 6, s: 7, c: "#22d3ee", t: "star" },
    { x: 14, y: 10, s: 4, c: "#a855f7", t: "dot" },
    { x: 88, y: 14, s: 5, c: "#ff2e93", t: "dot" },
    { x: 3, y: 22, s: 6, c: "#22d3ee", t: "star" },
    { x: 96, y: 26, s: 5, c: "#fde047", t: "star" },
    { x: 8, y: 38, s: 4, c: "#a855f7", t: "dot" },
    { x: 94, y: 42, s: 6, c: "#ff2e93", t: "star" },
    { x: 2, y: 52, s: 5, c: "#22d3ee", t: "dot" },
    { x: 98, y: 58, s: 4, c: "#a855f7", t: "dot" },
    { x: 6, y: 68, s: 7, c: "#ff2e93", t: "star" },
    { x: 92, y: 72, s: 5, c: "#22d3ee", t: "dot" },
    { x: 10, y: 82, s: 6, c: "#fde047", t: "star" },
    { x: 88, y: 88, s: 5, c: "#a855f7", t: "star" },
    { x: 4, y: 94, s: 4, c: "#22d3ee", t: "dot" },
    { x: 96, y: 96, s: 5, c: "#ff2e93", t: "dot" },
    { x: 20, y: 6, s: 3, c: "#fde047", t: "dot" },
    { x: 80, y: 10, s: 4, c: "#a855f7", t: "star" },
    { x: 16, y: 92, s: 4, c: "#ff2e93", t: "dot" },
    { x: 84, y: 94, s: 5, c: "#22d3ee", t: "star" }
  ];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {items.map((i, idx) =>
        i.t === "star" ? (
          <polygon
            key={idx}
            points={starPoints(i.x, i.y, i.s / 10)}
            fill={i.c}
            opacity={0.85}
          />
        ) : (
          <circle key={idx} cx={i.x} cy={i.y} r={i.s / 8} fill={i.c} opacity={0.7} />
        )
      )}
    </svg>
  );
}

function starPoints(cx: number, cy: number, r: number): string {
  // 4-Punkt-Sparkle-Stern (dünn, eleganter als 5-Punkt)
  return [
    [cx, cy - r],
    [cx + r * 0.25, cy - r * 0.25],
    [cx + r, cy],
    [cx + r * 0.25, cy + r * 0.25],
    [cx, cy + r],
    [cx - r * 0.25, cy + r * 0.25],
    [cx - r, cy],
    [cx - r * 0.25, cy - r * 0.25]
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}
