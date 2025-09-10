-- =====================================================
-- User Credits System for Diagnosis Protection
-- =====================================================

-- 1. USER_CREDITS TABLE
-- Track user credits for diagnosis usage
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Credit balance
    credits INTEGER DEFAULT 0 NOT NULL,
    free_credits INTEGER DEFAULT 3 NOT NULL, -- Free credits for new users
    
    -- Usage tracking
    total_used INTEGER DEFAULT 0 NOT NULL,
    last_used_at TIMESTAMPTZ,
    
    -- Rate limiting (per day)
    daily_usage INTEGER DEFAULT 0 NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREDIT_TRANSACTIONS TABLE
-- Track all credit purchases and usage
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Transaction details
    type VARCHAR(20) NOT NULL, -- 'purchase', 'usage', 'refund', 'admin_grant'
    amount INTEGER NOT NULL, -- positive for adding, negative for using
    description TEXT,
    
    -- Purchase related (for future implementation)
    payment_id VARCHAR(255),
    payment_status VARCHAR(50),
    
    -- Admin related
    admin_id UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DIAGNOSIS_RATE_LIMITS TABLE
-- Track daily usage for rate limiting
CREATE TABLE IF NOT EXISTS diagnosis_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rate_limits_user_date ON diagnosis_rate_limits(user_id, date);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_rate_limits ENABLE ROW LEVEL SECURITY;

-- User credits policies
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

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Function to create initial credits for new users (called manually by application)
CREATE OR REPLACE FUNCTION create_user_credits_manual(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_credits (user_id, credits, free_credits)
    VALUES (target_user_id, 0, 3) -- 3 free credits for new users
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: We removed the automatic trigger to avoid conflicts with user signup
-- Credits will be created automatically when first accessed via the CreditsService

-- Function to reset daily usage counter
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_reset_date < CURRENT_DATE THEN
        NEW.daily_usage = 0;
        NEW.last_reset_date = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-reset daily usage
CREATE OR REPLACE TRIGGER trigger_reset_daily_usage
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION reset_daily_usage();

-- Function to log credit transactions
CREATE OR REPLACE FUNCTION log_credit_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.credits != NEW.credits THEN
        INSERT INTO credit_transactions (
            user_id, 
            type, 
            amount, 
            description
        ) VALUES (
            NEW.user_id,
            CASE 
                WHEN NEW.credits > OLD.credits THEN 'admin_grant'
                ELSE 'usage'
            END,
            NEW.credits - OLD.credits,
            CASE 
                WHEN NEW.credits > OLD.credits THEN 'Credits added'
                ELSE 'Diagnosis usage'
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log all credit changes
CREATE OR REPLACE TRIGGER trigger_log_credit_transaction
    AFTER UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION log_credit_transaction();