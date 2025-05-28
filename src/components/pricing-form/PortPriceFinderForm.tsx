
"use client";

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation"; // Corrected import for App Router
import { Loader2, Copy, Edit3, Calculator, SearchCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  usePricingData,
  type RouteFormValues,
  type SmartPricingOutput,
  type PricingCommentaryOutput,
  type CalculationDetailsForInstructions,
  type PricingDataContextType,
} from "@/contexts/PricingDataContext";
import { RouteSchema } from '@/lib/schemas'; // Assuming schema is correctly defined
import { handleSeaRailFileParse, handleDirectRailFileParse } from '@/lib/pricing/excel-parser';
import { processSeaPlusRailCalculation, processDirectRailCalculation, calculateBestPrice } from '@/lib/pricing/calculation-logic';
import { handleCopyOutput, handleCreateInstructionsNavigation, handleDirectRailCopy } from '@/lib/pricing/ui-helpers'; // Corrected import
import { usePricingFormEffects } from '@/hooks/usePricingFormEffects';
import { DEFAULT_SEA_RAIL_FORM_VALUES, NONE_SEALINE_VALUE } from '@/lib/pricing/constants';
import { CommonFormFields } from './fields/CommonFormFields';
import { SeaRailFormFields } from './fields/SeaRailFormFields';
import { DirectRailFormFields } from './fields/DirectRailFormFields';
import { ShippingInfoDisplay } from './ShippingInfoDisplay';


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
    calculationMode,
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded,
    excelOriginPorts, excelRussianDestinationCitiesMasterList,
    directRailAgents, directRailDepartureCities, directRailDestinationCitiesDR,
    directRailIncotermsList, directRailBordersList,
    cachedFormValues, cachedShippingInfo, cachedLastSuccessfulCalculation,
    setCachedFormValues, setCachedShippingInfo, setCachedLastSuccessfulCalculation,
    setBestPriceResults,
  } = pricingContext;

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(RouteSchema),
    defaultValues: { // Ensure these align with RouteFormValues from types/index.ts
      ...DEFAULT_SEA_RAIL_FORM_VALUES, // Includes shipmentType, originPort, etc.
      seaMargin: "", // Explicitly set if not in DEFAULT_SEA_RAIL_FORM_VALUES
      railMargin: "", // Explicitly set
      directRailAgentName: "",
      directRailCityOfDeparture: "",
      directRailDestinationCityDR: "",
      directRailIncoterms: "",
      directRailBorder: "",
      calculationModeToggle: calculationMode,
    },
  });
  const { handleSubmit, getValues } = form;


  React.useEffect(() => {
    if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded) && !hasRestoredFromCache && cachedFormValues) {
      form.reset(cachedFormValues as RouteFormValues); // Ensure type alignment
    }
  }, [isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, hasRestoredFromCache, form.reset, cachedFormValues]);

  React.useEffect(() => {
    if (cachedShippingInfo) setShippingInfo(cachedShippingInfo);
    if (cachedLastSuccessfulCalculation) setLastSuccessfulCalculation(cachedLastSuccessfulCalculation);
    if ((isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded) && !hasRestoredFromCache) {
      setHasRestoredFromCache(true);
    }
  }, [isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, hasRestoredFromCache, cachedShippingInfo, cachedLastSuccessfulCalculation]);

  usePricingFormEffects({
    form,
    context: pricingContext as PricingDataContextType, // Ensure context type is passed correctly
    hasRestoredFromCache,
    localAvailableDestinationPorts, setLocalAvailableDestinationPorts,
    localAvailableSeaLines, setLocalAvailableSeaLines,
    localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities,
    localAvailableArrivalStations, setLocalAvailableArrivalStations,
    setShippingInfoState: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
    setLastSuccessfulCalculationState: setLastSuccessfulCalculation,
  });

  React.useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mockRate = 90.50;
    setExchangeRate("USD/RUB as of " + formattedDate + ": " + mockRate.toFixed(2));
  }, []);

  React.useEffect(() => {
    if (isNavigatingToBestPrices) {
      router.push('/best-prices');
      setIsNavigatingToBestPrices(false);
    }
  }, [isNavigatingToBestPrices, router]);

  const onSubmitHandler = async (values: RouteFormValues) => {
    const currentCalculationMode = pricingContext.calculationMode;
    if (currentCalculationMode === 'sea_plus_rail') {
      await processSeaPlusRailCalculation({
        values, context: pricingContext, toast,
        setIsLoading, setShippingInfo: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
        setLastSuccessfulCalculation,
        setCachedShippingInfo, setCachedLastSuccessfulCalculation
      });
    } else if (currentCalculationMode === 'direct_rail') {
      await processDirectRailCalculation({
        values, context: pricingContext, toast,
        setIsLoading, setShippingInfo: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>,
        setLastSuccessfulCalculation,
        setCachedShippingInfo, setCachedLastSuccessfulCalculation
      });
    }
  };

  const onSeaRailFileChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        variant: "destructive",
        title: "File Error",
        description: "No file selected or the file could not be accessed.",
      });
      if (seaRailFileInputRef.current) {
        seaRailFileInputRef.current.value = "";
      }
      return;
    }
    handleSeaRailFileParse({
      file,
      form: form as any, // Using 'as any' for form if type inference is tricky, ensure compatibility
      contextSetters: pricingContext,
      setShippingInfoState: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | PricingCommentaryOutput | null>>,
      setHasRestoredFromCacheState: setHasRestoredFromCache,
      toast,
      fileInputRef: seaRailFileInputRef,
      setIsParsingState: setIsParsingSeaRailFile,
      setBestPriceResults,
    });
  };

  const onDirectRailFileChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        variant: "destructive",
        title: "File Error",
        description: "No file selected or the file could not be accessed.",
      });
      if (directRailFileInputRef.current) {
        directRailFileInputRef.current.value = "";
      }
      return;
    }
    handleDirectRailFileParse({
      file,
      form: form as any,
      contextSetters: pricingContext,
      setShippingInfoState: setShippingInfo as React.Dispatch<React.SetStateAction<SmartPricingOutput | PricingCommentaryOutput | null>>,
      setHasRestoredFromCacheState: setHasRestoredFromCache,
      toast,
      fileInputRef: directRailFileInputRef,
      setIsParsingState: setIsParsingDirectRailFile,
      setBestPriceResults, // Ensure setBestPriceResults is passed if needed, or remove if not for direct rail
    });
  };
  
  const onCalculateBestPriceWrapper = () => {
    calculateBestPrice({
        form: form as any, // Using 'as any' for form, ensure compatibility
        context: pricingContext, toast,
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
    onSeaRailFileChange: onSeaRailFileChangeWrapper, // Changed from handleSeaRailFileChange
    onDirectRailFileChange: onDirectRailFileChangeWrapper, // Changed from handleDirectRailFileChange
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
    directRailDepartureCities, directRailDestinationCitiesDR, directRailAgents,
    directRailIncotermsList, directRailBordersList,
  };

  const currentFormValuesForButton = getValues();

  return (
    <React.Fragment>
      <Card className="w-full max-w-xl mx-auto shadow-xl rounded-xl bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
             {/* Adjusted Icon and Title */}
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-accent h-8 w-8"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M5 11h11"/><path d="m22 18-3-3 3-3"/><path d="M14 18h5"/></svg>
            PowerLog
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
                  onClick={onCalculateBestPriceWrapper}
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
             <ShippingInfoDisplay
                shippingInfo={shippingInfo}
                calculationMode={calculationMode}
                getFormValues={getValues} // Pass getValues to ShippingInfoDisplay
            />
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
                    onClick={() => handleDirectRailCopy(shippingInfo as SmartPricingOutput, toast)} // Ensure shippingInfo type matches expected
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

