import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  real,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const archetypes = pgTable('archetypes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  peakHour: integer('peak_hour').notNull(),
  peakDayOfWeek: integer('peak_day_of_week').notNull(),
  primaryMood: text('primary_mood').notNull(),
  trackIds: text('track_ids').array().notNull(),
  playCount: integer('play_count').notNull(),
  lastAppearedAt: timestamp('last_appeared_at').notNull(),
  detectedAt: timestamp('detected_at').default(sql`now()`).notNull(),
  spotifyPlaylistId: text('spotify_playlist_id'),
  styleTags: text('style_tags').array(),
  topArtists: text('top_artists').array(),
  topTrackImageUrls: text('top_track_image_urls').array(),
  similarArtists: text('similar_artists').array(),
  centroid: real('centroid').array(),
});

export type Archetype = typeof archetypes.$inferSelect;
export type NewArchetype = typeof archetypes.$inferInsert;
