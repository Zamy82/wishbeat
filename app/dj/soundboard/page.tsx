import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SoundboardClient from "./SoundboardClient";

export default async function SoundboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  return (
    <main className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <Link
          href="/dj"
          className="text-white/40 hover:text-white text-sm mb-4 inline-block transition"
        >
          ← Zurück
        </Link>
        <h1 className="text-3xl font-bold text-white">🎛️ DJ Soundboard</h1>
        <p className="text-white/50 text-sm mt-2 max-w-2xl">
          Tipp auf einen Button — der Sound spielt sofort über deinen Browser-Audio-Output ab.
          Damit es über deine Boxen kommt, muss dein Laptop-Audio auf dieselbe Quelle gehen wie Spotify.
        </p>
      </header>

      <SoundboardClient />
    </main>
  );
}
