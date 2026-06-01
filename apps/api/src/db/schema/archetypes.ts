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
  // Centroid of the cluster in vibe space (for future similarity queries)
  centroid: real('centroid').array(),
});

export type Archetype = typeof archetypes.$inferSelect;
export type NewArchetype = typeof archetypes.$inferInsert;
