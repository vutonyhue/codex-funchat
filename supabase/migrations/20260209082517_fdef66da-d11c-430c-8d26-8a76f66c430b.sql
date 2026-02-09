-- =============================================
-- PHASE 1 MVP: Red Envelope (Lì xì) Tables
-- =============================================

-- Bảng red_envelopes (lì xì)
CREATE TABLE public.red_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'CAMLY',
  total_recipients INT NOT NULL CHECK (total_recipients > 0),
  distribution_type TEXT NOT NULL DEFAULT 'random' CHECK (distribution_type IN ('random', 'equal')),
  message TEXT,
  remaining_amount NUMERIC NOT NULL,
  claimed_count INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'fully_claimed', 'refunded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng red_envelope_claims (lịch sử nhận lì xì)
CREATE TABLE public.red_envelope_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES red_envelopes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(envelope_id, user_id)
);

-- Indexes
CREATE INDEX idx_red_envelopes_conversation ON red_envelopes(conversation_id);
CREATE INDEX idx_red_envelopes_sender ON red_envelopes(sender_id);
CREATE INDEX idx_red_envelopes_status ON red_envelopes(status);
CREATE INDEX idx_red_envelopes_expires ON red_envelopes(expires_at) WHERE status = 'active';
CREATE INDEX idx_red_envelope_claims_envelope ON red_envelope_claims(envelope_id);
CREATE INDEX idx_red_envelope_claims_user ON red_envelope_claims(user_id);

-- Enable RLS
ALTER TABLE red_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_envelope_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for red_envelopes
-- Members of conversation can view envelopes
CREATE POLICY "View envelopes in conversation" ON red_envelopes
FOR SELECT TO authenticated
USING (conversation_id IN (SELECT get_my_conversation_ids()));

-- Users can create envelopes in their conversations
CREATE POLICY "Create own envelope" ON red_envelopes
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT get_my_conversation_ids()));

-- Users can update their own envelopes (for refund)
CREATE POLICY "Update own envelope" ON red_envelopes
FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

-- RLS Policies for red_envelope_claims
-- Members can view claims in their conversations
CREATE POLICY "View claims in my conversations" ON red_envelope_claims
FOR SELECT TO authenticated
USING (envelope_id IN (
  SELECT id FROM red_envelopes 
  WHERE conversation_id IN (SELECT get_my_conversation_ids())
));

-- Users can claim envelopes
CREATE POLICY "Claim envelope" ON red_envelope_claims
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  envelope_id IN (
    SELECT id FROM red_envelopes 
    WHERE conversation_id IN (SELECT get_my_conversation_ids())
    AND status = 'active'
  )
);