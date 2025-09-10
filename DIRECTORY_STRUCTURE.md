# Dimedio - Medical AI Diagnosis Platform

## Directory Structure

```
dimedio-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Doctor dashboard page
│   │   ├── diagnose/           # AI diagnosis interface page
│   │   ├── patients/           # Patient management page
│   │   ├── layout.tsx          # Root layout component
│   │   ├── page.tsx            # Homepage
│   │   └── globals.css         # Global styles
│   └── components/             # Reusable components
│       ├── layout/             # Layout components (header, nav, footer)
│       └── ui/                 # UI components (buttons, forms, cards)
├── public/                     # Static assets
└── package.json
```

## Page Structure

- **Homepage (/)** - Landing page with app overview and sign-up
- **Dashboard (/dashboard)** - Main doctor interface after login
- **Diagnose (/diagnose)** - AI-powered diagnosis tool
- **Patients (/patients)** - Patient management and history
- **History (/history)** - Diagnosis history and cases
- **Resources (/resources)** - Medical resources and documentation

## Component Organization

- **Layout Components** - Navigation, header, footer, sidebars
- **UI Components** - Buttons, forms, modals, cards, inputs
- **Feature Components** - Diagnosis form, patient cards, result displays

## Design System

- **Colors**: Emerald (primary), Slate (neutral), Blue/Purple (accents)
- **Typography**: Clean, medical-professional fonts
- **Style**: Swiss design principles - minimal, clean, functional