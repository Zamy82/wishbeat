"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId } from "@/lib/guest-session";

interface WishRow {
  id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  guest_nickname: string | null;
  status: string;
  requester_session_id: string | null;
  created_at: string;
}

interface VoteRow {
  id: string;
  request_id: string;
  session_id: string;
}

interface Props {
  eventId: string;
}

export default function WishesVotingList({ eventId }: Props) {
  const [wishes, setWishes] = useState<WishRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [busyWishId, setBusyWishId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSessionId(getGuestSessionId());
  }, []);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: w }, { data: v }] = await Promise.all([
      supabase
        .from("song_requests")
        .select("id, spotify_track_id, title, artist, cover_url, guest_nickname, status, requester_session_id, created_at")
        .eq("event_id", eventId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: true }),
      supabase
        .from("song_request_votes")
        .select("id, request_id, session_id")
    ]);
    if (w) setWishes(w as WishRow[]);
    if (v) setVotes(v as VoteRow[]);
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    reload();
    const supabase = createClient();

    const wishCh = supabase
      .channel(`vote-wishes-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests", filter: `event_id=eq.${eventId}` },
        () => reload()
      )
      .subscribe();

    const voteCh = supabase
      .channel(`vote-votes-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_request_votes" },
        () => reload()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(wishCh);
      supabase.removeChannel(voteCh);
    };
  }, [reload, eventId]);

  async function toggleVote(wishId: string) {
    if (!sessionId) return;
    setBusyWishId(wishId);
    // Optimistic Update — sofort visuell reagieren, dann ggf. zurueckdrehen
    const hadVote = votes.some(
      (v) => v.request_id === wishId && v.session_id === sessionId
    );
    if (hadVote) {
      setVotes((prev) =>
        prev.filter((v) => !(v.request_id === wishId && v.session_id === sessionId))
      );
    } else {
      setVotes((prev) => [
        ...prev,
        { id: `optimistic-${Date.now()}`, request_id: wishId, session_id: sessionId }
      ]);
    }
    try {
      const res = await fetch(`/api/wishes/${wishId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (!data.ok) {
        // Rollback bei Fehler
        reload();
      } else {
        // Server-Truth nachladen (Realtime-Channel triggert sowieso auch)
        reload();
      }
    } catch {
      reload();
    } finally {
      setBusyWishId(null);
    }
  }

  // Vote-Counts berechnen + sortieren
  const enriched = wishes.map((w) => {
    const wishVotes = votes.filter((v) => v.request_id === w.id);
    const userVoted = sessionId && wishVotes.some((v) => v.session_id === sessionId);
    const isOwn = sessionId && w.requester_session_id === sessionId;
    return { ...w, voteCount: wishVotes.length, userVoted, isOwn };
  });

  // Sortierung: meiste Votes zuerst, dann aelteste zuerst
  enriched.sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return a.created_at.localeCompare(b.created_at);
  });

  if (!loaded) {
    return (
      <section className="w-full max-w-md mb-6">
        <div className="h-32 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
      </section>
    );
  }

  if (enriched.length === 0) {
    return (
      <section className="w-full max-w-md mb-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-white/40 text-sm">
            Noch keine Wünsche. Sei der/die Erste!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs uppercase tracking-widest text-white/40 font-semibold">
          🎤 Andere Wünsche
        </h2>
        <span className="text-[10px] text-white/30">
          tippe ❤️ um zu pushen
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {enriched.map((w) => (
          <li
            key={w.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
              w.isOwn
                ? "border-neon-cyan/40 bg-neon-cyan/5"
                : w.voteCount >= 3
                ? "border-neon-pink/40 bg-neon-pink/5"
                : "border-white/10 bg-white/5"
            }`}
          >
            {w.cover_url && (
              <Image
                src={w.cover_url}
                alt={w.title}
                width={40}
                height={40}
                className="rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate flex items-center gap-1.5">
                {w.title}
                {w.voteCount >= 3 && <span title="Hot">🔥</span>}
              </p>
              <p className="text-white/50 text-xs truncate">
                {w.artist}
                {w.guest_nickname && (
                  <>
                    {" · "}
                    <span className="text-white/30">
                      von {w.guest_nickname}
                      {w.isOwn && " (du)"}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => toggleVote(w.id)}
              disabled={busyWishId === w.id || w.isOwn || !sessionId}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border transition flex-shrink-0 ${
                w.userVoted
                  ? "bg-neon-pink/20 text-neon-pink border-neon-pink/50"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:border-white/30"
              } ${w.isOwn ? "opacity-50 cursor-not-allowed" : ""} ${
                busyWishId === w.id ? "opacity-50 cursor-wait" : ""
              }`}
              title={w.isOwn ? "Dein eigener Wunsch" : w.userVoted ? "Vote zurücknehmen" : "Diesen Wunsch pushen"}
            >
              <span className="text-base leading-none">{w.userVoted ? "❤️" : "🤍"}</span>
              <span className="font-mono text-xs">{w.voteCount}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
