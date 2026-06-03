export interface MoodMapPoint {
  x: number;
  y: number;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  moodCategory: string | null;
  albumImageUrl: string | null;
  spotifyUri: string;
  playCount: number;
}

export type MoodMapRange = 'all' | '3m' | '1m';
