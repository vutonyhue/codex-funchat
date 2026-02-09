import { supabase } from '@/integrations/supabase/client';

export interface ScheduledMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  metadata: Record<string, any>;
  scheduled_at: string;
  status: string;
  sent_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createScheduledMessage(data: {
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type?: string;
  metadata?: Record<string, any>;
  scheduled_at: string;
}): Promise<{ data: ScheduledMessage | null; error: Error | null }> {
  const { data: result, error } = await supabase
    .from('scheduled_messages' as any)
    .insert({
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      content: data.content,
      message_type: data.message_type || 'text',
      metadata: data.metadata || {},
      scheduled_at: data.scheduled_at,
    })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: result as unknown as ScheduledMessage, error: null };
}

export async function listScheduledMessages(
  conversationId: string
): Promise<ScheduledMessage[]> {
  const { data, error } = await supabase
    .from('scheduled_messages' as any)
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('[scheduledMessages] list error:', error);
    return [];
  }
  return (data || []) as unknown as ScheduledMessage[];
}

export async function updateScheduledMessage(
  id: string,
  data: { content?: string; scheduled_at?: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('scheduled_messages' as any)
    .update(data)
    .eq('id', id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function cancelScheduledMessage(
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('scheduled_messages' as any)
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
