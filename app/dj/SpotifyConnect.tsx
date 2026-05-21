"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SpotifyConnect() {
  const params = useSearchParams();
  const router = useRouter();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const code = params.get("spotify");
    if (code === "connected") {
      setFlash({ kind: "ok", text: "Spotify verbunden! 🎧" });
      router.replace("/dj");
    } else if (code === "error") {
      const reason = params.get("reason");
      setFlash({ kind: "err", text: `Spotify-Verbindung fehlgeschlagen (${reason}).` });
      router.replace("/dj");
    }
  }, [params, router]);

  useEffect(() => {
    fetch("/api/spotify/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  async function disconnect() {
    if (!confirm("Spotify-Verbindung wirklich trennen?")) return;
    setWorking(true);
    await fetch("/api/spotify/disconnect", { method: "POST" });
    setConnected(false);
    setWorking(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {flash && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            flash.kind === "ok"
              ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
              : "bg-red-500/20 text-red-300 border border-red-500/30"
          }`}
        >
          {flash.text}
        </div>
      )}

      {connected === null ? (
        <div className="h-8 w-32 bg-white/5 rounded-full animate-pulse" />
      ) : connected ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
            Spotify verbunden
          </span>
          <button
            onClick={disconnect}
            disabled={working}
            className="text-xs text-white/40 hover:text-white/80 transition underline underline-offset-2"
          >
            trennen
          </button>
        </div>
      ) : (
        <a
          href="/api/spotify/authorize"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-semibold transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Spotify verbinden
        </a>
      )}
    </div>
  );
}
