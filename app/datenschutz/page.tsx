import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung — wishbeat",
  description: "Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO"
};

// ============================================================
// !! PLATZHALTER UNTEN ERSETZEN — BITTE AUSFÜLLEN !!
// (Suche nach 'PLATZHALTER' in dieser Datei — alles in eckigen Klammern.)
// ============================================================

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto text-white/85">
      <Link
        href="/"
        className="text-white/40 hover:text-white text-sm mb-6 inline-block transition"
      >
        ← Zurück
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Datenschutzerklärung</h1>
      <p className="text-white/50 text-sm mb-8">
        Informationen zur Verarbeitung personenbezogener Daten nach Art. 13 DSGVO
      </p>

      {/* ───── 1. Verantwortlicher ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          1. Verantwortlicher
        </h2>
        <p className="text-base leading-relaxed">
          [VOLLSTÄNDIGER NAME]
          <br />
          [STRAßE UND HAUSNUMMER]
          <br />
          [PLZ ORT]
          <br />
          E-Mail:{" "}
          <a
            href="mailto:[KONTAKT-EMAIL]"
            className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
          >
            [KONTAKT-EMAIL]
          </a>
        </p>
      </section>

      {/* ───── 2. Welche Daten ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          2. Welche Daten wir verarbeiten
        </h2>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          a) Gäste-Sitzung (anonym)
        </h3>
        <p className="text-sm leading-relaxed text-white/75 mb-3">
          Beim ersten Besuch einer Event-Seite wird eine zufällige Sitzungs-ID in
          deinem Browser (localStorage) gespeichert. Diese ID enthält keine
          personenbezogenen Daten und dient nur dazu, deine Wünsche und Votes
          deinem Gerät zuzuordnen — z. B. damit du deinen eigenen Wunsch in der
          Liste markiert siehst.
        </p>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          b) Wunschsongs
        </h3>
        <p className="text-sm leading-relaxed text-white/75 mb-3">
          Beim Absenden eines Wunsches speichern wir:
        </p>
        <ul className="text-sm leading-relaxed text-white/75 list-disc pl-6 space-y-1 mb-3">
          <li>Spotify-Track-ID, Titel, Künstler, Album-Cover-URL</li>
          <li>Optional: ein selbstgewählter Nickname (kann leer bleiben)</li>
          <li>Deine anonyme Sitzungs-ID</li>
          <li>Zeitstempel</li>
        </ul>
        <p className="text-sm leading-relaxed text-white/75">
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — du
          möchtest einen Wunschsong übermitteln).
        </p>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          c) Push-Benachrichtigungen
        </h3>
        <p className="text-sm leading-relaxed text-white/75">
          Wenn du Push-Benachrichtigungen erlaubst, speichern wir den
          Push-Endpoint deines Browsers (vergleichbar mit einer technischen
          Adresse). Dieser wird nur verwendet, um dir zu signalisieren, wenn dein
          Wunschsong läuft oder am Folgetag eine Bewertungs-Erinnerung zu senden.
          Du kannst die Erlaubnis jederzeit in den Browser-Einstellungen widerrufen.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
        </p>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          d) Bewertungen
        </h3>
        <p className="text-sm leading-relaxed text-white/75">
          Bei Abgabe einer Bewertung speichern wir Sterne-Wert, optionalen
          Kommentar und optionalen Nickname. Keine personenbezogenen Daten werden
          erzwungen.
        </p>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          e) Trinkgeld
        </h3>
        <p className="text-sm leading-relaxed text-white/75">
          wishbeat selbst speichert <strong>keine Zahlungsdaten</strong>. Trinkgeld
          wird ausschließlich über externe Dienste (PayPal, Banking-App via
          GiroCode) abgewickelt. Für deren Datenverarbeitung gelten ihre
          jeweiligen Datenschutzhinweise.
        </p>

        <h3 className="text-base font-semibold text-white mt-5 mb-2">
          f) Server-Logs
        </h3>
        <p className="text-sm leading-relaxed text-white/75">
          Unser Hosting-Anbieter (Vercel) verarbeitet beim Aufruf der Seite
          technische Daten wie IP-Adresse, Browser-Typ und Zeitstempel — für
          maximal 30 Tage zur Abwehr von Missbrauch (z. B. DDoS). Rechtsgrundlage:
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Betrieb und
          Sicherheit der Anwendung).
        </p>
      </section>

      {/* ───── 3. Empfänger / Dienstleister ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          3. Dienstleister, die wir einsetzen
        </h2>
        <p className="text-sm leading-relaxed text-white/75 mb-3">
          Die folgenden Anbieter verarbeiten technisch notwendige Daten in unserem
          Auftrag (Art. 28 DSGVO) oder als eigenständig Verantwortliche:
        </p>
        <ul className="text-sm leading-relaxed text-white/75 space-y-2 pl-2">
          <li>
            <strong className="text-white">Vercel Inc.</strong> (USA) — Hosting,
            Auslieferung der Seite, Server-Logs.{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutz Vercel
            </a>
          </li>
          <li>
            <strong className="text-white">Supabase Inc.</strong> (USA, EU-Hosting
            verfügbar) — Speicherung der Wünsche, Votes, Bewertungen, anonyme
            Sitzungs-ID.{" "}
            <a
              href="https://supabase.com/privacy"
              className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutz Supabase
            </a>
          </li>
          <li>
            <strong className="text-white">Spotify AB</strong> (Schweden) — wenn
            du Songs suchst, wird die Suchanfrage über die Spotify-Web-API
            verarbeitet (Track-Metadaten + Cover).{" "}
            <a
              href="https://www.spotify.com/de/legal/privacy-policy/"
              className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutz Spotify
            </a>
          </li>
          <li>
            <strong className="text-white">Anthropic PBC</strong> (USA) — wenn
            der DJ-Assistent KI-Vorschläge anzeigt, werden Track-Metadaten
            (keine personenbezogenen Daten der Gäste) an die Anthropic-API
            gesendet.{" "}
            <a
              href="https://www.anthropic.com/legal/privacy"
              className="text-neon-cyan hover:text-neon-pink underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutz Anthropic
            </a>
          </li>
          <li>
            <strong className="text-white">Browser-Push-Services</strong>
            {" "}(Google FCM, Apple Push, Mozilla autopush) — wenn du
            Push-Benachrichtigungen aktiviert hast, werden Notifications über
            den Push-Service deines Browsers/Betriebssystems ausgeliefert.
          </li>
          <li>
            <strong className="text-white">PayPal</strong> und{" "}
            <strong className="text-white">deine Bank</strong> — nur wenn du
            freiwillig Trinkgeld gibst. wishbeat selbst empfängt keine
            Zahlungsdaten.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-white/65 mt-4">
          Bei Übermittlungen in Drittländer (USA) gelten die Standardvertrags­klauseln
          der EU-Kommission und/oder der EU-US Data Privacy Framework als
          Übertragungsmechanismus.
        </p>
      </section>

      {/* ───── 4. Speicherdauer ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          4. Speicherdauer
        </h2>
        <ul className="text-sm leading-relaxed text-white/75 list-disc pl-6 space-y-1">
          <li>Wunschsongs &amp; Votes: bis zur Löschung des Events durch den DJ</li>
          <li>Push-Endpoints: bis du Push deaktivierst oder die App löschst</li>
          <li>Bewertungen: dauerhaft (anonyme Statistik)</li>
          <li>Server-Logs: 30 Tage</li>
        </ul>
      </section>

      {/* ───── 5. Deine Rechte ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          5. Deine Rechte
        </h2>
        <p className="text-sm leading-relaxed text-white/75 mb-3">
          Du hast jederzeit das Recht auf:
        </p>
        <ul className="text-sm leading-relaxed text-white/75 list-disc pl-6 space-y-1 mb-3">
          <li>Auskunft (Art. 15 DSGVO)</li>
          <li>Berichtigung (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch (Art. 21 DSGVO)</li>
          <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
        </ul>
        <p className="text-sm leading-relaxed text-white/75">
          Wende dich dazu an die unter Punkt 1 genannte Kontaktadresse. Außerdem
          steht dir das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde
          zu.
        </p>
      </section>

      {/* ───── 6. Cookies ───── */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-3">
          6. Cookies &amp; lokale Speicherung
        </h2>
        <p className="text-sm leading-relaxed text-white/75">
          wishbeat setzt <strong>keine Tracking-Cookies</strong>. Wir verwenden
          ausschließlich technisch notwendige Speicherung im Browser
          (localStorage) für deine anonyme Sitzungs-ID, deinen letzten besuchten
          Event-Shortcut und Login-Sessions des DJ-Bereichs. Es findet kein
          Drittanbieter-Tracking und keine Werbeauslieferung statt.
        </p>
      </section>

      <p className="text-white/40 text-xs mt-12">
        Stand: Juni 2026 — diese Erklärung kann bei Änderungen des Funktionsumfangs
        aktualisiert werden.
      </p>
    </main>
  );
}
