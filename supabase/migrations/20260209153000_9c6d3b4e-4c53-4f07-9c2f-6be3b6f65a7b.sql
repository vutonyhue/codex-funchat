-- Bump conversations.updated_at when messages change.
-- This avoids requiring clients to have UPDATE rights on conversations.

CREATE OR REPLACE FUNCTION public.bump_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_conversation_updated_at_on_message_insert ON public.messages;
CREATE TRIGGER trg_bump_conversation_updated_at_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_conversation_updated_at();

DROP TRIGGER IF EXISTS trg_bump_conversation_updated_at_on_message_update ON public.messages;
CREATE TRIGGER trg_bump_conversation_updated_at_on_message_update
AFTER UPDATE OF updated_at, is_deleted, deleted_at, content, metadata ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_conversation_updated_at();

