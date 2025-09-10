export const sampleComplaints = {
  en: [
    {
      id: 1,
      title: "Acute Pharyngitis",
      complaint: "Patient presents with 3-day history of severe odynophagia and sore throat. Physical examination reveals erythematous pharynx with bilateral tonsillar enlargement and exudate. Core body temperature elevated to 38.2°C. Patient reports mild non-productive cough with no adventitious lung sounds on auscultation. Mild rhinorrhea present without nasal congestion."
    },
    {
      id: 2,
      title: "Contact Dermatitis",
      complaint: "Patient reports 2-week history of pruritic erythematous lesions localized to bilateral antecubital and popliteal fossae. Affected areas demonstrate xerosis with desquamation and discrete erythematous patches. Symptoms exacerbated by exposure to alkaline soaps and cold water contact. No signs of secondary bacterial infection observed. Patient notes symptom intensification during nocturnal hours."
    },
    {
      id: 3,
      title: "Acute Gastroenteritis",
      complaint: "Patient presents with 48-hour onset of cramping abdominal pain, predominantly in the epigastric and periumbilical regions. Associated with frequent loose, watery stools (6-8 episodes daily) without hematochezia or melena. Reports nausea with two episodes of non-bilious vomiting. Mild dehydration noted with decreased skin turgor. No fever documented. Recent history of consuming undercooked poultry 72 hours prior to symptom onset."
    }
  ],
  lv: [
    {
      id: 1,
      title: "Akūts faringīts",
      complaint: "Pacients ierodas ar 3 dienu ilgu smagu odynophagias un rīkles sāpju anamnēzi. Fizikālā izmeklēšana atklāj eritematozu farinksu ar bilaterālu tonsillu palielināšanos un eksudātu. Pamata ķermeņa temperatūra paaugstināta līdz 38.2°C. Pacients ziņo par vieglu neproduktīvu klepus bez blakus plaušu skaņām auskultācijā. Viegla rinoreja bez deguna aizsprostojuma."
    },
    {
      id: 2,
      title: "Kontakta dermatīts", 
      complaint: "Pacients ziņo par 2 nedēļu ilgu niežošu eritematozu bojājumu anamnēzi, kas lokalizēti bilaterāli antecubital un popliteal fossae rajonos. Skartās zonas uzrāda kserozes ar deskvamāciju un diskrētiem eritemātiem plankumiem. Simptomi pastiprināšos no alkālu ziepes un auksta ūdens kontakta. Nav novērota sekundāras bakteriālas infekcijas pazīmes. Pacients atzīmē simptomu intensifikāciju nakts stundās."
    },
    {
      id: 3,
      title: "Akūts gastroenterīts",
      complaint: "Pacients ierodas ar 48 stundu sākumu krampjiem vēdera sāpēs, galvenokārt epigastrālajā un periumbilical rajonos. Saistīts ar biežām vaļīgām, ūdenainām bultām (6-8 epizodes dienā) bez hematochezia vai melena. Ziņo nelabumu ar divām ne-biliārām vemšanas epizodēm. Viegla dehidratācija atzīmēta ar samazinātu ādas turgoru. Nav dokumentēta drudzis. Nesena anamnēze par nepietiekami termisko tratētu mājputnu gaļu 72 stundas pirms simptomu sākuma."
    }
  ]
};

export type SampleComplaint = {
  id: number;
  title: string;
  complaint: string;
};