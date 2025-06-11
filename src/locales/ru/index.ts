// src/locales/ru/index.ts
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormRuTranslations } from './portPriceFinderForm';
import { dashboardPageRuTranslations } from './dashboardPage'; // Import dashboard translations

// This object will merge all partial Russian translation files.
export const partialRuTranslations: Partial<Translations> = {
  ...portPriceFinderFormRuTranslations,
  ...dashboardPageRuTranslations, // Merge dashboard translations
  // ... other future partial Russian translations can be merged here
};
