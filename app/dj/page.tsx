import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import type { DjEvent } from "@/lib/types";
import LogoutButton from "./LogoutButton";
import SpotifyConnect from "./SpotifyConnect";

export default async function DjDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("owner_id", user.id)
    .order("event_date", { ascending: false });

  return (
    <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Deine Events</h1>
          <p className="text-white/40 text-sm mt-1">{user.email}</p>
          <div className="mt-3">
            <Suspense fallback={<div className="h-8 w-32 bg-white/5 rounded-full animate-pulse" />}>
              <SpotifyConnect />
            </Suspense>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/dj/assistant"
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition"
          >
            🎛️ DJ-Assistent
          </Link>
          <Link
            href="/dj/settings"
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition"
          >
            ⚙️ Einstellungen
          </Link>
          <Link
            href="/dj/logo"
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition"
          >
            🎨 Logo
          </Link>
          <Link
            href="/dj/new-event"
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-neon-pink to-neon-purple text-white font-semibold text-sm hover:opacity-90 transition"
          >
            + Neues Event
          </Link>
          <LogoutButton />
        </div>
      </header>

      {!events || events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/50">Du hast noch keine Events angelegt.</p>
          <Link
            href="/dj/new-event"
            className="mt-4 inline-block px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition"
          >
            Erstes Event anlegen
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {(events as DjEvent[]).map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/dj/event/${ev.id}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-purple/40 p-5 transition"
              >
                <div>
                  <p className="text-white font-semibold">{ev.name}</p>
                  <p className="text-white/40 text-sm mt-0.5">
                    {new Date(ev.event_date).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      ev.is_active
                        ? "bg-neon-cyan/20 text-neon-cyan"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {ev.is_active ? "Aktiv" : "Beendet"}
                  </span>
                  <span className="text-white/30">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
