-- =====================================================
-- Clean Installation of Credits System
-- =====================================================

-- 1. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
DROP POLICY IF EXISTS "Admins can update all credits" ON user_credits;
DROP POLICY IF EXISTS "System can insert credits" ON user_credits;

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON credit_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON credit_transactions;

DROP POLICY IF EXISTS "Users can view own rate limits" ON diagnosis_rate_limits;
DROP POLICY IF EXISTS "Users can update own rate limits" ON diagnosis_rate_limits;
DROP POLICY IF EXISTS "System can insert rate limits" ON diagnosis_rate_limits;

-- 2. Create tables (will skip if already exist)
CREATE TABLE IF NOT EXISTS user_credits (
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

CREATE TABLE IF NOT EXISTS credit_transactions (
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

CREATE TABLE IF NOT EXISTS diagnosis_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- 3. Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rate_limits_user_date ON diagnosis_rate_limits(user_id, date);

-- 5. Create fresh policies
CREATE POLICY "Users can view own credits" 
    ON user_credits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits" 
    ON user_credits FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can update own credits" 
    ON user_credits FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all credits" 
    ON user_credits FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "System can insert credits" 
    ON user_credits FOR INSERT 
    WITH CHECK (true);

-- Credit transactions policies
CREATE POLICY "Users can view own transactions" 
    ON credit_transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" 
    ON credit_transactions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "System can insert transactions" 
    ON credit_transactions FOR INSERT 
    WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Users can view own rate limits" 
    ON diagnosis_rate_limits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits" 
    ON diagnosis_rate_limits FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert rate limits" 
    ON diagnosis_rate_limits FOR INSERT 
    WITH CHECK (true);

-- 6. Create helper functions
CREATE OR REPLACE FUNCTION create_user_credits_manual(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_credits (user_id, credits, free_credits)
    VALUES (target_user_id, 0, 3)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create existing users credits if they don't have any
INSERT INTO user_credits (user_id, credits, free_credits)
SELECT ur.user_id, 0, 3
FROM user_roles ur
LEFT JOIN user_credits uc ON ur.user_id = uc.user_id
WHERE uc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;