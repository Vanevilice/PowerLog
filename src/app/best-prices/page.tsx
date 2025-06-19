
"use client";

import React from 'react';
import { usePricingData, type ContainerType, type RouteFormValues, type PricingDataContextType } from '@/contexts/PricingDataContext'; // Added RouteFormValues, PricingDataContextType
import { useLocalization } from '@/contexts/LocalizationContext';
import NoBestPricesFound from '@/components/best-prices/NoBestPricesFound';
import BestPricesPageHeader from '@/components/best-prices/BestPricesPageHeader';
import BestPriceList from '@/components/best-prices/BestPriceList';
import BestPricesPageFooter from '@/components/best-prices/BestPricesPageFooter';
import { useBestPriceActions } from '@/hooks/useBestPriceActions';
import { calculateBestPrice } from '@/lib/pricing/calculation-processors'; // NEW IMPORT
import { useToast } from '@/hooks/use-toast'; // NEW IMPORT
import { useRouter } from 'next/navigation'; // NEW IMPORT

export default function BestPricesPage() {
  const pricingContext = usePricingData();
  const {
    bestPriceResults,
    cachedFormValues,
    setBestPriceResults,
    setCachedFormValues,
    // Destructure other context properties needed by calculateBestPrice if any
    // For example: excelRouteData, excelSOCRouteData, excelRailData etc. are accessed via context object in calculateBestPrice
  } = pricingContext;

  const { translate } = useLocalization();
  const { handleCopyRate, handleCreateInstructions } = useBestPriceActions();
  const { toast } = useToast(); // NEW
  const router = useRouter(); // NEW - calculateBestPrice might have dependencies that use it

  const [filterContainerType, setFilterContainerType] = React.useState<ContainerType | undefined>(
    cachedFormValues?.containerType
  );
  const [isRecalculating, setIsRecalculating] = React.useState(false); // NEW STATE

  React.useEffect(() => {
    if (cachedFormValues?.containerType && cachedFormValues.calculationModeToggle !== 'direct_rail') {
      // If cached container type exists and matches current filter, or filter is undefined, set it.
      // This ensures the filter defaults to the calculated type.
      if (filterContainerType !== cachedFormValues.containerType) {
        setFilterContainerType(cachedFormValues.containerType);
      }
    } else if (cachedFormValues?.calculationModeToggle === 'direct_rail') {
      setFilterContainerType(undefined);
    }
  }, [cachedFormValues, filterContainerType]); // Added filterContainerType to dependencies

  const handleFilterContainerTypeChange = async (newContainerType: ContainerType) => {
    setFilterContainerType(newContainerType); // Optimistically update UI

    if (cachedFormValues && cachedFormValues.containerType !== newContainerType) {
      setIsRecalculating(true);
      try {
        // Ensure cachedFormValues has all necessary fields expected by RouteFormValues.
        // calculateBestPrice will update context's bestPriceResults and cachedFormValues.
        await calculateBestPrice({
          values: cachedFormValues as RouteFormValues, // Casting, assuming cachedFormValues is sufficiently complete
          context: pricingContext, // Pass the whole context
          toast,
          setIsCalculatingBestPrice: setIsRecalculating,
          setShippingInfo: () => {}, // Dummy function, not updating detailed shipping info from here
          setBestPriceResults,
          setCachedFormValues,
          setIsNavigatingToBestPrices: () => {}, // Dummy function, don't navigate from filter change
          overrideContainerType: newContainerType,
        });
      } catch (error) {
        console.error("Error recalculating best prices:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to refresh best prices for the selected container type." });
      } finally {
        setIsRecalculating(false);
      }
    }
  };

  const displayedResults = React.useMemo(() => {
    if (!bestPriceResults) return [];
    if (cachedFormValues?.calculationModeToggle === 'direct_rail' || !filterContainerType) {
      return bestPriceResults;
    }
    return bestPriceResults.filter(route => route.containerType === filterContainerType);
  }, [bestPriceResults, filterContainerType, cachedFormValues?.calculationModeToggle]);

  if (!cachedFormValues && !bestPriceResults) { // Handles case where user lands here without calculation
    return <NoBestPricesFound translate={translate} />;
  }
  
  // Condition for showing "No results found *after filtering*"
  const noResultsAfterFilter = displayedResults.length === 0 && bestPriceResults && bestPriceResults.length > 0;

  // Condition for showing "No results initially" (e.g. after a calculation yields nothing)
  const noInitialResults = (!bestPriceResults || bestPriceResults.length === 0) && !noResultsAfterFilter;


  if (noInitialResults) {
    return <NoBestPricesFound translate={translate} />;
  }
  
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <BestPricesPageHeader
        bestPriceResultsCount={displayedResults.length}
        cachedFormValues={cachedFormValues}
        translate={translate}
        selectedFilterContainerType={filterContainerType}
        onFilterContainerTypeChange={handleFilterContainerTypeChange}
        isRecalculating={isRecalculating} // Pass recalculating state
      />

      {noResultsAfterFilter ? (
        <div className="text-center py-10">
          <p className="text-lg text-muted-foreground">
            {translate('bestPrices_NoResults_Title')} for container type: {filterContainerType}.
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
