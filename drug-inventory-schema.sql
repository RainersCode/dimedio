-- =====================================================
-- Drug Inventory System for Custom Treatment Suggestions
-- =====================================================

-- 1. DRUG_CATEGORIES TABLE
-- Standard drug categories for organization
CREATE TABLE IF NOT EXISTS drug_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_lv VARCHAR(100), -- Latvian translation
    description TEXT,
    description_lv TEXT,
    parent_category_id UUID REFERENCES drug_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER_DRUG_INVENTORY TABLE
-- User's custom drug inventory
CREATE TABLE IF NOT EXISTS user_drug_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Drug Information
    drug_name VARCHAR(200) NOT NULL,
    drug_name_lv VARCHAR(200), -- Latvian name
    generic_name VARCHAR(200),
    brand_name VARCHAR(200),
    
    -- Classification
    category_id UUID REFERENCES drug_categories(id),
    dosage_form VARCHAR(100), -- tablet, capsule, syrup, injection, etc.
    strength VARCHAR(100), -- 500mg, 10mg/ml, etc.
    
    -- Medical Information
    active_ingredient TEXT,
    indications TEXT[], -- Array of conditions it treats
    contraindications TEXT[], -- Array of contraindications
    dosage_adults VARCHAR(200),
    dosage_children VARCHAR(200),
    
    -- Business Information
    stock_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2),
    supplier VARCHAR(200),
    batch_number VARCHAR(100),
    expiry_date DATE,
    
    -- System Fields
    is_active BOOLEAN DEFAULT true,
    is_prescription_only BOOLEAN DEFAULT false,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DRUG_INTERACTIONS TABLE
-- Track potential drug interactions
CREATE TABLE IF NOT EXISTS drug_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id_1 UUID REFERENCES user_drug_inventory(id) ON DELETE CASCADE NOT NULL,
    drug_id_2 UUID REFERENCES user_drug_inventory(id) ON DELETE CASCADE NOT NULL,
    interaction_type VARCHAR(50), -- major, moderate, minor
    description TEXT NOT NULL,
    severity_level INTEGER DEFAULT 1, -- 1-5 scale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(drug_id_1, drug_id_2)
);

-- 4. DIAGNOSIS_DRUG_SUGGESTIONS TABLE
-- Track which drugs were suggested for which diagnoses
CREATE TABLE IF NOT EXISTS diagnosis_drug_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE CASCADE NOT NULL,
    drug_id UUID REFERENCES user_drug_inventory(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Suggestion details
    suggested_dosage VARCHAR(200),
    treatment_duration VARCHAR(100),
    administration_notes TEXT,
    priority_level INTEGER DEFAULT 1, -- 1=primary, 2=secondary, 3=alternative
    
    -- AI vs Manual
    suggested_by_ai BOOLEAN DEFAULT false,
    manual_selection BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DRUG_USAGE_HISTORY TABLE
-- Track drug dispensing/usage
CREATE TABLE IF NOT EXISTS drug_usage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    drug_id UUID REFERENCES user_drug_inventory(id) ON DELETE CASCADE NOT NULL,
    diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
    
    -- Usage details
    quantity_dispensed INTEGER NOT NULL,
    dispensed_date TIMESTAMPTZ DEFAULT NOW(),
    patient_info JSONB, -- Store patient details if needed
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_drug_inventory_user_id ON user_drug_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_drug_inventory_category ON user_drug_inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_user_drug_inventory_active ON user_drug_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_drugs ON drug_interactions(drug_id_1, drug_id_2);
CREATE INDEX IF NOT EXISTS idx_diagnosis_drug_suggestions_diagnosis ON diagnosis_drug_suggestions(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_drug_suggestions_user ON diagnosis_drug_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_drug_usage_history_user_drug ON drug_usage_history(user_id, drug_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE drug_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_drug_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_drug_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_usage_history ENABLE ROW LEVEL SECURITY;

-- Drug categories (public read, admin write)
CREATE POLICY "Anyone can view drug categories" 
    ON drug_categories FOR SELECT 
    USING (true);

CREATE POLICY "Admins can manage drug categories" 
    ON drug_categories FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'super_admin')
        )
    );

-- User drug inventory policies
CREATE POLICY "Users can view own drug inventory" 
    ON user_drug_inventory FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drugs" 
    ON user_drug_inventory FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drugs" 
    ON user_drug_inventory FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drugs" 
    ON user_drug_inventory FOR DELETE 
    USING (auth.uid() = user_id);

-- Drug interactions policies
CREATE POLICY "Users can view interactions for their drugs" 
    ON drug_interactions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_drug_inventory udi1, user_drug_inventory udi2
            WHERE (udi1.id = drug_interactions.drug_id_1 OR udi1.id = drug_interactions.drug_id_2)
            AND (udi2.id = drug_interactions.drug_id_1 OR udi2.id = drug_interactions.drug_id_2)
            AND udi1.user_id = auth.uid()
            AND udi2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage interactions for their drugs" 
    ON drug_interactions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_drug_inventory udi1, user_drug_inventory udi2
            WHERE udi1.id = drug_interactions.drug_id_1
            AND udi2.id = drug_interactions.drug_id_2
            AND udi1.user_id = auth.uid()
            AND udi2.user_id = auth.uid()
        )
    );

-- Diagnosis drug suggestions policies
CREATE POLICY "Users can view own diagnosis drug suggestions" 
    ON diagnosis_drug_suggestions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnosis drug suggestions" 
    ON diagnosis_drug_suggestions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diagnosis drug suggestions" 
    ON diagnosis_drug_suggestions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Drug usage history policies
CREATE POLICY "Users can view own drug usage history" 
    ON drug_usage_history FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drug usage history" 
    ON drug_usage_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_drug_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_drug_categories_updated_at 
    BEFORE UPDATE ON drug_categories 
    FOR EACH ROW EXECUTE FUNCTION update_drug_updated_at_column();

CREATE TRIGGER update_user_drug_inventory_updated_at 
    BEFORE UPDATE ON user_drug_inventory 
    FOR EACH ROW EXECUTE FUNCTION update_drug_updated_at_column();

-- Function to automatically update stock after dispensing
CREATE OR REPLACE FUNCTION update_drug_stock_after_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_drug_inventory 
    SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity_dispensed)
    WHERE id = NEW.drug_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update stock after drug usage
CREATE TRIGGER trigger_update_drug_stock
    AFTER INSERT ON drug_usage_history
    FOR EACH ROW EXECUTE FUNCTION update_drug_stock_after_usage();

-- =====================================================
-- SAMPLE DRUG CATEGORIES
-- =====================================================

-- Insert common drug categories
INSERT INTO drug_categories (name, name_lv, description, description_lv) VALUES
('Antibiotics', 'Antibiotikas', 'Medications that fight bacterial infections', 'Medikamenti, kas apkarot bakteriālas infekcijas'),
('Analgesics', 'Analgētiķi', 'Pain relief medications', 'Sāpju remdē medikamenti'),
('Anti-inflammatory', 'Pretiekaisuma', 'Medications that reduce inflammation', 'Medikamenti, kas samazina iekaisumu'),
('Cardiovascular', 'Sirds un asinsvadu', 'Heart and blood vessel medications', 'Sirds un asinsvadu medikamenti'),
('Respiratory', 'Elpošanas sistēmas', 'Lung and breathing medications', 'Plaušu un elpošanas medikamenti'),
('Gastrointestinal', 'Gremošanas sistēmas', 'Digestive system medications', 'Gremošanas sistēmas medikamenti'),
('Dermatological', 'Dermataloģiskie', 'Skin condition medications', 'Ādas slimību medikamenti'),
('Neurological', 'Neirolģiskie', 'Nervous system medications', 'Nervu sistēmas medikamenti')
ON CONFLICT DO NOTHING;

-- =====================================================
-- PREMIUM FEATURES (Credit System Integration)
-- =====================================================

-- Function to check if user has drug inventory access (premium feature)
CREATE OR REPLACE FUNCTION user_has_drug_inventory_access(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_credits INTEGER := 0;
BEGIN
    SELECT COALESCE(credits, 0) + COALESCE(free_credits, 0) 
    INTO user_credits 
    FROM user_credits 
    WHERE user_id = target_user_id;
    
    -- Users need at least 1 credit to access drug inventory
    RETURN COALESCE(user_credits, 0) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy to restrict drug inventory access to users with credits
CREATE POLICY "Drug inventory requires credits" 
    ON user_drug_inventory FOR ALL 
    USING (user_has_drug_inventory_access(user_id))
    WITH CHECK (user_has_drug_inventory_access(user_id));