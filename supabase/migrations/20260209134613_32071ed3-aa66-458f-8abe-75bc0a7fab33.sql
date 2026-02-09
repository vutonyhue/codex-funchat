
-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_message_id UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own scheduled messages"
ON public.scheduled_messages FOR SELECT
USING (sender_id = auth.uid());

CREATE POLICY "Users can create scheduled messages"
ON public.scheduled_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (SELECT get_my_conversation_ids())
);

CREATE POLICY "Users can update own pending scheduled messages"
ON public.scheduled_messages FOR UPDATE
USING (sender_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users can delete own pending scheduled messages"
ON public.scheduled_messages FOR DELETE
USING (sender_id = auth.uid() AND status = 'pending');

-- Index for efficient querying of pending messages
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages (scheduled_at)
WHERE status = 'pending';

CREATE INDEX idx_scheduled_messages_sender ON public.scheduled_messages (sender_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger: scheduled_at must be in the future
CREATE OR REPLACE FUNCTION public.validate_scheduled_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_at <= now() + interval '1 minute' THEN
    RAISE EXCEPTION 'scheduled_at must be at least 1 minute in the future';
  END IF;
  IF NEW.scheduled_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'scheduled_at must be within 30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_scheduled_message_trigger
BEFORE INSERT ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_scheduled_message();
