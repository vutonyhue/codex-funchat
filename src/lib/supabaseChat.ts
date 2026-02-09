/**
 * Supabase Direct Chat Operations
 * Replaces Cloudflare Worker API Gateway for chat functionality.
 * Uses RLS (Row Level Security) for authorization.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, Message, Profile, ConversationMember } from '@/types';

// ========== Conversations ==========

export async function listConversations(userId: string): Promise<{
  conversations: Conversation[];
  total: number;
}> {
  // 1. Get conversation IDs where user is member
  const { data: memberData, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  if (memberError) {
    if (import.meta.env.DEV) console.error('[supabaseChat] listConversations member error:', memberError);
    return { conversations: [], total: 0 };
  }

  if (!memberData?.length) {
    return { conversations: [], total: 0 };
  }

  const conversationIds = memberData.map((m) => m.conversation_id).filter(Boolean) as string[];

  // 2. Get conversations with members and profiles
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select(`
      id,
      name,
      is_group,
      avatar_url,
      created_by,
      created_at,
      updated_at
    `)
    .in('id', conversationIds)
    .order('updated_at', { ascending: false });

  if (convError) {
    if (import.meta.env.DEV) console.error('[supabaseChat] listConversations conv error:', convError);
    return { conversations: [], total: 0 };
  }

  if (!conversations?.length) {
    return { conversations: [], total: 0 };
  }

  // 3. Get all members for these conversations
  const { data: allMembers, error: membersError } = await supabase
    .from('conversation_members')
    .select(`
      id,
      conversation_id,
      user_id,
      role,
      joined_at,
      is_muted
    `)
    .in('conversation_id', conversationIds);

  if (membersError) {
    if (import.meta.env.DEV) console.error('[supabaseChat] listConversations members error:', membersError);
  }

  // 4. Get profiles for all members
  const memberUserIds = [...new Set((allMembers || []).map((m) => m.user_id).filter(Boolean))] as string[];
  let profilesMap: Map<string, Profile> = new Map();

  if (memberUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
      .in('id', memberUserIds);

    if (profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));
    }
  }

  // 5. Assemble conversations with members
  const result: Conversation[] = conversations.map((conv) => {
    const members: ConversationMember[] = (allMembers || [])
      .filter((m) => m.conversation_id === conv.id)
      .map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id!,
        user_id: m.user_id!,
        role: m.role || 'member',
        joined_at: m.joined_at || '',
        profile: m.user_id ? profilesMap.get(m.user_id) : undefined,
      }));

    return {
      id: conv.id,
      name: conv.name,
      is_group: conv.is_group || false,
      avatar_url: conv.avatar_url,
      created_by: conv.created_by,
      created_at: conv.created_at || '',
      updated_at: conv.updated_at || '',
      members,
    };
  });

  return { conversations: result, total: result.length };
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select('id, name, is_group, avatar_url, created_by, created_at, updated_at')
    .eq('id', conversationId)
    .single();

  if (error || !conv) {
    if (import.meta.env.DEV) console.error('[supabaseChat] getConversation error:', error);
    return null;
  }

  // Get members
  const { data: members } = await supabase
    .from('conversation_members')
    .select('id, conversation_id, user_id, role, joined_at')
    .eq('conversation_id', conversationId);

  // Get profiles
  const memberUserIds = (members || []).map((m) => m.user_id).filter(Boolean) as string[];
  let profilesMap: Map<string, Profile> = new Map();

  if (memberUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
      .in('id', memberUserIds);

    if (profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));
    }
  }

  return {
    id: conv.id,
    name: conv.name,
    is_group: conv.is_group || false,
    avatar_url: conv.avatar_url,
    created_by: conv.created_by,
    created_at: conv.created_at || '',
    updated_at: conv.updated_at || '',
    members: (members || []).map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id!,
      user_id: m.user_id!,
      role: m.role || 'member',
      joined_at: m.joined_at || '',
      profile: m.user_id ? profilesMap.get(m.user_id) : undefined,
    })),
  };
}

export async function findDirectConversation(
  userId: string,
  otherUserId: string
): Promise<Conversation | null> {
  // Find all conversations where current user is a member
  const { data: myMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  if (!myMemberships?.length) return null;

  const myConvIds = myMemberships.map((m) => m.conversation_id).filter(Boolean) as string[];

  // Get non-group conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .in('id', myConvIds)
    .eq('is_group', false);

  if (!conversations?.length) return null;

  const directConvIds = conversations.map((c) => c.id);

  // Check if other user is in any of these conversations
  const { data: otherMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', otherUserId)
    .in('conversation_id', directConvIds);

  if (!otherMemberships?.length) return null;

  // Return the first matching conversation
  const conversationId = otherMemberships[0].conversation_id;
  if (!conversationId) return null;

  return getConversation(conversationId);
}

export async function createConversation(
  userId: string,
  memberIds: string[],
  name?: string | null,
  isGroup = false
): Promise<{ data: Conversation | null; error: Error | null }> {
  try {
    // 1. Create conversation
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        name: isGroup ? name : null,
        is_group: isGroup,
        created_by: userId,
      })
      .select()
      .single();

    if (convError || !conv) {
      return { data: null, error: new Error(convError?.message || 'Failed to create conversation') };
    }

    // 2. Add creator as member
    const allMemberIds = [userId, ...memberIds.filter((id) => id !== userId)];
    const memberInserts = allMemberIds.map((uid) => ({
      conversation_id: conv.id,
      user_id: uid,
      role: uid === userId ? 'admin' : 'member',
    }));

    const { error: membersError } = await supabase.from('conversation_members').insert(memberInserts);

    if (membersError) {
      if (import.meta.env.DEV) console.error('[supabaseChat] createConversation members error:', membersError);
      // Still return the conversation - members might be added via trigger
    }

    // 3. Get full conversation with members
    const fullConv = await getConversation(conv.id);
    return { data: fullConv, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to create conversation') };
  }
}

export async function leaveConversation(
  userId: string,
  conversationId: string
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

// ========== Reactions ==========

export async function getReactionsBatch(messageIds: string[]): Promise<{
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}[]> {
  if (!messageIds.length) return [];

  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .in('message_id', messageIds);

  if (error) {
    if (import.meta.env.DEV) console.error('[supabaseChat] getReactionsBatch error:', error);
    return [];
  }

  return data || [];
}

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ data: { id: string; message_id: string; user_id: string; emoji: string; created_at: string } | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

export async function removeReaction(reactionId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('id', reactionId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// ========== Read Receipts ==========

export async function getReadReceiptsBatch(messageIds: string[]): Promise<{
  message_id: string;
  user_id: string;
  read_at: string;
}[]> {
  if (!messageIds.length) return [];

  const { data, error } = await supabase
    .from('message_reads')
    .select('message_id, user_id, read_at')
    .in('message_id', messageIds);

  if (error) {
    if (import.meta.env.DEV) console.error('[supabaseChat] getReadReceiptsBatch error:', error);
    return [];
  }

  return data || [];
}

export async function markMessagesAsRead(
  messageIds: string[],
  userId: string
): Promise<{ marked: number; error: Error | null }> {
  if (!messageIds.length) return { marked: 0, error: null };

  // Upsert to handle duplicates gracefully
  const inserts = messageIds.map((mid) => ({
    message_id: mid,
    user_id: userId,
  }));

  const { error } = await supabase
    .from('message_reads')
    .upsert(inserts, { onConflict: 'message_id,user_id' });

  if (error) {
    return { marked: 0, error: new Error(error.message) };
  }

  return { marked: messageIds.length, error: null };
}

// ========== Typing ==========

export async function broadcastTyping(
  conversationId: string,
  userId: string,
  userName: string
): Promise<void> {
  // Use Supabase Realtime broadcast
  const channel = supabase.channel(`conversation:${conversationId}`);
  
  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      user_id: userId,
      user_name: userName,
      timestamp: new Date().toISOString(),
    },
  });

  // Unsubscribe immediately after sending
  supabase.removeChannel(channel);
}

// ========== Messages ==========

export async function listMessages(
  conversationId: string,
  limit = 50,
  offset = 0
): Promise<Message[]> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at, is_deleted, deleted_at, reply_to_id, pinned_at, pinned_by, edited_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (import.meta.env.DEV) console.error('[supabaseChat] listMessages error:', error);
    return [];
  }

  if (!messages?.length) return [];

  // Get sender profiles
  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))] as string[];
  let profilesMap: Map<string, Profile> = new Map();

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
      .in('id', senderIds);

    if (profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));
    }
  }

  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id || '',
    sender_id: m.sender_id,
    content: m.content,
    message_type: m.message_type || 'text',
    metadata: (m.metadata as Record<string, any>) || {},
    created_at: m.created_at || '',
    updated_at: m.updated_at || m.created_at || '',
    is_deleted: m.is_deleted || false,
    deleted_at: m.deleted_at,
    reply_to_id: m.reply_to_id,
    pinned_at: m.pinned_at,
    pinned_by: m.pinned_by,
    edited_at: m.edited_at,
    sender: m.sender_id ? profilesMap.get(m.sender_id) : undefined,
  }));
}

// ========== Pin Messages ==========

export async function getPinnedMessages(conversationId: string): Promise<Message[]> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at, is_deleted, deleted_at, reply_to_id, pinned_at, pinned_by, edited_at')
    .eq('conversation_id', conversationId)
    .not('pinned_at', 'is', null)
    .order('pinned_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[supabaseChat] getPinnedMessages error:', error);
    return [];
  }

  if (!messages?.length) return [];

  // Get sender profiles
  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))] as string[];
  let profilesMap: Map<string, Profile> = new Map();

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
      .in('id', senderIds);

    if (profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));
    }
  }

  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id || '',
    sender_id: m.sender_id,
    content: m.content,
    message_type: m.message_type || 'text',
    metadata: (m.metadata as Record<string, any>) || {},
    created_at: m.created_at || '',
    updated_at: m.updated_at || m.created_at || '',
    is_deleted: m.is_deleted || false,
    deleted_at: m.deleted_at,
    reply_to_id: m.reply_to_id,
    pinned_at: m.pinned_at,
    pinned_by: m.pinned_by,
    edited_at: m.edited_at,
    sender: m.sender_id ? profilesMap.get(m.sender_id) : undefined,
  }));
}

export async function pinMessage(
  messageId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('messages')
    .update({
      pinned_at: new Date().toISOString(),
      pinned_by: userId,
    })
    .eq('id', messageId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function unpinMessage(messageId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('messages')
    .update({
      pinned_at: null,
      pinned_by: null,
    })
    .eq('id', messageId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// ========== Search Messages ==========

export async function searchMessages(
  conversationId: string,
  query: string,
  limit = 20
): Promise<Message[]> {
  // Use simple text search with ILIKE for Vietnamese support
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at, is_deleted, deleted_at, reply_to_id, pinned_at, pinned_by, edited_at')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (import.meta.env.DEV) console.error('[supabaseChat] searchMessages error:', error);
    return [];
  }

  if (!messages?.length) return [];

  // Get sender profiles
  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))] as string[];
  let profilesMap: Map<string, Profile> = new Map();

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
      .in('id', senderIds);

    if (profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));
    }
  }

  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id || '',
    sender_id: m.sender_id,
    content: m.content,
    message_type: m.message_type || 'text',
    metadata: (m.metadata as Record<string, any>) || {},
    created_at: m.created_at || '',
    updated_at: m.updated_at || m.created_at || '',
    is_deleted: m.is_deleted || false,
    deleted_at: m.deleted_at,
    reply_to_id: m.reply_to_id,
    pinned_at: m.pinned_at,
    pinned_by: m.pinned_by,
    edited_at: m.edited_at,
    sender: m.sender_id ? profilesMap.get(m.sender_id) : undefined,
  }));
}

// ========== Edit Messages ==========

export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  content: string,
  messageType = 'text',
  metadata: Record<string, any> = {},
  replyToId?: string | null
): Promise<{ data: Message | null; error: Error | null }> {
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content,
      message_type: messageType,
      metadata,
      reply_to_id: replyToId || null,
    })
    .select()
    .single();

  if (error || !msg) {
    return { data: null, error: new Error(error?.message || 'Failed to send message') };
  }

  // Get sender profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, status, last_seen, created_at, updated_at, wallet_address')
    .eq('id', userId)
    .single();

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return {
    data: {
      id: msg.id,
      conversation_id: msg.conversation_id || '',
      sender_id: msg.sender_id,
      content: msg.content,
      message_type: msg.message_type || 'text',
      metadata: (msg.metadata as Record<string, any>) || {},
      created_at: msg.created_at || '',
      updated_at: msg.updated_at || msg.created_at || '',
      is_deleted: msg.is_deleted || false,
      deleted_at: msg.deleted_at,
      reply_to_id: msg.reply_to_id,
      sender: profile as Profile | undefined,
    },
    error: null,
  };
}

export async function deleteMessage(
  messageId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('messages')
    .update({
      is_deleted: true,
      deleted_at: now,
      content: 'Message deleted',
    })
    .eq('id', messageId)
    .eq('sender_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
