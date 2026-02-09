/**
 * Supabase Storage utilities
 * Direct storage operations without going through API Gateway
 */

import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  ok: boolean;
  publicUrl?: string;
  path?: string;
  error?: string;
}

/**
 * Upload a file directly to Supabase Storage
 * Uses signed upload URL for security
 */
export async function uploadToStorage(
  file: File | Blob,
  options: {
    bucket?: string;
    path?: string;
    filename?: string;
  } = {}
): Promise<UploadResult> {
  const { bucket = 'chat-attachments', path, filename } = options;

  try {
    // Get user for path generation
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    // Generate unique path
    const originalName = filename || (file instanceof File ? file.name : 'file');
    const ext = originalName.split('.').pop() || 'bin';
    const uniquePath = path || `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Create signed upload URL
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(uniquePath);

    if (signError) {
      console.error('Sign URL error:', signError);
      return { ok: false, error: signError.message };
    }

    // Upload using signed URL
    const uploadResponse = await fetch(signedData.signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });

    if (!uploadResponse.ok) {
      return { ok: false, error: `Upload failed: ${uploadResponse.statusText}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uniquePath);

    return {
      ok: true,
      publicUrl: publicUrlData.publicUrl,
      path: uniquePath,
    };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { ok: false, error: err.message || 'Upload failed' };
  }
}

/**
 * Upload an avatar image
 */
export async function uploadAvatar(file: File, userId: string): Promise<UploadResult> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;
  
  return uploadToStorage(file, {
    bucket: 'avatars',
    path,
  });
}

/**
 * Upload a chat attachment
 */
export async function uploadChatAttachment(
  file: File | Blob,
  userId: string,
  options?: { filename?: string }
): Promise<UploadResult> {
  const filename = options?.filename || (file instanceof File ? file.name : `file_${Date.now()}`);
  const ext = filename.split('.').pop() || 'bin';
  const uniquePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  
  return uploadToStorage(file, {
    bucket: 'chat-attachments',
    path: uniquePath,
    filename,
  });
}

/**
 * Upload an audio message
 */
export async function uploadVoiceMessage(
  audioBlob: Blob,
  userId: string
): Promise<UploadResult> {
  const filename = `voice_${Date.now()}.webm`;
  const path = `${userId}/${filename}`;
  
  return uploadToStorage(audioBlob, {
    bucket: 'chat-attachments',
    path,
    filename,
  });
}

/**
 * Delete a file from storage
 */
export async function deleteFromStorage(
  path: string,
  bucket: string = 'chat-attachments'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(path: string, bucket: string = 'chat-attachments'): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
