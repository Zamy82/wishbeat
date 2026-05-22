"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DjLogo, { LOGO_STYLES, type LogoStyle } from "@/components/DjLogo";

interface Props {
  initialStyle: string | null;
}

export default function LogoPicker({ initialStyle }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<LogoStyle | null>(
    (initialStyle as LogoStyle) ?? null
  );
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  async function save() {
    if (!selected) return;
    setSaving(true);
    setFlash(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/dj/login");
      return;
    }

    const { error } = await supabase
      .from("dj_profiles")
      .upsert({
        user_id: user.id,
        logo_style: selected,
        updated_at: new Date().toISOString()
      });

    setSaving(false);

    if (error) {
      setFlash({ kind: "err", text: `Fehler: ${error.message}` });
      return;
    }
    setFlash({ kind: "ok", text: "Logo gespeichert!" });
    router.refresh();
  }

  return (
    <div>
      {/* Logo-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {LOGO_STYLES.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`relative rounded-3xl border-2 p-6 transition text-left ${
                isSelected
                  ? "border-neon-purple bg-neon-purple/10"
                  : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {isSelected && (
                <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-neon-purple text-white text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
              )}
              {/* Logo-Vorschau auf dunklem Hintergrund */}
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center mb-4 p-6">
                <DjLogo style={opt.id} size={120} />
              </div>
              {/* Label */}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white">{opt.label}</h3>
                {isSelected && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple font-medium">
                    Gewählt
                  </span>
                )}
              </div>
              <p className="text-white/50 text-sm">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Vorschau auf hellem Hintergrund (für Flyer-Druck) */}
      {selected && (
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Vorschau auf weißem Druck-Hintergrund (für Flyer)
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="rounded-2xl bg-white p-6">
              <DjLogo style={selected} size={80} />
            </div>
            <div className="rounded-2xl bg-white p-6">
              <DjLogo style={selected} size={48} />
            </div>
            <div className="rounded-2xl bg-white p-6">
              <DjLogo style={selected} size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Speichern */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={!selected || saving}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {saving ? "Speichere…" : "Logo speichern"}
        </button>
        {flash && (
          <span
            className={`text-sm ${
              flash.kind === "ok" ? "text-neon-cyan" : "text-red-400"
            }`}
          >
            {flash.text}
          </span>
        )}
      </div>

      <p className="text-white/30 text-xs mt-6">
        Das Logo wird beim nächsten Flyer-Druck automatisch verwendet. Du kannst
        es jederzeit hier ändern.
      </p>
    </div>
  );
}
