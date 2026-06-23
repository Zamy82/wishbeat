import { NextResponse } from "next/server";

// Liefert den aktuellen Build-Identifier. Wird vom AutoReload-Client
// gepollt — wenn sich der Wert aendert, weiss der Client dass ein neuer
// Deploy live ist und kann die Seite neuladen.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "dev";
  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    }
  );
}
