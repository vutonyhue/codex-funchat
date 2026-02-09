import { supabase } from "@/integrations/supabase/client";

const DEFAULT_CT = "application/octet-stream";

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function inferContentType(file: File): string {
  if (file.type && file.type.trim()) return file.type;

  const ext = extOf(file.name);
  const map: Record<string, string> = {
    // images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    heic: "image/heic",
    heif: "image/heif",

    // video
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    m4v: "video/x-m4v",

    // audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",

    // docs
    pdf: "application/pdf",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // archives
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",

    // android
    apk: "application/vnd.android.package-archive",
  };

  return map[ext] || DEFAULT_CT;
}

export type UploadResult = {
  publicUrl: string;
  contentType: string;
  key: string;
};

export async function uploadChatAttachment(file: File): Promise<UploadResult> {
  const contentType = inferContentType(file);

  // Generate unique path
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const ext = extOf(file.name) || 'bin';
  const path = `${timestamp}-${randomId}.${ext}`;

  // Upload directly to Supabase Storage
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "upload_failed");
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(data.path);

  return { 
    publicUrl: urlData.publicUrl, 
    contentType, 
    key: data.path 
  };
}
