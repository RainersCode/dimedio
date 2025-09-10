-- =====================================================
-- Admin Roles Schema Extension for Dimedio
-- =====================================================

-- 1. USER_ROLES TABLE
-- Stores user roles and permissions
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    permissions JSONB DEFAULT '{}',
    
    -- Role assignment tracking
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROLE_CHANGE_HISTORY TABLE  
-- Track all role changes for audit purposes
CREATE TABLE IF NOT EXISTS role_change_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    old_role VARCHAR(50),
    new_role VARCHAR(50) NOT NULL,
    reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_change_history ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view own role" 
    ON user_roles FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
    ON user_roles FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can update user roles" 
    ON user_roles FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can insert user roles" 
    ON user_roles FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

-- Role change history policies
CREATE POLICY "Admins can view role history" 
    ON role_change_history FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can insert role history" 
    ON role_change_history FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically create user role on registration
CREATE OR REPLACE FUNCTION create_user_role()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user role on user registration
CREATE TRIGGER create_user_role_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_role();

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role != NEW.role THEN
        INSERT INTO role_change_history (user_id, changed_by, old_role, new_role)
        VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log role changes
CREATE TRIGGER log_role_change_trigger
    AFTER UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION log_role_change();

-- Updated timestamp trigger
CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS FOR ROLE CHECKING
-- =====================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS VARCHAR AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role 
    FROM user_roles 
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_change_history_user_id ON role_change_history(user_id);

-- =====================================================
-- INITIAL ADMIN SETUP (Optional)
-- =====================================================

-- Uncomment and replace with your email to make yourself super admin
-- INSERT INTO user_roles (user_id, role, assigned_by, assigned_at)
-- SELECT id, 'super_admin', id, NOW()
-- FROM auth.users 
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- =====================================================
-- ROLE DEFINITIONS
-- =====================================================

/*
Role Hierarchy:
- user: Regular user (default)
- moderator: Can moderate content, limited admin functions
- admin: Full admin access except user role changes
- super_admin: Full system access including role management

Permissions:
- user: Use diagnosis system, view own data
- moderator: + moderate content, view user stats
- admin: + user management, system settings
- super_admin: + role management, system administration
*/