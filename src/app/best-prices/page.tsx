
"use client";

import React from 'react';
import Link from 'next/link';
import { usePricingData } from '@/contexts/PricingDataContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import NoBestPricesFound from '@/components/best-prices/NoBestPricesFound';
import BestPricesPageHeader from '@/components/best-prices/BestPricesPageHeader';
import BestPriceList from '@/components/best-prices/BestPriceList'; // New import
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

      <BestPriceList // Using the new component
        bestPriceResults={bestPriceResults}
        translate={translate}
        handleCopyRate={handleCopyRate}
        handleCreateInstructions={handleCreateInstructions}
      />

       <div className="text-center mt-6">
        <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
            </Link>
        </Button>
      </div>
    </div>
  );
}
