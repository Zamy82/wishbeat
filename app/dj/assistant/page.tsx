import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DjConsole from "./DjConsole";

export default async function DjAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  // Spotify-Verbindung pruefen
  const { data: token } = await supabase
    .from("spotify_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Aktives Event finden (neuestes aktives Event des DJs)
  const { data: activeEvent } = await supabase
    .from("events")
    .select("id, name, slug, is_active, event_date")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/dj"
              className="text-white/40 hover:text-white text-sm transition"
            >
              ← Zurück
            </Link>
            <h1 className="text-3xl font-bold text-white mt-2">DJ-Konsole</h1>
          </div>
        </header>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/60 mb-4">
            Verbinde zuerst dein Spotify-Konto, damit die Konsole weiß was du spielst.
          </p>
          <Link
            href="/dj"
            className="inline-block px-5 py-2.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Zum Dashboard → Spotify verbinden
          </Link>
        </div>
      </main>
    );
  }

  return (
    <DjConsole
      userEmail={user.email ?? ""}
      activeEvent={activeEvent ?? null}
    />
  );
}
