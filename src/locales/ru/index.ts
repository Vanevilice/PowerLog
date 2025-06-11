
import type { Translations } from '@/contexts/LocalizationContext';
import { portPriceFinderFormRuTranslations } from './portPriceFinderForm';

// This object will merge all partial Russian translation files.
// For now, it only includes translations for the PortPriceFinderForm.
export const partialRuTranslations: Partial<Translations> = {
  ...portPriceFinderFormRuTranslations,
  // ... other future partial Russian translations can be merged here
};
