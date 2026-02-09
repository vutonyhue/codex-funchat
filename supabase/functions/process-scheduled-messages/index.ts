import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Query pending messages that are due
    const { data: dueMessages, error: queryError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50)

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!dueMessages || dueMessages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0

    for (const scheduled of dueMessages) {
      // 2. Insert into messages table
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: scheduled.conversation_id,
          sender_id: scheduled.sender_id,
          content: scheduled.content,
          message_type: scheduled.message_type,
          metadata: {
            ...(scheduled.metadata || {}),
            scheduled: true,
            scheduled_at: scheduled.scheduled_at,
          },
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`Failed to send scheduled message ${scheduled.id}:`, insertError)
        continue
      }

      // 3. Update scheduled_messages status
      const { error: updateError } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_message_id: newMessage.id,
        })
        .eq('id', scheduled.id)

      if (updateError) {
        console.error(`Failed to update scheduled message ${scheduled.id}:`, updateError)
      } else {
        processed++
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', scheduled.conversation_id)
    }

    return new Response(JSON.stringify({ processed, total: dueMessages.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Process scheduled messages error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
