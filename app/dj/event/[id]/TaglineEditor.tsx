"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  initialTagline: string | null;
}

export default function TaglineEditor({ eventId, initialTagline }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTagline ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("events")
      .update({ tagline: value.trim() || null })
      .eq("id", eventId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-2 max-w-md">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="z.B. Spargelessen & Tanz"
          maxLength={100}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(initialTagline ?? "");
              setEditing(false);
            }
          }}
          className="flex-1 rounded-lg bg-white/10 border border-neon-purple/40 px-3 py-1.5 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-neon-purple"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-neon-purple/30 hover:bg-neon-purple/50 text-white text-xs font-medium disabled:opacity-40 transition"
        >
          {saving ? "…" : "OK"}
        </button>
        <button
          onClick={() => {
            setValue(initialTagline ?? "");
            setEditing(false);
          }}
          className="px-3 py-1.5 rounded-lg text-white/50 hover:text-white text-xs transition"
        >
          ✕
        </button>
      </div>
    );
  }

  if (initialTagline) {
    return (
      <p
        onClick={() => setEditing(true)}
        className="text-white/70 italic mt-1 cursor-pointer hover:text-white transition group"
        title="Klicken zum Bearbeiten"
      >
        {initialTagline}
        <span className="opacity-0 group-hover:opacity-100 ml-2 text-xs text-white/40 transition">
          ✎
        </span>
      </p>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-white/30 italic mt-1 hover:text-white/60 text-sm transition"
    >
      + Untertitel hinzufügen
    </button>
  );
}
