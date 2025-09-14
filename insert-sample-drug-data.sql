-- Insert Sample Drug Data
-- Replace '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8' with your actual user ID
-- Replace '1cab2c80-049d-4f18-8e9f-c169cf2245d2' with your actual organization ID

-- =====================================================
-- ORGANIZATION DRUGS (20 drugs)
-- =====================================================

INSERT INTO organization_drug_inventory (
    organization_id,
    drug_name,
    drug_name_lv,
    generic_name,
    brand_name,
    dosage_form,
    strength,
    active_ingredient,
    indications,
    contraindications,
    dosage_adults,
    dosage_children,
    stock_quantity,
    unit_price,
    supplier,
    batch_number,
    expiry_date,
    is_prescription_only,
    notes,
    created_by,
    updated_by
) VALUES
('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Amoxicillin', 'Amoksicilīns', 'Amoxicillin', 'Amoxil', 'Capsule', '500mg', 'Amoxicillin trihydrate', ARRAY['bacterial infections', 'respiratory tract infections', 'urinary tract infections'], ARRAY['penicillin allergy', 'severe kidney disease'], '500mg every 8 hours', '20-40mg/kg/day divided in 3 doses', 150, 2.50, 'PharmaCorp Ltd', 'AMX2024-001', '2025-12-31', true, 'Store in cool, dry place', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Paracetamol', 'Paracetamols', 'Acetaminophen', 'Tylenol', 'Tablet', '500mg', 'Paracetamol', ARRAY['pain relief', 'fever reduction', 'headache'], ARRAY['severe liver disease', 'alcohol dependence'], '500mg-1g every 4-6 hours, max 4g/day', '10-15mg/kg every 4-6 hours', 300, 0.15, 'MediSupply Co', 'PCM2024-145', '2026-06-30', false, 'Over-the-counter medication', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Ibuprofen', 'Ibuprofēns', 'Ibuprofen', 'Advil', 'Tablet', '400mg', 'Ibuprofen', ARRAY['pain relief', 'inflammation', 'fever', 'arthritis'], ARRAY['peptic ulcer', 'severe heart failure', 'severe kidney disease'], '400mg every 6-8 hours, max 2.4g/day', '5-10mg/kg every 6-8 hours', 200, 0.25, 'HealthPharma Inc', 'IBU2024-089', '2025-11-15', false, 'Take with food to reduce stomach irritation', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Omeprazole', 'Omeprazols', 'Omeprazole', 'Prilosec', 'Capsule', '20mg', 'Omeprazole magnesium', ARRAY['gastroesophageal reflux disease', 'peptic ulcer', 'gastritis'], ARRAY['hypersensitivity to omeprazole'], '20-40mg once daily', '0.7-3.3mg/kg once daily', 100, 1.75, 'GastroPharma Ltd', 'OMP2024-067', '2025-09-20', true, 'Take before meals', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Lisinopril', 'Lisinopirils', 'Lisinopril', 'Zestril', 'Tablet', '10mg', 'Lisinopril dihydrate', ARRAY['hypertension', 'heart failure', 'post-myocardial infarction'], ARRAY['pregnancy', 'angioedema', 'severe kidney disease'], '10-40mg once daily', '0.07mg/kg once daily', 120, 0.45, 'CardioMeds Inc', 'LIS2024-123', '2025-10-31', true, 'Monitor blood pressure regularly', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Metformin', 'Metformīns', 'Metformin', 'Glucophage', 'Tablet', '500mg', 'Metformin hydrochloride', ARRAY['type 2 diabetes', 'polycystic ovary syndrome'], ARRAY['severe kidney disease', 'diabetic ketoacidosis', 'severe liver disease'], '500mg twice daily with meals', '500mg twice daily (age >10 years)', 180, 0.30, 'DiabetesCare Pharma', 'MET2024-094', '2025-12-15', true, 'Take with meals to reduce GI side effects', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Atorvastatin', 'Atorvastatīns', 'Atorvastatin', 'Lipitor', 'Tablet', '20mg', 'Atorvastatin calcium', ARRAY['high cholesterol', 'cardiovascular disease prevention'], ARRAY['pregnancy', 'breastfeeding', 'active liver disease'], '20-80mg once daily', '10-20mg once daily (age >10 years)', 90, 0.85, 'CholesterolMeds Ltd', 'ATO2024-156', '2026-01-28', true, 'Monitor liver function tests', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Salbutamol', 'Salbutamols', 'Albuterol', 'Ventolin', 'Inhaler', '100mcg/dose', 'Salbutamol sulfate', ARRAY['asthma', 'chronic obstructive pulmonary disease', 'bronchospasm'], ARRAY['hypersensitivity to salbutamol'], '1-2 puffs every 4-6 hours as needed', '1 puff every 4-6 hours as needed', 75, 8.50, 'RespiraPharma Inc', 'SAL2024-078', '2025-08-10', true, 'Prime inhaler before first use', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Cetirizine', 'Cetirizīns', 'Cetirizine', 'Zyrtec', 'Tablet', '10mg', 'Cetirizine hydrochloride', ARRAY['allergic rhinitis', 'urticaria', 'seasonal allergies'], ARRAY['severe kidney disease', 'hypersensitivity to cetirizine'], '10mg once daily', '5-10mg once daily (age >2 years)', 160, 0.35, 'AllergyMeds Co', 'CET2024-112', '2025-07-22', false, 'May cause drowsiness', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Simvastatin', 'Simvastatīns', 'Simvastatin', 'Zocor', 'Tablet', '40mg', 'Simvastatin', ARRAY['hypercholesterolemia', 'cardiovascular disease prevention'], ARRAY['pregnancy', 'active liver disease', 'concurrent use with certain drugs'], '20-80mg once daily in the evening', '10-40mg once daily (age >10 years)', 110, 0.55, 'StatinPharma Ltd', 'SIM2024-201', '2025-11-05', true, 'Take in the evening for best effect', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Pantoprazole', 'Pantoprazols', 'Pantoprazole', 'Protonix', 'Tablet', '40mg', 'Pantoprazole sodium', ARRAY['gastroesophageal reflux disease', 'peptic ulcer', 'Zollinger-Ellison syndrome'], ARRAY['hypersensitivity to pantoprazole'], '40mg once daily', '20-40mg once daily (age >5 years)', 85, 1.25, 'GastroHealth Pharma', 'PAN2024-189', '2025-10-12', true, 'Take before breakfast', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Amlodipine', 'Amlodipīns', 'Amlodipine', 'Norvasc', 'Tablet', '5mg', 'Amlodipine besylate', ARRAY['hypertension', 'angina pectoris'], ARRAY['severe hypotension', 'cardiogenic shock'], '2.5-10mg once daily', '2.5-5mg once daily (age >6 years)', 140, 0.65, 'HypertenMeds Inc', 'AML2024-167', '2025-09-18', true, 'Monitor for ankle swelling', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Loratadine', 'Loratadīns', 'Loratadine', 'Claritin', 'Tablet', '10mg', 'Loratadine', ARRAY['allergic rhinitis', 'chronic urticaria', 'seasonal allergies'], ARRAY['hypersensitivity to loratadine'], '10mg once daily', '5-10mg once daily (age >2 years)', 200, 0.40, 'NonDrowsy Pharma', 'LOR2024-134', '2026-02-14', false, 'Non-sedating antihistamine', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Metoprolol', 'Metoprolols', 'Metoprolol', 'Lopressor', 'Tablet', '50mg', 'Metoprolol tartrate', ARRAY['hypertension', 'angina', 'heart failure', 'post-myocardial infarction'], ARRAY['severe bradycardia', 'cardiogenic shock', 'severe asthma'], '50-200mg twice daily', '1-6mg/kg/day divided in 2 doses', 125, 0.75, 'BetaBlocker Pharma', 'MET2024-178', '2025-12-08', true, 'Do not stop abruptly', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Furosemide', 'Furosemīds', 'Furosemide', 'Lasix', 'Tablet', '40mg', 'Furosemide', ARRAY['heart failure', 'edema', 'hypertension'], ARRAY['anuria', 'severe electrolyte depletion'], '20-80mg once or twice daily', '1-2mg/kg once or twice daily', 95, 0.35, 'DiureticMeds Ltd', 'FUR2024-143', '2025-08-25', true, 'Monitor electrolytes and kidney function', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Warfarin', 'Varfarīns', 'Warfarin', 'Coumadin', 'Tablet', '5mg', 'Warfarin sodium', ARRAY['atrial fibrillation', 'deep vein thrombosis', 'pulmonary embolism'], ARRAY['active bleeding', 'pregnancy', 'severe liver disease'], '2-10mg daily (individualized)', '0.1-0.3mg/kg daily (individualized)', 60, 0.50, 'AnticoagPharma Inc', 'WAR2024-092', '2025-07-30', true, 'Requires regular INR monitoring', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Levothyroxine', 'Levotiroksīns', 'Levothyroxine', 'Synthroid', 'Tablet', '100mcg', 'Levothyroxine sodium', ARRAY['hypothyroidism', 'thyroid cancer', 'goiter'], ARRAY['untreated adrenal insufficiency', 'acute myocardial infarction'], '25-200mcg once daily', '25-150mcg once daily (age dependent)', 105, 0.80, 'ThyroidMeds Co', 'LEV2024-156', '2025-11-20', true, 'Take on empty stomach, 30-60 min before breakfast', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Clopidogrel', 'Klopidogrels', 'Clopidogrel', 'Plavix', 'Tablet', '75mg', 'Clopidogrel bisulfate', ARRAY['acute coronary syndrome', 'stroke prevention', 'peripheral artery disease'], ARRAY['active bleeding', 'severe liver disease'], '75mg once daily', '0.2mg/kg once daily', 80, 2.25, 'AntiplateletPharma Ltd', 'CLO2024-134', '2025-09-15', true, 'Monitor for bleeding', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Prednisone', 'Prednizons', 'Prednisone', 'Deltasone', 'Tablet', '10mg', 'Prednisone', ARRAY['inflammatory conditions', 'autoimmune disorders', 'allergic reactions'], ARRAY['systemic fungal infections', 'live vaccine administration'], '5-60mg daily (condition dependent)', '0.5-2mg/kg daily', 70, 0.25, 'SteroidMeds Inc', 'PRE2024-167', '2025-10-05', true, 'Taper dose when discontinuing', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8'),

('1cab2c80-049d-4f18-8e9f-c169cf2245d2', 'Azithromycin', 'Azitromicīns', 'Azithromycin', 'Zithromax', 'Tablet', '250mg', 'Azithromycin dihydrate', ARRAY['bacterial infections', 'respiratory tract infections', 'skin infections'], ARRAY['macrolide allergy', 'severe liver disease'], '500mg on day 1, then 250mg days 2-5', '10mg/kg on day 1, then 5mg/kg days 2-5', 55, 3.75, 'MacrolidePharma Ltd', 'AZI2024-098', '2025-06-18', true, 'Z-pack 5-day course', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8');

-- =====================================================
-- INDIVIDUAL USER DRUGS (20 drugs)
-- =====================================================

INSERT INTO user_drug_inventory (
    user_id,
    drug_name,
    drug_name_lv,
    generic_name,
    brand_name,
    dosage_form,
    strength,
    active_ingredient,
    indications,
    contraindications,
    dosage_adults,
    dosage_children,
    stock_quantity,
    unit_price,
    supplier,
    batch_number,
    expiry_date,
    is_prescription_only,
    notes
) VALUES
('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Aspirin', 'Aspirīns', 'Acetylsalicylic acid', 'Bayer Aspirin', 'Tablet', '325mg', 'Acetylsalicylic acid', ARRAY['pain relief', 'fever reduction', 'cardiovascular protection', 'inflammation'], ARRAY['peptic ulcer', 'bleeding disorders', 'severe asthma'], '325-650mg every 4 hours for pain, 81mg daily for cardioprotection', 'Not recommended under 16 years (Reye''s syndrome risk)', 50, 0.10, 'BasicMeds Supply', 'ASP2024-001', '2026-03-15', false, 'Low-dose for heart protection'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Diphenhydramine', 'Difenhidramīns', 'Diphenhydramine', 'Benadryl', 'Capsule', '25mg', 'Diphenhydramine hydrochloride', ARRAY['allergic reactions', 'sleep aid', 'motion sickness', 'itching'], ARRAY['narrow-angle glaucoma', 'enlarged prostate', 'severe asthma'], '25-50mg every 6-8 hours', '12.5-25mg every 6-8 hours (age >2 years)', 40, 0.20, 'SleepAid Pharma', 'DIP2024-067', '2025-12-20', false, 'Causes drowsiness'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Calcium Carbonate', 'Kalcija karbonāts', 'Calcium Carbonate', 'Tums', 'Chewable Tablet', '500mg', 'Calcium carbonate', ARRAY['calcium deficiency', 'osteoporosis prevention', 'antacid'], ARRAY['hypercalcemia', 'kidney stones', 'severe kidney disease'], '1-2 tablets 2-3 times daily with meals', '500mg 1-2 times daily (age >4 years)', 100, 0.08, 'NutriSupplements Inc', 'CAL2024-123', '2026-01-10', false, 'Take with food for better absorption'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Multivitamin', 'Multivitamīns', 'Multivitamin', 'Centrum', 'Tablet', 'Daily Formula', 'Various vitamins and minerals', ARRAY['nutritional supplementation', 'vitamin deficiency prevention'], ARRAY['iron overload', 'hypervitaminosis'], '1 tablet daily with food', '1/2 to 1 tablet daily (age dependent)', 90, 0.12, 'VitaminWorld Co', 'MUL2024-189', '2025-08-30', false, 'Complete daily nutrition'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Hydrocortisone Cream', 'Hidrokortizons krēms', 'Hydrocortisone', 'Cortizone-10', 'Topical Cream', '1%', 'Hydrocortisone acetate', ARRAY['eczema', 'dermatitis', 'insect bites', 'rash'], ARRAY['viral skin infections', 'fungal infections'], 'Apply thin layer 2-3 times daily', 'Apply thin layer 1-2 times daily', 25, 4.50, 'TopicalMeds Ltd', 'HYD2024-045', '2025-11-25', false, 'For external use only'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Loperamide', 'Loperamīds', 'Loperamide', 'Imodium', 'Capsule', '2mg', 'Loperamide hydrochloride', ARRAY['acute diarrhea', 'chronic diarrhea', 'irritable bowel syndrome'], ARRAY['bloody diarrhea', 'fever with diarrhea', 'ulcerative colitis'], '4mg initially, then 2mg after each loose stool', '1mg after each loose stool (age >2 years)', 35, 0.75, 'GastroOTC Pharma', 'LOP2024-078', '2025-09-12', false, 'Do not exceed 8mg in 24 hours'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Dextromethorphan', 'Dekstrometorfāns', 'Dextromethorphan', 'Robitussin DM', 'Syrup', '15mg/5ml', 'Dextromethorphan hydrobromide', ARRAY['dry cough', 'cold symptoms'], ARRAY['MAO inhibitor use', 'chronic cough with excessive mucus'], '15-30mg every 4 hours', '7.5-15mg every 4 hours (age >4 years)', 20, 6.25, 'CoughRelief Co', 'DEX2024-156', '2025-07-08', false, 'Sugar-free formula available'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Pseudoephedrine', 'Pseidoefedrīns', 'Pseudoephedrine', 'Sudafed', 'Tablet', '30mg', 'Pseudoephedrine hydrochloride', ARRAY['nasal congestion', 'sinus pressure', 'allergic rhinitis'], ARRAY['severe hypertension', 'severe coronary artery disease', 'MAO inhibitor use'], '30-60mg every 4-6 hours', '15-30mg every 4-6 hours (age >4 years)', 30, 0.30, 'DecongestPharma Inc', 'PSE2024-134', '2025-10-15', false, 'Behind-the-counter medication'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Famotidine', 'Famotidīns', 'Famotidine', 'Pepcid AC', 'Tablet', '20mg', 'Famotidine', ARRAY['heartburn', 'acid indigestion', 'peptic ulcer disease'], ARRAY['hypersensitivity to famotidine'], '20mg twice daily or 40mg at bedtime', '0.5mg/kg twice daily', 45, 0.85, 'H2BlockerMeds Ltd', 'FAM2024-167', '2025-12-03', false, 'Can be taken with or without food'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Magnesium Oxide', 'Magnija oksīds', 'Magnesium Oxide', 'Mag-Ox', 'Tablet', '400mg', 'Magnesium oxide', ARRAY['magnesium deficiency', 'constipation', 'heartburn'], ARRAY['severe kidney disease', 'bowel obstruction'], '400-800mg daily with water', '200-400mg daily (age >4 years)', 60, 0.15, 'MineralSupply Co', 'MAG2024-089', '2026-05-20', false, 'Take with plenty of water'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Zinc Sulfate', 'Cinka sulfāts', 'Zinc Sulfate', 'Zincate', 'Capsule', '220mg', 'Zinc sulfate heptahydrate', ARRAY['zinc deficiency', 'wound healing', 'immune support'], ARRAY['copper deficiency risk with long-term use'], '220mg once daily with food', '110mg once daily with food (age >4 years)', 40, 0.25, 'TraceElement Pharma', 'ZIN2024-112', '2025-11-18', false, 'Take with food to reduce stomach upset'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Guaifenesin', 'Gvaifenezīns', 'Guaifenesin', 'Mucinex', 'Extended Release Tablet', '600mg', 'Guaifenesin', ARRAY['productive cough', 'chest congestion', 'mucus clearance'], ARRAY['hypersensitivity to guaifenesin'], '600-1200mg every 12 hours', '300-600mg every 12 hours (age >4 years)', 28, 1.25, 'ExpectorantMeds Inc', 'GUA2024-145', '2025-08-14', false, 'Take with plenty of water'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Docusate Sodium', 'Dokuzāta nātrijs', 'Docusate Sodium', 'Colace', 'Soft Gel Capsule', '100mg', 'Docusate sodium', ARRAY['constipation', 'stool softening', 'hemorrhoid prevention'], ARRAY['bowel obstruction', 'acute abdominal pain'], '100-300mg daily in divided doses', '50-150mg daily in divided doses (age >3 years)', 50, 0.18, 'StoolSoftener Co', 'DOC2024-178', '2025-09-28', false, 'Effects may take 1-3 days'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Polyethylene Glycol', 'Polietilēnglikols', 'Polyethylene Glycol 3350', 'MiraLAX', 'Powder', '17g per dose', 'Polyethylene glycol 3350', ARRAY['constipation', 'bowel preparation'], ARRAY['bowel obstruction', 'gastric retention'], '17g once daily mixed in liquid', '8.5-17g once daily mixed in liquid (age >6 months)', 15, 8.75, 'LaxativeMeds Ltd', 'POL2024-134', '2025-12-10', false, 'Mix in 4-8oz of liquid'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Melatonin', 'Melatonīns', 'Melatonin', 'Natrol Melatonin', 'Tablet', '3mg', 'Melatonin', ARRAY['insomnia', 'jet lag', 'sleep disorders'], ARRAY['autoimmune disorders', 'depression'], '0.5-3mg 30 minutes before bedtime', '0.5-1mg 30 minutes before bedtime (age >3 years)', 75, 0.20, 'SleepNatural Co', 'MEL2024-156', '2025-10-22', false, 'Natural sleep aid'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Vitamin D3', 'D3 vitamīns', 'Cholecalciferol', 'Nature Made Vitamin D3', 'Soft Gel', '1000 IU', 'Cholecalciferol', ARRAY['vitamin D deficiency', 'bone health', 'immune support'], ARRAY['hypercalcemia', 'vitamin D toxicity'], '1000-4000 IU daily', '400-1000 IU daily (age dependent)', 120, 0.10, 'SunVitamin Inc', 'VID2024-201', '2026-04-15', false, 'Take with fatty meal for better absorption'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Fish Oil', 'Zivju eļļa', 'Omega-3 Fatty Acids', 'Nordic Naturals', 'Soft Gel', '1000mg', 'EPA and DHA', ARRAY['cardiovascular health', 'brain health', 'joint health'], ARRAY['fish allergy', 'bleeding disorders'], '1-3 capsules daily with meals', '1 capsule daily with meals (age >4 years)', 85, 0.35, 'OmegaHealth Co', 'FIS2024-167', '2025-11-30', false, 'Molecularly distilled for purity'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Probiotic', 'Probiotiķis', 'Lactobacillus Complex', 'Align', 'Capsule', '1 Billion CFU', 'Bifidobacterium infantis 35624', ARRAY['digestive health', 'immune support', 'antibiotic recovery'], ARRAY['severe immunocompromised state'], '1 capsule daily', '1 capsule daily (age >3 years)', 30, 1.50, 'GutHealth Pharma', 'PRO2024-189', '2025-06-25', false, 'Refrigerate for best potency'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Glucosamine', 'Glūkozamīns', 'Glucosamine Sulfate', 'Osteo Bi-Flex', 'Tablet', '1500mg', 'Glucosamine sulfate', ARRAY['joint health', 'osteoarthritis', 'cartilage support'], ARRAY['shellfish allergy', 'diabetes (monitor glucose)'], '1500mg once daily or 500mg three times daily', 'Not typically recommended', 40, 0.85, 'JointCare Inc', 'GLU2024-123', '2025-08-18', false, 'Take with meals, effects may take 2-3 months'),

('2a5ead1c-6fd6-496d-9763-08c8b92f0fe8', 'Coenzyme Q10', 'Koenzīms Q10', 'Ubiquinone', 'Qunol CoQ10', 'Soft Gel', '100mg', 'Coenzyme Q10', ARRAY['heart health', 'energy production', 'antioxidant support'], ARRAY['warfarin interaction (monitor INR)'], '100-200mg daily with fatty meal', '30-100mg daily (age >12 years)', 35, 1.25, 'CardioSupplements Ltd', 'COQ2024-145', '2025-09-05', false, 'Water-soluble form for better absorption');

-- =====================================================
-- INSTRUCTIONS
-- =====================================================

-- Before running this script:
-- 1. Replace '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8' with your actual user UUID from auth.users
-- 2. Replace '1cab2c80-049d-4f18-8e9f-c169cf2245d2' with your actual organization UUID
--
-- To find your user ID, run:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--
-- To find your organization ID, run:
-- SELECT organization_id FROM organization_members WHERE user_id = '2a5ead1c-6fd6-496d-9763-08c8b92f0fe8';