
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
import { DEFAULT_SEA_RAIL_FORM_VALUES, DEFAULT_DIRECT_RAIL_FORM_VALUES, NONE_SEALINE_VALUE } from '@/lib/pricing/constants';
import { CommonFormFields } from './fields/CommonFormFields';
import { SeaRailFormFields } from './fields/SeaRailFormFields';
import { DirectRailFormFields } from './fields/DirectRailFormFields';
import { ShippingInfoDisplay } from './ShippingInfoDisplay';
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization


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
    cachedFormValues, 
  } = pricingContext;

  const { translate, language } = useLocalization(); 

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(RouteSchema),
    defaultValues: {
      ...DEFAULT_SEA_RAIL_FORM_VALUES, // Spread defaults first
      seaMargin: "", // Explicitly set if not in DEFAULT_SEA_RAIL_FORM_VALUES
      railMargin: "", // Explicitly set if not in DEFAULT_SEA_RAIL_FORM_VALUES
      ...DEFAULT_DIRECT_RAIL_FORM_VALUES, // Spread direct rail defaults
      calculationModeToggle: calculationMode, // Initialize with context's mode
      seaLineCompany: NONE_SEALINE_VALUE, // Ensure this default is set
    },
  });
  const { handleSubmit, getValues } = form;

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
    setHasRestoredFromCache, 
  });


  React.useEffect(() => {
    if (!hasRestoredFromCache) {
      if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded || isSOCDropOffExcelDataLoaded) && cachedFormValues) {
        const newResetValues = { ...DEFAULT_SEA_RAIL_FORM_VALUES, ...DEFAULT_DIRECT_RAIL_FORM_VALUES, ...cachedFormValues } as RouteFormValues;
        
        let modeToSetInContext = pricingContext.calculationMode;
        if (cachedFormValues.calculationModeToggle && pricingContext.calculationMode !== cachedFormValues.calculationModeToggle) {
          modeToSetInContext = cachedFormValues.calculationModeToggle;
          pricingContext.setCalculationMode(modeToSetInContext);
        }
        // Ensure the form's toggle reflects the mode that will be active (either from cache or current context)
        newResetValues.calculationModeToggle = modeToSetInContext;

        form.reset(newResetValues);
        setHasRestoredFromCache(true);
      } else if (!cachedFormValues) {
        // No cached values, ensure form defaults align with current context mode and mark as restored.
        form.reset({
          ...DEFAULT_SEA_RAIL_FORM_VALUES,
          ...DEFAULT_DIRECT_RAIL_FORM_VALUES,
          seaMargin: "", 
          railMargin: "",
          calculationModeToggle: pricingContext.calculationMode,
          seaLineCompany: NONE_SEALINE_VALUE,
        });
        setHasRestoredFromCache(true);
      }
    }
  }, [
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, isSOCDropOffExcelDataLoaded,
    cachedFormValues,
    hasRestoredFromCache,
    form, // form.reset, form.getValues implied
    pricingContext, // pricingContext.calculationMode, pricingContext.setCalculationMode implied
    setHasRestoredFromCache
  ]);


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

  const descriptionText = translate('powerLogDescription');


  return (
    <React.Fragment>
      <Card className="w-full max-w-xl mx-auto shadow-xl rounded-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-accent h-8 w-8"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M5 11h11"/><path d="m22 18-3-3 3-3"/><path d="M14 18h5"/></svg>
            {translate('powerLogTitle')}
          </CardTitle>
          <CardDescription>{descriptionText}</CardDescription>
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
                  {isLoading ? translate('processingButton') : translate('getPriceAndCommentary')}
                </Button>
                <Button
                  type="button"
                  onClick={onCalculateBestPriceWrapper}
                  disabled={isCalculatingBestPrice || calculateBestPriceButtonDisabled}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isCalculatingBestPrice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {translate('calculating')}
                    </>
                  ) : (
                    <>
                      <SearchCheck className="mr-2 h-4 w-4" />
                      {translate('calculateBestPrice')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>

          {(isLoading || isCalculatingBestPrice || isAnyParsing) && !shippingInfo && (
            <div className="text-center p-6 mt-6 border rounded-lg bg-secondary/20 animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
              <p className="text-lg font-medium text-primary">
                {isCalculatingBestPrice ? translate('loading_CalculatingBestPrices') : (isAnyParsing ? translate('loading_ProcessingFile') : translate('loading_GettingInfo'))}
              </p>
              <p className="text-sm text-muted-foreground">{translate('loading_MayTakeMoment')}</p>
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
    

    



    
