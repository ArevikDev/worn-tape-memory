import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tracks } from './tracks';

export const listens = pgTable(
  'listens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id),
    // Denormalized for fast queries — avoids joining tracks just to filter by spotify id
    spotifyTrackId: text('spotify_track_id').notNull(),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at').default(sql`now()`),
  },
  (table) => [
    // Same user can't have the same track at the exact same millisecond twice
    unique('uq_listen').on(table.userId, table.spotifyTrackId, table.playedAt),
  ],
);

export type Listen = typeof listens.$inferSelect;
export type NewListen = typeof listens.$inferInsert;
