"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DjProfile } from "@/lib/types";

interface Props {
  initialProfile: DjProfile | null;
  userEmail: string;
}

export default function SettingsForm({ initialProfile, userEmail }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    initialProfile?.display_name ?? "DJ Zamy"
  );
  const [paypal, setPaypal] = useState(initialProfile?.paypal_handle ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

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

    // Trinkgeld laeuft bewusst NUR ueber PayPal. Die Bank-/IBAN-Felder werden
    // hart auf null gesetzt — so wird eine evtl. frueher gespeicherte IBAN beim
    // Speichern geloescht (keine sensiblen Bankdaten mehr in der DB).
    const { error } = await supabase.from("dj_profiles").upsert({
      user_id: user.id,
      display_name: displayName.trim() || null,
      iban_holder: null,
      iban: null,
      bic: null,
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

      {/* PayPal — einziger Trinkgeld-Weg */}
      <fieldset className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <legend className="px-3 text-white/60 text-xs uppercase tracking-widest">
          Geschenk — PayPal.me
        </legend>
        <p className="text-white/40 text-xs mt-2 mb-2">
          PayPal-Username für deinen{" "}
          <code className="text-white/60">paypal.me/USER</code>-Link. Trinkgeld
          läuft ausschließlich über PayPal — es werden bewusst keine Bankdaten
          gespeichert.
        </p>
        <p className="text-white/30 text-xs mb-4 leading-relaxed">
          💡 Bei PayPal &bdquo;Friends &amp; Family&ldquo; einstellen — dann sind
          beide Seiten gebührenfrei, gilt rechtlich als private Schenkung.
        </p>
        <input
          type="text"
          value={paypal}
          onChange={(e) => setPaypal(e.target.value.replace(/^@/, "").trim())}
          maxLength={50}
          placeholder="z.B. ZamyAhmad (ohne @)"
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
        />
        {paypal && (
          <p className="text-white/40 text-xs mt-2">
            Vorschau:{" "}
            <a
              href={`https://paypal.me/${paypal}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan hover:underline"
            >
              paypal.me/{paypal}
            </a>
          </p>
        )}
      </fieldset>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
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
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-white/70 text-sm font-medium mb-1">
        {label}
      </label>
      {hint && <p className="text-white/40 text-xs mb-2">{hint}</p>}
      {children}
    </div>
  );
}
