export interface TrackStat {
  name: string;
  artistName: string;
  albumImageUrl: string | null;
  spotifyUri: string;
  playCount: number;
}

export interface ArtistStat {
  artistName: string;
  albumImageUrl: string | null;
  playCount: number;
}

export interface RecentListen {
  name: string;
  artistName: string;
  albumImageUrl: string | null;
  playedAt: string; // ISO string
}

export interface UserStats {
  totalListens: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topTracks: TrackStat[];
  topArtists: ArtistStat[];
  recentListens: RecentListen[];
}

export interface NowPlaying {
  trackName: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  spotifyUri: string;
  progressMs: number;
  durationMs: number;
}
