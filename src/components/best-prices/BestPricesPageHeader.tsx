
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListOrdered, ArrowLeft } from 'lucide-react';
import type { BestPriceRoute, RouteFormValues } from '@/contexts/PricingDataContext';
import type { Translations } from '@/contexts/LocalizationContext';

interface BestPricesPageHeaderProps {
  bestPriceResults: BestPriceRoute[];
  cachedFormValues: Partial<RouteFormValues> | null;
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
}

export default function BestPricesPageHeader({ bestPriceResults, cachedFormValues, translate }: BestPricesPageHeaderProps) {
  const isDirectRailMode = bestPriceResults.some(r => r.mode === 'direct_rail');
  const formModeText = isDirectRailMode ? translate('calculationMode_DirectRail') : translate('calculationMode_SeaRail');

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ListOrdered className="mr-3 h-8 w-8 text-primary" />
          {translate('bestPrices_Header_Title', { count: bestPriceResults.length, mode: formModeText })}
        </h1>
        {cachedFormValues && (
          <p className="text-muted-foreground mt-1" dangerouslySetInnerHTML={{
            __html: isDirectRailMode ?
              translate('bestPrices_Header_BasedOn_DirectRail', {
                departureCity: cachedFormValues.directRailCityOfDeparture || translate('common_NA'),
                destinationCity: cachedFormValues.directRailDestinationCityDR || translate('common_NA'),
                incoterms: cachedFormValues.directRailIncoterms || translate('common_NA'),
              }) :
              translate('bestPrices_Header_BasedOn_SeaRail_Base', {
                originPort: cachedFormValues.originPort || translate('common_NA'),
                containerType: cachedFormValues.containerType || translate('common_NA'),
                shipmentType: cachedFormValues.shipmentType || translate('common_NA'),
              }) +
              (cachedFormValues.russianDestinationCity ? translate('bestPrices_Header_BasedOn_SeaRail_FinalDest', { finalDestCity: cachedFormValues.russianDestinationCity }) : '')
          }} />
        )}
      </div>
      <Button asChild variant="outline" className="mt-4 sm:mt-0">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
        </Link>
      </Button>
    </header>
  );
}
