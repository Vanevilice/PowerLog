
"use client";

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, ControllerRenderProps, FieldValues } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  usePricingData,
  type RouteFormValues, // Consolidated type
  type SmartPricingOutput, // Consolidated type
  type PricingCommentaryOutput, // From types
  type CalculationDetailsForInstructions, // From types
  type CalculationMode, // From types
  type PricingDataContextType, // From types
} from "@/contexts/PricingDataContext"; // Context still provides data and setters

import { RouteSchema, type RouteFormValidationValues } from '@/lib/schemas';
import { calculateShippingCost } from "@/ai/flows/smart-pricing";
import { generatePricingCommentary, type PricingCommentaryInput } from "@/ai/flows/pricing-commentary";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { ArrowRightLeft, Calculator, Copy, Edit3, Loader2, SearchCheck } from "lucide-react";

import { CommonFormFields } from './fields/CommonFormFields';
import { SeaRailFormFields } from './fields/SeaRailFormFields';
import { DirectRailFormFields } from './fields/DirectRailFormFields';

import { handleSeaRailFileParse, handleDirectRailFileParse } from '@/lib/pricing/excel-parser';
import { processSeaPlusRailCalculation, processDirectRailCalculation, calculateBestPrice } from '@/lib/pricing/calculation-logic';
import { handleCopyOutput, handleCreateInstructionsNavigation, handleDirectRailCopy, formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { usePricingFormEffects } from '@/hooks/usePricingFormEffects';
import { DEFAULT_SEA_RAIL_FORM_VALUES, NONE_SEALINE_VALUE, DEFAULT_DIRECT_RAIL_FORM_VALUES } from '@/lib/pricing/constants';


export default function PortPriceFinderForm(): JSX.Element {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCalculatingBestPrice, setIsCalculatingBestPrice] = React.useState(false);
  const [isParsingSeaRailFile, setIsParsingSeaRailFile] = React.useState(false);
  const [isParsingDirectRailFile, setIsParsingDirectRailFile] = React.useState(false);

  const [shippingInfo, setShippingInfo] = React.useState<SmartPricingOutput | PricingCommentaryOutput | null>(null);
  const [lastSuccessfulCalculation, setLastSuccessfulCalculation] = React.useState<CalculationDetailsForInstructions | null>(null);
  const [hasRestoredFromCache, setHasRestoredFromCache] = React.useState(false);
  const [isNavigatingToBestPrices, setIsNavigatingToBestPrices] = React.useState(false);
  const [exchangeRate, setExchangeRate] = React.useState<string | null>(null);

  // Local states for filtered dropdown options - managed by usePricingFormEffects
  const [localAvailableDestinationPorts, setLocalAvailableDestinationPorts] = React.useState<string[]>([]);
  const [localAvailableSeaLines, setLocalAvailableSeaLines] = React.useState<string[]>([]);
  const [localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities] = React.useState<string[]>([]);
  const [localAvailableArrivalStations, setLocalAvailableArrivalStations] = React.useState<string[]>([]);

  const { toast } = useToast();
  const router = useRouter();
  const seaRailFileInputRef = React.useRef<HTMLInputElement>(null);
  const directRailFileInputRef = React.useRef<HTMLInputElement>(null);

  const pricingContext = usePricingData();
  const {
    calculationMode, setCalculationMode, // calculationMode directly from context
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded,
    excelOriginPorts, excelRussianDestinationCitiesMasterList,
    directRailAgents, directRailDepartureCities, directRailDestinationCitiesDR,
    directRailIncotermsList, directRailBordersList,
    cachedFormValues, cachedShippingInfo, cachedLastSuccessfulCalculation,
    setCachedFormValues, setCachedShippingInfo, setCachedLastSuccessfulCalculation,
    setBestPriceResults,
  } = pricingContext;

  const form = useForm<RouteFormValidationValues>({ // Use Zod-inferred type for validation
    resolver: zodResolver(RouteSchema),
    defaultValues: { // Ensure these match RouteFormValues and RouteSchema
      ...DEFAULT_SEA_RAIL_FORM_VALUES,
      ...DEFAULT_DIRECT_RAIL_FORM_VALUES,
      seaMargin: "", // Explicitly provide defaults for all fields in schema
      railMargin: "",
      calculationModeToggle: calculationMode, // Initialize toggle with context's mode
    },
  });
  const { handleSubmit, getValues, reset, watch, control } = form; // Added watch and control

  // Update calculationModeToggle in form when context's calculationMode changes
  React.useEffect(() => {
    if (watch('calculationModeToggle') !== calculationMode) {
      form.setValue('calculationModeToggle', calculationMode, {shouldValidate: false});
    }
  }, [calculationMode, form, watch]);


  // Restore from cache effects
  React.useEffect(() => {
    if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded) && !hasRestoredFromCache && cachedFormValues) {
      const formValuesToRestore: Partial<RouteFormValues> = {
        ...cachedFormValues,
        calculationModeToggle: calculationMode, // Ensure toggle matches current context mode
      };
      reset(formValuesToRestore as RouteFormValidationValues);
    }
  }, [isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, hasRestoredFromCache, reset, cachedFormValues, calculationMode]);

  React.useEffect(() => {
    if (cachedShippingInfo) setShippingInfo(cachedShippingInfo);
    if (cachedLastSuccessfulCalculation) setLastSuccessfulCalculation(cachedLastSuccessfulCalculation);
    if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded) && !hasRestoredFromCache) {
      setHasRestoredFromCache(true);
    }
  }, [isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, hasRestoredFromCache, cachedShippingInfo, cachedLastSuccessfulCalculation]);


  // Custom hook for managing form effects (dependent dropdowns, etc.)
  usePricingFormEffects({
    form,
    context: pricingContext,
    hasRestoredFromCache,
    localAvailableDestinationPorts, setLocalAvailableDestinationPorts,
    localAvailableSeaLines, setLocalAvailableSeaLines,
    localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities,
    localAvailableArrivalStations, setLocalAvailableArrivalStations,
    setShippingInfoState: setShippingInfo,
    setLastSuccessfulCalculationState: setLastSuccessfulCalculation,
  });

  // Fetch exchange rate (example)
  React.useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mockRate = 90.50;
    setExchangeRate("USD/RUB as of " + formattedDate + ": " + mockRate.toFixed(2));
  }, []);

  // Navigate to best prices page after state is updated
  React.useEffect(() => {
    if (isNavigatingToBestPrices) {
      router.push('/best-prices');
      setIsNavigatingToBestPrices(false); // Reset flag
    }
  }, [isNavigatingToBestPrices, router]);


  const onSubmitHandler = async (values: RouteFormValidationValues) => {
    // Use context's calculationMode for logic, values.calculationModeToggle is for UI sync
    const currentCalculationMode = pricingContext.calculationMode;
    const castedValues = values as RouteFormValues; // Cast to the general type for logic functions

    if (currentCalculationMode === 'sea_plus_rail') {
      await processSeaPlusRailCalculation({
        values: castedValues, context: pricingContext, toast,
        setIsLoading, setShippingInfo: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
        setLastSuccessfulCalculation,
        setCachedShippingInfo, setCachedLastSuccessfulCalculation
      });
    } else if (currentCalculationMode === 'direct_rail') {
      await processDirectRailCalculation({
        values: castedValues, context: pricingContext, toast,
        setIsLoading, setShippingInfo: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
        setLastSuccessfulCalculation,
        setCachedShippingInfo, setCachedLastSuccessfulCalculation
      });
    }
  };

  const onSeaRailFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleSeaRailFileParse({
        file, form: form as UseFormReturn<RouteFormValues>, contextSetters: pricingContext, // Pass all context setters
        setShippingInfoState: setShippingInfo,
        setHasRestoredFromCacheState: setHasRestoredFromCache,
        toast, fileInputRef: seaRailFileInputRef,
        setIsParsingState: setIsParsingSeaRailFile,
      });
    }
  };
  const onDirectRailFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleDirectRailFileParse({
        file, form: form as UseFormReturn<RouteFormValues>, contextSetters: pricingContext, // Pass all context setters
        setShippingInfoState: setShippingInfo,
        setHasRestoredFromCacheState: setHasRestoredFromCache,
        toast, fileInputRef: directRailFileInputRef,
        setIsParsingState: setIsParsingDirectRailFile,
      });
    }
  };

  const onCalculateBestPrice = () => {
    calculateBestPrice({
        form: form as UseFormReturn<RouteFormValues>, context: pricingContext, toast,
        setIsCalculatingBestPrice, setShippingInfo: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
        setBestPriceResults,
        setCachedFormValues, setIsNavigatingToBestPrices
    });
  };

  const commonFormProps = {
    form, isParsingSeaRailFile, isParsingDirectRailFile,
    handleSeaRailFileUploadClick: () => seaRailFileInputRef.current?.click(),
    handleDirectRailFileUploadClick: () => directRailFileInputRef.current?.click(),
    seaRailFileInputRef, directRailFileInputRef,
    handleSeaRailFileChange: onSeaRailFileChange,
    handleDirectRailFileChange: onDirectRailFileChange,
    calculationModeContext: calculationMode, // Pass context's calculationMode
    setCalculationModeContext: setCalculationMode, // Pass context's setter
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
    directRailDepartureCities, directRailDestinationCitiesDR, directRailAgents,
    directRailIncotermsList, directRailBordersList,
  };

  // For disabling buttons
  const currentFormValuesForButton = getValues();


  return (
    <React.Fragment>
      <Card className="w-full max-w-xl mx-auto shadow-xl rounded-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <ArrowRightLeft className="mr-2 h-8 w-8 text-accent" /> PowerLog
          </CardTitle>
          <CardDescription>Calculate shipping costs and get AI-powered insights for PowerLog.</CardDescription>
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
                  disabled={isLoading || isCalculatingBestPrice || isParsingSeaRailFile || isParsingDirectRailFile || (calculationMode === "sea_plus_rail" && (!isSeaRailExcelDataLoaded || !currentFormValuesForButton.originPort || !currentFormValuesForButton.destinationPort || !currentFormValuesForButton.containerType)) || (calculationMode === "direct_rail" && (!isDirectRailExcelDataLoaded || !currentFormValuesForButton.directRailCityOfDeparture || !currentFormValuesForButton.directRailDestinationCityDR || !currentFormValuesForButton.directRailAgentName || !currentFormValuesForButton.directRailIncoterms || !currentFormValuesForButton.directRailBorder ))}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  {isLoading ? "Processing..." : "Get Price & Commentary"}
                </Button>
                <Button
                  type="button"
                  onClick={onCalculateBestPrice}
                  disabled={isCalculatingBestPrice || isLoading || isParsingSeaRailFile || isParsingDirectRailFile || calculationMode === "direct_rail" || !isSeaRailExcelDataLoaded || !currentFormValuesForButton.originPort || !currentFormValuesForButton.containerType || (excelRussianDestinationCitiesMasterList.length > 0 && !currentFormValuesForButton.russianDestinationCity)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isCalculatingBestPrice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
                  {isCalculatingBestPrice ? "Calculating..." : "Calculate Best Price"}
                </Button>
              </div>
            </form>
          </Form>

          {isCalculatingBestPrice && (
            <div className="text-center p-6 mt-6 border rounded-lg bg-secondary/20 animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
              <p className="text-lg font-medium text-primary">Calculating best prices...</p>
              <p className="text-sm text-muted-foreground">This may take a moment.</p>
            </div>
          )}
          {(isLoading || isParsingSeaRailFile || isParsingDirectRailFile) && !shippingInfo && !isCalculatingBestPrice && (
            <div className="text-center p-6 mt-6 border rounded-lg bg-secondary/20 animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
              <p className="text-lg font-medium text-primary">{isParsingSeaRailFile || isParsingDirectRailFile ? "Processing file..." : "Getting information..."}</p>
              <p className="text-sm text-muted-foreground">This may take a moment.</p>
            </div>
          )}

          {shippingInfo && !isLoading && !isParsingSeaRailFile && !isParsingDirectRailFile && !isCalculatingBestPrice && (
            <div className="mt-6 p-6 border rounded-lg bg-background shadow-md animate-in fade-in-50 duration-500">
              <h3 className="text-xl font-semibold mb-3 text-primary border-b pb-2">Shipping Information</h3>
               <div className="space-y-2 text-sm">
                {calculationMode === "sea_plus_rail" && (
                    <>
                        <p className="flex justify-between"><strong>Shipment Type:</strong><span className="text-right text-primary">{currentFormValuesForButton.shipmentType}</span></p>
                        <p className="flex justify-between"><strong>Origin:</strong><span className="text-right text-primary">{currentFormValuesForButton.originPort}</span></p>
                        <p className="flex justify-between"><strong>Destination (Sea):</strong><span className="text-right text-primary">{currentFormValuesForButton.destinationPort}</span></p>
                        {currentFormValuesForButton.seaLineCompany && currentFormValuesForButton.seaLineCompany !== NONE_SEALINE_VALUE && (
                        <p className="flex justify-between"><strong>Sea Line:</strong><span className="text-right text-primary">{currentFormValuesForButton.seaLineCompany}</span></p>
                        )}
                        {currentFormValuesForButton.containerType && (
                        <p className="flex justify-between"><strong>Container:</strong><span className="text-right text-primary">{currentFormValuesForButton.containerType}</span></p>
                        )}
                         {'seaComment' in shippingInfo && shippingInfo.seaComment && (
                            <p className="flex justify-between items-start">
                            <strong>Sea Route Comment:</strong>
                            <span className={'text-xs text-right ml-2 ' + (currentFormValuesForButton.shipmentType === "COC" ? 'text-destructive' : 'text-muted-foreground')}>
                                {shippingInfo.seaComment}
                            </span>
                            </p>
                        )}
                        {'seaCost' in shippingInfo && shippingInfo.seaCost !== null && shippingInfo.seaCost !== undefined ? (
                        <p className="flex justify-between">
                            <strong>Sea Freight Cost:</strong>
                            <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.seaCost, 'USD')}</span>
                        </p>
                        ) : null}
                        {'socComment' in shippingInfo && shippingInfo.socComment && currentFormValuesForButton.shipmentType === "SOC" ? (
                        <p className="flex justify-between items-start">
                            <strong>SOC Comment:</strong>
                            <span className="text-xs text-muted-foreground text-right ml-2">{shippingInfo.socComment}</span>
                        </p>
                        ) : null}
                        {currentFormValuesForButton.russianDestinationCity && (
                        <p className="flex justify-between"><strong>Destination City:</strong><span className="text-right text-primary">{currentFormValuesForButton.russianDestinationCity}</span></p>
                        )}
                         {('railDepartureStation' in shippingInfo && shippingInfo.railDepartureStation && currentFormValuesForButton.russianDestinationCity) && (
                           <p className="flex justify-between">
                             <strong>Rail Dep. Station:</strong>
                             <span className="text-right text-primary">
                               {shippingInfo.railDepartureStation || "N/A"}
                             </span>
                           </p>
                         )}
                        {'railArrivalStation' in shippingInfo && shippingInfo.railArrivalStation && currentFormValuesForButton.russianDestinationCity && (
                        <p className="flex justify-between"><strong>Rail Arr. Station:</strong><span className="text-right text-primary">{shippingInfo.railArrivalStation}</span></p>
                        )}
                        {currentFormValuesForButton.containerType === "20DC" && (
                        <>
                            {'railCost20DC_24t' in shippingInfo && shippingInfo.railCost20DC_24t !== null && shippingInfo.railCost20DC_24t !== undefined ? (
                            <p className="flex justify-between">
                                <strong>Rail Freight Cost (&lt;24t):</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost20DC_24t, 'RUB')}</span>
                            </p>
                            ) : null}
                            {'railCost20DC_28t' in shippingInfo && shippingInfo.railCost20DC_28t !== null && shippingInfo.railCost20DC_28t !== undefined ? (
                            <p className="flex justify-between">
                                <strong>Rail Freight Cost (20DC &lt;28t):</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost20DC_28t, 'RUB')}</span>
                            </p>
                            ) : null}
                            {'railGuardCost20DC' in shippingInfo && shippingInfo.railGuardCost20DC !== null && shippingInfo.railGuardCost20DC !== undefined ? (
                            <p className="flex justify-between">
                                <strong>Rail Guard Cost (20DC):</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railGuardCost20DC, 'RUB')}</span>
                            </p>
                            ) : null}
                        </>
                        )}
                        {currentFormValuesForButton.containerType === "40HC" && (
                        <>
                            {'railCost40HC' in shippingInfo && shippingInfo.railCost40HC !== null && shippingInfo.railCost40HC !== undefined ? (
                            <p className="flex justify-between">
                                <strong>Rail Freight Cost (40HC):</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost40HC, 'RUB')}</span>
                            </p>
                            ) : null}
                            {'railGuardCost40HC' in shippingInfo && shippingInfo.railGuardCost40HC !== null && shippingInfo.railGuardCost40HC !== undefined ? (
                            <p className="flex justify-between">
                                <strong>Rail Guard Cost (40HC):</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railGuardCost40HC, 'RUB')}</span>
                            </p>
                            ) : null}
                        </>
                        )}
                        {'dropOffCost' in shippingInfo && shippingInfo.dropOffCost !== null && shippingInfo.dropOffCost !== undefined && currentFormValuesForButton.shipmentType === "COC" && !currentFormValuesForButton.seaLineCompany?.toLowerCase().includes('panda express line') ? (
                        <p className="flex justify-between">
                            <strong>Drop Off Cost:</strong>
                            <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.dropOffCost, 'USD')}</span>
                        </p>
                        ) : null}
                        {'dropOffComment' in shippingInfo && shippingInfo.dropOffComment && currentFormValuesForButton.shipmentType === "COC" ? (
                        <p className="flex justify-between items-start">
                            <strong>Drop Off Comment:</strong>
                            <span className="text-xs text-destructive text-right ml-2">{shippingInfo.dropOffComment}</span>
                        </p>
                        ) : null}
                         {shippingInfo.commentary && (
                          <p className="mt-4 pt-2 border-t text-xs text-muted-foreground">
                            <strong>AI Commentary:</strong> {shippingInfo.commentary}
                          </p>
                        )}
                    </>
                )}
                {calculationMode === "direct_rail" && shippingInfo && (
                    <>
                        <p className="flex justify-between"><strong>Agent:</strong><span className="text-right text-primary">{shippingInfo.directRailAgentName || 'N/A'}</span></p>
                        <p className="flex justify-between"><strong>City of Departure:</strong><span className="text-right text-primary">{shippingInfo.directRailCityOfDeparture || 'N/A'}</span></p>
                        <p className="flex justify-between"><strong>Departure Station:</strong><span className="text-right text-primary">{shippingInfo.directRailDepartureStation || 'N/A'}</span></p>
                        <p className="flex justify-between"><strong>Destination City:</strong><span className="text-right text-primary">{shippingInfo.directRailDestinationCity || 'N/A'}</span></p>
                        <p className="flex justify-between"><strong>Border:</strong><span className="text-right text-primary">{shippingInfo.directRailBorder || 'N/A'}</span></p>
                        <p className="flex justify-between"><strong>Incoterms:</strong><span className="text-right text-primary">{shippingInfo.directRailIncoterms || 'N/A'}</span></p>
                        {'directRailCost' in shippingInfo && shippingInfo.directRailCost !== null && shippingInfo.directRailCost !== undefined &&(
                             <p className="flex justify-between">
                                <strong>Railway Cost:</strong>
                                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.directRailCost, 'RUB')}</span>
                            </p>
                        )}
                        <p className="flex justify-between"><strong>ETD:</strong><span className="text-right text-primary">{shippingInfo.directRailETD || 'N/A'}</span></p>
                        {'directRailCommentary' in shippingInfo && shippingInfo.directRailCommentary && (
                            <p className="flex justify-between items-start">
                                <strong>Excel Commentary:</strong>
                                <span className="text-xs text-muted-foreground text-right ml-2">{shippingInfo.directRailCommentary}</span>
                            </p>
                        )}
                         {shippingInfo.commentary && ( // General AI commentary for direct rail might be available too
                          <p className="mt-4 pt-2 border-t text-xs text-muted-foreground">
                            <strong>AI Commentary:</strong> {shippingInfo.commentary}
                          </p>
                        )}
                    </>
                )}
              </div>
            </div>
          )}

          {(shippingInfo || (isSeaRailExcelDataLoaded && lastSuccessfulCalculation && calculationMode === 'sea_plus_rail')) && !isLoading && !isParsingSeaRailFile && !isParsingDirectRailFile && !isCalculatingBestPrice && (
            <div className="mt-6 space-y-4 animate-in fade-in-50 duration-700">
              {calculationMode === 'sea_plus_rail' && (
                <>
                    <Button
                        onClick={() => handleCopyOutput({ isSeaRailExcelDataLoaded, shippingInfo: shippingInfo as SmartPricingOutput | null, lastSuccessfulCalculation, formGetValues: getValues, toast, router })}
                        variant="outline"
                        className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary"
                    >
                        <Copy className="mr-2 h-4 w-4" /> Copy Full Output
                    </Button>
                    {lastSuccessfulCalculation && (
                        <Button
                        onClick={() => handleCreateInstructionsNavigation({ isSeaRailExcelDataLoaded, shippingInfo: shippingInfo as SmartPricingOutput | null, lastSuccessfulCalculation, formGetValues: getValues, toast, router })}
                        variant="default"
                        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                        >
                        <Edit3 className="mr-2 h-4 w-4" /> Create Instructions
                        </Button>
                    )}
                </>
              )}
               {calculationMode === 'direct_rail' && shippingInfo && ('directRailCost' in shippingInfo || 'commentary' in shippingInfo) && (
                 <Button
                    onClick={() => handleDirectRailCopy(shippingInfo as SmartPricingOutput, toast)}
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

    