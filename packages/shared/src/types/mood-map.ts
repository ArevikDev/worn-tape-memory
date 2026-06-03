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

  archetypeId: string | null;
  archetypeColor: string | null;
  archetypeName: string | null;
  primaryStyle: string | null;
}

export type MoodMapRange = 'all' | '3m' | '1m';
