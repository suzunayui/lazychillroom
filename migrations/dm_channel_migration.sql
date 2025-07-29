-- DM Channel Migration for Production
-- This migration allows channels table to support DM channels

-- 1. Allow guild_id to be NULL for DM channels
ALTER TABLE channels ALTER COLUMN guild_id DROP NOT NULL;

-- 2. Allow name to be NULL for DM channels (since DM channels don't have names)
ALTER TABLE channels ALTER COLUMN name DROP NOT NULL;

-- 3. Update the type constraint to include new channel types if not already present
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE channels ADD CONSTRAINT channels_type_check 
  CHECK (type IN ('text', 'voice', 'dm', 'uploader_public', 'uploader_private'));

-- 4. Create dm_participants table if it doesn't exist
CREATE TABLE IF NOT EXISTS dm_participants (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dm_participants_channel_id ON dm_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_dm_participants_user_id ON dm_participants(user_id);

-- Optional: Add some helpful comments
COMMENT ON TABLE dm_participants IS 'Stores participants for DM channels';
COMMENT ON COLUMN channels.guild_id IS 'Guild ID - NULL for DM channels';
COMMENT ON COLUMN channels.name IS 'Channel name - NULL for DM channels';
