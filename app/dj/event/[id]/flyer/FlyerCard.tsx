"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import DjLogo, { type LogoStyle } from "@/components/DjLogo";

interface Props {
  name: string;
  tagline: string | null;
  eventDate: string;
  url: string;
  eventId: string;
  logoStyle: string | null;
}

type DesignKey = "light" | "neon" | "spotify" | "gradient";

interface Theme {
  label: string;
  swatch: string;
  pageBg: string;
  cardBg: string;
  bandStyle: string;
  eyebrow: string;
  eyebrowDot: string;
  titleStyle: string;
  tagline: string;
  date: string;
  qrFrameBorder: string;
  qrFrameBg: string;
  qrDark: string;
  qrLight: string;
  cta: string;
  stepBg: string;
  stepText: string;
  stepBody: string;
  djName: string;
  footerBorder: string;
  url: string;
  brandText: string;
  brandMark: string;
  brandMarkText: string; // Farbe des "w" Buchstaben im Logo-Kreis
}

const THEMES: Record<DesignKey, Theme> = {
  light: {
    label: "Hell",
    swatch:
      "linear-gradient(135deg, #fffbf0 0%, #fff 50%, #fdf2f8 100%)",
    pageBg: "#fdf6e8",
    cardBg: "#ffffff",
    bandStyle:
      "linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
    eyebrow: "#7c3aed",
    eyebrowDot: "#ff2e93",
    titleStyle:
      "background: linear-gradient(135deg, #ff2e93 0%, #a855f7 60%, #22d3ee 100%); -webkit-background-clip: text; background-clip: text; color: transparent;",
    tagline: "#475569",
    date: "#64748b",
    qrFrameBorder: "#0a0a12",
    qrFrameBg: "#ffffff",
    qrDark: "#0a0a12",
    qrLight: "#ffffff",
    cta: "#0a0a12",
    stepBg: "linear-gradient(135deg, #ff2e93, #a855f7)",
    stepText: "#ffffff",
    stepBody: "#334155",
    djName: "#7c3aed",
    footerBorder: "#e2e8f0",
    url: "#94a3b8",
    brandText: "#475569",
    brandMark: "linear-gradient(135deg, #ff2e93, #22d3ee)",
    brandMarkText: "#ffffff"
  },
  neon: {
    label: "Neon Party",
    swatch:
      "linear-gradient(135deg, #2a1244 0%, #1d1530 50%, #3d1248 100%)",
    pageBg: "#1d1530",
    cardBg: "#2a1f3d",
    bandStyle:
      "linear-gradient(90deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
    eyebrow: "#22d3ee",
    eyebrowDot: "#ff2e93",
    titleStyle:
      "background: linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%); -webkit-background-clip: text; background-clip: text; color: transparent;",
    tagline: "#a78bfa",
    date: "#94a3b8",
    qrFrameBorder: "#22d3ee",
    qrFrameBg: "#ffffff",
    qrDark: "#0a0a12",
    qrLight: "#ffffff",
    cta: "#ffffff",
    stepBg: "linear-gradient(135deg, #ff2e93, #22d3ee)",
    stepText: "#ffffff",
    stepBody: "#cbd5e1",
    djName: "#22d3ee",
    footerBorder: "rgba(255,255,255,0.1)",
    url: "rgba(255,255,255,0.4)",
    brandText: "rgba(255,255,255,0.6)",
    brandMark: "linear-gradient(135deg, #ff2e93, #22d3ee)",
    brandMarkText: "#ffffff"
  },
  spotify: {
    label: "Spotify",
    swatch:
      "linear-gradient(135deg, #1e2c24 0%, #2a3d31 50%, #1DB954 100%)",
    pageBg: "#1c2620",
    cardBg: "#22302a",
    bandStyle: "linear-gradient(90deg, #1DB954 0%, #1ed760 100%)",
    eyebrow: "#1ed760",
    eyebrowDot: "#1ed760",
    titleStyle: "color: #1ed760;",
    tagline: "#a7f3d0",
    date: "#86efac",
    qrFrameBorder: "#1ed760",
    qrFrameBg: "#ffffff",
    qrDark: "#1c2620",
    qrLight: "#ffffff",
    cta: "#ffffff",
    stepBg: "#1DB954",
    stepText: "#ffffff",
    stepBody: "#d1fae5",
    djName: "#1ed760",
    footerBorder: "rgba(29, 185, 84, 0.25)",
    url: "rgba(255,255,255,0.45)",
    brandText: "rgba(255,255,255,0.7)",
    brandMark: "#1DB954",
    brandMarkText: "#ffffff"
  },
  gradient: {
    label: "Gradient",
    swatch:
      "linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
    pageBg:
      "linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
    cardBg:
      "linear-gradient(135deg, #ff2e93 0%, #a855f7 50%, #22d3ee 100%)",
    bandStyle: "rgba(255,255,255,0.25)",
    eyebrow: "rgba(255,255,255,0.9)",
    eyebrowDot: "#ffffff",
    titleStyle: "color: #ffffff;",
    tagline: "rgba(255,255,255,0.9)",
    date: "rgba(255,255,255,0.75)",
    qrFrameBorder: "#ffffff",
    qrFrameBg: "#ffffff",
    qrDark: "#0a0a12",
    qrLight: "#ffffff",
    cta: "#ffffff",
    stepBg: "rgba(255,255,255,0.95)",
    stepText: "#a855f7",
    stepBody: "rgba(255,255,255,0.95)",
    djName: "#ffffff",
    footerBorder: "rgba(255,255,255,0.3)",
    url: "rgba(255,255,255,0.7)",
    brandText: "rgba(255,255,255,0.85)",
    brandMark: "rgba(255,255,255,0.95)",
    brandMarkText: "#a855f7"
  }
};

const DJ_NAME = "DJ ZAMY";

export default function FlyerCard({
  name,
  tagline,
  eventDate,
  url,
  eventId,
  logoStyle
}: Props) {
  const validLogoStyle = (
    ["vinyl", "equalizer", "headphones", "wave", "monogram"] as const
  ).includes(logoStyle as LogoStyle)
    ? (logoStyle as LogoStyle)
    : null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [design, setDesign] = useState<DesignKey>("neon");

  // Design aus localStorage laden — User-Präferenz behalten
  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? (localStorage.getItem("wishbeat_flyer_design") as DesignKey | null)
      : null;
    if (saved && saved in THEMES) {
      setDesign(saved);
    }
  }, []);

  function pickDesign(d: DesignKey) {
    setDesign(d);
    if (typeof window !== "undefined") {
      localStorage.setItem("wishbeat_flyer_design", d);
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    const theme = THEMES[design];
    QRCode.toCanvas(canvasRef.current, url, {
      width: 560,
      margin: 1,
      color: { dark: theme.qrDark, light: theme.qrLight },
      errorCorrectionLevel: "M"
    });
  }, [url, design]);

  function handlePrint() {
    window.print();
  }

  const dateLabel = new Date(eventDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const theme = THEMES[design];

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
          🖨️ Drucken
        </button>
      </div>

      {/* Design-Picker */}
      <div className="no-print max-w-3xl mx-auto px-4 mb-4">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Design wählen
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(THEMES) as DesignKey[]).map((key) => {
            const t = THEMES[key];
            const active = design === key;
            return (
              <button
                key={key}
                onClick={() => pickDesign(key)}
                className={`flex items-center gap-2 pl-2 pr-4 py-2 rounded-full border transition ${
                  active
                    ? "border-white bg-white/10 text-white"
                    : "border-white/15 hover:border-white/40 text-white/60 hover:text-white"
                }`}
              >
                <span
                  className="w-6 h-6 rounded-full border border-white/20"
                  style={{ background: t.swatch }}
                />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hinweis */}
      <p className="no-print text-center text-white/40 text-xs mb-6 px-4 max-w-3xl mx-auto">
        Im Druck-Dialog{" "}
        <strong className="text-white/70">„Hintergrundgrafik drucken"</strong>{" "}
        aktivieren, damit Farben sichtbar werden (Chrome → Mehr Einstellungen).
      </p>

      {/* Flyer-Karte */}
      <div className="flyer-stage flex justify-center pb-16 px-4">
        <article className="flyer-card" data-design={design}>
          {/* Dekorativer Header-Streifen */}
          <div className="flyer-band" />

          {/* Inhalt */}
          <div className="flyer-content">
            <div className="flyer-eyebrow">
              <span className="dot" /> Wunschsong an {DJ_NAME}
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
                <span>Wunsch absenden — {DJ_NAME} legt&apos;s auf</span>
              </li>
            </ol>

            {/* Footer — minimal */}
            <div className="flyer-footer">
              {validLogoStyle ? (
                <span className="brand-logo">
                  <DjLogo style={validLogoStyle} size={28} />
                </span>
              ) : (
                <span className="brand-mark">w</span>
              )}
              <span className="brand-text-line">
                <span className="brand-name">wishbeat</span>
                <span className="brand-sep"> · </span>
                <span className="brand-handle">zamy82</span>
              </span>
            </div>
          </div>
        </article>
      </div>

      <style jsx global>{`
        /* Theme-Variablen pro design-Wahl */
        .flyer-card[data-design="${design}"] {
          --bg: ${theme.cardBg};
          --band: ${theme.bandStyle};
          --eyebrow: ${theme.eyebrow};
          --eyebrow-dot: ${theme.eyebrowDot};
          --tagline: ${theme.tagline};
          --date: ${theme.date};
          --qr-border: ${theme.qrFrameBorder};
          --qr-bg: ${theme.qrFrameBg};
          --cta: ${theme.cta};
          --step-bg: ${theme.stepBg};
          --step-text: ${theme.stepText};
          --step-body: ${theme.stepBody};
          --dj-name: ${theme.djName};
          --footer-border: ${theme.footerBorder};
          --url: ${theme.url};
          --brand-text: ${theme.brandText};
          --brand-mark: ${theme.brandMark};
          --brand-mark-text: ${theme.brandMarkText};
        }

        .flyer-stage {
          color-scheme: light;
        }

        .flyer-card {
          background: var(--bg);
          width: 148mm;
          min-height: 210mm;
          border-radius: 4mm;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
          overflow: hidden;
          position: relative;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .flyer-band {
          height: 12mm;
          background: var(--band);
        }

        .flyer-content {
          padding: 8mm 12mm 6mm 12mm;
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
          color: var(--eyebrow);
          font-weight: 600;
        }

        .flyer-eyebrow .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--eyebrow-dot);
          display: inline-block;
        }

        .flyer-title {
          font-size: 30pt;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          padding: 0 4px 0.08em 4px;
          margin: 4mm 0 0 0;
          ${theme.titleStyle}
        }

        .flyer-tagline {
          font-size: 14pt;
          color: var(--tagline);
          margin: 3mm 0 0 0;
          font-style: italic;
          font-weight: 500;
        }

        .flyer-date {
          font-size: 10pt;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--date);
          margin: 2mm 0 0 0;
        }

        .flyer-qr-wrap {
          margin: 5mm 0 4mm 0;
          padding: 3mm;
          background: var(--qr-bg);
          border: 3px solid var(--qr-border);
          border-radius: 3mm;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .flyer-qr {
          display: block;
          width: 54mm !important;
          height: 54mm !important;
        }

        .flyer-cta {
          font-size: 13pt;
          font-weight: 700;
          margin: 2mm 0 4mm 0;
          color: var(--cta);
        }

        .flyer-steps {
          list-style: none;
          padding: 0;
          margin: 0 0 5mm 0;
          display: flex;
          flex-direction: column;
          gap: 2mm;
          width: 100%;
          max-width: 100mm;
        }

        .flyer-steps li {
          display: flex;
          align-items: center;
          gap: 4mm;
          text-align: left;
          font-size: 10pt;
          color: var(--step-body);
        }

        .step-num {
          flex-shrink: 0;
          width: 7mm;
          height: 7mm;
          border-radius: 50%;
          background: var(--step-bg);
          color: var(--step-text);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 10pt;
        }

        .flyer-footer {
          margin-top: auto;
          width: 100%;
          padding-top: 4mm;
          border-top: 1px solid var(--footer-border);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 9.5pt;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 5mm;
          height: 5mm;
          border-radius: 50%;
          background: var(--brand-mark);
          color: var(--brand-mark-text);
          font-size: 9pt;
          font-weight: 900;
        }

        .brand-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 8mm;
          height: 8mm;
        }

        .brand-logo svg {
          width: 100%;
          height: 100%;
        }

        .brand-text-line {
          color: var(--brand-text);
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .brand-name {
          color: var(--brand-text);
        }

        .brand-handle {
          color: var(--dj-name);
          font-weight: 800;
        }

        .brand-sep {
          color: var(--url);
          font-weight: 400;
        }

        /* Druck-Ansicht */
        @media print {
          @page {
            size: A5 portrait;
            /* 5mm Drucker-Sicherheitsrand — die meisten Drucker schneiden
               sonst die letzten 3-5mm jeder Kante ab */
            margin: 5mm;
          }

          html,
          body {
            background: #ffffff !important;
            background-image: none !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
            /* Karten-Größe an den druckbaren Bereich anpassen
               (A5 = 148×210mm, minus 2× 5mm Rand = 138×200mm) */
            width: 138mm;
            height: 200mm;
            page-break-after: always;
          }

          /* Spotify-Theme: weißer Hintergrund beim Druck — spart Tinte
             und das Grün leuchtet sogar besser auf weißem Papier */
          .flyer-card[data-design="spotify"] {
            background: #ffffff !important;
          }
          .flyer-card[data-design="spotify"] .flyer-tagline {
            color: #475569 !important;
          }
          .flyer-card[data-design="spotify"] .flyer-date {
            color: #64748b !important;
          }
          .flyer-card[data-design="spotify"] .flyer-cta {
            color: #0a0a12 !important;
          }
          .flyer-card[data-design="spotify"] .flyer-steps li {
            color: #334155 !important;
          }
          .flyer-card[data-design="spotify"] .flyer-footer {
            border-top-color: #e2e8f0 !important;
          }
          .flyer-card[data-design="spotify"] .brand-text-line,
          .flyer-card[data-design="spotify"] .brand-name {
            color: #475569 !important;
          }
          .flyer-card[data-design="spotify"] .brand-sep {
            color: #94a3b8 !important;
          }
        }
      `}</style>
    </>
  );
}
