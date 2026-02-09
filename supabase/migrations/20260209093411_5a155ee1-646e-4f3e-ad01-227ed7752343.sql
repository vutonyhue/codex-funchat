-- =====================================================
-- Group Admin Features Migration
-- =====================================================

-- 1. Add new columns to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS invite_link TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"only_admin_can_send": false, "only_admin_can_add_members": false, "allow_member_to_invite": true}'::jsonb;

-- 2. Add added_by column to conversation_members table
ALTER TABLE public.conversation_members 
ADD COLUMN IF NOT EXISTS added_by UUID;

-- 3. Create security definer function to check if user is admin of conversation
CREATE OR REPLACE FUNCTION public.is_conversation_admin(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_members cm
    JOIN public.conversations c ON c.id = cm.conversation_id
    WHERE cm.conversation_id = _conversation_id
      AND cm.user_id = _user_id
      AND (cm.role = 'admin' OR c.created_by = _user_id)
  )
$$;

-- 4. Drop existing UPDATE policy on conversation_members if exists
DROP POLICY IF EXISTS "Users can update conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.conversation_members;

-- 5. Create new UPDATE policy - Admins can update member roles
CREATE POLICY "Admins can update member roles"
ON public.conversation_members
FOR UPDATE
USING (
  public.is_conversation_admin(auth.uid(), conversation_id)
);

-- 6. Drop existing DELETE policy if exists
DROP POLICY IF EXISTS "Users can delete conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;

-- 7. Create DELETE policy - Admins can remove members OR users can leave themselves
CREATE POLICY "Users can leave or admins can remove"
ON public.conversation_members
FOR DELETE
USING (
  user_id = auth.uid() OR public.is_conversation_admin(auth.uid(), conversation_id)
);

-- 8. Drop and recreate UPDATE policy on conversations to allow admins
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversations;

-- 9. Create new UPDATE policy - Creator OR Admin can update
CREATE POLICY "Creator or admin can update conversations"
ON public.conversations
FOR UPDATE
USING (
  created_by = auth.uid() OR public.is_conversation_admin(auth.uid(), id)
);

-- 10. Create index for invite_link lookups
CREATE INDEX IF NOT EXISTS idx_conversations_invite_link ON public.conversations(invite_link) WHERE invite_link IS NOT NULL;