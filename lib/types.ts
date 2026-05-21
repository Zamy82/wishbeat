export type EventStatus = "active" | "ended";
export type RequestStatus = "pending" | "approved" | "played" | "rejected";

export interface DjEvent {
  id: string;
  owner_id: string;
  name: string;
  event_date: string;
  slug: string;
  is_active: boolean;
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
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string | null;
  duration_ms: number;
}
