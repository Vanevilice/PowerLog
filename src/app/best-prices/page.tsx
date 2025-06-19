
"use client";

import React from 'react';
import Link from 'next/link';
// useRouter is no longer directly used here, it's in the hook.
import { usePricingData, type BestPriceRoute } from '@/contexts/PricingDataContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
// useToast is no longer directly used here, it's in the hook.
import { useLocalization } from '@/contexts/LocalizationContext';
import NoBestPricesFound from '@/components/best-prices/NoBestPricesFound';
import BestPricesPageHeader from '@/components/best-prices/BestPricesPageHeader';
import BestPriceCard from '@/components/best-prices/BestPriceCard';
import { useBestPriceActions } from '@/hooks/useBestPriceActions'; // Import the new hook

export default function BestPricesPage() {
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { translate } = useLocalization();
  const { handleCopyRate, handleCreateInstructions } = useBestPriceActions(); // Use the hook

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bestPriceResults.map((route, index) => (
          <BestPriceCard
            key={route.id}
            route={route}
            index={index}
            translate={translate}
            onCopyRate={handleCopyRate} // Pass the function from the hook
            onCreateInstructions={handleCreateInstructions} // Pass the function from the hook
          />
        ))}
      </div>
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

    
