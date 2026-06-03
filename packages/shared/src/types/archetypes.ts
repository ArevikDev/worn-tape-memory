export interface Archetype {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  peakHour: number;
  peakDayOfWeek: number;
  primaryMood: MoodCategory;
  trackIds: string[];
  playCount: number;
  lastAppearedAt: string;
  detectedAt: string;
  spotifyPlaylistId: string | null;
  styleTags: string[] | null;
  topArtists: string[] | null;
  topTrackImageUrls: string[] | null;
  similarArtists: string[] | null;
}

export type MoodCategory =
  | 'melancholy'
  | 'warm'
  | 'peak'
  | 'hypnotic'
  | 'euphoric'
  | 'contemplative'
  | 'nostalgic'
  | 'dreamy'
  | 'tense'
  | 'serene'
  | 'raw'
  | 'bittersweet'
  | 'electric'
  | 'tender'
  | 'brooding';