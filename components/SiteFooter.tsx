import Link from "next/link";

// Globaler Footer mit Pflicht-Links (Impressum, Datenschutz).
// `no-print` blendet ihn auf Druck-Seiten (Flyer, Tisch-Aufsteller,
// Poster) komplett aus.

export default function SiteFooter() {
  return (
    <footer className="no-print mt-auto pt-8 pb-6 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <p className="text-white/30">
          © {new Date().getFullYear()} wishbeat — privates Hobby-Projekt
        </p>
        <nav className="flex items-center gap-5">
          <Link
            href="/impressum"
            className="text-white/40 hover:text-white transition"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="text-white/40 hover:text-white transition"
          >
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}
