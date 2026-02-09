/**
 * FunChat API Module
 * 
 * Centralized API client for backend communication through Cloudflare Worker.
 * Core chat operations now use Supabase direct (see src/lib/supabaseChat.ts):
 * - conversations, messages, reactions, read receipts
 * - crypto transactions
 * 
 * This API layer is used for: auth, rewards, API keys, AI, user profile operations.
 */

import { ApiClient } from './apiClient';
import { supabase } from '@/integrations/supabase/client';

// API modules
import { createAuthApi } from './modules/auth';
import { createUsersApi } from './modules/users';
import { createRewardsApi } from './modules/rewards';
import { createApiKeysApi } from './modules/apiKeys';
import { createAIApi } from './modules/ai';
import { API_BASE_URL } from '@/config/workerUrls';

// Debug mode in development
const DEBUG = import.meta.env.DEV;

// Create the API client instance
const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
  onUnauthorized: () => {
    console.warn('[API] Session expired, signing out...');
    supabase.auth.signOut();
  },
  onError: (error) => {
    console.error('[API] Error:', error.code, error.message);
  },
  debug: DEBUG,
});

// Export API modules
// Note: chat and crypto have been migrated to supabaseChat.ts (Supabase direct)
export const api = {
  auth: createAuthApi(apiClient),
  users: createUsersApi(apiClient),
  rewards: createRewardsApi(apiClient),
  apiKeys: createApiKeysApi(apiClient),
  ai: createAIApi(apiClient),
};

// Export types
export * from './types';
export type { ApiKey, CreateApiKeyRequest, CreateApiKeyResponse, ApiKeyListResponse } from './modules/apiKeys';

// Export client for advanced usage
export { apiClient };
