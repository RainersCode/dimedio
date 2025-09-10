# N8N Drug Inventory Integration Guide

## Overview

This guide explains how to enhance your n8n workflow to include drug inventory suggestions when providing medical diagnoses.

## Enhanced Payload Structure

The application now sends an enhanced payload to your n8n webhook that includes the user's drug inventory:

```json
{
  "complaint": "Patient complaint text",
  "age": 45,
  "gender": "male",
  "symptoms": "Additional symptoms",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "user_drug_inventory": [
    {
      "id": "uuid-123",
      "name": "Paracetamol 500mg",
      "generic_name": "Acetaminophen",
      "brand_name": "Tylenol",
      "strength": "500mg",
      "dosage_form": "tablet",
      "active_ingredient": "Paracetamol",
      "indications": ["fever", "pain", "headache"],
      "contraindications": ["liver disease", "alcohol dependency"],
      "dosage_adults": "1-2 tablets every 6 hours",
      "dosage_children": "10-15mg/kg every 6 hours",
      "stock_quantity": 100,
      "is_prescription_only": false,
      "expiry_date": "2025-12-31",
      "category": "Analgesics"
    }
  ],
  "has_drug_inventory": true
}
```

## N8N Workflow Enhancement

### 1. Update Your AI Prompt

Based on the actual data structure, enhance your AI prompt to include drug inventory logic:

```
You are a medical AI assistant. Based on the patient complaint and symptoms, provide a diagnosis and treatment recommendations.

Patient Information:
- Complaint: {{$json.complaint}}
- Age: {{$json.age}}
- Gender: {{$json.gender}}
- Additional Symptoms: {{$json.symptoms}}

{{#if $json.has_drug_inventory}}
Available Drug Inventory:
The user has the following drugs available in their inventory (top 150 most relevant drugs for this condition):

{{#each $json.user_drug_inventory}}
- **{{name}}** (ID: {{id}})
  * Form: {{dosage_form}}
  * Strength: {{#if strength}}{{strength}}{{else}}Not specified{{/if}}
  * Generic: {{#if generic_name}}{{generic_name}}{{else}}Not specified{{/if}}
  * Brand: {{#if brand_name}}{{brand_name}}{{else}}Not specified{{/if}}
  * Active Ingredient: {{#if active_ingredient}}{{active_ingredient}}{{else}}Not specified{{/if}}
  * Category: {{#if category}}{{category}}{{else}}Not specified{{/if}}
  * Indications: {{#if indications}}{{indications}}{{else}}Not specified{{/if}}
  * Contraindications: {{#if contraindications}}{{contraindications}}{{else}}None listed{{/if}}
  * Stock: {{stock_quantity}} units
  * Prescription Only: {{is_prescription_only}}
  * Adult Dosage: {{#if dosage_adults}}{{dosage_adults}}{{else}}Standard dosage recommended{{/if}}
  * Children Dosage: {{#if dosage_children}}{{dosage_children}}{{else}}Consult pediatric guidelines{{/if}}
  * Expiry: {{#if expiry_date}}{{expiry_date}}{{else}}Not specified{{/if}}

{{/each}}

IMPORTANT INSTRUCTIONS:
1. When suggesting treatment, PRIORITIZE drugs from the user's inventory if they are appropriate for the condition
2. Only suggest external drugs if nothing suitable is available in inventory
3. Consider the drug indications - match them to the patient's condition
4. Check contraindications and avoid suggesting drugs that might harm the patient
5. Consider the drug form (tablet, cream, injection, etc.) when making recommendations
6. Pay attention to prescription requirements and stock levels
7. Use the available strength information for dosage calculations
8. Check expiry dates - avoid suggesting expired drugs
9. When responding, use the exact drug ID from the inventory for accurate tracking
10. The inventory shows up to 150 most relevant drugs for this condition, sorted by relevance - prioritize the top matches

{{else}}
Note: User has no drug inventory available. Suggest standard treatment options.
{{/if}}

Please provide your response in the following JSON format:
{
  "primary_diagnosis": "Primary diagnosis",
  "differential_diagnoses": ["Alternative diagnosis 1", "Alternative diagnosis 2"],
  "recommended_actions": ["Action 1", "Action 2"],
  "treatment": ["Treatment recommendation 1", "Treatment recommendation 2"],
  "inventory_drugs": [
    {
      "drug_id": "uuid-123",
      "drug_name": "Exact drug name from inventory",
      "dosage": "Recommended dosage based on strength and form",
      "duration": "Treatment duration (e.g., '5-7 days', 'as needed')",
      "instructions": "Specific instructions (e.g., 'Take with food', 'Apply topically')",
      "prescription_required": false,
      "stock_quantity": 100
    }
  ],
  "additional_therapy": [
    {
      "drug_name": "External drug if needed",
      "dosage": "Standard dosage",
      "duration": "Treatment duration",
      "instructions": "Usage instructions",
      "prescription_required": true
    }
  ],
  "severity_level": "low",
  "confidence_score": 0.95
}
```

### 2. Add Conditional Logic Node

Add a conditional node in your workflow to handle cases with and without drug inventory:

```javascript
// Check if user has drug inventory
if ($json.has_drug_inventory && $json.user_drug_inventory.length > 0) {
  // Route to enhanced AI prompt that considers inventory
  return [{ json: { route: 'with_inventory', data: $json } }];
} else {
  // Route to standard AI prompt
  return [{ json: { route: 'standard', data: $json } }];
}
```

### 3. Drug Matching Logic (Optional)

Add a pre-processing step to find relevant drugs before AI analysis based on the actual data structure:

```javascript
// Filter drugs relevant to the complaint
const complaint = ($json.complaint || '').toLowerCase();
const symptoms = ($json.symptoms || '').toLowerCase();
const searchText = complaint + ' ' + symptoms;

const relevantDrugs = $json.user_drug_inventory?.filter(drug => {
  const drugName = (drug.name || '').toLowerCase();
  const activeIngredient = (drug.active_ingredient || '').toLowerCase();
  const genericName = (drug.generic_name || '').toLowerCase();
  const dosageForm = (drug.dosage_form || '').toLowerCase();
  
  // Define condition-drug mappings based on drug names and forms
  const drugMappings = {
    pain: ['paracetamol', 'ibuprofen', 'analgin', 'aspirin', 'ketanov', 'dolmen'],
    headache: ['paracetamol', 'analgin', 'aspirin', 'migraine'],
    fever: ['paracetamol', 'ibuprofen', 'analgin', 'aspirin'],
    infection: ['antibiotic', 'amoxicillin', 'azithromycin', 'ciprofloxacin', 'ceftriaxone'],
    inflammation: ['ibuprofen', 'diclofenac', 'prednisolone', 'dexamethasone'],
    skin: ['cream', 'ointment', 'gel', 'topical'],
    wound: ['betadine', 'antiseptic', 'antibiotic', 'cream'],
    stomach: ['antacid', 'omeprazole', 'ranitidine'],
    allergy: ['antihistamine', 'loratadine', 'cetirizine', 'suprastin']
  };
  
  // Check if drug might be relevant
  let isRelevant = false;
  
  for (const [condition, drugKeywords] of Object.entries(drugMappings)) {
    if (searchText.includes(condition)) {
      isRelevant = drugKeywords.some(keyword => 
        drugName.includes(keyword) || 
        activeIngredient.includes(keyword) || 
        genericName.includes(keyword) ||
        (condition === 'skin' && ['cream', 'ointment', 'gel'].includes(dosageForm))
      );
      if (isRelevant) break;
    }
  }
  
  // Also check for direct name matches
  if (!isRelevant) {
    const searchWords = searchText.split(' ');
    isRelevant = searchWords.some(word => 
      word.length > 3 && (
        drugName.includes(word) || 
        activeIngredient.includes(word) || 
        genericName.includes(word)
      )
    );
  }
  
  return isRelevant && drug.stock_quantity > 0;
}) || [];

return [{
  json: {
    ...($json),
    relevant_drugs: relevantDrugs,
    has_relevant_drugs: relevantDrugs.length > 0,
    total_inventory_count: $json.user_drug_inventory?.length || 0,
    relevant_count: relevantDrugs.length
  }
}];
```

## Expected AI Response Format

The AI should now return enhanced responses that include specific drug suggestions using actual drug names from your inventory:

### Example Response for Headache with Available Inventory:

```json
{
  "primary_diagnosis": "Tension headache",
  "differential_diagnoses": ["Migraine", "Sinus headache"],
  "recommended_actions": ["Rest in quiet environment", "Apply cold compress to forehead"],
  "treatment": ["Pain relief", "Stress management", "Adequate hydration"],
  "drug_suggestions": [
    {
      "drug_name": "Analgin 500mg tabletes N20",
      "source": "inventory",
      "dosage": "1 tablet every 6 hours as needed",
      "duration": "Maximum 3 days",
      "instructions": "Take with water, preferably with food to avoid stomach upset",
      "prescription_required": false
    },
    {
      "drug_name": "Paracetamol Sopharma 500mg tabletes N20",
      "source": "inventory", 
      "dosage": "1-2 tablets every 4-6 hours",
      "duration": "As needed, do not exceed 8 tablets in 24 hours",
      "instructions": "Can be taken with or without food",
      "prescription_required": false
    }
  ],
  "severity_level": "low",
  "confidence_score": 0.92
}
```

### Example Response for Skin Issue with Available Inventory:

```json
{
  "primary_diagnosis": "Herpes simplex (cold sore)",
  "differential_diagnoses": ["Contact dermatitis", "Minor skin irritation"],
  "recommended_actions": ["Keep area clean and dry", "Avoid touching the affected area"],
  "treatment": ["Topical antiviral treatment", "Symptomatic relief"],
  "drug_suggestions": [
    {
      "drug_name": "Acic 50mg/g krēms 2g N1",
      "source": "inventory",
      "dosage": "Apply thin layer 5 times daily",
      "duration": "Continue for 4 days after healing begins",
      "instructions": "Apply to affected area and surrounding skin. Wash hands before and after application",
      "prescription_required": false
    },
    {
      "drug_name": "Betadine šķīdums 100mg/ml 30ml N1",
      "source": "inventory",
      "dosage": "Apply to clean area 2-3 times daily",
      "duration": "Until healing is complete", 
      "instructions": "For wound cleaning and antiseptic protection. May stain clothing",
      "prescription_required": false
    }
  ],
  "severity_level": "low",
  "confidence_score": 0.88
}
```

### Example Response with Mixed Inventory + External Drugs:

```json
{
  "primary_diagnosis": "Bacterial respiratory infection",
  "differential_diagnoses": ["Viral upper respiratory tract infection", "Bronchitis"],
  "recommended_actions": ["Rest and increase fluid intake", "Monitor temperature", "Seek medical attention if symptoms worsen"],
  "treatment": ["Antibiotic therapy", "Symptom management", "Supportive care"],
  "drug_suggestions": [
    {
      "drug_name": "Azibiot 500mg apvalkotās tabletes N3",
      "source": "inventory",
      "dosage": "1 tablet daily for 3 days",
      "duration": "3 days total",
      "instructions": "Take 1 hour before or 2 hours after meals. Complete the full course",
      "prescription_required": true
    },
    {
      "drug_name": "Paracetamol Sopharma 500mg tabletes N20", 
      "source": "inventory",
      "dosage": "1-2 tablets every 6 hours for fever",
      "duration": "As needed for symptom relief",
      "instructions": "For fever and pain relief. Take with water",
      "prescription_required": false
    },
    {
      "drug_name": "Expectorant syrup",
      "source": "external",
      "dosage": "10ml three times daily",
      "duration": "7-10 days",
      "instructions": "To help clear chest congestion. Available at pharmacy",
      "prescription_required": false
    }
  ],
  "severity_level": "moderate", 
  "confidence_score": 0.85
}
```

## Benefits

1. **Personalized Treatment**: AI suggests drugs the user actually has available
2. **Inventory Management**: Helps users utilize their existing stock
3. **Cost Effective**: Reduces need to purchase new medications
4. **Practical Recommendations**: Only suggests obtainable treatments
5. **Fallback Options**: Still provides external drug suggestions when needed

## Implementation Notes

- Drug inventory is only included if user has premium access
- Only drugs with stock > 0 are sent to the AI
- Sensitive information is excluded from the payload
- The system gracefully handles users without drug inventory
- All existing functionality remains unchanged for users without inventory access

## Testing

Test your enhanced workflow with both scenarios:

1. **With Drug Inventory**: User has relevant drugs in stock
2. **Without Drug Inventory**: User has no inventory or no relevant drugs
3. **Mixed Scenario**: User has some relevant drugs but may need additional medications

The AI should adapt its recommendations accordingly in each case.