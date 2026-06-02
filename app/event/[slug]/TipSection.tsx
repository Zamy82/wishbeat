"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildGiroCodeData, formatIban } from "@/lib/girocode";

interface Props {
  djDisplayName: string;
  ibanHolder: string;
  iban: string;
  bic: string | null;
  paypalHandle: string | null;
  eventName: string;
  hasBank: boolean;
  hasPaypal: boolean;
}

const PRESET_AMOUNTS = [2, 6];

type Method = "bank" | "paypal";

export default function TipSection({
  djDisplayName,
  ibanHolder,
  iban,
  bic,
  paypalHandle,
  hasBank,
  hasPaypal
}: Props) {
  const [amount, setAmount] = useState<number | null>(2);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<Method>(hasBank ? "bank" : "paypal");
  const [showFull, setShowFull] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveAmount =
    amount !== null ? amount : parseFloat(customAmount.replace(",", ".")) || 0;

  // Vornamen aus iban_holder für sauberen Verwendungszweck
  const firstName = ibanHolder.trim().split(/\s+/)[0] || djDisplayName;
  const purpose = `Geschenk an ${firstName}`;

  // SEPA QR-Code generieren — nur wenn Bank-Tab aktiv und Daten da
  useEffect(() => {
    if (method !== "bank" || !canvasRef.current || !iban || !ibanHolder) return;
    const data = buildGiroCodeData({
      name: ibanHolder,
      iban,
      bic: bic ?? undefined,
      amount: effectiveAmount > 0 ? effectiveAmount : undefined,
      purpose
    });
    QRCode.toCanvas(canvasRef.current, data, {
      width: 280,
      margin: 1,
      color: { dark: "#0a0a12", light: "#ffffff" },
      errorCorrectionLevel: "M"
    });
  }, [method, ibanHolder, iban, bic, effectiveAmount, purpose]);

  // PayPal.me-URL bauen — Format: paypal.me/USER/BETRAGEUR
  const paypalUrl = paypalHandle
    ? effectiveAmount > 0
      ? `https://paypal.me/${paypalHandle}/${effectiveAmount.toFixed(2)}EUR`
      : `https://paypal.me/${paypalHandle}`
    : "";

  return (
    <section className="w-full max-w-md mt-12 mb-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-center mb-5">
          <h3 className="text-xl font-bold text-white">
            💚 Danke an {djDisplayName}
          </h3>
          <p className="text-white/50 text-sm mt-1">
            Gefällt dir der Abend? Sag &bdquo;Danke&ldquo; mit einem freiwilligen
            Betrag — komplett auf privater Schenk-Basis.
          </p>
        </div>

        {/* Methoden-Tabs — nur zeigen wenn beide verfügbar */}
        {hasBank && hasPaypal && (
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setMethod("bank")}
              className={`py-2.5 rounded-xl font-semibold text-sm transition ${
                method === "bank"
                  ? "bg-white/15 text-white shadow-lg"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              🏦 Bank-Überweisung
            </button>
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              className={`py-2.5 rounded-xl font-semibold text-sm transition ${
                method === "paypal"
                  ? "bg-[#0070ba]/30 text-white shadow-lg"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <PayPalLogo />
                PayPal
              </span>
            </button>
          </div>
        )}

        {/* Betrag-Auswahl */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAmount(a);
                setCustomAmount("");
              }}
              className={`py-3 rounded-2xl font-semibold transition ${
                amount === a
                  ? "bg-gradient-to-r from-neon-pink to-neon-purple text-white"
                  : "bg-white/10 hover:bg-white/15 text-white/80"
              }`}
            >
              {a} €
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount(null)}
            className={`py-3 rounded-2xl font-semibold transition text-sm ${
              amount === null
                ? "bg-gradient-to-r from-neon-pink to-neon-purple text-white"
                : "bg-white/10 hover:bg-white/15 text-white/80"
            }`}
          >
            Eigener
          </button>
        </div>

        {amount === null && (
          <div className="mb-5">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Betrag in € (z.B. 7.50)"
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition text-center text-lg font-semibold"
            />
          </div>
        )}

        {/* Bank-Methode */}
        {method === "bank" && hasBank && (
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              <canvas ref={canvasRef} />
            </div>
            <p className="text-white/60 text-sm mt-3 text-center">
              📱 Mit Banking-App scannen
              {effectiveAmount > 0 && (
                <>
                  {" "}—{" "}
                  <span className="text-white font-semibold">
                    {effectiveAmount.toFixed(2)} €
                  </span>{" "}
                  als Geschenk an {firstName}
                </>
              )}
            </p>
            <p className="text-white/30 text-xs mt-1 text-center">
              Sparkasse, Volksbank, ING, N26, DKB, comdirect & alle DE-Banken
            </p>

            {/* Manual-Daten ausklappen */}
            <button
              type="button"
              onClick={() => setShowFull(!showFull)}
              className="mt-4 w-full text-white/40 hover:text-white/70 text-xs underline underline-offset-2 transition"
            >
              {showFull ? "Daten ausblenden" : "Daten manuell anzeigen"}
            </button>

            {showFull && (
              <dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-xs w-full">
                <dt className="text-white/40">Empfänger</dt>
                <dd className="text-white/80">{ibanHolder}</dd>
                <dt className="text-white/40">IBAN</dt>
                <dd className="text-white/80 font-mono break-all">
                  {formatIban(iban)}
                </dd>
                {bic && (
                  <>
                    <dt className="text-white/40">BIC</dt>
                    <dd className="text-white/80 font-mono">{bic}</dd>
                  </>
                )}
                <dt className="text-white/40">Verw.zweck</dt>
                <dd className="text-white/80">{purpose}</dd>
              </dl>
            )}
          </div>
        )}

        {/* PayPal-Methode */}
        {method === "paypal" && hasPaypal && (
          <div className="flex flex-col items-center">
            <a
              href={paypalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold text-base flex items-center justify-center gap-2.5 transition shadow-lg active:scale-95"
            >
              <PayPalLogo big />
              Mit PayPal senden
              {effectiveAmount > 0 && (
                <span className="font-extrabold">
                  · {effectiveAmount.toFixed(2)} €
                </span>
              )}
            </a>
            <p className="text-white/50 text-xs mt-3 text-center">
              Öffnet <code className="text-white/70">paypal.me/{paypalHandle}</code>
              {" "}in der PayPal-App
            </p>
            <div className="mt-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 p-3 text-xs">
              <p className="text-yellow-300 font-semibold mb-1">
                ⚠️ Wichtig im PayPal-Dialog:
              </p>
              <p className="text-white/80 leading-relaxed">
                Wähle <strong>&bdquo;An Freunde oder Familie senden&ldquo;</strong>{" "}
                (nicht „Für Waren/Dienstleistungen"). Sonst fallen 2,5% Gebühren
                an — bei einer privaten Schenkung gibt&apos;s das nicht.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PayPalLogo({ big = false }: { big?: boolean }) {
  const size = big ? 20 : 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.997-5.683 5.79-.943.241-1.943.367-3.018.367h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106-.327 2.083a.523.523 0 0 0 .515.605h3.94c.464 0 .858-.336.93-.795l.038-.2.74-4.7.048-.262a.93.93 0 0 1 .93-.795h.585c3.787 0 6.752-1.538 7.62-5.99.36-1.86.174-3.412-.81-4.5z" />
    </svg>
  );
}
