
"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/contexts/LocalizationContext';
import type { BestPriceRoute } from '@/types';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS } from '@/lib/pricing/constants';
import { normalizeCityName } from '@/lib/pricing/utils';
import { generateCopyRateText } from '@/lib/pricing/copy-actions'; // Import the new utility

export function useBestPriceActions() {
  const router = useRouter();
  const { toast } = useToast();
  const { translate } = useLocalization();

  const handleCopyRate = useCallback(async (route: BestPriceRoute, index: number) => {
    const textToCopy = generateCopyRateText(route, index, translate); // Use the utility function

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: translate('toast_Success_Title'), description: translate('toast_BestPrices_RateCopied', { optionNumber: index + 1 }) });
    } catch (err) {
      toast({ variant: "destructive", title: translate('toast_CopyFailed_Title'), description: translate('toast_CopyFailed_Description') });
    }
  }, [translate, toast]);

  const handleCreateInstructions = useCallback((route: BestPriceRoute) => {
    if (route.mode === 'direct_rail' || route.isDashboardRecommendation) {
        const messageKey = route.mode === 'direct_rail' ? 'toast_BestPrices_NotAvailable_DirectRailInstructions' : 'toast_BestPrices_NotAvailable_DirectRailInstructions';
        toast({ title: translate('toast_BestPrices_NotAvailable_Title'), description: translate(messageKey as keyof import('@/contexts/LocalizationContext').Translations) });
        return;
    }
    const queryParams = new URLSearchParams();
    if (route.originPort) queryParams.set('originPort', route.originPort);
    if (route.seaDestinationPort) queryParams.set('destinationPort', route.seaDestinationPort);
    if (route.seaLineCompany) queryParams.set('seaLineCompany', route.seaLineCompany);
    if (route.containerType && route.containerType !== 'N/A') queryParams.set('containerType', route.containerType);
    
    if (route.shipmentType === "COC" && route.seaComment) queryParams.set('seaComment', route.seaComment);
    if (route.shipmentType === "SOC" && route.socComment) queryParams.set('socComment', route.socComment);

    const normalizedSeaDestPortInstructions = normalizeCityName(route.seaDestinationPort || "");
    const normalizedRussianDestCityInstructions = normalizeCityName(route.russianDestinationCity || "");
    const isSeaDestHubInstructions = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPortInstructions) ||
                           VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPortInstructions);

    if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && isSeaDestHubInstructions && normalizedRussianDestCityInstructions !== normalizedSeaDestPortInstructions) {
        queryParams.set('russianDestinationCity', route.russianDestinationCity);
        if (route.railArrivalStation) queryParams.set('railArrivalStation', route.railArrivalStation);
        if (route.railDepartureStation) queryParams.set('railDepartureStation', route.railDepartureStation);
    }

    if (route.seaCostUSD !== null && route.seaCostUSD !== undefined) {
      queryParams.set('seaCostBase', route.seaCostUSD.toString());
      queryParams.set('seaCostFinal', route.seaCostUSD.toString());
    }

    queryParams.set('seaMarginApplied', '0');
    queryParams.set('railMarginApplied', '0');

    if (route.containerType === "20DC") { 
        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostBase24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostBase28t', route.railCost20DC_28t_RUB.toString());
        if (route.shipmentType === "COC" && route.railGuardCost20DC_RUB !== null && route.railGuardCost20DC_RUB > 0) queryParams.set('railGuardCost20DC', route.railGuardCost20DC_RUB.toString());

        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostFinal24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostFinal28t', route.railCost20DC_28t_RUB.toString());
    } else if (route.containerType === "40HC") { 
        if (route.railCost40HC_RUB !== null) queryParams.set('railCostBase40HC', route.railCost40HC_RUB.toString());
        if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null && route.railGuardCost40HC_RUB > 0) queryParams.set('railGuardCost40HC', route.railGuardCost40HC_RUB.toString());

        if (route.railCost40HC_RUB !== null) queryParams.set('railCostFinal40HC', route.railCost40HC_RUB.toString());
    }

    if (route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line')) {
        if (route.dropOffDisplayValue) {
             queryParams.set('dropOffCost', route.dropOffDisplayValue);
        } else if (route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined) {
            queryParams.set('dropOffCost', route.dropOffCostUSD.toString());
        }
        if (route.dropOffComment) queryParams.set('dropOffComment', route.dropOffComment);
    }
    
    if (route.shipmentType === "SOC") {
        if (route.socDropOffCostUSD !== null && route.socDropOffCostUSD !== undefined) queryParams.set('socDropOffCost', route.socDropOffCostUSD.toString());
        if (route.socDropOffComment) queryParams.set('socDropOffComment', route.socDropOffComment);
    }

    if (route.shipmentType && route.shipmentType !== 'N/A') queryParams.set('shipmentType', route.shipmentType);

    router.push("/instructions?" + queryParams.toString());
  }, [router, toast, translate]);

  return { handleCopyRate, handleCreateInstructions };
}
