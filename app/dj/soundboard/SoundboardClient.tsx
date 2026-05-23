"use client";

import { useEffect, useState } from "react";
import {
  playPoliceSiren,
  playFireSiren,
  playAmbulance,
  playAirHorn,
  playBassDrop,
  playApplause,
  playSnare,
  playCowbell,
  playScratch,
  playRiser,
  playBeep,
  playBoom,
  playDrop
} from "@/lib/soundboard";

interface Pad {
  id: string;
  label: string;
  emoji: string;
  hotkey: string;
  color: string;
  play: () => void;
}

const PADS: Pad[] = [
  // Reihe 1 — Sirenen (rot/orange)
  { id: "police",    label: "Polizei",     emoji: "🚓", hotkey: "1", color: "from-red-500 to-red-700",       play: playPoliceSiren },
  { id: "fire",      label: "Feuerwehr",   emoji: "🚒", hotkey: "2", color: "from-orange-500 to-red-600",    play: playFireSiren },
  { id: "ambulance", label: "Ambulanz",    emoji: "🚑", hotkey: "3", color: "from-amber-400 to-orange-600",  play: playAmbulance },
  { id: "airhorn",   label: "Air Horn",    emoji: "📣", hotkey: "4", color: "from-yellow-400 to-orange-500", play: playAirHorn },
  // Reihe 2 — Bass / Hits (lila/blau)
  { id: "bassdrop",  label: "Bass Drop",   emoji: "💥", hotkey: "5", color: "from-purple-500 to-purple-800", play: playBassDrop },
  { id: "boom",      label: "Boom",        emoji: "🔊", hotkey: "6", color: "from-indigo-500 to-purple-700", play: playBoom },
  { id: "snare",     label: "Snare",       emoji: "🥁", hotkey: "7", color: "from-blue-500 to-blue-700",     play: playSnare },
  { id: "cowbell",   label: "Cowbell",     emoji: "🔔", hotkey: "8", color: "from-cyan-500 to-blue-600",     play: playCowbell },
  // Reihe 3 — FX (grün/pink)
  { id: "scratch",   label: "Scratch",     emoji: "💿", hotkey: "9", color: "from-pink-500 to-rose-600",     play: playScratch },
  { id: "riser",     label: "Riser",       emoji: "⚡", hotkey: "0", color: "from-fuchsia-500 to-pink-600",  play: playRiser },
  { id: "drop",      label: "Tropfen",     emoji: "💧", hotkey: "q", color: "from-teal-400 to-cyan-600",     play: playDrop },
  { id: "beep",      label: "Beep",        emoji: "🔔", hotkey: "w", color: "from-emerald-500 to-green-700", play: playBeep },
  // Sonderfeld — breit
  { id: "applause",  label: "Applaus / Crowd", emoji: "👏", hotkey: "e", color: "from-amber-500 via-orange-500 to-red-500", play: playApplause }
];

export default function SoundboardClient() {
  const [active, setActive] = useState<string | null>(null);

  // Sound abspielen + visuelles Feedback
  function trigger(pad: Pad) {
    try { pad.play(); } catch {}
    setActive(pad.id);
    setTimeout(() => setActive((cur) => (cur === pad.id ? null : cur)), 220);
  }

  // Keyboard-Shortcuts: 1-9 0 q w e — fuer schnellen Zugriff am Laptop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignoriere wenn ein Input fokussiert ist
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const key = e.key.toLowerCase();
      const pad = PADS.find((p) => p.hotkey === key);
      if (pad) {
        e.preventDefault();
        trigger(pad);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mainPads = PADS.slice(0, 12);
  const wideRow = PADS.slice(12);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {mainPads.map((pad) => (
          <PadButton key={pad.id} pad={pad} active={active === pad.id} onTrigger={trigger} />
        ))}
      </div>

      {/* Wide Pad: Applaus */}
      {wideRow.map((pad) => (
        <button
          key={pad.id}
          onClick={() => trigger(pad)}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-full rounded-3xl border border-white/10 bg-gradient-to-r ${pad.color} px-6 py-6 text-white shadow-xl transition-transform active:scale-95 ${
            active === pad.id ? "scale-95 brightness-110" : "hover:brightness-110"
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl">{pad.emoji}</span>
            <span className="text-xl font-bold">{pad.label}</span>
            <kbd className="ml-3 px-2 py-1 rounded-md bg-white/20 text-xs font-mono">{pad.hotkey.toUpperCase()}</kbd>
          </div>
        </button>
      ))}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/50 space-y-1">
        <p>⌨️ <strong className="text-white/70">Tastatur-Shortcuts:</strong> Tippe die Zahl/Buchstabe (oben rechts auf jedem Pad) zum schnellen Auslösen — funktioniert nur wenn kein Eingabefeld aktiv ist.</p>
        <p>🔉 <strong className="text-white/70">Audio-Quelle:</strong> Die Sounds laufen über den Audio-Output des Browsers. Damit Gäste sie hören, muss dein Laptop-Audio über dieselbe Anlage laufen wie Spotify.</p>
        <p>📜 <strong className="text-white/70">Lizenz:</strong> Alle Sounds werden live synthetisiert (kein Sample-File) — du brauchst dir um Lizenzen keine Sorgen zu machen.</p>
      </div>
    </div>
  );
}

function PadButton({
  pad,
  active,
  onTrigger
}: {
  pad: Pad;
  active: boolean;
  onTrigger: (pad: Pad) => void;
}) {
  return (
    <button
      onClick={() => onTrigger(pad)}
      onMouseDown={(e) => e.preventDefault()}
      className={`relative aspect-square rounded-3xl border border-white/10 bg-gradient-to-br ${pad.color} text-white shadow-xl transition-all active:scale-95 ${
        active ? "scale-95 brightness-125 shadow-2xl" : "hover:brightness-110 hover:shadow-2xl"
      }`}
    >
      <kbd className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono">{pad.hotkey.toUpperCase()}</kbd>
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-5xl drop-shadow-lg">{pad.emoji}</span>
        <span className="text-sm font-bold">{pad.label}</span>
      </div>
    </button>
  );
}
