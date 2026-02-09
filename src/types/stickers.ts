export interface StickerPack {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  preview_url: string | null;
  author: string | null;
  is_premium: boolean;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Sticker {
  id: string;
  pack_id: string;
  name: string;
  url: string;
  emoji: string | null;
  sort_order: number;
  created_at: string;
}

export interface UserStickerPack {
  id: string;
  user_id: string;
  pack_id: string;
  acquired_at: string;
}

export interface StickerMessage {
  sticker_id: string;
  pack_id: string;
  url: string;
  name: string;
}
