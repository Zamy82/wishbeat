"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  isActive: boolean;
  wishOnly: boolean;
}

export default function EventControls({ eventId, isActive, wishOnly }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateEvent(patch: { is_active?: boolean; wish_only?: boolean }) {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("events").update(patch).eq("id", eventId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      <button
        onClick={() => updateEvent({ is_active: !isActive })}
        disabled={loading}
        className={`px-5 py-2 rounded-full text-sm font-medium transition disabled:opacity-40 ${
          isActive
            ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
            : "border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
        }`}
      >
        {loading
          ? "…"
          : isActive
          ? "Event beenden (keine neuen Wünsche)"
          : "Event wieder aktivieren"}
      </button>

      <button
        onClick={() => updateEvent({ wish_only: !wishOnly })}
        disabled={loading}
        className={`px-5 py-2 rounded-full text-sm font-medium transition disabled:opacity-40 ${
          wishOnly
            ? "border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10"
            : "border border-white/20 text-white/70 hover:bg-white/10"
        }`}
      >
        {loading
          ? "…"
          : wishOnly
          ? "Party starten (Vorab-Modus aus)"
          : "Vorab-Modus an (nur Wünsche)"}
      </button>
    </div>
  );
}
