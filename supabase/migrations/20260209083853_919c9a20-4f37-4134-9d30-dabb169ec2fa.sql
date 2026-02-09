-- Bảng sticker_packs
CREATE TABLE public.sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  preview_url TEXT,
  author TEXT,
  is_premium BOOLEAN DEFAULT false,
  price NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAMLY',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng stickers
CREATE TABLE public.stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  emoji TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng user_sticker_packs (stickers mà user sở hữu)
CREATE TABLE public.user_sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pack_id UUID NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pack_id)
);

-- RLS Policies
ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sticker_packs ENABLE ROW LEVEL SECURITY;

-- Everyone can view active sticker packs
CREATE POLICY "View active packs" ON public.sticker_packs
FOR SELECT USING (is_active = true);

-- Everyone can view stickers
CREATE POLICY "View stickers" ON public.stickers
FOR SELECT USING (true);

-- Users can view own sticker packs
CREATE POLICY "View own sticker packs" ON public.user_sticker_packs
FOR SELECT USING (user_id = auth.uid());

-- Users can acquire sticker packs
CREATE POLICY "Acquire sticker packs" ON public.user_sticker_packs
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can remove sticker packs
CREATE POLICY "Remove sticker packs" ON public.user_sticker_packs
FOR DELETE USING (user_id = auth.uid());

-- Seed 5 starter packs with placeholder URLs
INSERT INTO public.sticker_packs (id, name, name_en, description, preview_url, is_premium, price, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'Biểu cảm vui', 'Happy Emotions', 'Bộ sticker biểu cảm vui vẻ', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f600.png', false, 0, 1),
('22222222-2222-2222-2222-222222222222', 'Động vật dễ thương', 'Cute Animals', 'Mèo, chó, thỏ siêu dễ thương', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f431.png', false, 0, 2),
('33333333-3333-3333-3333-333333333333', 'Chúc mừng', 'Celebrations', 'Sticker cho các dịp lễ', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f389.png', false, 0, 3),
('44444444-4444-4444-4444-444444444444', 'Công việc', 'Work Life', 'Sticker cho công việc hàng ngày', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4bc.png', false, 0, 4),
('55555555-5555-5555-5555-555555555555', 'Tình yêu', 'Love & Romance', 'Sticker tình yêu lãng mạn', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2764-fe0f.png', true, 10, 5);

-- Seed stickers for each pack
-- Happy Emotions pack
INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'Cười tươi', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f600.png', ':grinning:', 1),
('11111111-1111-1111-1111-111111111111', 'Cười lớn', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f603.png', ':smiley:', 2),
('11111111-1111-1111-1111-111111111111', 'Cười híp mắt', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f604.png', ':smile:', 3),
('11111111-1111-1111-1111-111111111111', 'Cười ngoác', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f601.png', ':grin:', 4),
('11111111-1111-1111-1111-111111111111', 'Cười ra nước mắt', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f602.png', ':joy:', 5),
('11111111-1111-1111-1111-111111111111', 'Nháy mắt', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f609.png', ':wink:', 6);

-- Cute Animals pack
INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
('22222222-2222-2222-2222-222222222222', 'Mèo', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f431.png', ':cat:', 1),
('22222222-2222-2222-2222-222222222222', 'Chó', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f436.png', ':dog:', 2),
('22222222-2222-2222-2222-222222222222', 'Thỏ', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f430.png', ':rabbit:', 3),
('22222222-2222-2222-2222-222222222222', 'Gấu', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f43b.png', ':bear:', 4),
('22222222-2222-2222-2222-222222222222', 'Khỉ', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f435.png', ':monkey:', 5),
('22222222-2222-2222-2222-222222222222', 'Gấu trúc', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f43c.png', ':panda:', 6);

-- Celebrations pack
INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
('33333333-3333-3333-3333-333333333333', 'Tiệc tùng', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f389.png', ':tada:', 1),
('33333333-3333-3333-3333-333333333333', 'Pháo hoa', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f386.png', ':fireworks:', 2),
('33333333-3333-3333-3333-333333333333', 'Bóng bay', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f388.png', ':balloon:', 3),
('33333333-3333-3333-3333-333333333333', 'Bánh sinh nhật', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f382.png', ':cake:', 4),
('33333333-3333-3333-3333-333333333333', 'Quà tặng', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f381.png', ':gift:', 5),
('33333333-3333-3333-3333-333333333333', 'Ly rượu', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f942.png', ':champagne:', 6);

-- Work Life pack
INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
('44444444-4444-4444-4444-444444444444', 'Cặp táp', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4bc.png', ':briefcase:', 1),
('44444444-4444-4444-4444-444444444444', 'Laptop', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4bb.png', ':laptop:', 2),
('44444444-4444-4444-4444-444444444444', 'Cà phê', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2615.png', ':coffee:', 3),
('44444444-4444-4444-4444-444444444444', 'OK', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f44d.png', ':thumbsup:', 4),
('44444444-4444-4444-4444-444444444444', 'Suy nghĩ', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f914.png', ':thinking:', 5),
('44444444-4444-4444-4444-444444444444', 'Hoàn thành', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2705.png', ':check:', 6);

-- Love & Romance pack (Premium)
INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
('55555555-5555-5555-5555-555555555555', 'Trái tim', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2764-fe0f.png', ':heart:', 1),
('55555555-5555-5555-5555-555555555555', 'Trái tim hồng', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f497.png', ':growing_heart:', 2),
('55555555-5555-5555-5555-555555555555', 'Mắt tim', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f60d.png', ':heart_eyes:', 3),
('55555555-5555-5555-5555-555555555555', 'Hôn', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f618.png', ':kiss:', 4),
('55555555-5555-5555-5555-555555555555', 'Hoa hồng', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f339.png', ':rose:', 5),
('55555555-5555-5555-5555-555555555555', 'Cặp đôi', 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f491.png', ':couple:', 6);