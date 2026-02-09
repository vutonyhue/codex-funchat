-- =============================================
-- Phase 1 MVP: Ghim tin nhắn (Pin) + Tìm kiếm (Search)
-- =============================================

-- 1. Thêm cột pinned_at và pinned_by vào bảng messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_by UUID DEFAULT NULL;

-- 2. Index cho pinned messages (partial index - chỉ index những tin đã ghim)
CREATE INDEX IF NOT EXISTS idx_messages_pinned 
ON public.messages(conversation_id, pinned_at DESC) 
WHERE pinned_at IS NOT NULL;

-- 3. Full-text search index cho nội dung tin nhắn
-- Sử dụng 'simple' config vì Vietnamese không có built-in support
CREATE INDEX IF NOT EXISTS idx_messages_content_search 
ON public.messages USING gin(to_tsvector('simple', COALESCE(content, '')));

-- 4. Thêm cột edited_at để track thời điểm sửa tin nhắn (chuẩn bị cho Nhóm 3)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;