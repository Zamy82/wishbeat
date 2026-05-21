"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  isActive: boolean;
}

export default function EventControls({ eventId, isActive }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("events")
      .update({ is_active: !isActive })
      .eq("id", eventId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        onClick={toggleActive}
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
    </div>
  );
}
