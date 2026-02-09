/**
 * Users API Module
 * Endpoints for user search and profile operations
 */

import { ApiClient } from '../apiClient';
import { ApiResponse, ProfileResponse } from '../types';

export interface UserSearchResponse {
  users: ProfileResponse[];
}

export function createUsersApi(client: ApiClient) {
  return {
    /**
     * Search users by username/display_name/phone (server-side).
     */
    async search(query: string): Promise<ApiResponse<UserSearchResponse>> {
      return client.get<UserSearchResponse>(`/v1/users/search?q=${encodeURIComponent(query)}`);
    },

    /**
     * Get a user's public profile by ID
     */
    async getProfile(userId: string): Promise<ApiResponse<ProfileResponse>> {
      return client.get<ProfileResponse>(`/v1/users/${userId}`);
    },

    /**
     * Get multiple users' profiles by IDs
     */
    async getProfiles(userIds: string[]): Promise<ApiResponse<ProfileResponse[]>> {
      return client.post<ProfileResponse[]>('/v1/users/batch', { user_ids: userIds });
    },

    /**
     * Check if a username is available
     */
    async checkUsername(username: string): Promise<ApiResponse<{ available: boolean; normalized?: string; error?: string }>> {
      return client.get<{ available: boolean; normalized?: string; error?: string }>(
        `/v1/users/check-username?u=${encodeURIComponent(username)}`
      );
    },

    /**
     * Check if an email is available (signup)
     */
    async checkEmail(email: string): Promise<ApiResponse<{ success: boolean; valid: boolean; normalized?: string; available: boolean | null; error?: string; message?: string }>> {
      return client.get<{ success: boolean; valid: boolean; normalized?: string; available: boolean | null; error?: string; message?: string }>(
        `/v1/users/check-email?e=${encodeURIComponent(email)}`
      );
    },

    /**
     * Update user's online status
     */
    async updateStatus(status: 'online' | 'away' | 'offline'): Promise<ApiResponse<void>> {
      return client.patch<void>('/v1/users/status', { status });
    },

    /**
     * Update last seen timestamp
     */
    async updateLastSeen(): Promise<ApiResponse<void>> {
      return client.patch<void>('/v1/users/last-seen');
    },
  };
}
