"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface PlayItem {
  spotify_track_id: string;
  title: string;
  artist: string;
}

interface Props {
  eventId: string;
  eventName: string;
  eventDate: string;
  plays: PlayItem[];
}

// Setlist-Export — kein Spotify-Playlist-Endpoint mehr (im Spotify-Dev-Mode
// gesperrt, braucht "Extended Quota" was 2-4 Wochen Antragsdauer hat).
// Stattdessen: schoener Setlist-Text mit Spotify-Links zum Teilen via WhatsApp.

export default function MemoryPlaylistButton({
  eventId,
  eventName,
  eventDate,
  plays: initialPlays
}: Props) {
  const [copied, setCopied] = useState(false);
  const [plays, setPlays] = useState<PlayItem[]>(initialPlays);

  // Live-Update der Play-History — ohne Seiten-Reload, analog StatsPanel.
  // Realtime-Abo + 8s-Poll-Fallback, damit die Setlist waehrend der Party
  // mitwaechst statt beim Stand vom Seitenaufruf haengen zu bleiben.
  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("event_plays")
        .select("spotify_track_id, title, artist")
        .eq("event_id", eventId)
        .order("played_at", { ascending: true });
      if (data) setPlays(data as PlayItem[]);
    }

    refetch();

    const pollId = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 8000);

    const channelName = `setlist-${eventId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_plays",
          filter: `event_id=eq.${eventId}`
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Duplikate entfernen, Reihenfolge beibehalten
  const unique: PlayItem[] = (() => {
    const seen = new Set<string>();
    const out: PlayItem[] = [];
    for (const p of plays) {
      if (!seen.has(p.spotify_track_id)) {
        seen.add(p.spotify_track_id);
        out.push(p);
      }
    }
    return out;
  })();

  if (unique.length === 0) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🎵</span>
          <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">
            Setlist als Erinnerung
          </span>
        </div>
        <p className="text-white/50 text-sm">
          Sobald Songs gespielt wurden, kannst du hier die Setlist als Text mit
          Spotify-Links generieren — zum Verschicken an den Gastgeber.
        </p>
      </section>
    );
  }

  const dateLabel = new Date(eventDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const setlistLines = unique.map(
    (p, i) =>
      `${i + 1}. ${p.title} — ${p.artist}\n   https://open.spotify.com/track/${p.spotify_track_id}`
  );

  const fullText =
    `🎵 ${eventName} — Setlist vom ${dateLabel}\n` +
    `${unique.length} Songs in der Reihenfolge wie gespielt 💃\n\n` +
    setlistLines.join("\n\n") +
    `\n\n— erstellt mit wishbeat`;

  // Kompakte WhatsApp-Version (ohne Links, sonst zu lang)
  const compactText =
    `🎵 ${eventName} — Setlist vom ${dateLabel}\n` +
    `${unique.length} Songs wie sie gespielt wurden 💃\n\n` +
    unique
      .map((p, i) => `${i + 1}. ${p.title} — ${p.artist}`)
      .join("\n") +
    `\n\n— erstellt mit wishbeat`;

  async function copyFull() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(compactText)}`;
    window.open(url, "_blank");
  }

  function downloadTxt() {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = eventName.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
    a.download = `${safeName}-setlist.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 rounded-3xl border border-[#1DB954]/40 bg-gradient-to-br from-[#1DB954]/10 via-transparent to-transparent p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🎵</span>
        <span className="text-xs uppercase tracking-widest text-[#1ed760] font-semibold">
          Setlist als Erinnerung
        </span>
      </div>
      <p className="text-white text-sm font-semibold mb-1">
        Alle gespielten Songs zum Verschicken
      </p>
      <p className="text-white/50 text-xs mb-4">
        {unique.length} Songs in der Reihenfolge wie sie liefen — als Text, mit
        Spotify-Link pro Song. Perfekt für eine WhatsApp an den Gastgeber.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="py-3 rounded-2xl bg-[#25D366] hover:bg-[#1eb858] text-white font-bold text-sm transition active:scale-95"
        >
          💬 An WhatsApp
        </button>
        <button
          type="button"
          onClick={copyFull}
          className="py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition active:scale-95"
        >
          {copied ? "✅ Kopiert!" : "📋 Kopieren"}
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition active:scale-95"
        >
          💾 Als .txt
        </button>
      </div>

      <details className="mt-4">
        <summary className="text-white/40 hover:text-white/70 text-xs cursor-pointer transition">
          Vorschau der Setlist
        </summary>
        <pre className="mt-3 rounded-2xl bg-black/40 border border-white/10 p-3 text-[11px] text-white/80 leading-relaxed overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
          {compactText}
        </pre>
      </details>

      <p className="text-white/30 text-[10px] mt-4 leading-relaxed">
        Hinweis: Eine echte Spotify-Playlist mit allen Songs auf 1 Klick wäre
        cooler, aber Spotify hat für Dev-Apps das Hinzufügen von Tracks zu
        Playlists gesperrt (Extended-Quota-Antrag dauert 2-4 Wochen). Diese
        Setlist als Text + Links erfüllt aber denselben Zweck.
      </p>
    </section>
  );
}
