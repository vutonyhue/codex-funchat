/**
 * Group Admin API Functions
 * Handles group settings, member management, and invite links
 */
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, Profile } from '@/types';

// ========== Types ==========

export interface GroupSettings {
  only_admin_can_send: boolean;
  only_admin_can_add_members: boolean;
  allow_member_to_invite: boolean;
}

export interface GroupUpdateData {
  name?: string;
  description?: string;
  avatar_url?: string;
  settings?: GroupSettings;
}

// ========== Helper Functions ==========

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ========== Conversation Update ==========

export async function updateConversation(
  conversationId: string,
  data: GroupUpdateData
): Promise<{ error: Error | null }> {
  const updateData: Record<string, any> = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
  if (data.settings !== undefined) updateData.settings = data.settings;

  const { error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// ========== Member Management ==========

export async function updateMemberRole(
  memberId: string,
  newRole: 'admin' | 'member'
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('conversation_members')
    .update({ role: newRole })
    .eq('id', memberId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function removeMember(
  conversationId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function addMembers(
  conversationId: string,
  userIds: string[],
  addedBy: string
): Promise<{ error: Error | null }> {
  const inserts = userIds.map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    role: 'member',
    added_by: addedBy,
  }));

  const { error } = await supabase
    .from('conversation_members')
    .insert(inserts);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// ========== Invite Link ==========

export async function generateInviteLink(
  conversationId: string
): Promise<{ data: string | null; error: Error | null }> {
  const inviteCode = generateInviteCode();

  const { error } = await supabase
    .from('conversations')
    .update({ invite_link: inviteCode })
    .eq('id', conversationId);

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: inviteCode, error: null };
}

export async function getInviteLink(
  conversationId: string
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('conversations')
    .select('invite_link')
    .eq('id', conversationId)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: (data as any)?.invite_link || null, error: null };
}

export async function joinByInviteLink(
  inviteCode: string,
  userId: string
): Promise<{ data: Conversation | null; error: Error | null }> {
  // Find conversation with this invite code
  const { data: conv, error: findError } = await supabase
    .from('conversations')
    .select('id, name, is_group, avatar_url, created_by, created_at, updated_at')
    .eq('invite_link', inviteCode)
    .single();

  if (findError || !conv) {
    return { data: null, error: new Error('Link mời không hợp lệ hoặc đã hết hạn') };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conv.id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    return { data: null, error: new Error('Bạn đã là thành viên của nhóm này') };
  }

  // Add user to conversation
  const { error: joinError } = await supabase
    .from('conversation_members')
    .insert({
      conversation_id: conv.id,
      user_id: userId,
      role: 'member',
    });

  if (joinError) {
    return { data: null, error: new Error(joinError.message) };
  }

  return {
    data: {
      id: conv.id,
      name: conv.name,
      is_group: conv.is_group || false,
      avatar_url: conv.avatar_url,
      created_by: conv.created_by,
      created_at: conv.created_at || '',
      updated_at: conv.updated_at || '',
    },
    error: null,
  };
}

// ========== Admin Check ==========

export function isConversationAdmin(
  conversation: Conversation,
  userId: string
): boolean {
  if (!conversation.members) return conversation.created_by === userId;
  
  const member = conversation.members.find((m) => m.user_id === userId);
  return member?.role === 'admin' || conversation.created_by === userId;
}

// ========== Get Group Details ==========

export async function getGroupDetails(conversationId: string): Promise<{
  data: {
    description: string | null;
    invite_link: string | null;
    settings: GroupSettings;
  } | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('conversations')
    .select('description, invite_link, settings')
    .eq('id', conversationId)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const rawData = data as any;
  
  return {
    data: {
      description: rawData?.description || null,
      invite_link: rawData?.invite_link || null,
      settings: rawData?.settings || {
        only_admin_can_send: false,
        only_admin_can_add_members: false,
        allow_member_to_invite: true,
      },
    },
    error: null,
  };
}
