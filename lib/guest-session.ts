// Hilfsfunktion für die Gast-Session-ID (UUID im localStorage).
// Erlaubt uns, einen Wunsch dem Gast zuzuordnen ohne Login —
// damit z.B. "Dein Wunsch läuft gerade!" funktioniert.

const KEY = "wishbeat_guest_session";

export function getGuestSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // crypto.randomUUID ist in allen modernen Browsern verfügbar
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
