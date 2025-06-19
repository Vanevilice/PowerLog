
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ListOrdered, Loader2 } from 'lucide-react'; // Added Loader2
import type { BestPriceRoute, RouteFormValues, ContainerType } from '@/contexts/PricingDataContext';
import type { Translations } from '@/contexts/LocalizationContext';

interface BestPricesPageHeaderProps {
  bestPriceResultsCount: number;
  cachedFormValues: Partial<RouteFormValues> | null;
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
  selectedFilterContainerType: ContainerType | undefined;
  onFilterContainerTypeChange: (containerType: ContainerType) => void;
  isRecalculating: boolean; // New prop
}

export default function BestPricesPageHeader({
  bestPriceResultsCount,
  cachedFormValues,
  translate,
  selectedFilterContainerType,
  onFilterContainerTypeChange,
  isRecalculating, // Consuming new prop
}: BestPricesPageHeaderProps) {
  const isDirectRailMode = cachedFormValues?.calculationModeToggle === 'direct_rail';
  const formModeText = isDirectRailMode ? translate('calculationMode_DirectRail') : translate('calculationMode_SeaRail');

  const initialContainerType = cachedFormValues?.containerType;

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex-grow">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ListOrdered className="mr-3 h-8 w-8 text-primary" />
          {translate('bestPrices_Header_Title', { count: bestPriceResultsCount, mode: formModeText })}
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
                containerType: initialContainerType || translate('common_NA'), 
                shipmentType: cachedFormValues.shipmentType || translate('common_NA'),
              }) +
              (cachedFormValues.russianDestinationCity ? translate('bestPrices_Header_BasedOn_SeaRail_FinalDest', { finalDestCity: cachedFormValues.russianDestinationCity }) : '')
          }} />
        )}
      </div>
      {!isDirectRailMode && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant={selectedFilterContainerType === '20DC' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterContainerTypeChange('20DC')}
            className="px-4 py-2 rounded-md shadow-sm hover:shadow-md transition-shadow min-w-[80px]" // Added min-width
            disabled={isRecalculating} // Disable button if recalculating
          >
            {isRecalculating && selectedFilterContainerType === '20DC' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            20DC
          </Button>
          <Button
            variant={selectedFilterContainerType === '40HC' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterContainerTypeChange('40HC')}
            className="px-4 py-2 rounded-md shadow-sm hover:shadow-md transition-shadow min-w-[80px]" // Added min-width
            disabled={isRecalculating} // Disable button if recalculating
          >
            {isRecalculating && selectedFilterContainerType === '40HC' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            40HC
          </Button>
        </div>
      )}
    </header>
  );
}
