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
}

export type MoodCategory =
  | 'melancholy'
  | 'warm'
  | 'peak'
  | 'hypnotic'
  | 'euphoric'
  | 'contemplative';