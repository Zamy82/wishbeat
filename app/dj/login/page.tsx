"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DjLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/dj` }
    });

    setLoading(false);

    if (authError) {
      setError("Login fehlgeschlagen. Bitte prüfe deine E-Mail-Adresse.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-2">DJ-Login</h1>
        <p className="text-white/50 mb-8 text-sm">
          Du bekommst einen Login-Link per E-Mail — kein Passwort nötig.
        </p>

        {sent ? (
          <div className="rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 p-6 text-center">
            <p className="text-neon-cyan font-medium">Link ist unterwegs! 📬</p>
            <p className="text-white/60 text-sm mt-2">
              Schau in dein Postfach ({email}) und klick auf den Link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="deine@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-purple transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-neon-pink to-neon-purple text-white disabled:opacity-40 hover:opacity-90 transition"
            >
              {loading ? "Sende Link…" : "Login-Link schicken"}
            </button>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
