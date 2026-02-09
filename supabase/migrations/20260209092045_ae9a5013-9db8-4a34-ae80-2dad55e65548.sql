-- 1. Create helper function (SECURITY DEFINER) to check membership safely
CREATE OR REPLACE FUNCTION public.is_member_of_message_conversation(
  _user_id UUID,
  _message_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM messages m
    JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = _message_id 
      AND cm.user_id = _user_id
  )
$$;

-- 2. Drop existing policies that have issues
DROP POLICY IF EXISTS "Users can insert read receipts" ON message_reads;
DROP POLICY IF EXISTS "Users can view read receipts" ON message_reads;

-- 3. Create new policies using the SECURITY DEFINER function
CREATE POLICY "Users can insert read receipts" ON message_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND 
    public.is_member_of_message_conversation(auth.uid(), message_id)
  );

CREATE POLICY "Users can view read receipts" ON message_reads
  FOR SELECT TO authenticated
  USING (
    public.is_member_of_message_conversation(auth.uid(), message_id)
  );