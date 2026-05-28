CREATE TABLE IF NOT EXISTS "users" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"                    text UNIQUE,
  "spotify_user_id"          text UNIQUE NOT NULL,
  "spotify_access_token"     text NOT NULL,
  "spotify_refresh_token"    text NOT NULL,
  "spotify_token_expires_at" timestamp NOT NULL,
  "display_name"             text,
  "avatar_url"               text,
  "created_at"               timestamp DEFAULT now(),
  "last_synced_at"           timestamp,
  "last_active_at"           timestamp DEFAULT now()
);
