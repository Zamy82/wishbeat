import Link from "next/link";

export const metadata = {
  title: "Impressum — wishbeat",
  description: "Angaben gemäß § 5 TMG"
};

// ============================================================
// !! PLATZHALTER UNTEN ERSETZEN — BITTE AUSFÜLLEN !!
// (Suche nach 'PLATZHALTER' in dieser Datei — alles in eckigen Klammern.)
// ============================================================

export default function ImpressumPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto text-white/85">
      <Link
        href="/"
        className="text-white/40 hover:text-white text-sm mb-6 inline-block transition"
      >
        ← Zurück
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Impressum</h1>
      <p className="text-white/50 text-sm mb-8">Angaben gemäß § 5 TMG</p>

      <section className="space-y-1 mb-8 text-base leading-relaxed">
        <p className="font-semibold text-white">[VOLLSTÄNDIGER NAME]</p>
        <p>[STRAßE UND HAUSNUMMER]</p>
        <p>[PLZ ORT]</p>
        <p>Deutschland</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">Kontakt</h2>
        <p className="text-base leading-relaxed">
          E-Mail:{" "}
          <a
            href="mailto:wishbeatdj@gmail.com"
            className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
          >
            wishbeatdj@gmail.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">
          Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
        </h2>
        <p className="text-base leading-relaxed">
          [VOLLSTÄNDIGER NAME]
          <br />
          [STRAßE UND HAUSNUMMER]
          <br />
          [PLZ ORT]
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">Hinweise</h2>
        <p className="text-base leading-relaxed text-white/70">
          wishbeat ist ein privates Hobby-Projekt zur Annahme von Wunschsongs auf
          privaten Feiern. Keine kommerzielle Tätigkeit, keine Gewerbeanmeldung.
          Trinkgelder werden ausschließlich freiwillig als Schenkung an Privatpersonen
          gegeben.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">Haftungsausschluss</h2>
        <h3 className="text-base font-semibold text-white mt-4 mb-2">
          Haftung für Inhalte
        </h3>
        <p className="text-sm leading-relaxed text-white/65">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf
          diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
          10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte
          oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
          zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>

        <h3 className="text-base font-semibold text-white mt-4 mb-2">
          Haftung für Links
        </h3>
        <p className="text-sm leading-relaxed text-white/65">
          Unser Angebot enthält Links zu externen Webseiten Dritter (z. B. Spotify,
          PayPal), auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir
          für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte
          der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
          verantwortlich.
        </p>

        <h3 className="text-base font-semibold text-white mt-4 mb-2">
          Urheberrecht
        </h3>
        <p className="text-sm leading-relaxed text-white/65">
          Die Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Song-Metadaten (Titel, Künstler, Cover) werden über die
          Spotify Web API bereitgestellt und sind Eigentum der jeweiligen
          Rechteinhaber.
        </p>
      </section>

      <p className="text-white/40 text-xs mt-12">
        Stand: Juni 2026
      </p>
    </main>
  );
}
