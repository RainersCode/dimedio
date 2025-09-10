export type Language = 'en' | 'lv';

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
];

export const defaultLanguage: Language = 'en';