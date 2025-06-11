// src/locales/en/index.ts
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormEnTranslations } from './portPriceFinderForm';
import { dashboardPageEnTranslations } from './dashboardPage'; // Import dashboard translations

// This object will merge all partial English translation files.
export const partialEnTranslations: Partial<Translations> = {
  ...portPriceFinderFormEnTranslations,
  ...dashboardPageEnTranslations, // Merge dashboard translations
  // ... other future partial English translations can be merged here
};
