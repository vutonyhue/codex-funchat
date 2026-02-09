/**
 * Red Envelope (Lì xì) Edge Function
 * Xử lý tạo, nhận và hoàn tiền lì xì
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Route handling
    if (req.method === 'POST' && path === 'create') {
      return await handleCreate(supabase, user.id, await req.json());
    }

    if (req.method === 'POST' && path === 'claim') {
      return await handleClaim(supabase, user.id, await req.json());
    }

    if (req.method === 'GET' && path === 'details') {
      const envelopeId = url.searchParams.get('id');
      if (!envelopeId) {
        return new Response(
          JSON.stringify({ error: 'Missing envelope ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await handleDetails(supabase, user.id, envelopeId);
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[red-envelope] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Create a new red envelope
async function handleCreate(supabase: any, userId: string, body: any) {
  const { conversationId, totalAmount, currency, totalRecipients, distributionType, message } = body;

  // Validate input
  if (!conversationId || !totalAmount || !totalRecipients) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check user is member of conversation
  const { data: membership, error: memberError } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return new Response(
      JSON.stringify({ error: 'Not a member of this conversation' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create red envelope with 24h expiry
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: envelope, error: createError } = await supabase
    .from('red_envelopes')
    .insert({
      sender_id: userId,
      conversation_id: conversationId,
      total_amount: totalAmount,
      currency: currency || 'CAMLY',
      total_recipients: totalRecipients,
      distribution_type: distributionType || 'random',
      message: message || null,
      remaining_amount: totalAmount,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (createError) {
    console.error('[red-envelope] Create error:', createError);
    return new Response(
      JSON.stringify({ error: createError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create message in conversation
  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: message || '🧧 Lì xì đây!',
      message_type: 'red_envelope',
      metadata: {
        envelope_id: envelope.id,
        total_amount: totalAmount,
        currency: currency || 'CAMLY',
        total_recipients: totalRecipients,
        distribution_type: distributionType || 'random',
      },
    })
    .select()
    .single();

  if (msgError) {
    console.error('[red-envelope] Message error:', msgError);
  } else {
    // Update envelope with message_id
    await supabase
      .from('red_envelopes')
      .update({ message_id: msg.id })
      .eq('id', envelope.id);
  }

  console.log(`[red-envelope] Created envelope ${envelope.id} by user ${userId}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      envelope: { ...envelope, message_id: msg?.id } 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Claim a red envelope
async function handleClaim(supabase: any, userId: string, body: any) {
  const { envelopeId } = body;

  if (!envelopeId) {
    return new Response(
      JSON.stringify({ error: 'Missing envelope ID' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get envelope
  const { data: envelope, error: envError } = await supabase
    .from('red_envelopes')
    .select('*')
    .eq('id', envelopeId)
    .single();

  if (envError || !envelope) {
    return new Response(
      JSON.stringify({ error: 'Envelope not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check status
  if (envelope.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Envelope is no longer active', status: envelope.status }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check expiry
  if (new Date(envelope.expires_at) < new Date()) {
    await supabase
      .from('red_envelopes')
      .update({ status: 'expired' })
      .eq('id', envelopeId);

    return new Response(
      JSON.stringify({ error: 'Envelope has expired' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already claimed
  const { data: existingClaim } = await supabase
    .from('red_envelope_claims')
    .select('id')
    .eq('envelope_id', envelopeId)
    .eq('user_id', userId)
    .single();

  if (existingClaim) {
    return new Response(
      JSON.stringify({ error: 'Already claimed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate amount
  const remainingRecipients = envelope.total_recipients - envelope.claimed_count;
  let claimAmount: number;

  if (envelope.distribution_type === 'equal') {
    claimAmount = envelope.total_amount / envelope.total_recipients;
  } else {
    // Random distribution
    if (remainingRecipients === 1) {
      // Last person gets remaining
      claimAmount = envelope.remaining_amount;
    } else {
      // Random between min and max
      const min = 0.01;
      const max = (envelope.remaining_amount / remainingRecipients) * 2;
      claimAmount = Math.max(min, Math.random() * (max - min) + min);
      claimAmount = Math.min(claimAmount, envelope.remaining_amount - (remainingRecipients - 1) * min);
      claimAmount = Math.round(claimAmount * 100) / 100; // Round to 2 decimals
    }
  }

  // Create claim
  const { data: claim, error: claimError } = await supabase
    .from('red_envelope_claims')
    .insert({
      envelope_id: envelopeId,
      user_id: userId,
      amount: claimAmount,
    })
    .select()
    .single();

  if (claimError) {
    console.error('[red-envelope] Claim error:', claimError);
    return new Response(
      JSON.stringify({ error: claimError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update envelope
  const newRemainingAmount = envelope.remaining_amount - claimAmount;
  const newClaimedCount = envelope.claimed_count + 1;
  const newStatus = newClaimedCount >= envelope.total_recipients ? 'fully_claimed' : 'active';

  await supabase
    .from('red_envelopes')
    .update({
      remaining_amount: newRemainingAmount,
      claimed_count: newClaimedCount,
      status: newStatus,
    })
    .eq('id', envelopeId);

  console.log(`[red-envelope] User ${userId} claimed ${claimAmount} ${envelope.currency} from envelope ${envelopeId}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      claim: { ...claim, currency: envelope.currency },
      envelope: {
        remaining_amount: newRemainingAmount,
        claimed_count: newClaimedCount,
        status: newStatus,
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get envelope details
async function handleDetails(supabase: any, userId: string, envelopeId: string) {
  // Get envelope
  const { data: envelope, error: envError } = await supabase
    .from('red_envelopes')
    .select('*, sender:sender_id(id, display_name, avatar_url)')
    .eq('id', envelopeId)
    .single();

  if (envError || !envelope) {
    return new Response(
      JSON.stringify({ error: 'Envelope not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get claims with user profiles
  const { data: claims } = await supabase
    .from('red_envelope_claims')
    .select('*, user:user_id(id, display_name, avatar_url)')
    .eq('envelope_id', envelopeId)
    .order('claimed_at', { ascending: false });

  // Check if current user has claimed
  const userClaim = claims?.find((c: any) => c.user_id === userId);

  return new Response(
    JSON.stringify({ 
      envelope,
      claims: claims || [],
      hasClaimed: !!userClaim,
      userClaimAmount: userClaim?.amount || null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
