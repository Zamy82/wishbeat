"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  initialName: string;
}

export default function TitleEditor({ eventId, initialName }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    // Name darf nicht leer sein — sonst Aenderung verwerfen.
    if (!trimmed) {
      setValue(initialName);
      setEditing(false);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    // Bewusst NUR der Anzeigename — der slug (Link/QR) bleibt gleich,
    // damit bereits verschickte Links weiter funktionieren.
    await supabase.from("events").update({ name: trimmed }).eq("id", eventId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 max-w-lg">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={80}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(initialName);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-xl bg-white/10 border border-neon-purple/40 px-3 py-2 text-white text-2xl font-bold focus:outline-none focus:border-neon-purple"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-neon-purple/30 hover:bg-neon-purple/50 text-white text-xs font-medium disabled:opacity-40 transition"
        >
          {saving ? "…" : "OK"}
        </button>
        <button
          onClick={() => {
            setValue(initialName);
            setEditing(false);
          }}
          className="px-3 py-2 rounded-lg text-white/50 hover:text-white text-xs transition"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="text-3xl font-bold text-white cursor-pointer hover:text-white/90 transition group inline-flex items-center gap-2"
      title="Klicken zum Bearbeiten"
    >
      {initialName}
      <span className="opacity-0 group-hover:opacity-100 text-sm text-white/40 transition">
        ✎
      </span>
    </h1>
  );
}
