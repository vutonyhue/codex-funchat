-- Add conversation_id to reactions and read receipts so Realtime can filter by conversation_id.

ALTER TABLE public.message_reactions
ADD COLUMN IF NOT EXISTS conversation_id uuid;

ALTER TABLE public.message_reads
ADD COLUMN IF NOT EXISTS conversation_id uuid;

-- Backfill conversation_id from messages
UPDATE public.message_reactions r
SET conversation_id = m.conversation_id
FROM public.messages m
WHERE m.id = r.message_id AND r.conversation_id IS NULL;

UPDATE public.message_reads rr
SET conversation_id = m.conversation_id
FROM public.messages m
WHERE m.id = rr.message_id AND rr.conversation_id IS NULL;

-- Maintain conversation_id automatically on inserts
CREATE OR REPLACE FUNCTION public.set_reaction_conversation_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT conversation_id INTO NEW.conversation_id
  FROM public.messages
  WHERE id = NEW.message_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reaction_conversation_id ON public.message_reactions;
CREATE TRIGGER trg_set_reaction_conversation_id
BEFORE INSERT ON public.message_reactions
FOR EACH ROW
EXECUTE FUNCTION public.set_reaction_conversation_id();

CREATE OR REPLACE FUNCTION public.set_read_conversation_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT conversation_id INTO NEW.conversation_id
  FROM public.messages
  WHERE id = NEW.message_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_read_conversation_id ON public.message_reads;
CREATE TRIGGER trg_set_read_conversation_id
BEFORE INSERT ON public.message_reads
FOR EACH ROW
EXECUTE FUNCTION public.set_read_conversation_id();

-- Enforce not null going forward (after backfill)
ALTER TABLE public.message_reactions
ALTER COLUMN conversation_id SET NOT NULL;

ALTER TABLE public.message_reads
ALTER COLUMN conversation_id SET NOT NULL;

-- Indexes for realtime filters + lookups
CREATE INDEX IF NOT EXISTS idx_message_reactions_conversation_id ON public.message_reactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_conversation_id ON public.message_reads(conversation_id);

-- Realtime requirements
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;

