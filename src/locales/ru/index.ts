// src/locales/ru/index.ts
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormRuTranslations } from './portPriceFinderForm';
import { dashboardPageRuTranslations } from './dashboardPage'; // Import dashboard translations
import { bestPricesPageRuTranslations } from './bestPricesPage'; // Import best prices translations

// This object will merge all partial Russian translation files.
export const partialRuTranslations: Partial<Translations> = {
  ...portPriceFinderFormRuTranslations,
  ...dashboardPageRuTranslations, // Merge dashboard translations
  ...bestPricesPageRuTranslations, // Merge best prices translations
  // ... other future partial Russian translations can be merged here
};
