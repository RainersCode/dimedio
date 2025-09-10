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
      patient_age: formData.patient_age,
      patient_gender: formData.patient_gender,
      complaint: formData.complaint,
      symptoms: formData.symptoms ? [formData.symptoms] : null,
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
      confidence_score: n8nResponse.confidence_score || 0.85, // Use provided or default
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
      'pain|sāp|headache|galvassāp|fever|temperature|drudzis': ['paracetamol', 'ibuprofen', 'analgin', 'aspirin', 'ketanov', 'dolmen', 'acetaminophen'],
      
      // Respiratory & Cough
      'cough|klepu|runny nose|iesnas|cold|saaukstēšan|respiratory|elpceļ': ['acc', 'mucosolvan', 'broncho', 'actifed', 'coldargan', 'sirup', 'expectorant'],
      
      // Digestive Issues
      'nausea|vomit|vemšan|diarrhea|caureja|stomach|kuņģ|gastro': ['metoclopramid', 'loperamid', 'smecta', 'rehydron', 'omeprazol', 'antacid'],
      
      // Infections
      'infection|infekcij|antibiotic|antibiotik|bacteria|bakterij': ['azithromycin', 'azibiot', 'amoxicillin', 'cipro', 'betaklav', 'ceftriaxon'],
      
      // Skin & Topical
      'skin|ād|rash|izsitum|wound|brūc|cut|griezum': ['bepanthen', 'betadin', 'clotrimazol', 'cream', 'krēms', 'ziede'],
      
      // Allergy
      'allergy|alergij|itch|niez|antihistamin': ['loratadin', 'cetirizin', 'suprastin', 'clarityn'],
      
      // Eye conditions
      'eye|acu|dry eyes|sausa': ['artelac', 'corneregel', 'pilieni']
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
        
        return { ...drug, relevance_score: score };
      })
      .sort((a, b) => b.relevance_score - a.relevance_score); // Sort by relevance
    
    console.log(`Filtered ${scoredDrugs.length} drugs from ${drugs.length} total. Top 10 scores:`, 
      scoredDrugs.slice(0, 10).map(d => ({ name: d.drug_name, score: d.relevance_score })));
    
    return scoredDrugs;
  }

  static async sendDiagnosisRequest(formData: DiagnosisFormData): Promise<{ data: N8nDiagnosisResponse | null; error: string | null }> {
    try {
      // Get user's drug inventory if they have access
      let drugInventory = null;
      try {
        const { DrugInventoryService } = await import('./drugInventory');
        const { hasAccess } = await DrugInventoryService.checkDrugInventoryAccess();
        
        if (hasAccess) {
          const { data: userDrugs } = await DrugInventoryService.getUserDrugInventory();
          if (userDrugs && userDrugs.length > 0) {
            // Filter and prioritize most relevant drugs
            const relevantDrugs = this.filterRelevantDrugs(userDrugs, formData.complaint + ' ' + (formData.symptoms || ''));
            
            // Format drug inventory for AI analysis (top 100 with basic info)
            drugInventory = relevantDrugs
              .slice(0, 100) // Increased to 100 most relevant drugs
              .map(drug => ({
                name: drug.drug_name,
                form: drug.dosage_form,
                strength: drug.strength
              }));
          }
        }
      } catch (drugError) {
        console.log('Could not fetch drug inventory (this is normal if user has no access):', drugError);
      }

      const payload = {
        complaint: formData.complaint,
        age: formData.patient_age,
        gender: formData.patient_gender,
        symptoms: formData.symptoms,
        timestamp: new Date().toISOString(),
        // Include drug inventory if available
        user_drug_inventory: drugInventory,
        has_drug_inventory: drugInventory !== null && drugInventory.length > 0,
      };

      console.log('Sending request to local API route:', this.API_ROUTE);
      console.log('Request payload size:', JSON.stringify(payload).length, 'characters');
      console.log('Drug inventory items:', drugInventory?.length || 0);
      console.log('Sample payload:', {
        ...payload,
        user_drug_inventory: drugInventory?.length ? `[${drugInventory.length} items]` : drugInventory
      });

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