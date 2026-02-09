import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/workerUrls';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean | null;
  failure_count: number | null;
  max_retries?: number | null;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  secret?: string;
  api_key_id?: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload?: Record<string, unknown>;
  response_status: number | null;
  response_body?: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string | null;
  attempt_count?: number | null;
}

export interface TestResult {
  sent: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  duration_ms?: number;
  error?: string;
}

export const WEBHOOK_EVENTS = [
  { id: 'message.created', label: 'Message Created', description: 'When a new message is sent' },
  { id: 'message.deleted', label: 'Message Deleted', description: 'When a message is deleted' },
  { id: 'call.started', label: 'Call Started', description: 'When a call begins' },
  { id: 'call.ended', label: 'Call Ended', description: 'When a call ends' },
  { id: 'crypto.transfer', label: 'Crypto Transfer', description: 'When crypto is transferred' },
  { id: 'user.updated', label: 'User Updated', description: 'When user profile changes' },
];

export const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  'message.created': {
    id: 'msg_test_123',
    conversation_id: 'conv_test_456',
    sender_id: 'user_test_789',
    content: 'Hello, this is a test message!',
    message_type: 'text',
    created_at: new Date().toISOString(),
  },
  'message.deleted': {
    id: 'msg_test_123',
    conversation_id: 'conv_test_456',
    deleted_by: 'user_test_789',
    deleted_at: new Date().toISOString(),
  },
  'call.started': {
    id: 'call_test_123',
    conversation_id: 'conv_test_456',
    initiator_id: 'user_test_789',
    call_type: 'video',
    started_at: new Date().toISOString(),
  },
  'call.ended': {
    id: 'call_test_123',
    conversation_id: 'conv_test_456',
    duration_seconds: 120,
    ended_at: new Date().toISOString(),
  },
  'crypto.transfer': {
    id: 'tx_test_123',
    from_user_id: 'user_test_123',
    to_user_id: 'user_test_456',
    amount: 100,
    currency: 'CAMLY',
    status: 'completed',
    created_at: new Date().toISOString(),
  },
  'user.updated': {
    id: 'user_test_123',
    display_name: 'Updated Name',
    avatar_url: 'https://example.com/avatar.jpg',
    updated_at: new Date().toISOString(),
  },
  test: {
    message: 'This is a test webhook from FunChat',
    timestamp: new Date().toISOString(),
  },
};

type SuccessEnvelope<T> = { success: true; data: T };
type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: string };
type ApiResult<T> = ApiSuccess<T> | ApiError;

function getErrorMessage(json: any, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const e = json.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof e.message === 'string') return e.message;
  return fallback;
}

async function requestJson<T>(
  apiKeySecret: string,
  path: string,
  init: RequestInit
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers || {});
    headers.set('x-funchat-api-key', apiKeySecret);
    if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return { ok: false as const, error: getErrorMessage(json, res.statusText || `HTTP_${res.status}`) };
    }

    const env = json as SuccessEnvelope<T> | null;
    if (!env || typeof env !== 'object' || (env as any).success !== true) {
      return { ok: false as const, error: getErrorMessage(json, 'Request failed') };
    }

    return { ok: true as const, data: env.data };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

function unwrapResult<T>(res: ApiResult<T>): T {
  if (res.ok === false) {
    throw new Error(res.error);
  }
  return res.data;
}

export function useWebhooks(apiKeySecret?: string) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    if (!apiKeySecret) return;

    setLoading(true);
    try {
      const res = await requestJson<Webhook[]>(apiKeySecret, '/api-webhooks', { method: 'GET' });
      const data = unwrapResult(res);
      setWebhooks(data || []);
    } catch (err) {
      console.error('Error fetching webhooks:', err);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [apiKeySecret]);

  const createWebhook = useCallback(
    async (url: string, events: string[]): Promise<Webhook | null> => {
      if (!apiKeySecret) return null;

      try {
        const res = await requestJson<Webhook>(apiKeySecret, '/api-webhooks', {
          method: 'POST',
          body: JSON.stringify({ url, events }),
        });
        const data = unwrapResult(res);
        toast.success('Webhook created');
        await fetchWebhooks();
        return data;
      } catch (err: any) {
        console.error('Error creating webhook:', err);
        toast.error(err?.message || 'Failed to create webhook');
        return null;
      }
    },
    [apiKeySecret, fetchWebhooks]
  );

  const updateWebhook = useCallback(
    async (id: string, updates: { url?: string; events?: string[]; is_active?: boolean }): Promise<boolean> => {
      if (!apiKeySecret) return false;

      try {
        const res = await requestJson<Webhook>(apiKeySecret, `/api-webhooks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        unwrapResult(res);
        toast.success('Webhook updated');
        await fetchWebhooks();
        return true;
      } catch (err: any) {
        console.error('Error updating webhook:', err);
        toast.error(err?.message || 'Failed to update webhook');
        return false;
      }
    },
    [apiKeySecret, fetchWebhooks]
  );

  const deleteWebhook = useCallback(
    async (id: string): Promise<boolean> => {
      if (!apiKeySecret) return false;

      try {
        const res = await requestJson<{ deleted: true }>(apiKeySecret, `/api-webhooks/${id}`, { method: 'DELETE' });
        unwrapResult(res);
        toast.success('Webhook deleted');
        await fetchWebhooks();
        return true;
      } catch (err: any) {
        console.error('Error deleting webhook:', err);
        toast.error(err?.message || 'Failed to delete webhook');
        return false;
      }
    },
    [apiKeySecret, fetchWebhooks]
  );

  const testWebhook = useCallback(
    async (id: string, event?: string, customPayload?: Record<string, unknown>): Promise<TestResult> => {
      if (!apiKeySecret) return { sent: false, error: 'Missing API key secret' };

      setTestLoading(true);
      try {
        const res = await requestJson<TestResult>(apiKeySecret, `/api-webhooks/${id}/test`, {
          method: 'POST',
          body: JSON.stringify({ event, payload: customPayload }),
        });
        return unwrapResult(res);
      } catch (err: any) {
        console.error('Error testing webhook:', err);
        return { sent: false, error: err?.message || 'Test failed' };
      } finally {
        setTestLoading(false);
      }
    },
    [apiKeySecret]
  );

  const fetchDeliveries = useCallback(
    async (webhookId: string, options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'all' }): Promise<WebhookDelivery[]> => {
      if (!apiKeySecret) return [];

      try {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());
        if (options?.status && options.status !== 'all') params.set('status', options.status);

        const res = await requestJson<WebhookDelivery[]>(
          apiKeySecret,
          `/api-webhooks/${webhookId}/deliveries?${params.toString()}`,
          { method: 'GET' }
        );
        const deliveryData = unwrapResult(res) || [];
        setDeliveries(deliveryData);
        return deliveryData;
      } catch (err) {
        console.error('Error fetching deliveries:', err);
        toast.error('Failed to load deliveries');
        return [];
      }
    },
    [apiKeySecret]
  );

  const rotateSecret = useCallback(
    async (id: string): Promise<string | null> => {
      if (!apiKeySecret) return null;

      try {
        const res = await requestJson<{ id: string; secret: string }>(apiKeySecret, `/api-webhooks/${id}/rotate-secret`, {
          method: 'POST',
        });
        const data = unwrapResult(res);
        toast.success('Secret rotated');
        return data.secret;
      } catch (err: any) {
        console.error('Error rotating secret:', err);
        toast.error(err?.message || 'Failed to rotate secret');
        return null;
      }
    },
    [apiKeySecret]
  );

  return {
    webhooks,
    deliveries,
    loading,
    testLoading,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    fetchDeliveries,
    rotateSecret,
  };
}