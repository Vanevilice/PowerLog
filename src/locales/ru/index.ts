
// src/locales/ru/index.ts
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormRuTranslations } from './portPriceFinderForm';
import { dashboardPageRuTranslations } from './dashboardPage';
import { bestPricesPageRuTranslations } from './bestPricesPage';
import { faqPageRuTranslations } from './faqPage'; // New

// This object will merge all partial Russian translation files.
export const partialRuTranslations: Partial<Translations> = {
  ...portPriceFinderFormRuTranslations,
  ...dashboardPageRuTranslations,
  ...bestPricesPageRuTranslations,
  ...faqPageRuTranslations, // New
  // ... other future partial Russian translations can be merged here
};
