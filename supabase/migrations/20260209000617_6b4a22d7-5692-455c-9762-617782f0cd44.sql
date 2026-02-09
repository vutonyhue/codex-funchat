-- Add message_reactions to realtime publication
-- This table was missing from the publication, causing CHANNEL_ERROR

-- Set REPLICA IDENTITY FULL to get full row data on DELETE events
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;