-- =====================================================
-- Force Clean Credits System Installation
-- =====================================================

-- First, let's see what exists
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('user_credits', 'credit_transactions', 'diagnosis_rate_limits');

-- Drop the tables completely (this will also drop all policies)
DROP TABLE IF EXISTS diagnosis_rate_limits CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE; 
DROP TABLE IF EXISTS user_credits CASCADE;

-- Now recreate everything from scratch
CREATE TABLE user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Credit balance
    credits INTEGER DEFAULT 0 NOT NULL,
    free_credits INTEGER DEFAULT 3 NOT NULL,
    
    -- Usage tracking
    total_used INTEGER DEFAULT 0 NOT NULL,
    last_used_at TIMESTAMPTZ,
    
    -- Rate limiting (per day)
    daily_usage INTEGER DEFAULT 0 NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    
    payment_id VARCHAR(255),
    payment_status VARCHAR(50),
    admin_id UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);

-- Create policies (fresh start, no conflicts)
CREATE POLICY "Users can view own credits" 
    ON user_credits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits" 
    ON user_credits FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert credits" 
    ON user_credits FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users can view own transactions" 
    ON credit_transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" 
    ON credit_transactions FOR INSERT 
    WITH CHECK (true);

-- Helper function
CREATE OR REPLACE FUNCTION create_user_credits_manual(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_credits (user_id, credits, free_credits)
    VALUES (target_user_id, 0, 3)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Give existing users credits
INSERT INTO user_credits (user_id, credits, free_credits)
SELECT ur.user_id, 0, 3
FROM user_roles ur
ON CONFLICT (user_id) DO NOTHING;