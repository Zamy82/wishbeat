export type EventStatus = "active" | "ended";
export type RequestStatus = "pending" | "approved" | "played" | "rejected";

export interface DjEvent {
  id: string;
  owner_id: string;
  name: string;
  event_date: string;
  slug: string;
  is_active: boolean;
  tagline: string | null;
  created_at: string;
}

export interface SongRequest {
  id: string;
  event_id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  guest_nickname: string | null;
  status: RequestStatus;
  created_at: string;
  artist_genres: string[] | null;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
}

export interface DjProfile {
  user_id: string;
  display_name: string | null;
  iban_holder: string | null;
  iban: string | null;
  bic: string | null;
  paypal_handle: string | null;
  updated_at: string;
}

export interface EventRating {
  id: string;
  event_id: string;
  rating: number; // 1-5
  comment: string | null;
  nickname: string | null;
  created_at: string;
}

export interface EventPlay {
  id: string;
  event_id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  source: "wish" | "auto";
  request_id: string | null;
  played_at: string;
}
