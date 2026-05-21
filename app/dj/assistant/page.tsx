import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AssistantClient from "./AssistantClient";

export default async function DjAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: token } = await supabase
    .from("spotify_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

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
          <h1 className="text-3xl font-bold text-white mt-2">DJ-Assistent</h1>
          <p className="text-white/40 text-sm mt-1">
            Spotify-Live-Status & Vorschläge für den nächsten Song
          </p>
        </div>
      </header>

      {!token ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/60 mb-4">
            Verbinde zuerst dein Spotify-Konto, damit der Assistent weiß was du
            spielst.
          </p>
          <Link
            href="/dj"
            className="inline-block px-5 py-2.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Zum Dashboard → Spotify verbinden
          </Link>
        </div>
      ) : (
        <AssistantClient />
      )}
    </main>
  );
}
