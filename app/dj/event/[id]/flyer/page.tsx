import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import FlyerCard from "./FlyerCard";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FlyerPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dj/login");

  const { data: event } = await supabase
    .from("events")
    .select("id, name, tagline, event_date, slug")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!event) notFound();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://wishbeat-zamy82-s-projects.vercel.app";
  const eventUrl = `${baseUrl}/event/${event.slug}`;

  // DJ-Profil holen für Logo-Auswahl
  const { data: profile } = await supabase
    .from("dj_profiles")
    .select("logo_style")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <FlyerCard
      name={event.name}
      tagline={event.tagline}
      eventDate={event.event_date}
      url={eventUrl}
      eventId={event.id}
      logoStyle={profile?.logo_style ?? null}
    />
  );
}
