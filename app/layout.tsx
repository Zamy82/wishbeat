import type { Metadata, Viewport } from "next";
import { Pacifico } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

// Skript-Font fuer Party-Poster (Cursive-Style). Wird via CSS-Variable
// global verfuegbar gemacht, aber nur dort genutzt wo wir ihn brauchen.
const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pacifico",
  display: "swap"
});

export const metadata: Metadata = {
  title: "wishbeat — Wunschsongs für den DJ",
  description:
    "Scanne den QR-Code und schicke deinen Wunschsong direkt an den DJ — kein Anstehen am Pult mehr.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "wishbeat"
  }
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={pacifico.variable}>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
