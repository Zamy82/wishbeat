"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Minimaler Typ-Ausschnitt fuer html5-qrcode — wir importieren die Library
// nur dynamisch (kein SSR-Bundle-Bloat), darum hier Hand-Typen.
interface Html5QrcodeConfig {
  fps: number;
  qrbox?:
    | { width: number; height: number }
    | ((vw: number, vh: number) => { width: number; height: number });
  aspectRatio?: number;
  experimentalFeatures?: { useBarCodeDetectorIfSupported?: boolean };
  rememberLastUsedCamera?: boolean;
  disableFlip?: boolean;
}

interface VideoConstraints {
  facingMode: string;
  width?: { ideal: number };
  height?: { ideal: number };
}

interface Html5QrcodeLike {
  start: (
    cameraIdOrConfig: VideoConstraints,
    config: Html5QrcodeConfig,
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  isScanning?: boolean;
}

const READER_ID = "wishbeat-qr-reader";

export default function QrScanButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "denied" | "error">(
    "idle"
  );
  const scannerRef = useRef<Html5QrcodeLike | null>(null);
  const router = useRouter();

  // Scanner starten, sobald Modal offen
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setStatus("starting");
    setError(null);

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (!mounted) return;
        const scanner = new mod.Html5Qrcode(READER_ID) as unknown as Html5QrcodeLike;
        scannerRef.current = scanner;
        // iOS Safari ist zickig: hoehere Video-Aufloesung explizit anfordern,
        // sonst liefert es 640x480 was bei kleinen QR-Codes nicht reicht.
        // facingMode: "environment" (NICHT { exact: ... }), damit es auf
        // Geraeten ohne Backcam einen Fallback gibt.
        const videoConstraints = {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        };
        await scanner.start(
          videoConstraints,
          {
            fps: 25,
            // qrbox dynamisch: 75% des kleineren Container-Mass
            qrbox: (vw: number, vh: number) => {
              const min = Math.min(vw, vh);
              const size = Math.max(180, Math.floor(min * 0.75));
              return { width: size, height: size };
            },
            aspectRatio: 1,
            // Nutzt die native BarcodeDetector-API wo verfuegbar (Chrome,
            // Edge, Android-WebView). iOS Safari hat das nicht — faellt auf
            // JS-Decoder zurueck.
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            rememberLastUsedCamera: true,
            disableFlip: false
          },
          (decodedText: string) => {
            handleScan(decodedText);
          },
          () => {
            // pro-Frame Decoding-Fehler ignorieren (kommen staendig vor)
          }
        );
        if (!mounted) {
          await scanner.stop().catch(() => {});
          scanner.clear();
          return;
        }
        setStatus("running");
      } catch (e) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/permission|denied|notallowed/i.test(msg)) {
          setStatus("denied");
          setError(
            "Kamera-Zugriff abgelehnt. Erlaube wishbeat den Kamera-Zugriff in den Browser-Einstellungen."
          );
        } else if (/notfound|nodevice|nocamera/i.test(msg)) {
          setStatus("error");
          setError("Keine Kamera gefunden.");
        } else {
          setStatus("error");
          setError(`Kamera-Fehler: ${msg}`);
        }
      }
    })();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        // stop() schlaegt fehl wenn schon gestoppt — fangen
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            try {
              s.clear();
            } catch {
              // ignore
            }
          });
      }
    };
  }, [open]);

  function handleScan(text: string) {
    // wishbeat-Event-URL extrahieren — egal ob /event/SLUG oder Voll-URL
    let slug: string | null = null;
    try {
      const url = new URL(text);
      const m = url.pathname.match(/\/event\/([A-Za-z0-9_-]+)/);
      if (m) slug = m[1];
    } catch {
      // not a URL — vielleicht direkter Slug
      if (/^[A-Za-z0-9_-]{3,80}$/.test(text)) slug = text;
    }

    if (slug) {
      // Modal schliessen + navigieren
      closeModal();
      router.push(`/event/${slug}`);
    } else {
      setError(`Das ist kein wishbeat-QR. Gescannt: ${text.slice(0, 60)}`);
    }
  }

  function closeModal() {
    setOpen(false);
    setStatus("idle");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-3xl border border-neon-purple/40 bg-gradient-to-r from-neon-pink/15 to-neon-purple/15 p-5 text-left hover:from-neon-pink/25 hover:to-neon-purple/25 transition active:scale-[0.98]"
      >
        <p className="text-[10px] uppercase tracking-widest text-neon-purple/90 mb-2 font-semibold">
          📷 QR-Code in der App scannen
        </p>
        <p className="text-white text-base font-semibold leading-snug">
          Tippe hier und richte die Kamera auf den QR am Tisch.
        </p>
        <p className="text-white/50 text-xs mt-1">
          Bleibt in der App — kein Wechsel in den Browser.
        </p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">QR-Code scannen</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-white/60 hover:text-white text-2xl leading-none px-2"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-white/10">
              {/* Scanner mounted in dieses div */}
              <div id={READER_ID} className="w-full h-full" />

              {status === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                  Kamera startet …
                </div>
              )}
            </div>

            {status === "running" && (
              <div className="text-white/60 text-xs text-center space-y-1">
                <p>Halte den QR im hellen Rahmen, 10–20 cm Abstand.</p>
                <p className="text-white/40">
                  PC-Bildschirm? Browser mit <kbd className="px-1 rounded bg-white/10">Strg</kbd>+<kbd className="px-1 rounded bg-white/10">+</kbd> zoomen,
                  bis QR mind. 5 cm groß ist.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {(status === "denied" || status === "error") && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/70 leading-relaxed">
                <p className="text-white/90 font-semibold mb-1">
                  Alternative:
                </p>
                Verlasse wishbeat kurz, öffne die <strong className="text-white">Kamera-App</strong>{" "}
                deines Handys und scanne den QR-Code damit.
              </div>
            )}

            <button
              type="button"
              onClick={closeModal}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
