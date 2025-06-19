
"use client";

import React from 'react';
import { usePricingData } from '@/contexts/PricingDataContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import NoBestPricesFound from '@/components/best-prices/NoBestPricesFound';
import BestPricesPageHeader from '@/components/best-prices/BestPricesPageHeader';
import BestPriceList from '@/components/best-prices/BestPriceList';
import BestPricesPageFooter from '@/components/best-prices/BestPricesPageFooter'; // Import the new footer
import { useBestPriceActions } from '@/hooks/useBestPriceActions';

export default function BestPricesPage() {
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { translate } = useLocalization();
  const { handleCopyRate, handleCreateInstructions } = useBestPriceActions();

  if (!bestPriceResults || bestPriceResults.length === 0) {
    return <NoBestPricesFound translate={translate} />;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <BestPricesPageHeader
        bestPriceResults={bestPriceResults}
        cachedFormValues={cachedFormValues}
        translate={translate}
      />

      <BestPriceList
        bestPriceResults={bestPriceResults}
        translate={translate}
        handleCopyRate={handleCopyRate}
        handleCreateInstructions={handleCreateInstructions}
      />

      <BestPricesPageFooter translate={translate} /> {/* Use the new footer component */}
    </div>
  );
}
