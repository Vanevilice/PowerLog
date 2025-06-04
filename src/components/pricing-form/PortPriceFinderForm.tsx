
"use client";

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation"; // Keep for router instance if needed by helpers
import { Loader2, Copy, Edit3, Calculator, SearchCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  usePricingData,
  type RouteFormValues,
  type PricingDataContextType,
} from "@/contexts/PricingDataContext";
import { RouteSchema } from '@/lib/schemas';
import { handleCopyOutput, handleCreateInstructionsNavigation, handleDirectRailCopy } from '@/lib/pricing/ui-helpers';
import { usePricingFormEffects } from '@/hooks/usePricingFormEffects';
import { usePricingFormManager } from '@/hooks/usePricingFormManager'; // Import the new hook
import { DEFAULT_SEA_RAIL_FORM_VALUES, DEFAULT_DIRECT_RAIL_FORM_VALUES } from '@/lib/pricing/constants';
import { CommonFormFields } from './fields/CommonFormFields';
import { SeaRailFormFields } from './fields/SeaRailFormFields';
import { DirectRailFormFields } from './fields/DirectRailFormFields';
import { ShippingInfoDisplay } from './ShippingInfoDisplay';


export default function PortPriceFinderForm(): JSX.Element {
  const [hasRestoredFromCache, setHasRestoredFromCache] = React.useState(false);

  const { toast } = useToast(); // Keep for helpers if they still use it directly
  const router = useRouter(); // Keep for helpers
  const pricingContext = usePricingData();
  const {
    calculationMode,
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, isSOCDropOffExcelDataLoaded,
    excelOriginPorts, excelRussianDestinationCitiesMasterList,
    directRailAgents, directRailDepartureCities, directRailDestinationCitiesDR,
    directRailIncotermsList, directRailBordersList,
    localAvailableDirectRailAgents, localAvailableDirectRailIncoterms, localAvailableDirectRailBorders,
    cachedFormValues, // Still needed for initial form reset
  } = pricingContext;

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(RouteSchema),
    defaultValues: {
      ...DEFAULT_SEA_RAIL_FORM_VALUES,
      seaMargin: "",
      railMargin: "",
      ...DEFAULT_DIRECT_RAIL_FORM_VALUES,
      calculationModeToggle: calculationMode,
    },
  });
  const { handleSubmit, getValues } = form;

  // Instantiate the new hook
  const {
    isLoading,
    isCalculatingBestPrice,
    isParsingSeaRailFile,
    isParsingDirectRailFile,
    isParsingSOCDropOffFile,
    shippingInfo,
    lastSuccessfulCalculation,
    exchangeRate,
    isAnyParsing,
    onSubmitHandler,
    onSeaRailFileChangeWrapper,
    onDirectRailFileChangeWrapper,
    onSOCDropOffFileChangeWrapper,
    onCalculateBestPriceWrapper,
    handleSeaRailFileUploadClick,
    handleDirectRailFileUploadClick,
    handleSOCDropOffFileUploadClick,
    seaRailFileInputRef,
    directRailFileInputRef,
    socDropOffFileInputRef,
    getPriceButtonDisabled,
    calculateBestPriceButtonDisabled,
  } = usePricingFormManager({
    form,
    context: pricingContext,
    hasRestoredFromCache,
    setHasRestoredFromCache, // Pass the setter
  });


  // Effect for initial form reset from cache if data is loaded
  React.useEffect(() => {
    if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded || isSOCDropOffExcelDataLoaded) && !hasRestoredFromCache && cachedFormValues) {
      form.reset(cachedFormValues as RouteFormValues);
      if (cachedFormValues.calculationModeToggle && pricingContext.calculationMode !== cachedFormValues.calculationModeToggle) {
          pricingContext.setCalculationMode(cachedFormValues.calculationModeToggle);
      }
      // setHasRestoredFromCache will be called by file handlers after first successful parse.
      // If we want to mark restored after form.reset, it could be done here too.
      // For now, relying on file handlers.
    }
  }, [
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, isSOCDropOffExcelDataLoaded,
    hasRestoredFromCache, form.reset, cachedFormValues,
    pricingContext.calculationMode, pricingContext.setCalculationMode
  ]);

  // This hook handles dependent dropdown logic and other side effects based on form/context changes
  // It will now receive shippingInfo and lastSuccessfulCalculation from usePricingFormManager
  const [localAvailableDestinationPorts, setLocalAvailableDestinationPorts] = React.useState<string[]>([]);
  const [localAvailableSeaLines, setLocalAvailableSeaLines] = React.useState<string[]>([]);
  const [localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities] = React.useState<string[]>([]);
  const [localAvailableArrivalStations, setLocalAvailableArrivalStations] = React.useState<string[]>([]);

  usePricingFormEffects({
    form,
    context: pricingContext as PricingDataContextType,
    hasRestoredFromCache,
    localAvailableDestinationPorts, setLocalAvailableDestinationPorts,
    localAvailableSeaLines, setLocalAvailableSeaLines,
    localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities,
    localAvailableArrivalStations, setLocalAvailableArrivalStations,
    setShippingInfoState: () => {}, // Now managed by usePricingFormManager
    setLastSuccessfulCalculationState: () => {}, // Now managed by usePricingFormManager
  });


  const commonFormProps = {
    form, isParsingSeaRailFile, isParsingDirectRailFile, isParsingSOCDropOffFile,
    handleSeaRailFileUploadClick,
    handleDirectRailFileUploadClick,
    handleSOCDropOffFileUploadClick,
    seaRailFileInputRef, directRailFileInputRef, socDropOffFileInputRef,
    onSeaRailFileChange: onSeaRailFileChangeWrapper,
    onDirectRailFileChange: onDirectRailFileChangeWrapper,
    onSOCDropOffFileChange: onSOCDropOffFileChangeWrapper,
    calculationModeContext: calculationMode,
    setCalculationModeContext: pricingContext.setCalculationMode,
    exchangeRate,
  };

  const seaRailFormProps = {
    form, isParsingSeaRailFile, isSeaRailExcelDataLoaded,
    excelOriginPorts, localAvailableDestinationPorts, localAvailableSeaLines,
    excelRussianDestinationCitiesMasterList, localAvailableRussianDestinationCities,
    localAvailableArrivalStations, hasRestoredFromCache,
  };

  const directRailFormProps = {
    form, isParsingDirectRailFile, isDirectRailExcelDataLoaded,
    directRailDepartureCities, directRailDestinationCitiesDR,
    localAvailableDirectRailAgents, localAvailableDirectRailIncoterms, localAvailableDirectRailBorders,
    masterAgentList: directRailAgents, masterIncotermsList: directRailIncotermsList, masterBorderList: directRailBordersList,
  };

  return (
    <React.Fragment>
      <Card className="w-full max-w-xl mx-auto shadow-xl rounded-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-accent h-8 w-8"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M5 11h11"/><path d="m22 18-3-3 3-3"/><path d="M14 18h5"/></svg>
            PowerLog
          </CardTitle>
          <CardDescription>Calculate shipping costs and get insights for PowerLog.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6">
              <CommonFormFields {...commonFormProps} />
              {calculationMode === "sea_plus_rail" && <SeaRailFormFields {...seaRailFormProps} />}
              {calculationMode === "direct_rail" && <DirectRailFormFields {...directRailFormProps} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  type="submit"
                  disabled={getPriceButtonDisabled}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  {isLoading ? "Processing..." : "Get Price & Commentary"}
                </Button>
                <Button
                  type="button"
                  onClick={onCalculateBestPriceWrapper}
                  disabled={calculateBestPriceButtonDisabled}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isCalculatingBestPrice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
                  {isCalculatingBestPrice ? "Calculating..." : "Calculate Best Price"}
                </Button>
              </div>
            </form>
          </Form>

          {(isLoading || isCalculatingBestPrice || isAnyParsing) && !shippingInfo && (
            <div className="text-center p-6 mt-6 border rounded-lg bg-secondary/20 animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
              <p className="text-lg font-medium text-primary">
                {isCalculatingBestPrice ? "Calculating best prices..." : (isAnyParsing ? "Processing file..." : "Getting information...")}
              </p>
              <p className="text-sm text-muted-foreground">This may take a moment.</p>
            </div>
          )}

          {shippingInfo && !isLoading && !isAnyParsing && (
             <ShippingInfoDisplay
                shippingInfo={shippingInfo}
                calculationMode={calculationMode}
                getFormValues={getValues}
            />
          )}

          {(shippingInfo || (lastSuccessfulCalculation && calculationMode === 'sea_plus_rail')) &&
           !isLoading && !isAnyParsing && (
            <div className="mt-6 space-y-4 animate-in fade-in-50 duration-700">
              {calculationMode === 'sea_plus_rail' && (
                <>
                    <Button
                        onClick={() => handleCopyOutput({ isSeaRailExcelDataLoaded, shippingInfo, lastSuccessfulCalculation, formGetValues: getValues, toast, router })}
                        variant="outline"
                        className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary"
                    >
                        <Copy className="mr-2 h-4 w-4" /> Copy Full Output
                    </Button>
                    {lastSuccessfulCalculation && (
                        <Button
                        onClick={() => handleCreateInstructionsNavigation({ isSeaRailExcelDataLoaded, shippingInfo, lastSuccessfulCalculation, formGetValues: getValues, toast, router })}
                        variant="default"
                        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                        >
                        <Edit3 className="mr-2 h-4 w-4" /> Create Instructions
                        </Button>
                    )}
                </>
              )}
               {calculationMode === 'direct_rail' && shippingInfo && ('directRailCost' in shippingInfo || 'directRailCommentary' in shippingInfo) && (
                 <Button
                    onClick={() => handleDirectRailCopy(shippingInfo, toast)}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary"
                    >
                    <Copy className="mr-2 h-4 w-4" /> Copy Direct Rail Info
                 </Button>
               )}
            </div>
          )}
        </CardContent>
      </Card>
    </React.Fragment>
  );
}
    

    