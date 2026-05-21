import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="inline-block px-3 py-1 mb-6 rounded-full text-xs uppercase tracking-widest bg-white/10 backdrop-blur">
        DJ-Tool
      </span>

      <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan bg-clip-text text-transparent">
        wishbeat
      </h1>

      <p className="mt-6 max-w-xl text-lg text-white/70">
        Deine Gäste wünschen sich Songs direkt vom Tisch aus — du bekommst alles
        live auf dein Dashboard. Kein Anstehen am DJ-Pult mehr.
      </p>

      <Link
        href="/dj"
        className="mt-10 px-8 py-4 rounded-full font-bold bg-gradient-to-r from-neon-pink to-neon-purple text-white hover:opacity-90 transition text-base"
      >
        DJ-Login →
      </Link>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full text-left">
        <Feature
          emoji="📱"
          title="QR am Tisch"
          body="Gäste scannen, App öffnet sich sofort im Browser. Keine Installation."
        />
        <Feature
          emoji="🎵"
          title="Spotify-Suche"
          body="Songs mit Cover und Künstler — direkt aus dem Spotify-Katalog."
        />
        <Feature
          emoji="⚡"
          title="Live-Dashboard"
          body="Wünsche kommen in Echtzeit an. Annehmen, ablehnen, als gespielt markieren."
        />
      </div>
    </main>
  );
}

function Feature({
  emoji,
  title,
  body
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="text-2xl mb-3">{emoji}</div>
      <div className="text-sm uppercase tracking-widest text-neon-cyan mb-1">
        {title}
      </div>
      <div className="text-white/70 text-sm">{body}</div>
    </div>
  );
}
