
// src/lib/pricing/file-handlers/types.ts
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues,
  PricingDataContextType,
  CombinedAiOutput,
} from '@/types';
import type { useToast } from '@/hooks/use-toast';

export interface ExcelParserArgsBase {
  file: File;
  form: UseFormReturn<RouteFormValues>;
  contextSetters: PricingDataContextType;
  setShippingInfoState: (info: CombinedAiOutput | null) => void;
  setHasRestoredFromCacheState: (flag: boolean) => void; // Added this line
  toast: ReturnType<typeof useToast>['toast'];
  fileInputRef: React.RefObject<HTMLInputElement>;
  setIsParsingState: (isParsing: boolean) => void;
  setBestPriceResults: PricingDataContextType['setBestPriceResults'];
}


    