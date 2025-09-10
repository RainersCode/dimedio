-- =====================================================
-- Fix Signup Issues with Credit System
-- =====================================================

-- 1. Drop any existing problematic triggers
DROP TRIGGER IF EXISTS trigger_create_user_credits ON user_roles;
DROP TRIGGER IF EXISTS trigger_create_user_credits ON auth.users;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS create_user_credits();

-- 3. Create the new manual function (if not exists)
CREATE OR REPLACE FUNCTION create_user_credits_manual(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_credits (user_id, credits, free_credits)
    VALUES (target_user_id, 0, 3) -- 3 free credits for new users
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Clean up any orphaned data that might be causing issues
-- Remove any user_credits without corresponding user_roles
DELETE FROM user_credits 
WHERE user_id NOT IN (
    SELECT user_id FROM user_roles
);

-- 5. Ensure all existing users have credits
INSERT INTO user_credits (user_id, credits, free_credits)
SELECT ur.user_id, 0, 3
FROM user_roles ur
LEFT JOIN user_credits uc ON ur.user_id = uc.user_id
WHERE uc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;