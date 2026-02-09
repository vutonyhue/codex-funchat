/**
 * Agora Token Edge Function
 * Generates Agora RTC tokens for video/voice calls
 * 
 * POST /agora-token
 * Body: { channel: string, uid: number, role?: 'publisher' | 'subscriber', expireTime?: number }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenRequest {
  channel: string;
  uid: number;
  role?: 'publisher' | 'subscriber' | number;
  expireTime?: number;
}

const RtcRole = {
  PUBLISHER: 1,
  SUBSCRIBER: 2,
} as const;

const Privileges = {
  JOIN_CHANNEL: 1,
  PUBLISH_AUDIO_STREAM: 2,
  PUBLISH_VIDEO_STREAM: 3,
  PUBLISH_DATA_STREAM: 4,
} as const;

// ============================================================================
// Binary Packing Utilities
// ============================================================================

function packString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const result = new Uint8Array(2 + strBytes.length);
  result[0] = strBytes.length & 0xff;
  result[1] = (strBytes.length >> 8) & 0xff;
  for (let i = 0; i < strBytes.length; i++) {
    result[2 + i] = strBytes[i];
  }
  return result;
}

function packUint16(value: number): Uint8Array {
  const result = new Uint8Array(2);
  result[0] = value & 0xff;
  result[1] = (value >> 8) & 0xff;
  return result;
}

function packUint32(value: number): Uint8Array {
  const result = new Uint8Array(4);
  result[0] = value & 0xff;
  result[1] = (value >> 8) & 0xff;
  result[2] = (value >> 16) & 0xff;
  result[3] = (value >> 24) & 0xff;
  return result;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// Crypto Utilities
// ============================================================================

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function hmacSign(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

function base64Encode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ============================================================================
// Token Builder
// ============================================================================

async function buildToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  expireTimestamp: number
): Promise<string> {
  const encoder = new TextEncoder();
  const issueTs = Math.floor(Date.now() / 1000);
  const expire = expireTimestamp - issueTs;
  
  // Generate random salt
  const saltBytes = randomBytes(4);
  const salt = new DataView(saltBytes.buffer).getUint32(0, true);
  
  // Build privileges map based on role
  const privileges = new Map<number, number>();
  privileges.set(Privileges.JOIN_CHANNEL, expireTimestamp);
  
  if (role === RtcRole.PUBLISHER) {
    privileges.set(Privileges.PUBLISH_AUDIO_STREAM, expireTimestamp);
    privileges.set(Privileges.PUBLISH_VIDEO_STREAM, expireTimestamp);
    privileges.set(Privileges.PUBLISH_DATA_STREAM, expireTimestamp);
  }
  
  // Pack privileges
  const privilegeBytes: Uint8Array[] = [packUint16(privileges.size)];
  privileges.forEach((value, key) => {
    privilegeBytes.push(packUint16(key));
    privilegeBytes.push(packUint32(value));
  });
  const packedPrivileges = concatBytes(...privilegeBytes);
  
  // Build services (RTC service type = 1)
  const serviceType = 1;
  const services = [
    packUint16(1), // number of services
    packUint16(serviceType),
    packedPrivileges,
  ];
  const packedServices = concatBytes(...services);
  
  // Build message
  const message = concatBytes(
    packUint32(salt),
    packUint32(issueTs),
    packUint32(expire),
    packedServices
  );
  
  // Sign the message
  const toSign = concatBytes(
    encoder.encode(appId),
    encoder.encode(channelName),
    packUint32(uid),
    message
  );
  
  const signature = await hmacSign(encoder.encode(appCertificate), toSign);
  
  // Build final token content
  const tokenContent = concatBytes(
    packString(appId),
    packUint32(issueTs),
    packUint32(expire),
    packUint32(salt),
    packUint16(1), // service count
    packUint16(serviceType),
    packString(channelName),
    packUint32(uid),
    packUint16(privileges.size),
    ...Array.from(privileges.entries()).flatMap(([k, v]) => [packUint16(k), packUint32(v)]),
    packUint16(signature.length),
    signature
  );
  
  // Version 007 prefix
  const version = '007';
  return version + base64Encode(tokenContent);
}

// ============================================================================
// Request Handler
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        service: 'agora-token',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Only accept POST for token generation
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claims?.user) {
      console.error('[agora-token] JWT verification failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as TokenRequest;
    
    // Validate channel name
    if (!body.channel || typeof body.channel !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid channel name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate uid
    if (body.uid === undefined || typeof body.uid !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid uid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine role (default to publisher)
    let role = RtcRole.PUBLISHER;
    if (body.role === 'subscriber' || body.role === 2) {
      role = RtcRole.SUBSCRIBER;
    }
    
    // Calculate expiration (default 1 hour)
    const expireTime = body.expireTime || 3600;
    const expireTimestamp = Math.floor(Date.now() / 1000) + expireTime;
    
    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    
    if (!appId || !appCertificate) {
      console.error('[agora-token] Missing Agora credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate token
    const agoraToken = await buildToken(
      appId,
      appCertificate,
      body.channel,
      body.uid,
      role,
      expireTimestamp
    );
    
    console.log(`[agora-token] Token generated for channel: ${body.channel}, uid: ${body.uid}, user: ${claims.user.id}`);
    
    return new Response(
      JSON.stringify({
        appId,
        token: agoraToken,
        channel: body.channel,
        uid: body.uid,
        expireTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate token';
    console.error('[agora-token] Token generation error:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
