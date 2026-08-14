import { createClient } from "@supabase/supabase-js";

// Server-only Supabase-Client mit Service-Role-Key (umgeht RLS).
// NUR in Server-Komponenten und API-Routen verwenden — niemals im Browser.
// Der Service-Role-Key liegt ausschliesslich serverseitig (kein NEXT_PUBLIC_).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
