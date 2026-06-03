import { pgTable, uuid, text, integer, real, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tracks = pgTable('tracks', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spotifyTrackId: text('spotify_track_id').unique().notNull(),
  name: text('name').notNull(),
  artistName: text('artist_name').notNull(), // primary artist (display)
  artistNames: text('artist_names').array().notNull(), // all artists
  albumName: text('album_name').notNull(),
  albumImageUrl: text('album_image_url'),
  durationMs: integer('duration_ms').notNull(),
  previewUrl: text('preview_url'),
  spotifyUri: text('spotify_uri').notNull(),
  releaseYear: integer('release_year'),

  moodTags: text('mood_tags').array(),
  moodCategory: text('mood_category'),
  energy: real('energy'),
  vibeVector: real('vibe_vector').array(),
  genreTags: text('genre_tags').array(),
  enrichedAt: timestamp('enriched_at'),

  createdAt: timestamp('created_at').default(sql`now()`),
});

export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
