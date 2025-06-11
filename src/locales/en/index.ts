
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormEnTranslations } from './portPriceFinderForm';

// This object will merge all partial English translation files.
// For now, it only includes translations for the PortPriceFinderForm.
export const partialEnTranslations: Partial<Translations> = {
  ...portPriceFinderFormEnTranslations,
  // ... other future partial English translations can be merged here
};
