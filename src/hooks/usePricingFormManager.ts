
// src/hooks/usePricingFormManager.ts
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import type {
  RouteFormValues,
  PricingDataContextType,
  CombinedAiOutput,
  CalculationDetailsForInstructions,
} from '@/types';

import {
  handleSeaRailFileParse,
  handleDirectRailFileParse,
  handleSOCDropOffFileParse,
  type ExcelParserArgsBase,
} from '@/lib/pricing/form-file-handlers';
import {
  processSeaPlusRailCalculation,
  processDirectRailCalculation,
  calculateBestPrice,
} from '@/lib/pricing/calculation-processors';

interface UsePricingFormManagerProps {
  form: UseFormReturn<RouteFormValues>;
  context: PricingDataContextType;
  // hasRestoredFromCache is primarily read by usePricingFormEffects,
  // but the manager might need to know if initial setup is complete for some internal logic if any.
  hasRestoredFromCache: boolean;
  // setHasRestoredFromCache will be passed to file handlers by this manager.
  setHasRestoredFromCache: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePricingFormManager({
  form,
  context,
  hasRestoredFromCache,
  setHasRestoredFromCache,
}: UsePricingFormManagerProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCalculatingBestPrice, setIsCalculatingBestPrice] = React.useState(false);
  const [isParsingSeaRailFile, setIsParsingSeaRailFile] = React.useState(false);
  const [isParsingDirectRailFile, setIsParsingDirectRailFile] = React.useState(false);
  const [isParsingSOCDropOffFile, setIsParsingSOCDropOffFile] = React.useState(false);

  const [shippingInfo, setShippingInfo] = React.useState<CombinedAiOutput | null>(null);
  const [lastSuccessfulCalculation, setLastSuccessfulCalculation] = React.useState<CalculationDetailsForInstructions | null>(null);
  const [isNavigatingToBestPrices, setIsNavigatingToBestPrices] = React.useState(false);
  const [exchangeRate, setExchangeRate] = React.useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const seaRailFileInputRef = React.useRef<HTMLInputElement>(null);
  const directRailFileInputRef = React.useRef<HTMLInputElement>(null);
  const socDropOffFileInputRef = React.useRef<HTMLInputElement>(null);

  const { getValues } = form;

  // Effect to restore cached info once after initial form/context setup
  React.useEffect(() => {
    if (hasRestoredFromCache) { // Ensures this runs after initial cache check in PortPriceFinderForm
        if (context.cachedShippingInfo && !shippingInfo) {
            setShippingInfo(context.cachedShippingInfo);
        }
        if (context.cachedLastSuccessfulCalculation && !lastSuccessfulCalculation) {
            setLastSuccessfulCalculation(context.cachedLastSuccessfulCalculation);
        }
    }
  }, [hasRestoredFromCache, context.cachedShippingInfo, context.cachedLastSuccessfulCalculation, shippingInfo, lastSuccessfulCalculation]);


  React.useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    // This mock rate should ideally be fetched or configured
    const mockRate = 78.62;
    setExchangeRate("USD/RUB as of " + formattedDate + ": " + mockRate.toFixed(2));
  }, []);

  React.useEffect(() => {
    if (isNavigatingToBestPrices) {
      router.push('/best-prices');
      setIsNavigatingToBestPrices(false); // Reset after navigation attempt
    }
  }, [isNavigatingToBestPrices, router]);

  const onSubmitHandler = async (values: RouteFormValues) => {
    const currentCalculationMode = context.calculationMode;
    const calculationArgs = {
      values,
      context,
      toast,
      setIsLoading,
      setShippingInfo,
      setLastSuccessfulCalculation,
      setCachedShippingInfo: context.setCachedShippingInfo,
      setCachedLastSuccessfulCalculation: context.setCachedLastSuccessfulCalculation,
    };
    if (currentCalculationMode === 'sea_plus_rail') {
      await processSeaPlusRailCalculation(calculationArgs);
    } else if (currentCalculationMode === 'direct_rail') {
      await processDirectRailCalculation(calculationArgs); // Pass without the lastSuccessfulCalc setters if not needed
    }
  };

  // Base arguments for file handlers, now includes setHasRestoredFromCache
  const baseFileHandlerArgs: Omit<ExcelParserArgsBase, 'file' | 'fileInputRef' | 'setIsParsingState'> = {
    form,
    contextSetters: context,
    setShippingInfoState: setShippingInfo,
    setHasRestoredFromCacheState: setHasRestoredFromCache, // Pass the setter here
    toast,
    fileInputRef: seaRailFileInputRef, // This will be overridden but must be present for type
    setIsParsingState: setIsParsingSeaRailFile, // This will be overridden but must be present for type
    setBestPriceResults: context.setBestPriceResults,
  };

  const onSeaRailFileChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "File Error", description: "No file selected (Sea+Rail)." });
      if (seaRailFileInputRef.current) seaRailFileInputRef.current.value = "";
      return;
    }
    handleSeaRailFileParse({
      ...baseFileHandlerArgs,
      file,
      fileInputRef: seaRailFileInputRef,
      setIsParsingState: setIsParsingSeaRailFile,
    });
  };

  const onDirectRailFileChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "File Error", description: "No file selected (Direct Rail)." });
      if (directRailFileInputRef.current) directRailFileInputRef.current.value = "";
      return;
    }
    handleDirectRailFileParse({
      ...baseFileHandlerArgs,
      file,
      fileInputRef: directRailFileInputRef,
      setIsParsingState: setIsParsingDirectRailFile,
    });
  };

  const onSOCDropOffFileChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "File Error", description: "No file selected (SOC Drop-off)." });
      if (socDropOffFileInputRef.current) socDropOffFileInputRef.current.value = "";
      return;
    }
    handleSOCDropOffFileParse({
      ...baseFileHandlerArgs,
      file,
      fileInputRef: socDropOffFileInputRef,
      setIsParsingState: setIsParsingSOCDropOffFile,
    });
  };

  const onCalculateBestPriceWrapper = () => {
    calculateBestPrice({
      values: form.getValues(), // Pass form values directly
      context,
      toast,
      setIsCalculatingBestPrice,
      setShippingInfo,
      setBestPriceResults: context.setBestPriceResults,
      setCachedFormValues: context.setCachedFormValues,
      setIsNavigatingToBestPrices,
      // overrideContainerType is not passed here as this is for initial calculation
    });
  };

  const handleSeaRailFileUploadClick = () => seaRailFileInputRef.current?.click();
  const handleDirectRailFileUploadClick = () => directRailFileInputRef.current?.click();
  const handleSOCDropOffFileUploadClick = () => socDropOffFileInputRef.current?.click();

  const isAnyParsing = React.useMemo(
    () => isParsingSeaRailFile || isParsingDirectRailFile || isParsingSOCDropOffFile,
    [isParsingSeaRailFile, isParsingDirectRailFile, isParsingSOCDropOffFile]
  );

  const getPriceButtonDisabled = React.useMemo(() => {
    const currentFormValues = getValues();
    const { shipmentType } = currentFormValues;
    return (
      isLoading || isCalculatingBestPrice || isAnyParsing ||
      (context.calculationMode === "sea_plus_rail" && (
        !context.isSeaRailExcelDataLoaded ||
        !currentFormValues.originPort ||
        (!currentFormValues.destinationPort && !currentFormValues.russianDestinationCity) || // Needs either sea dest or rail dest
        !currentFormValues.containerType ||
        (shipmentType === "SOC" && (!context.isSOCDropOffExcelDataLoaded || !currentFormValues.russianDestinationCity)) // SOC needs SOC drop-off data and a Russian city
      )) ||
      (context.calculationMode === "direct_rail" && (
        !context.isDirectRailExcelDataLoaded ||
        !currentFormValues.directRailCityOfDeparture ||
        !currentFormValues.directRailDestinationCityDR ||
        !currentFormValues.directRailAgentName ||
        !currentFormValues.directRailIncoterms ||
        !currentFormValues.directRailBorder
      ))
    );
  }, [
      isLoading, isCalculatingBestPrice, isAnyParsing, context.calculationMode,
      context.isSeaRailExcelDataLoaded, context.isSOCDropOffExcelDataLoaded, context.isDirectRailExcelDataLoaded,
      form.watch('originPort'), form.watch('destinationPort'), form.watch('russianDestinationCity'), form.watch('containerType'), form.watch('shipmentType'),
      form.watch('directRailCityOfDeparture'), form.watch('directRailDestinationCityDR'), form.watch('directRailAgentName'), form.watch('directRailIncoterms'), form.watch('directRailBorder')
  ]);

  const calculateBestPriceButtonDisabled = React.useMemo(() => {
    const currentFormValues = getValues();
    const { shipmentType } = currentFormValues;
    return (
      isCalculatingBestPrice || isLoading || isAnyParsing ||
      (context.calculationMode === "sea_plus_rail" && (
        !context.isSeaRailExcelDataLoaded ||
        !currentFormValues.originPort ||
        !currentFormValues.containerType ||
        // For COC, russianDestinationCity is no longer a strict requirement for this button
        (shipmentType === "SOC" && (!context.isSOCDropOffExcelDataLoaded || !currentFormValues.russianDestinationCity)) // For SOC, SOC drop-off data and russianDestCity are required
      )) ||
      (context.calculationMode === "direct_rail" && (
        !context.isDirectRailExcelDataLoaded ||
        !currentFormValues.directRailCityOfDeparture ||
        !currentFormValues.directRailDestinationCityDR ||
        !currentFormValues.directRailIncoterms
        // Agent and Border are not strictly needed to *initiate* a best price search for direct rail,
        // as we might want to find best price across agents/borders if not specified.
        // This can be adjusted based on how `generateDirectRailCandidates` handles missing agent/border.
      ))
    );
  }, [
      isCalculatingBestPrice, isLoading, isAnyParsing, context.calculationMode,
      context.isSeaRailExcelDataLoaded, context.isSOCDropOffExcelDataLoaded, context.isDirectRailExcelDataLoaded,
      form.watch('originPort'), form.watch('containerType'), form.watch('russianDestinationCity'), form.watch('shipmentType'),
      form.watch('directRailCityOfDeparture'), form.watch('directRailDestinationCityDR'), form.watch('directRailIncoterms')
  ]);

  return {
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
  };
}

