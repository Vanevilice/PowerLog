
"use client";

import React from 'react';
import { usePricingData, type ContainerType } from '@/contexts/PricingDataContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import NoBestPricesFound from '@/components/best-prices/NoBestPricesFound';
import BestPricesPageHeader from '@/components/best-prices/BestPricesPageHeader';
import BestPriceList from '@/components/best-prices/BestPriceList';
import BestPricesPageFooter from '@/components/best-prices/BestPricesPageFooter';
import { useBestPriceActions } from '@/hooks/useBestPriceActions';

export default function BestPricesPage() {
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { translate } = useLocalization();
  const { handleCopyRate, handleCreateInstructions } = useBestPriceActions();

  // State for the selected container type filter
  const [filterContainerType, setFilterContainerType] = React.useState<ContainerType | undefined>(
    cachedFormValues?.containerType
  );

  React.useEffect(() => {
    // Initialize or update filter if cachedFormValues change (e.g., on first load)
    if (cachedFormValues?.containerType && cachedFormValues.calculationModeToggle !== 'direct_rail') {
      setFilterContainerType(cachedFormValues.containerType);
    } else if (cachedFormValues?.calculationModeToggle === 'direct_rail') {
      setFilterContainerType(undefined); // No filter for direct rail
    }
  }, [cachedFormValues]);

  const handleFilterContainerTypeChange = (containerType: ContainerType) => {
    setFilterContainerType(containerType);
  };

  // Filter results based on the selected container type
  const displayedResults = React.useMemo(() => {
    if (!bestPriceResults) return [];
    if (cachedFormValues?.calculationModeToggle === 'direct_rail' || !filterContainerType) {
      // For direct rail or if no filter is set (though UI enforces a filter for sea+rail), show all
      return bestPriceResults;
    }
    return bestPriceResults.filter(route => route.containerType === filterContainerType);
  }, [bestPriceResults, filterContainerType, cachedFormValues?.calculationModeToggle]);


  if (!bestPriceResults || bestPriceResults.length === 0) {
    // This message shows if the initial fetch yielded no results.
    // If filtering results in an empty list, the BestPriceList will be empty but the header will show.
    return <NoBestPricesFound translate={translate} />;
  }
  
  // If after filtering, displayedResults is empty, but original bestPriceResults was not.
  const noResultsAfterFilter = displayedResults.length === 0 && bestPriceResults.length > 0;


  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <BestPricesPageHeader
        bestPriceResultsCount={displayedResults.length}
        cachedFormValues={cachedFormValues}
        translate={translate}
        selectedFilterContainerType={filterContainerType}
        onFilterContainerTypeChange={handleFilterContainerTypeChange}
      />

      {noResultsAfterFilter ? (
        <div className="text-center py-10">
          <p className="text-lg text-muted-foreground">
            No options found for container type: {filterContainerType}.
          </p>
          <p className="text-sm text-muted-foreground">
            Original calculation was for: {cachedFormValues?.containerType || 'N/A'}.
          </p>
        </div>
      ) : (
        <BestPriceList
          bestPriceResults={displayedResults}
          translate={translate}
          handleCopyRate={handleCopyRate}
          handleCreateInstructions={handleCreateInstructions}
        />
      )}

      <BestPricesPageFooter translate={translate} />
    </div>
  );
}

