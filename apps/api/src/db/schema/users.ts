import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').unique(),
  spotifyUserId: text('spotify_user_id').unique().notNull(),
  spotifyAccessToken: text('spotify_access_token').notNull(),
  spotifyRefreshToken: text('spotify_refresh_token').notNull(),
  spotifyTokenExpiresAt: timestamp('spotify_token_expires_at').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').default(sql`now()`),
  lastSyncedAt: timestamp('last_synced_at'),
  lastActiveAt: timestamp('last_active_at').default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
