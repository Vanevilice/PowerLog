
"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/contexts/LocalizationContext';
import type { BestPriceRoute } from '@/types';
import { generateCopyRateText } from '@/lib/pricing/copy-actions';
import { navigateToInstructionsPage } from '@/lib/pricing/navigation-actions'; // Import the new utility

export function useBestPriceActions() {
  const router = useRouter();
  const { toast } = useToast();
  const { translate } = useLocalization();

  const handleCopyRate = useCallback(async (route: BestPriceRoute, index: number) => {
    const textToCopy = generateCopyRateText(route, index, translate);

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: translate('toast_Success_Title'), description: translate('toast_BestPrices_RateCopied', { optionNumber: index + 1 }) });
    } catch (err) {
      toast({ variant: "destructive", title: translate('toast_CopyFailed_Title'), description: translate('toast_CopyFailed_Description') });
    }
  }, [translate, toast]);

  const handleCreateInstructions = useCallback((route: BestPriceRoute) => {
    navigateToInstructionsPage({ route, router, toast, translate }); // Use the utility function
  }, [router, toast, translate]);

  return { handleCopyRate, handleCreateInstructions };
}

