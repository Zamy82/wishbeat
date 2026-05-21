"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="px-5 py-2.5 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm transition"
    >
      Ausloggen
    </button>
  );
}
