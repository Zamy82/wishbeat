"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

interface Props {
  name: string;
  tagline: string | null;
  eventDate: string;
  url: string;
  eventId: string;
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
    brandMark: "linear-gradient(135deg, #ff2e93, #22d3ee)"
  },
  neon: {
    label: "Neon Party",
    swatch:
      "linear-gradient(135deg, #1a0033 0%, #0a0a12 50%, #2d0a3a 100%)",
    pageBg: "#0a0a12",
    cardBg: "#13111c",
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
    brandMark: "linear-gradient(135deg, #ff2e93, #22d3ee)"
  },
  spotify: {
    label: "Spotify",
    swatch:
      "linear-gradient(135deg, #064e3b 0%, #0a0a0a 50%, #1DB954 100%)",
    pageBg: "#0a0a0a",
    cardBg: "#191414",
    bandStyle: "linear-gradient(90deg, #1DB954 0%, #1ed760 100%)",
    eyebrow: "#1DB954",
    eyebrowDot: "#1ed760",
    titleStyle:
      "background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%); -webkit-background-clip: text; background-clip: text; color: transparent;",
    tagline: "#a7f3d0",
    date: "#94a3b8",
    qrFrameBorder: "#1DB954",
    qrFrameBg: "#ffffff",
    qrDark: "#191414",
    qrLight: "#ffffff",
    cta: "#ffffff",
    stepBg: "#1DB954",
    stepText: "#ffffff",
    stepBody: "#cbd5e1",
    djName: "#1DB954",
    footerBorder: "rgba(29, 185, 84, 0.2)",
    url: "rgba(255,255,255,0.4)",
    brandText: "rgba(255,255,255,0.6)",
    brandMark: "#1DB954"
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
    brandMark: "rgba(255,255,255,0.95)"
  }
};

const DJ_NAME = "DJ ZAMY";

export default function FlyerCard({
  name,
  tagline,
  eventDate,
  url,
  eventId
}: Props) {
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

            {/* Footer */}
            <div className="flyer-footer">
              <div className="flyer-url">{url.replace(/^https?:\/\//, "")}</div>
              <div className="flyer-brand">
                <span className="brand-mark">w</span>
                <span className="brand-djname">{DJ_NAME}</span>
                <span className="brand-sep">·</span>
                <span>wishbeat</span>
              </div>
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
          font-size: 36pt;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
          margin: 6mm 0 0 0;
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
          margin: 8mm 0 5mm 0;
          padding: 4mm;
          background: var(--qr-bg);
          border: 3px solid var(--qr-border);
          border-radius: 3mm;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .flyer-qr {
          display: block;
          width: 62mm !important;
          height: 62mm !important;
        }

        .flyer-cta {
          font-size: 15pt;
          font-weight: 700;
          margin: 3mm 0 6mm 0;
          color: var(--cta);
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
          font-size: 11pt;
          color: var(--step-body);
        }

        .step-num {
          flex-shrink: 0;
          width: 8mm;
          height: 8mm;
          border-radius: 50%;
          background: var(--step-bg);
          color: var(--step-text);
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
          border-top: 1px solid var(--footer-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8.5pt;
          color: var(--url);
          gap: 4mm;
        }

        .flyer-url {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: -0.01em;
          color: var(--url);
          word-break: break-all;
          max-width: 60%;
        }

        .flyer-brand {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 700;
          color: var(--brand-text);
          font-size: 9pt;
          white-space: nowrap;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 5mm;
          height: 5mm;
          border-radius: 50%;
          background: var(--brand-mark);
          color: #ffffff;
          font-size: 9pt;
          font-weight: 900;
        }

        .brand-djname {
          color: var(--dj-name);
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .brand-sep {
          color: var(--url);
          font-weight: 400;
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
            width: 148mm;
            height: 210mm;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}
