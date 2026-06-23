"use client";

import { useState } from "react";

interface Props {
  djUserId: string;
  djDisplayName: string;
  referrerEventId: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const EVENT_TYPES = [
  "Geburtstag",
  "Hochzeit",
  "Firmenfeier",
  "Sommerfest",
  "Jubiläum",
  "Familienfeier",
  "Anderes"
];

export default function BookingRequestButton({
  djUserId,
  djDisplayName,
  referrerEventId
}: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    event_date: "",
    event_type: "",
    guest_count: "",
    location: "",
    message: ""
  });

  function reset() {
    setForm({
      name: "",
      email: "",
      phone: "",
      event_date: "",
      event_type: "",
      guest_count: "",
      location: "",
      message: ""
    });
    setStatus({ kind: "idle" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;

    if (!form.name.trim() || !form.email.trim()) {
      setStatus({ kind: "error", message: "Name und E-Mail sind Pflichtfelder." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dj_user_id: djUserId,
          referrer_event_id: referrerEventId,
          name: form.name,
          email: form.email,
          phone: form.phone,
          event_date: form.event_date || undefined,
          event_type: form.event_type || undefined,
          guest_count: form.guest_count ? parseInt(form.guest_count, 10) : undefined,
          location: form.location,
          message: form.message
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Anfrage konnte nicht gesendet werden."
        });
        return;
      }
      setStatus({ kind: "success" });
    } catch {
      setStatus({ kind: "error", message: "Netzwerk-Fehler. Bitte nochmal versuchen." });
    }
  }

  function close() {
    if (status.kind === "submitting") return;
    setOpen(false);
    // Reset nach kurzer Verzoegerung damit die Erfolgs-Meldung
    // beim Schliessen nicht verschwindet
    setTimeout(reset, 500);
  }

  return (
    <>
      {/* Button auf der Event-Seite */}
      <section className="w-full max-w-md mt-6 mb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border border-neon-purple/40 bg-gradient-to-r from-neon-pink/15 via-neon-purple/15 to-neon-cyan/15 hover:from-neon-pink/25 hover:via-neon-purple/25 hover:to-neon-cyan/25 p-5 text-left transition active:scale-[0.98]"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">💼</span>
            <div className="flex-1">
              <p className="text-white font-bold text-base">
                {djDisplayName} für deine Party buchen
              </p>
              <p className="text-white/60 text-sm mt-1">
                Gefällt dir der Vibe? Schick eine unverbindliche Anfrage — Zamy meldet
                sich bei dir zurück.
              </p>
            </div>
            <span className="text-white/30 text-lg">→</span>
          </div>
        </button>
      </section>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#1a0f24] shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">
                💼 {djDisplayName} buchen
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={status.kind === "submitting"}
                className="text-white/60 hover:text-white text-2xl leading-none px-2"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            {status.kind === "success" ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Anfrage angekommen!
                </h3>
                <p className="text-white/70 text-sm">
                  Zamy meldet sich in den nächsten Tagen bei dir per E-Mail.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
                <Field label="Dein Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={100}
                    placeholder="z.B. Anna Mustermann"
                    className="input"
                    required
                  />
                </Field>

                <Field label="E-Mail" required>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={200}
                    placeholder="du@beispiel.de"
                    className="input"
                    required
                  />
                </Field>

                <Field label="Telefon (optional)">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    maxLength={40}
                    placeholder="für schnelle Rückrufe"
                    className="input"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Wunschtermin">
                    <input
                      type="date"
                      value={form.event_date}
                      onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Gäste (ca.)">
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={form.guest_count}
                      onChange={(e) => setForm({ ...form, guest_count: e.target.value })}
                      placeholder="z.B. 60"
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="Anlass">
                  <select
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className="input"
                  >
                    <option value="">Bitte wählen…</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Ort">
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    maxLength={100}
                    placeholder="z.B. Berlin oder Sportplatz Lichterfelde"
                    className="input"
                  />
                </Field>

                <Field label="Nachricht (optional)">
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    maxLength={1000}
                    rows={3}
                    placeholder="Stilrichtung, Musikwünsche, Besonderheiten…"
                    className="input resize-none"
                  />
                </Field>

                {status.kind === "error" && (
                  <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    ⚠ {status.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status.kind === "submitting"}
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-neon-pink to-neon-purple text-white disabled:opacity-50 hover:opacity-90 active:scale-95 transition mt-2"
                >
                  {status.kind === "submitting" ? "Wird gesendet…" : "Anfrage absenden"}
                </button>

                <p className="text-white/30 text-[10px] text-center">
                  Mit dem Absenden willigst du ein, dass deine Angaben an Zamy
                  weitergeleitet werden. Keine Werbung, kein Weiterverkauf.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 0.75rem;
          padding: 0.65rem 0.85rem;
          color: white;
          font-size: 0.9rem;
        }
        .input:focus {
          outline: none;
          border-color: rgba(168, 85, 247, 0.6);
          background: rgba(255, 255, 255, 0.12);
        }
        .input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">
        {label}
        {required && <span className="text-neon-pink ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
