-- =============================================
-- PHASE 1 MVP: Block & Report Tables
-- =============================================

-- Bảng blocks (tạm ngừng kết nối - 5D Light Language)
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Bảng reports (gửi phản hồi - 5D Light Language)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  reported_user_id UUID,
  reported_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

-- Indexes for performance
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Enable RLS
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocks
-- Users can view their own blocks (both as blocker and blocked)
CREATE POLICY "Users can view own blocks" ON blocks
FOR SELECT TO authenticated
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

-- Users can create blocks
CREATE POLICY "Users can create blocks" ON blocks
FOR INSERT TO authenticated
WITH CHECK (blocker_id = auth.uid());

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can delete own blocks" ON blocks
FOR DELETE TO authenticated
USING (blocker_id = auth.uid());

-- RLS Policies for reports
-- Users can create reports
CREATE POLICY "Users can create reports" ON reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON reports
FOR SELECT TO authenticated
USING (reporter_id = auth.uid());