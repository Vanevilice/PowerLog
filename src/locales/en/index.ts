
// src/locales/en/index.ts
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormEnTranslations } from './portPriceFinderForm';
import { dashboardPageEnTranslations } from './dashboardPage';
import { bestPricesPageEnTranslations } from './bestPricesPage';
import { faqPageEnTranslations } from './faqPage';

// This object will merge all partial English translation files.
export const partialEnTranslations: Partial<Translations> = {
  ...portPriceFinderFormEnTranslations,
  ...dashboardPageEnTranslations,
  ...bestPricesPageEnTranslations,
  ...faqPageEnTranslations,
  // ... other future partial English translations can be merged here
};
