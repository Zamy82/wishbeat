"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildGiroCodeData, formatIban } from "@/lib/girocode";

interface Props {
  djDisplayName: string;
  ibanHolder: string;
  iban: string;
  bic: string | null;
  eventName: string;
}

const PRESET_AMOUNTS = [2, 5, 10];

export default function TipSection({
  djDisplayName,
  ibanHolder,
  iban,
  bic,
  eventName
}: Props) {
  const [amount, setAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [showFull, setShowFull] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveAmount =
    amount !== null
      ? amount
      : parseFloat(customAmount.replace(",", ".")) || 0;

  // Verwendungszweck als "Geschenk" formuliert — rechtssicher als private
  // Schenkung erkennbar (keine Dienstleistungs-Implikation wie bei "Trinkgeld").
  const purpose = `Geschenk an ${djDisplayName}`;

  useEffect(() => {
    if (!canvasRef.current) return;
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
    // eventName ist nicht mehr im purpose enthalten — keine Dep nötig
  }, [ibanHolder, iban, bic, effectiveAmount, djDisplayName, purpose]);

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

        {/* Betrag-Auswahl */}
        <div className="grid grid-cols-4 gap-2 mb-5">
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

        {/* QR-Code */}
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
                als Geschenk an {djDisplayName}
              </>
            )}
          </p>
          <p className="text-white/30 text-xs mt-1 text-center">
            Funktioniert mit Sparkasse, Volksbank, ING, N26, DKB, comdirect &
            allen DE-Banken
          </p>
        </div>

        {/* Manual-Daten ausklappen */}
        <button
          type="button"
          onClick={() => setShowFull(!showFull)}
          className="mt-4 w-full text-white/40 hover:text-white/70 text-xs underline underline-offset-2 transition"
        >
          {showFull ? "Daten ausblenden" : "Daten manuell anzeigen"}
        </button>

        {showFull && (
          <dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-xs">
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
    </section>
  );
}
