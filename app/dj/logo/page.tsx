import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoPicker from "./LogoPicker";

export default async function LogoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: profile } = await supabase
    .from("dj_profiles")
    .select("logo_style")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen px-4 py-10 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/dj"
          className="text-white/40 hover:text-white text-sm transition"
        >
          ← Zurück
        </Link>
        <h1 className="text-3xl font-bold text-white mt-2">Logo wählen</h1>
        <p className="text-white/40 text-sm mt-1">
          Wird auf dem Flyer, im Dashboard und auf der Gäste-Seite verwendet.
        </p>
      </header>

      <LogoPicker initialStyle={profile?.logo_style ?? null} />
    </main>
  );
}
