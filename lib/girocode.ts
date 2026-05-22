// Generiert GiroCode (EPC-QR-Code) für SEPA-Überweisungen.
// Standard: European Payments Council Quick Response Code.
// Banking-Apps (Sparkasse, Volksbank, N26, ING, etc.) scannen den Code
// und füllen Empfänger, IBAN, Betrag und Verwendungszweck automatisch aus.

interface GiroCodeParams {
  /** Empfänger-Name (max 70 Zeichen) — der Name auf dem Konto */
  name: string;
  /** IBAN (Leerzeichen werden automatisch entfernt) */
  iban: string;
  /** Optional: BIC (für deutsche IBANs nicht nötig in Version 002) */
  bic?: string;
  /** Optional: Betrag in EUR. Wenn leer, kann der Sender selbst eingeben */
  amount?: number;
  /** Verwendungszweck (max 140 Zeichen) */
  purpose?: string;
}

export function buildGiroCodeData(params: GiroCodeParams): string {
  const ibanClean = params.iban.replace(/\s+/g, "").toUpperCase();
  const lines = [
    "BCD", // Service Tag
    "002", // Version: 002 erlaubt leere BIC für EU-Länder
    "1", // Character Set: 1 = UTF-8
    "SCT", // Identification: SCT = SEPA Credit Transfer
    params.bic ?? "", // BIC optional bei Version 002
    truncate(params.name, 70),
    ibanClean,
    params.amount && params.amount > 0
      ? `EUR${params.amount.toFixed(2)}`
      : "",
    "", // Purpose code (4 chars) — leer ist OK
    "", // Customer reference (max 35) — leer ist OK
    truncate(params.purpose ?? "", 140), // Remittance info
    "" // Beneficiary to originator info
  ];
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

// Einfache IBAN-Format-Prüfung (Länge + Anfangsbuchstaben, keine Mod-97-Check)
export function isLikelyValidIban(iban: string): boolean {
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  // DE: 22 Zeichen, AT: 20, CH: 21, etc.
  // Wir prüfen nur grob: 2 Buchstaben + 2 Ziffern + 11-30 alphanumerisch
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned);
}

// Formatiert IBAN mit Leerzeichen alle 4 Zeichen (für Anzeige)
export function formatIban(iban: string): string {
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}
