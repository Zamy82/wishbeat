import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wishbeat — Wunschsongs für den DJ",
  description:
    "Scanne den QR-Code und schicke deinen Wunschsong direkt an den DJ — kein Anstehen am Pult mehr."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
