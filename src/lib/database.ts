import { supabase } from './supabase';
import type { 
  Diagnosis, 
  DiagnosisFormData, 
  N8nDiagnosisResponse, 
  ParsedDiagnosis 
} from '@/types/database';

export class DatabaseService {
  // Create a new diagnosis
  static async createDiagnosis(formData: DiagnosisFormData): Promise<{ data: Diagnosis | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const diagnosisData = {
      user_id: user.id,
      // Basic patient info
      patient_age: formData.patient_age || null,
      patient_gender: formData.patient_gender || null,
      complaint: formData.complaint,
      symptoms: formData.symptoms ? [formData.symptoms] : null,
      
      // Patient identification
      patient_name: formData.patient_name || null,
      patient_surname: formData.patient_surname || null,
      patient_id: formData.patient_id || null,
      date_of_birth: formData.date_of_birth || null,
      
      // Vital signs
      blood_pressure_systolic: formData.blood_pressure_systolic || null,
      blood_pressure_diastolic: formData.blood_pressure_diastolic || null,
      heart_rate: formData.heart_rate || null,
      temperature: formData.temperature || null,
      respiratory_rate: formData.respiratory_rate || null,
      oxygen_saturation: formData.oxygen_saturation || null,
      weight: formData.weight || null,
      height: formData.height || null,
      
      // Medical history
      allergies: formData.allergies || null,
      current_medications: formData.current_medications || null,
      chronic_conditions: formData.chronic_conditions || null,
      previous_surgeries: formData.previous_surgeries || null,
      previous_injuries: formData.previous_injuries || null,
      
      // Clinical details
      complaint_duration: formData.complaint_duration || null,
      pain_scale: formData.pain_scale && formData.pain_scale > 1
        ? formData.pain_scale / 10  // Convert 0-10 scale to 0-1 scale for database
        : formData.pain_scale || null,
      symptom_onset: formData.symptom_onset || null,
      associated_symptoms: formData.associated_symptoms || null,
    };

    const { data, error } = await supabase
      .from('diagnoses')
      .insert([diagnosisData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Update diagnosis with AI results
  static async updateDiagnosisWithAI(
    diagnosisId: string, 
    n8nResponse: N8nDiagnosisResponse,
    workflowId?: string
  ): Promise<{ data: Diagnosis | null; error: string | null }> {
    // Parse the n8n response
    console.log('Raw n8n response to parse:', n8nResponse);
    const parsedDiagnosis = this.parseN8nResponse(n8nResponse);
    console.log('Parsed diagnosis object:', parsedDiagnosis);
    console.log('Drug suggestions in parsed diagnosis:', parsedDiagnosis.drug_suggestions);
    console.log('Inventory drugs in parsed diagnosis:', parsedDiagnosis.inventory_drugs);
    console.log('Additional therapy in parsed diagnosis:', parsedDiagnosis.additional_therapy);
    
    const updateData = {
      primary_diagnosis: parsedDiagnosis.primary_diagnosis,
      differential_diagnoses: parsedDiagnosis.differential_diagnoses,
      recommended_actions: parsedDiagnosis.recommended_actions,
      treatment: parsedDiagnosis.treatment,
      drug_suggestions: parsedDiagnosis.drug_suggestions,
      inventory_drugs: parsedDiagnosis.inventory_drugs,
      additional_therapy: parsedDiagnosis.additional_therapy,
      improved_patient_history: parsedDiagnosis.improved_patient_history,
      confidence_score: parsedDiagnosis.confidence_score,
      severity_level: parsedDiagnosis.severity_level,
      n8n_workflow_id: workflowId,
      n8n_response: n8nResponse,

      // Enhanced AI response fields
      clinical_assessment: parsedDiagnosis.clinical_assessment,
      monitoring_plan: parsedDiagnosis.monitoring_plan,
    };

    console.log('Update data being sent to database:', updateData);

    const { data, error } = await supabase
      .from('diagnoses')
      .update(updateData)
      .eq('id', diagnosisId)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Update diagnosis with manual edits and audit trail
  static async updateDiagnosisManually(
    diagnosisId: string, 
    editedData: Partial<Diagnosis>,
    editorEmail?: string,
    editLocation?: string,
    customEditorName?: string
  ): Promise<{ data: Diagnosis | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Get user's profile for audit trail or use custom name
    let editorName = customEditorName || 'Unknown User';
    
    if (!customEditorName) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          editorName = profile.full_name || profile.email || 'Unknown User';
        }
      } catch (profileError) {
        // Silently fall back to customEditorName or 'Unknown User'
      }
    }

    // Helper function to convert empty strings to null
    const normalizeValue = (value: any) => {
      if (typeof value === 'string' && value.trim() === '') {
        return null;
      }
      return value;
    };

    // Only allow updating certain fields that can be manually edited
    const allowedFields = {
      // Core fields (always include these)
      complaint: normalizeValue(editedData.complaint),
      
      // Diagnosis fields
      primary_diagnosis: normalizeValue(editedData.primary_diagnosis),
      differential_diagnoses: editedData.differential_diagnoses,
      recommended_actions: editedData.recommended_actions,
      treatment: editedData.treatment,
      improved_patient_history: normalizeValue(editedData.improved_patient_history),
      symptoms: editedData.symptoms,
      
      // Patient Information
      patient_age: editedData.patient_age,
      patient_gender: normalizeValue(editedData.patient_gender),
      patient_name: normalizeValue(editedData.patient_name),
      patient_surname: normalizeValue(editedData.patient_surname),
      patient_id: normalizeValue(editedData.patient_id),
      date_of_birth: normalizeValue(editedData.date_of_birth),
      weight: editedData.weight,
      height: editedData.height,
      
      // Vital Signs
      blood_pressure_systolic: editedData.blood_pressure_systolic,
      blood_pressure_diastolic: editedData.blood_pressure_diastolic,
      heart_rate: editedData.heart_rate,
      temperature: editedData.temperature,
      respiratory_rate: editedData.respiratory_rate,
      oxygen_saturation: editedData.oxygen_saturation,
      complaint_duration: normalizeValue(editedData.complaint_duration),
      pain_scale: editedData.pain_scale && editedData.pain_scale > 1
        ? editedData.pain_scale / 10  // Convert 0-10 scale to 0-1 scale for database
        : editedData.pain_scale,
      symptom_onset: normalizeValue(editedData.symptom_onset),
      
      // Medical History
      allergies: normalizeValue(editedData.allergies),
      current_medications: normalizeValue(editedData.current_medications),
      chronic_conditions: normalizeValue(editedData.chronic_conditions),
      previous_surgeries: normalizeValue(editedData.previous_surgeries),
      previous_injuries: normalizeValue(editedData.previous_injuries),
      associated_symptoms: normalizeValue(editedData.associated_symptoms),
      
      // Drug Recommendations
      inventory_drugs: editedData.inventory_drugs,
      additional_therapy: editedData.additional_therapy,
      
      // Audit trail (always include these)
      last_edited_by: editorName,
      last_edited_by_email: editorEmail || user.email || '',
      last_edited_at: new Date().toISOString(),
      edit_location: editLocation || 'Patient Details Page'
    };

    // Remove undefined fields (but keep null fields to clear database values)
    const updateData = Object.fromEntries(
      Object.entries(allowedFields).filter(([_, value]) => value !== undefined)
    );

    const { data, error } = await supabase
      .from('diagnoses')
      .update(updateData)
      .eq('id', diagnosisId)
      .eq('user_id', user.id) // Ensure user can only update their own diagnoses
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get user's diagnoses
  static async getUserDiagnoses(limit = 50, offset = 0): Promise<{ data: Diagnosis[] | null; error: string | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database query error:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Get single diagnosis
  static async getDiagnosis(diagnosisId: string): Promise<{ data: Diagnosis | null; error: string | null }> {
    const { data, error } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('id', diagnosisId)
      .single();

    if (error) {
      console.error('Database query error:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  // Delete diagnosis
  static async deleteDiagnosis(diagnosisId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('diagnoses')
      .delete()
      .eq('id', diagnosisId);

    if (error) {
      console.error('Database delete error:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  // Parse n8n response into structured format
  private static parseN8nResponse(n8nResponse: N8nDiagnosisResponse): ParsedDiagnosis {
    // Parse differential diagnoses (handle both array and string formats)
    let differentialDiagnoses: string[] = [];
    if (Array.isArray(n8nResponse.differential_diagnoses)) {
      differentialDiagnoses = n8nResponse.differential_diagnoses;
    } else if (typeof n8nResponse.differential_diagnoses === 'string') {
      differentialDiagnoses = n8nResponse.differential_diagnoses
        .split(/[,\n]/)
        .map(d => d.trim())
        .filter(d => d.length > 0);
    }

    // Parse recommended actions (handle both array and string formats)
    let recommendedActions: string[] = [];
    if (Array.isArray(n8nResponse.recommended_actions)) {
      recommendedActions = n8nResponse.recommended_actions;
    } else if (typeof n8nResponse.recommended_actions === 'string') {
      recommendedActions = n8nResponse.recommended_actions
        .split(/[,\n]/)
        .map(a => a.trim())
        .filter(a => a.length > 0);
    }

    // Parse treatment (handle both array and string formats)
    let treatment: string[] = [];
    if (Array.isArray(n8nResponse.treatment)) {
      treatment = n8nResponse.treatment;
    } else if (typeof n8nResponse.treatment === 'string') {
      treatment = n8nResponse.treatment
        .split(/[,\n]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }

    // Use severity from response or determine based on keywords
    let severity_level = n8nResponse.severity_level;
    if (!severity_level) {
      severity_level = 'moderate'; // Default
      const responseText = JSON.stringify(n8nResponse).toLowerCase();
      
      if (responseText.includes('critical') || responseText.includes('emergency') || responseText.includes('immediate')) {
        severity_level = 'critical';
      } else if (responseText.includes('severe') || responseText.includes('urgent')) {
        severity_level = 'high';
      } else if (responseText.includes('mild') || responseText.includes('minor')) {
        severity_level = 'low';
      }
    }

    // Handle both old and new drug suggestion formats
    const drugSuggestions = n8nResponse.drug_suggestions || [];
    const inventoryDrugs = n8nResponse.inventory_drugs || [];
    const additionalTherapy = n8nResponse.additional_therapy || [];
    const improvedPatientHistory = n8nResponse.improved_patient_history || '';
    
    const result = {
      primary_diagnosis: n8nResponse.primary_diagnosis,
      differential_diagnoses: differentialDiagnoses,
      recommended_actions: recommendedActions,
      treatment: treatment,
      drug_suggestions: drugSuggestions,
      inventory_drugs: inventoryDrugs,
      additional_therapy: additionalTherapy,
      improved_patient_history: improvedPatientHistory,
      severity_level,
      confidence_score: n8nResponse.confidence_score
        ? (n8nResponse.confidence_score > 1 ? n8nResponse.confidence_score / 100 : n8nResponse.confidence_score)
        : 0.85, // Convert percentage to decimal if needed

      // Enhanced AI response fields
      clinical_assessment: n8nResponse.clinical_assessment,
      monitoring_plan: n8nResponse.monitoring_plan,
    };
    
    console.log('Parsed diagnosis result:', result);
    console.log('Drug suggestions from n8n:', drugSuggestions);
    console.log('Inventory drugs from n8n:', inventoryDrugs);
    console.log('Additional therapy from n8n:', additionalTherapy);
    console.log('Final drug suggestions:', result.drug_suggestions);
    console.log('Final inventory drugs:', result.inventory_drugs);
    console.log('Final additional therapy:', result.additional_therapy);
    
    return result;
  }
}

// n8n Integration Service
export class N8nService {
  private static API_ROUTE = '/api/diagnosis'; // Use local API route to bypass CORS

  // Filter drugs to most relevant ones based on complaint/symptoms
  private static filterRelevantDrugs(drugs: any[], complaintText: string): any[] {
    const searchText = complaintText.toLowerCase();
    
    // Define condition-drug mappings for better matching
    const conditionMappings = {
      // Pain & Fever
      'pain|sāp|headache|galvassāp|fever|temperature|drudzis|migraine|migrēna|toothache|zobu': ['paracetamol', 'ibuprofen', 'analgin', 'aspirin', 'ketanov', 'dolmen', 'acetaminophen', 'naproxen', 'diclofenac', 'tramadol'],
      
      // Respiratory & Cough
      'cough|klepu|runny nose|iesnas|cold|saaukstēšan|respiratory|elpceļ|sore throat|rīkle|bronchitis|pneimonij|asthma': ['acc', 'mucosolvan', 'broncho', 'actifed', 'coldargan', 'sirup', 'expectorant', 'salbutamol', 'ventolin', 'berodual', 'prednisolon'],
      
      // Digestive Issues
      'nausea|vomit|vemšan|diarrhea|caureja|stomach|kuņģ|gastro|constipation|aizcietējum|bloating|uzpūšan|gas|gāz|meteorism|digestive|gremošan|bowel|zarn|intestinal|heartburn|grēmošana|acid|skābe': ['metoclopramid', 'loperamid', 'smecta', 'rehydron', 'omeprazol', 'antacid', 'lactulose', 'laktulose', 'duphalac', 'simeticon', 'espumisan', 'motilium', 'disflatyl', 'ranitidine', 'domperidone'],
      
      // Infections
      'infection|infekcij|antibiotic|antibiotik|bacteria|bakterij|pneumonia|pneimonija|bronchitis|sinusitis|uti|urinary': ['azithromycin', 'azibiot', 'amoxicillin', 'cipro', 'betaklav', 'ceftriaxon', 'clarithromycin', 'erythromycin', 'doxycycline'],
      
      // Skin & Topical
      'skin|ād|rash|izsitum|wound|brūc|cut|griezum|eczema|dermatitis|psoriasis|fungal|sēnīt': ['bepanthen', 'betadin', 'clotrimazol', 'cream', 'krēms', 'ziede', 'hydrocortisone', 'betamethasone', 'miconazole'],
      
      // Allergy
      'allergy|alergij|itch|niez|antihistamin|hives|nātrene|allergic rhinitis': ['loratadin', 'cetirizin', 'suprastin', 'clarityn', 'fenistil', 'tavegil', 'zyrtec', 'telfast'],
      
      // Eye conditions
      'eye|acu|dry eyes|sausa|conjunctivitis|konjunktivīts|red eyes|sarkanas': ['artelac', 'corneregel', 'pilieni', 'chloramphenicol', 'gentamicin'],
      
      // Cardiovascular
      'heart|sirds|blood pressure|asinsspiedien|hypertension|chest pain|krūtu sāp|arrhythmia': ['atenolol', 'amlodipine', 'enalapril', 'metoprolol', 'carvedilol', 'lisinopril'],
      
      // Diabetes & Metabolic
      'diabetes|diabēts|blood sugar|cukurs|metabolic|vielmaiņ': ['metformin', 'insulin', 'glibenclamide', 'gliclazide'],
      
      // Mental Health & Sleep
      'anxiety|trauksm|depression|depresij|sleep|miega|insomnia|bezmiega|stress': ['diazepam', 'lorazepam', 'zolpidem', 'melatonin', 'valerian'],
      
      // Vitamins & Supplements
      'vitamin|vitamīn|supplement|papildinājum|deficiency|trūkum|weakness|vājum': ['vitamin', 'b12', 'iron', 'calcium', 'magnesium', 'zinc', 'omega']
    };
    
    // Score drugs based on relevance
    const scoredDrugs = drugs
      .filter(drug => drug.stock_quantity > 0) // Only in-stock drugs
      .map(drug => {
        let score = 0;
        const drugName = (drug.drug_name || '').toLowerCase();
        const genericName = (drug.generic_name || '').toLowerCase();
        const activeIngredient = (drug.active_ingredient || '').toLowerCase();
        
        // Check against condition mappings
        for (const [conditions, drugKeywords] of Object.entries(conditionMappings)) {
          const conditionRegex = new RegExp(conditions, 'i');
          if (conditionRegex.test(searchText)) {
            for (const keyword of drugKeywords) {
              if (drugName.includes(keyword) || genericName.includes(keyword) || activeIngredient.includes(keyword)) {
                score += 10; // High relevance
                break;
              }
            }
          }
        }
        
        // Boost common/essential drugs
        const commonDrugs = ['paracetamol', 'ibuprofen', 'analgin', 'vitamin', 'betadin'];
        if (commonDrugs.some(common => drugName.includes(common))) {
          score += 2;
        }
        
        // Prefer tablets and common forms
        if (drug.dosage_form === 'tablet') score += 1;
        if (drug.dosage_form === 'capsule') score += 1;
        
        // Give all in-stock drugs a minimum score so they have a chance to be included
        if (score === 0) {
          score = 1; // Minimum score for any in-stock drug
        }
        
        // Add diversity bonus for different therapeutic categories
        if (drug.category?.name) {
          score += 0.5; // Small bonus for categorized drugs to ensure variety
        }
        
        return { ...drug, relevance_score: score };
      })
      .sort((a, b) => {
        // First sort by relevance score, then by category diversity
        if (Math.abs(a.relevance_score - b.relevance_score) < 2) {
          // If scores are close, prefer different categories for variety
          return (a.category?.name || '').localeCompare(b.category?.name || '');
        }
        return b.relevance_score - a.relevance_score;
      }); // Sort by relevance with diversity consideration
    
    console.log(`Filtered ${scoredDrugs.length} drugs from ${drugs.length} total. Top 10 scores:`,
      scoredDrugs.slice(0, 10).map(d => ({ name: d.drug_name, score: d.relevance_score })));

    console.log('=== DRUG FILTERING DEBUG ===');
    console.log('Input drugs count:', drugs.length);
    console.log('Search text:', searchText);
    console.log('Filtered drugs count:', scoredDrugs.length);
    console.log('Top 5 drugs after filtering:', scoredDrugs.slice(0, 5).map(d => ({
      name: d.drug_name,
      score: d.relevance_score,
      stock: d.stock_quantity
    })));
    console.log('=== END DRUG FILTERING DEBUG ===');
    
    return scoredDrugs;
  }

  static async sendDiagnosisRequest(formData: DiagnosisFormData & {
    user_drug_inventory?: any[];
    has_drug_inventory?: boolean;
    current_mode?: string
  }): Promise<{ data: N8nDiagnosisResponse | null; error: string | null }> {
    try {
      // Use drug inventory passed from the form (mode-aware)
      let drugInventory = null;

      if (formData.has_drug_inventory && formData.user_drug_inventory && formData.user_drug_inventory.length > 0) {
        try {
          // Filter and prioritize most relevant drugs from the provided inventory
          const relevantDrugs = this.filterRelevantDrugs(formData.user_drug_inventory, formData.complaint + ' ' + (formData.symptoms || ''));

          // Format drug inventory for AI analysis (top 200 with essential info)
          const drugList = relevantDrugs
            .slice(0, 200) // Send up to 200 most relevant drugs for better therapy options
            .map(drug => ({
              id: drug.id,
              name: drug.drug_name,
              generic_name: drug.generic_name,
              dosage_form: drug.dosage_form,
              strength: drug.strength,
              active_ingredient: drug.active_ingredient,
              indications: drug.indications?.slice(0, 3), // Limit to 3 indications
              dosage_adults: drug.dosage_adults,
              stock_quantity: drug.stock_quantity,
              is_prescription_only: drug.is_prescription_only,
              category: drug.category?.name
            }));

          // Format as readable text for AI
          drugInventory = drugList.map(drug =>
            `Drug: ${drug.name}${drug.generic_name ? ` (${drug.generic_name})` : ''}, Form: ${drug.dosage_form || 'N/A'}, Strength: ${drug.strength || 'N/A'}, Stock: ${drug.stock_quantity}, Category: ${drug.category || 'Uncategorized'}${drug.dosage_adults ? `, Adult Dosage: ${drug.dosage_adults}` : ''}`
          ).join('\n');
        } catch (drugError) {
          console.log('Could not process drug inventory:', drugError);
        }
      }

      // Detect language of the complaint
      const detectLanguage = (text: string): string => {
        const lowerText = text.toLowerCase();
        
        // Latvian language indicators
        const latvianWords = ['sāp', 'klepu', 'temperature', 'drudzis', 'galva', 'kuņģ', 'elpošana', 'rīkle', 'seja', 'krūts', 'vēders', 'roku', 'kāju', 'mugura', 'acu', 'ausi', 'deguns', 'sirds', 'pēda'];
        const latvianChars = /[āēīōūģķļņšž]/;
        
        // Russian language indicators  
        const russianWords = ['боль', 'температура', 'кашель', 'голова', 'живот', 'грудь', 'спина', 'рука', 'нога', 'сердце', 'глаза', 'уши', 'нос'];
        const russianChars = /[а-яё]/;
        
        // German language indicators
        const germanWords = ['schmerzen', 'fieber', 'husten', 'kopf', 'bauch', 'brust', 'rücken', 'arm', 'bein', 'herz', 'augen', 'ohren', 'nase'];
        
        // Check for language indicators
        if (latvianChars.test(text) || latvianWords.some(word => lowerText.includes(word))) {
          return 'latvian';
        } else if (russianChars.test(text) || russianWords.some(word => lowerText.includes(word))) {
          return 'russian';
        } else if (germanWords.some(word => lowerText.includes(word))) {
          return 'german';
        } else {
          // Default to English if no specific language detected
          return 'english';
        }
      };

      const detectedLanguage = detectLanguage(formData.complaint + ' ' + (formData.symptoms || ''));
      console.log('Detected language:', detectedLanguage);

      // Build payload with only filled fields to reduce size
      const payload: any = {
        complaint: formData.complaint,
        age: formData.patient_age,
        gender: formData.patient_gender,
        symptoms: formData.symptoms ? [formData.symptoms] : null,
        timestamp: new Date().toISOString(),
        detected_language: detectedLanguage,
        // Include drug inventory if available
        user_drug_inventory: drugInventory,
        has_drug_inventory: drugInventory !== null && drugInventory.length > 0,
        // Request comprehensive therapy recommendations (flat structure)
        request_comprehensive_therapy: true,
        minimum_additional_therapy_count: 5,
        include_alternative_treatments: true,
        include_otc_medications: true,
        therapy_explanation: drugInventory && drugInventory.length > 0
          ? "IMPORTANT DUAL REQUIREMENT: 1) For 'inventory_drugs' field: ONLY recommend drugs with exact names matching the user_drug_inventory list provided. Use exact drug names from inventory. 2) For 'additional_therapy' field: Provide 5-8 comprehensive external treatment options including both prescription and over-the-counter medications that would be ideal for this condition, regardless of inventory availability. These external suggestions should represent best-practice medical treatment options that the doctor should consider prescribing or recommending to the patient."
          : "Please provide comprehensive therapy recommendations in the 'additional_therapy' field. Provide at least 5 diverse therapy options including both prescription and over-the-counter medications that represent best medical practice for this condition.",
      };

      // Add all patient fields to enable comprehensive AI analysis
      if (formData.patient_name) payload.patient_name = formData.patient_name;
      if (formData.patient_surname) payload.patient_surname = formData.patient_surname;
      if (formData.patient_id) payload.patient_id = formData.patient_id;
      if (formData.date_of_birth) payload.date_of_birth = formData.date_of_birth;

      // Medical History
      if (formData.allergies) payload.allergies = formData.allergies;
      if (formData.current_medications) payload.current_medications = formData.current_medications;
      if (formData.chronic_conditions) payload.chronic_conditions = formData.chronic_conditions;
      if (formData.previous_surgeries) payload.previous_surgeries = formData.previous_surgeries;
      if (formData.previous_injuries) payload.previous_injuries = formData.previous_injuries;

      // Vital Signs
      if (formData.blood_pressure_systolic) payload.blood_pressure_systolic = formData.blood_pressure_systolic;
      if (formData.blood_pressure_diastolic) payload.blood_pressure_diastolic = formData.blood_pressure_diastolic;
      if (formData.heart_rate) payload.heart_rate = formData.heart_rate;
      if (formData.temperature) payload.temperature = formData.temperature;
      if (formData.respiratory_rate) payload.respiratory_rate = formData.respiratory_rate;
      if (formData.oxygen_saturation) payload.oxygen_saturation = formData.oxygen_saturation;
      if (formData.weight) payload.weight = formData.weight;
      if (formData.height) payload.height = formData.height;

      // Symptom Details
      if (formData.complaint_duration) payload.complaint_duration = formData.complaint_duration;
      if (formData.pain_scale !== undefined && formData.pain_scale !== null) payload.pain_scale = formData.pain_scale;
      if (formData.symptom_onset) payload.symptom_onset = formData.symptom_onset;
      if (formData.associated_symptoms) payload.associated_symptoms = formData.associated_symptoms;

      console.log('Sending request to local API route:', this.API_ROUTE);
      console.log('Request payload size:', JSON.stringify(payload).length, 'characters');
      console.log('Drug inventory items:', drugInventory?.length || 0);
      
      // Check if payload is too large (>1MB)
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 1000000) {
        console.warn('Large payload detected:', payloadSize, 'characters');
      }
      
      console.log('Sample payload:', {
        ...payload,
        user_drug_inventory: drugInventory?.length ? `[${drugInventory.length} items]` : drugInventory
      });

      // Debug: Log the actual inventory drugs being sent to AI
      if (drugInventory && drugInventory.length > 0) {
        console.log('=== INVENTORY DRUGS SENT TO AI ===');
        console.log('Format: Text-based for AI readability');
        console.log('First 3 drugs preview:', drugInventory.split('\n').slice(0, 3));
        console.log('Total drugs in inventory:', drugInventory.split('\n').length);
      } else {
        console.log('=== NO INVENTORY DRUGS SENT TO AI ===');
      }

      // Debug: Log all the fields being sent
      console.log('=== FORM DATA DEBUG ===');
      console.log('Form data received:', formData);
      console.log('Symptoms processing:', {
        original_symptoms: formData.symptoms,
        processed_symptoms: payload.symptoms,
        type_of_original: typeof formData.symptoms,
        type_of_processed: typeof payload.symptoms,
        is_array: Array.isArray(payload.symptoms)
      });
      console.log('Vital signs being sent:', {
        blood_pressure_systolic: payload.blood_pressure_systolic,
        blood_pressure_diastolic: payload.blood_pressure_diastolic,
        heart_rate: payload.heart_rate,
        temperature: payload.temperature,
        respiratory_rate: payload.respiratory_rate,
        oxygen_saturation: payload.oxygen_saturation,
        weight: payload.weight,
        height: payload.height
      });
      console.log('Medical history being sent:', {
        allergies: payload.allergies,
        current_medications: payload.current_medications,
        chronic_conditions: payload.chronic_conditions,
        previous_surgeries: payload.previous_surgeries,
        previous_injuries: payload.previous_injuries
      });
      console.log('Patient details being sent:', {
        patient_name: payload.patient_name,
        patient_surname: payload.patient_surname,
        patient_id: payload.patient_id,
        date_of_birth: payload.date_of_birth
      });
      console.log('Numeric fields being sent:', {
        confidence_score: payload.confidence_score,
        pain_scale: payload.pain_scale,
        temperature: payload.temperature,
        heart_rate: payload.heart_rate,
        blood_pressure_systolic: payload.blood_pressure_systolic,
        blood_pressure_diastolic: payload.blood_pressure_diastolic,
        respiratory_rate: payload.respiratory_rate,
        oxygen_saturation: payload.oxygen_saturation,
        weight: payload.weight,
        height: payload.height
      });
      console.log('=== END FORM DATA DEBUG ===');

      const response = await fetch(this.API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('n8n response status:', response.status);
      console.log('n8n response ok:', response.ok);

      if (!response.ok) {
        throw new Error(`n8n request failed: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log('Raw n8n response:', rawData);
      
      // Handle n8n response formats
      let data;
      
      // Check if response has text field (current format)
      if (rawData.text) {
        // Extract JSON from text field with markdown code blocks
        const textContent = rawData.text;
        console.log('Text content to parse:', textContent.substring(0, 200) + '...');
        
        // Try multiple regex patterns to match JSON
        let jsonMatch = textContent.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (!jsonMatch) {
          jsonMatch = textContent.match(/```json([\s\S]*?)```/);
        }
        if (!jsonMatch) {
          jsonMatch = textContent.match(/\{[\s\S]*\}/);
        }
        
        if (jsonMatch) {
          let jsonString = jsonMatch[1] || jsonMatch[0];
          
          // Try to fix truncated JSON by adding missing closing brackets
          const openBraces = (jsonString.match(/{/g) || []).length;
          const closeBraces = (jsonString.match(/}/g) || []).length;
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          
          // Add missing closing brackets/braces
          const missingCloseBraces = openBraces - closeBraces;
          const missingCloseBrackets = openBrackets - closeBrackets;
          
          if (missingCloseBraces > 0 || missingCloseBrackets > 0) {
            console.log('Attempting to fix truncated JSON...');
            console.log('Missing close braces:', missingCloseBraces);
            console.log('Missing close brackets:', missingCloseBrackets);
            
            // Remove any incomplete trailing content (likely the truncated part)
            const lastCompleteComma = jsonString.lastIndexOf(',');
            const lastCompleteQuote = jsonString.lastIndexOf('"');
            if (lastCompleteComma > lastCompleteQuote) {
              // Remove incomplete trailing field
              jsonString = jsonString.substring(0, lastCompleteComma);
            } else if (jsonString.endsWith('"')) {
              // Complete string but missing brackets/braces
            } else {
              // Find last complete field
              const lastCompleteField = jsonString.lastIndexOf('"');
              if (lastCompleteField > 0) {
                const beforeLastField = jsonString.substring(0, lastCompleteField);
                const lastFieldStart = beforeLastField.lastIndexOf('"');
                if (lastFieldStart > 0) {
                  jsonString = jsonString.substring(0, lastFieldStart - 1);
                }
              }
            }
            
            // Add missing closing brackets and braces
            for (let i = 0; i < missingCloseBrackets; i++) {
              jsonString += ']';
            }
            for (let i = 0; i < missingCloseBraces; i++) {
              jsonString += '}';
            }
          }
          
          try {
            data = JSON.parse(jsonString.trim());
            console.log('Successfully parsed JSON:', data);
            console.log('Parsed drug_suggestions:', data.drug_suggestions);
          } catch (parseError) {
            console.error('Failed to parse JSON from text:', parseError);
            console.error('JSON string was:', jsonString);
            console.error('Original JSON string was:', jsonMatch[1] || jsonMatch[0]);
            throw new Error('Invalid JSON in n8n response text field');
          }
        } else {
          console.error('No JSON found in text field. Text content:', textContent);
          throw new Error('No JSON found in text field');
        }
      } else if (Array.isArray(rawData) && rawData.length > 0) {
        const firstItem = rawData[0];
        
        if (firstItem.text) {
          // Extract JSON from array format
          const textContent = firstItem.text;
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
          
          if (jsonMatch && jsonMatch[1]) {
            try {
              data = JSON.parse(jsonMatch[1]);
            } catch (parseError) {
              console.error('Failed to parse JSON from text:', parseError);
              throw new Error('Invalid JSON in n8n response text field');
            }
          } else {
            throw new Error('No JSON found in text field');
          }
        } else if (firstItem.primary_diagnosis) {
          // Direct diagnosis object
          data = firstItem;
        } else {
          console.error('Unexpected array item format:', firstItem);
          throw new Error('Unrecognized n8n response array format');
        }
      } else if (rawData.primary_diagnosis) {
        // Direct JSON object (fallback)
        data = rawData;
      } else {
        console.error('Unexpected n8n response format:', rawData);
        throw new Error('Unrecognized n8n response format');
      }
      
      // Validate response structure
      if (!data.primary_diagnosis) {
        console.error('Parsed data missing primary_diagnosis:', data);
        throw new Error('Invalid n8n response: missing primary_diagnosis');
      }

      console.log('Successfully parsed n8n response:', data);
      return { data, error: null };
    } catch (error) {
      console.error('n8n request error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}