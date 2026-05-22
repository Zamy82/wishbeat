"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DjProfile } from "@/lib/types";
import { formatIban, isLikelyValidIban } from "@/lib/girocode";

interface Props {
  initialProfile: DjProfile | null;
  userEmail: string;
}

export default function SettingsForm({ initialProfile, userEmail }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    initialProfile?.display_name ?? "DJ Zamy"
  );
  const [ibanHolder, setIbanHolder] = useState(initialProfile?.iban_holder ?? "");
  const [iban, setIban] = useState(
    initialProfile?.iban ? formatIban(initialProfile.iban) : ""
  );
  const [bic, setBic] = useState(initialProfile?.bic ?? "");
  const [paypal, setPaypal] = useState(initialProfile?.paypal_handle ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const ibanClean = iban.replace(/\s+/g, "").toUpperCase();
  const ibanValid = ibanClean.length === 0 || isLikelyValidIban(ibanClean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/dj/login");
      return;
    }

    const { error } = await supabase.from("dj_profiles").upsert({
      user_id: user.id,
      display_name: displayName.trim() || null,
      iban_holder: ibanHolder.trim() || null,
      iban: ibanClean || null,
      bic: bic.trim().toUpperCase() || null,
      paypal_handle: paypal.trim() || null,
      updated_at: new Date().toISOString()
    });

    setSaving(false);

    if (error) {
      setFlash({ kind: "err", text: `Speichern fehlgeschlagen: ${error.message}` });
      return;
    }
    setFlash({ kind: "ok", text: "Gespeichert!" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      {/* Anzeige-Name */}
      <Field
        label="Anzeige-Name"
        hint="Wie sollst du auf der Gäste-Seite genannt werden?"
      >
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="z.B. DJ Zamy"
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
        />
      </Field>

      {/* Trinkgeld-Block */}
      <fieldset className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <legend className="px-3 text-white/60 text-xs uppercase tracking-widest">
          Geschenk-Bank-Daten
        </legend>
        <p className="text-white/40 text-xs mt-2 mb-2">
          Daten werden für einen SEPA-QR-Code auf der Gäste-Seite generiert. Gäste
          scannen mit ihrer Banking-App → freiwillige Überweisung in 2 Klicks.
        </p>
        <p className="text-white/30 text-xs mb-5 leading-relaxed">
          💡 Verwendungszweck ist absichtlich als „Geschenk an [Name]"
          formuliert — gilt rechtlich als private Schenkung. Für Hobby-DJs ohne
          Gewerbe sauber, da keine Dienstleistungs-Implikation. Schenkungen sind
          bis 20.000 €/Person über 10 Jahre steuerfrei.
        </p>

        <div className="flex flex-col gap-4">
          <Field
            label="Empfänger-Name (Kontoinhaber)"
            hint="Genau wie er auf deinem Konto steht — sonst lehnt die Bank ab."
          >
            <input
              type="text"
              value={ibanHolder}
              onChange={(e) => setIbanHolder(e.target.value)}
              maxLength={70}
              placeholder="z.B. Zamy Ahmad"
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
            />
          </Field>

          <Field
            label="IBAN"
            hint="Leerzeichen sind OK — werden automatisch entfernt."
            invalid={!ibanValid}
            error={!ibanValid ? "IBAN sieht ungültig aus — bitte prüfen." : undefined}
          >
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              maxLength={42}
              placeholder="DE89 3704 0044 0532 0130 00"
              className={`w-full rounded-2xl bg-white/10 border px-5 py-4 text-white placeholder:text-white/40 focus:outline-none transition font-mono ${
                !ibanValid
                  ? "border-red-500/50 focus:border-red-400"
                  : "border-white/20 focus:border-neon-purple"
              }`}
            />
          </Field>

          <Field
            label="BIC (optional)"
            hint="Bei deutschen IBANs nicht nötig. Nur für Ausland."
          >
            <input
              type="text"
              value={bic}
              onChange={(e) => setBic(e.target.value)}
              maxLength={11}
              placeholder="z.B. COBADEFFXXX"
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition font-mono uppercase"
            />
          </Field>
        </div>
      </fieldset>

      {/* PayPal (deaktiviert für jetzt) */}
      <fieldset className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 opacity-60">
        <legend className="px-3 text-white/60 text-xs uppercase tracking-widest">
          Trinkgeld — PayPal (kommt bald)
        </legend>
        <p className="text-white/40 text-xs mt-2 mb-3">
          PayPal-Username — z.B. <code>zamy82</code> für{" "}
          <code>paypal.me/zamy82</code>. Trag's ein wenn deine PayPal-Einstellungen
          fertig sind.
        </p>
        <input
          type="text"
          value={paypal}
          onChange={(e) => setPaypal(e.target.value)}
          maxLength={50}
          placeholder="z.B. zamy82"
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
        />
      </fieldset>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || !ibanValid}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>
        {flash && (
          <span
            className={`text-sm ${
              flash.kind === "ok" ? "text-neon-cyan" : "text-red-400"
            }`}
          >
            {flash.text}
          </span>
        )}
      </div>

      <p className="text-white/30 text-xs">Eingeloggt als: {userEmail}</p>
    </form>
  );
}

function Field({
  label,
  hint,
  invalid,
  error,
  children
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-white/70 text-sm font-medium mb-1">
        {label}
      </label>
      {hint && <p className="text-white/40 text-xs mb-2">{hint}</p>}
      {children}
      {invalid && error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
