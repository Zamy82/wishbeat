"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function buildSlug(name: string, date: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${normalized}-${date}`;
}

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [date, setDate] = useState("");
  const [wishOnly, setWishOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/dj/login");
      return;
    }

    const slug = buildSlug(name, date);

    const { data: event, error: dbError } = await supabase
      .from("events")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        tagline: tagline.trim() || null,
        event_date: date,
        slug,
        is_active: true,
        wish_only: wishOnly
      })
      .select("id")
      .single();

    setLoading(false);

    if (dbError) {
      if (dbError.code === "23505") {
        setError("Ein Event mit diesem Namen und Datum existiert bereits.");
      } else {
        setError("Fehler beim Anlegen. Bitte nochmal versuchen.");
      }
      return;
    }

    router.push(`/dj/event/${event.id}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-2">Neues Event</h1>
        <p className="text-white/50 text-sm mb-8">
          Du bekommst danach deinen QR-Code zum Ausdrucken.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
              Event-Name
            </label>
            <input
              type="text"
              required
              placeholder="z.B. Spargelsatt"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
              Untertitel <span className="lowercase text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="z.B. Spargelessen & Tanz"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={100}
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
              Datum
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white focus:outline-none focus:border-neon-purple transition [color-scheme:dark]"
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-white/5 border border-white/15 px-5 py-4 cursor-pointer hover:bg-white/10 transition">
            <input
              type="checkbox"
              checked={wishOnly}
              onChange={(e) => setWishOnly(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-neon-purple"
            />
            <span className="text-sm">
              <span className="block text-white font-medium">
                Vorab-Modus (nur Wünsche sammeln)
              </span>
              <span className="block text-white/50 text-xs mt-0.5">
                Für den QR-Code vor der Party: Gäste sehen nur die Wunsch-Eingabe,
                keine Live-Anzeige oder Trinkgeld. Am Party-Tag im Event einfach
                ausschalten.
              </span>
            </span>
          </label>

          {name && date && (
            <p className="text-white/30 text-xs">
              URL: /event/{buildSlug(name, date)}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name || !date}
            className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-neon-pink to-neon-purple text-white disabled:opacity-40 hover:opacity-90 transition mt-2"
          >
            {loading ? "Wird angelegt…" : "Event anlegen & QR-Code zeigen"}
          </button>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </form>
      </div>
    </main>
  );
}
