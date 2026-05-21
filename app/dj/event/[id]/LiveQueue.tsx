"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SongRequest, RequestStatus } from "@/lib/types";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Offen",
  approved: "Angenommen",
  played: "Gespielt",
  rejected: "Abgelehnt"
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-yellow-400/20 text-yellow-300",
  approved: "bg-neon-cyan/20 text-neon-cyan",
  played: "bg-white/10 text-white/30",
  rejected: "bg-red-500/20 text-red-400"
};

interface Props {
  eventId: string;
  initialRequests: SongRequest[];
}

export default function LiveQueue({ eventId, initialRequests }: Props) {
  const [requests, setRequests] = useState<SongRequest[]>(initialRequests);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_requests",
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [...prev, payload.new as SongRequest]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === payload.new.id ? (payload.new as SongRequest) : r
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) =>
              prev.filter((r) => r.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  async function updateStatus(requestId: string, status: RequestStatus) {
    const supabase = createClient();
    await supabase
      .from("song_requests")
      .update({ status })
      .eq("id", requestId);
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-white/40 text-sm">
          Noch keine Wünsche. Gäste können jetzt über den QR-Code Songs wünschen.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((req) => (
        <li
          key={req.id}
          className={`rounded-2xl border border-white/10 bg-white/5 p-4 transition ${
            req.status === "played" ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {req.cover_url && (
              <Image
                src={req.cover_url}
                alt={req.title}
                width={48}
                height={48}
                className="rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{req.title}</p>
              <p className="text-white/50 text-sm truncate">{req.artist}</p>
              {req.guest_nickname && (
                <p className="text-white/30 text-xs mt-0.5">
                  von {req.guest_nickname}
                </p>
              )}
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[req.status]}`}
            >
              {STATUS_LABEL[req.status]}
            </span>
          </div>

          {/* Aktions-Buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {req.status === "pending" && (
              <>
                <ActionButton
                  label="✓ Annehmen"
                  style="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10"
                  onClick={() => updateStatus(req.id, "approved")}
                />
                <ActionButton
                  label="✕ Ablehnen"
                  style="text-red-400 border-red-500/40 hover:bg-red-500/10"
                  onClick={() => updateStatus(req.id, "rejected")}
                />
              </>
            )}
            {req.status === "approved" && (
              <ActionButton
                label="🎵 Als gespielt markieren"
                style="text-white/60 border-white/20 hover:bg-white/10"
                onClick={() => updateStatus(req.id, "played")}
              />
            )}
            {(req.status === "rejected" || req.status === "played") && (
              <ActionButton
                label="↩ Zurücksetzen"
                style="text-white/30 border-white/10 hover:bg-white/5"
                onClick={() => updateStatus(req.id, "pending")}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActionButton({
  label,
  style,
  onClick
}: {
  label: string;
  style: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${style}`}
    >
      {label}
    </button>
  );
}
