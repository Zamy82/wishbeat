"use client";

import { useEffect, useState } from "react";

interface Props {
  eventId: string;
  eventName: string;
  initialUrl: string | null;
  initialCreatedAt: string | null;
  playsCount: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; url: string; createdAt: string | null }
  | { kind: "error"; message: string; missingScope?: boolean };

export default function MemoryPlaylistButton({
  eventId,
  eventName,
  initialUrl,
  initialCreatedAt,
  playsCount
}: Props) {
  const [status, setStatus] = useState<Status>(
    initialUrl
      ? { kind: "ready", url: initialUrl, createdAt: initialCreatedAt }
      : { kind: "idle" }
  );
  const [copied, setCopied] = useState(false);

  async function create() {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`/api/events/${eventId}/memory-playlist`, {
        method: "POST"
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Unbekannter Fehler",
          missingScope: data.error === "missing_scope"
        });
        return;
      }
      setStatus({
        kind: "ready",
        url: data.playlist_url,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Netzwerk-Fehler"
      });
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function shareWhatsApp(url: string) {
    const text = `🎵 Hier sind alle Songs von "${eventName}" als Spotify-Playlist:\n\n${url}\n\nViel Spaß beim Wiederhören! 💃`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  }

  if (playsCount === 0) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🎵</span>
          <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">
            Memory-Playlist
          </span>
        </div>
        <p className="text-white/50 text-sm">
          Sobald Songs gespielt wurden, kannst du hier eine Spotify-Playlist mit
          allen Tracks erstellen — perfekt zum Verschicken an den Gastgeber.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-[#1DB954]/40 bg-gradient-to-br from-[#1DB954]/10 via-transparent to-transparent p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🎵</span>
            <span className="text-xs uppercase tracking-widest text-[#1ed760] font-semibold">
              Memory-Playlist
            </span>
          </div>
          <p className="text-white text-sm font-semibold">
            Alle gespielten Songs als Spotify-Playlist
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {playsCount} Songs in der Reihenfolge wie sie liefen — perfekt zum
            Verschicken an den Gastgeber.
          </p>
        </div>
      </div>

      {status.kind === "idle" && (
        <button
          type="button"
          onClick={create}
          className="w-full py-3 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold text-sm transition active:scale-95"
        >
          🎵 Playlist auf Spotify erstellen
        </button>
      )}

      {status.kind === "loading" && (
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-2xl bg-[#1DB954]/60 text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <span className="inline-block animate-spin">🎵</span>
          Erstelle Playlist…
        </button>
      )}

      {status.kind === "ready" && (
        <div className="flex flex-col gap-2">
          <a
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold text-sm transition text-center"
          >
            ▶️ Playlist auf Spotify öffnen
          </a>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => shareWhatsApp(status.url)}
              className="py-2.5 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/30 font-semibold text-xs transition"
            >
              💬 Per WhatsApp teilen
            </button>
            <button
              type="button"
              onClick={() => copyLink(status.url)}
              className="py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/15 font-semibold text-xs transition"
            >
              {copied ? "✅ Kopiert!" : "📋 Link kopieren"}
            </button>
          </div>
          {status.createdAt && (
            <p className="text-white/30 text-[10px] text-center mt-1">
              Erstellt am{" "}
              {new Date(status.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}
            </p>
          )}
          <button
            type="button"
            onClick={create}
            className="text-white/40 hover:text-white text-xs underline underline-offset-2 mt-1"
          >
            Neu generieren (mit aktuellen Songs)
          </button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="space-y-2">
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-200">
            ⚠ {status.message}
          </div>
          {status.missingScope && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs text-yellow-200 leading-relaxed">
              <p className="font-semibold mb-1">So fixt du das:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Geh zum DJ-Dashboard</li>
                <li>Klicke neben dem Spotify-Status auf „trennen"</li>
                <li>Verbinde Spotify erneut — diesmal wirst du nach erweiterten Berechtigungen gefragt</li>
                <li>Komm zurück hierher</li>
              </ol>
            </div>
          )}
          <button
            type="button"
            onClick={create}
            className="w-full py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Nochmal versuchen
          </button>
        </div>
      )}
    </section>
  );
}
