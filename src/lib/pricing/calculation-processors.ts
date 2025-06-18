
// src/lib/pricing/calculation-processors.ts
import type { UseFormReturn } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { generatePricingCommentary, type PricingCommentaryInput } from "@/ai/flows/pricing-commentary";
import type {
  RouteFormValues,
  CombinedAiOutput,
  PricingDataContextType,
  CalculationDetailsForInstructions,
  ShipmentType,
  ContainerType,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, USD_RUB_CONVERSION_RATE } from './constants'; // Added VOSTOCHNIY_VARIANTS
import {
  findSeaPriceAndDetails,
  findRailLegDetails,
  findDropOffDetails,
  findSOCDropOffDetails,
  findDirectRailEntry,
  type SeaPriceInfo,
  type RailLegInfo,
  type DropOffInfo,
  type SOCDropOffInfo
} from './finders';
import { generateSeaPlusRailCandidates, generateDirectRailCandidates, generateDashboardCandidates } from './best-price-generators';
import { normalizeCityName, appendCommentary } from './utils'; // Added normalizeCityName and appendCommentary

// --- Helper Types ---
interface CalculationArgsBase {
  values: RouteFormValues;
  context: PricingDataContextType;
  toast: ReturnType<typeof useToast>['toast'];
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setShippingInfo: React.Dispatch<React.SetStateAction<CombinedAiOutput | null>>;
  setLastSuccessfulCalculation?: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>;
  setCachedShippingInfo: PricingDataContextType['setCachedShippingInfo'];
  setCachedLastSuccessfulCalculation?: PricingDataContextType['setCachedLastSuccessfulCalculation'];
}

interface BestPriceArgs {
  form: UseFormReturn<RouteFormValues>;
  context: PricingDataContextType;
  toast: ReturnType<typeof useToast>['toast'];
  setIsCalculatingBestPrice: React.Dispatch<React.SetStateAction<boolean>>;
  setShippingInfo: React.Dispatch<React.SetStateAction<CombinedAiOutput | null>>;
  setBestPriceResults: PricingDataContextType['setBestPriceResults'];
  setCachedFormValues: PricingDataContextType['setCachedFormValues'];
  setIsNavigatingToBestPrices: React.Dispatch<React.SetStateAction<boolean>>;
}


// --- AI Interaction and State Setting ---
async function callAiAndSetState(
  aiInputData: CombinedAiOutput,
  toast: ReturnType<typeof useToast>['toast'],
  setShippingInfo: React.Dispatch<React.SetStateAction<CombinedAiOutput | null>>,
  setCachedShippingInfo: PricingDataContextType['setCachedShippingInfo'],
  calcDetails: CalculationDetailsForInstructions | null,
  setLastSuccessfulCalculation: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>> | undefined,
  setCachedLastSuccessfulCalculation: PricingDataContextType['setCachedLastSuccessfulCalculation'] | undefined,
  finalCommentaryReason: string,
  partialPricing: boolean,
  noPricedComponents: boolean
) {
  let displayOutput: CombinedAiOutput = { ...aiInputData };

  if (noPricedComponents && finalCommentaryReason && aiInputData.originCity && (aiInputData.destinationCity || aiInputData.russianDestinationCity) ) {
    toast({ title: "Pricing Not Available", description: finalCommentaryReason, variant: "destructive" });

    if (aiInputData.shipmentType && aiInputData.originCity && (aiInputData.destinationCity || aiInputData.russianDestinationCity) ) {
        const pricingCommentaryInput: PricingCommentaryInput = {
            originCity: aiInputData.originCity,
            destinationCity: aiInputData.destinationCity || aiInputData.russianDestinationCity!,
            containerType: aiInputData.containerType,
            russianDestinationCity: aiInputData.russianDestinationCity
        };
        try {
            // const commentaryResponse = await generatePricingCommentary(pricingCommentaryInput);
            // displayOutput.commentary = commentaryResponse.commentary;
            // Instead of calling AI if no price, use the constructed reason
            displayOutput.commentary = finalCommentaryReason;
        } catch (e) {
            // console.error("AI commentary generation failed:", e);
            displayOutput.commentary = finalCommentaryReason; // Fallback to constructed reason
        }
    } else {
        displayOutput.commentary = finalCommentaryReason;
    }

    setShippingInfo(displayOutput);
    setCachedShippingInfo(displayOutput);
    if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null);
    if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);

  } else if (aiInputData.originCity || (aiInputData.directRailCityOfDeparture && aiInputData.directRailDestinationCity)) {
    // if (!finalCommentaryReason && aiInputData.shipmentType && aiInputData.originCity && (aiInputData.destinationCity || aiInputData.russianDestinationCity)) {
    //   const pricingCommentaryInput: PricingCommentaryInput = {
    //     originCity: aiInputData.originCity,
    //     destinationCity: aiInputData.destinationCity || aiInputData.russianDestinationCity!,
    //     containerType: aiInputData.containerType,
    //     russianDestinationCity: aiInputData.russianDestinationCity
    //   };
    //   try {
    //     const commentaryResponse = await generatePricingCommentary(pricingCommentaryInput);
    //     displayOutput.commentary = commentaryResponse.commentary;
    //   } catch (e) {
    //     console.error("AI commentary generation failed:", e);
    //     displayOutput.commentary = "AI commentary generation failed. Using fallback."; // Fallback
    //   }
    // } else {
      displayOutput.commentary = finalCommentaryReason; // Use constructed if it exists
    // }
    setShippingInfo(displayOutput);
    setCachedShippingInfo(displayOutput);

    if (calcDetails && setLastSuccessfulCalculation && setCachedLastSuccessfulCalculation) {
      setLastSuccessfulCalculation(calcDetails);
      setCachedLastSuccessfulCalculation(calcDetails);
    }

    if (finalCommentaryReason) {
      if (partialPricing && !noPricedComponents) {
        toast({ title: "Partial Pricing Info", description: finalCommentaryReason });
      }
      // No toast if full pricing and no specific failure commentary
    }
  } else {
    const fallbackCommentary = finalCommentaryReason || "Essential information missing for processing.";
    displayOutput.commentary = fallbackCommentary;
    setShippingInfo(displayOutput);
    setCachedShippingInfo(displayOutput);
    if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null);
    if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);
    toast({ title: "Processing Incomplete", description: fallbackCommentary, variant: "destructive" });
  }
}


// --- Main Exported Functions ---

export async function processSeaPlusRailCalculation({
  values, context, toast, setIsLoading, setShippingInfo, setLastSuccessfulCalculation,
  setCachedShippingInfo, setCachedLastSuccessfulCalculation
}: CalculationArgsBase ) {
  const { calculationMode } = context;
  const { shipmentType, originPort, destinationPort, seaLineCompany, containerType, russianDestinationCity } = values;

  if (calculationMode === "sea_plus_rail") {
    if (!originPort || !containerType) {
      toast({ variant: "destructive", title: "Missing Information", description: "Origin Port and Container Type are required for Sea+Rail." });
      setIsLoading(false); return;
    }
    if (!destinationPort && !russianDestinationCity) {
        toast({ variant: "destructive", title: "Missing Information", description: "Either Destination Port (Sea) or Final Destination City (Rail) is required for Sea+Rail." });
        setIsLoading(false); return;
    }
    if (shipmentType === "SOC" && !context.isSOCDropOffExcelDataLoaded) {
      toast({ variant: "destructive", title: "Missing Data", description: "SOC Drop-off Excel file not loaded. Required for SOC calculations."});
      setIsLoading(false); return;
    }
  }

  setIsLoading(true);
  setShippingInfo(null);
  if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null);
  setCachedShippingInfo(null);
  if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);

  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;
  const seaMargin = parseFloat(values.seaMargin || "0") || 0;
  const railMargin = parseFloat(values.railMargin || "0") || 0;

  const seaInfo = findSeaPriceAndDetails(values, context);
  let finalCommentary = seaInfo.commentaryReason;
  let railDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;

  let isFurtherRailJourney = false;
  if (russianDestinationCity && destinationPort) {
    const normSeaDest = normalizeCityName(destinationPort);
    const normRussianDest = normalizeCityName(russianDestinationCity);

    const seaDestIsVladHub = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normSeaDest);
    const seaDestIsVostHub = VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normSeaDest);

    if ((seaDestIsVladHub || seaDestIsVostHub) && normRussianDest !== normSeaDest) {
      isFurtherRailJourney = true;
    }
  }


  if (seaInfo.seaPriceNumeric !== null && seaInfo.matchedSeaRouteInfo && isFurtherRailJourney && destinationPort) {
    railDetails = findRailLegDetails(values, context, destinationPort, finalCommentary);
    finalCommentary = railDetails.commentaryReason;
  } else if (seaInfo.seaPriceNumeric === null && isFurtherRailJourney) {
    // If sea pricing failed, we cannot price the rail leg either
    finalCommentary += (finalCommentary ? " " : "") + `Cannot price rail to ${russianDestinationCity} as sea pricing failed.`;
    if (!railDetails) railDetails = { railLegFailed: true, commentaryReason: finalCommentary } as RailLegInfo; else railDetails.railLegFailed = true;
  }

  // Determine city for drop-off lookup
  let cityForDropOffLookup: string | undefined = undefined;
  if (shipmentType === "SOC" && russianDestinationCity) {
    cityForDropOffLookup = russianDestinationCity;
  } else if (shipmentType === "COC") {
    // If there's a successful further rail journey, drop-off is at the final Russian city
    if (isFurtherRailJourney && railDetails && !railDetails.railLegFailed && russianDestinationCity) {
        cityForDropOffLookup = russianDestinationCity;
    } 
    // If NO further rail journey, but the sea port is a hub (Vlad/Vost), drop-off is at that sea port
    else if (!isFurtherRailJourney && destinationPort && 
             (VLADIVOSTOK_VARIANTS.some(variant => normalizeCityName(destinationPort) === normalizeCityName(variant)) || 
              VOSTOCHNIY_VARIANTS.some(variant => normalizeCityName(destinationPort) === normalizeCityName(variant)))
            ) {
        cityForDropOffLookup = destinationPort;
    }
    // If sea port is NOT a hub, and NO further rail, then COC drop-off lookup might not be applicable or needs specific rule.
    // Current logic will try to use destinationPort if it's set and rail journey isn't happening or failed.
    else if (destinationPort) { // Default to sea port if other conditions not met
        cityForDropOffLookup = destinationPort;
    }
  }

  // Refactored conditional logic for COC Drop-off
  const canAttemptCOCDropOffSeaPriceOK = seaInfo.seaPriceNumeric !== null;
  const canAttemptCOCDropOffRailLegSuccess = isFurtherRailJourney && railDetails && !railDetails.railLegFailed;
  const canAttemptCOCDropOffSeaPortIsHub =
    !isFurtherRailJourney &&
    destinationPort &&
    (
      VLADIVOSTOK_VARIANTS.some(variant => normalizeCityName(destinationPort!) === normalizeCityName(variant)) ||
      VOSTOCHNIY_VARIANTS.some(variant => normalizeCityName(destinationPort!) === normalizeCityName(variant))
    );

  if (
    shipmentType === "COC" &&
    seaInfo.matchedSeaRouteInfo &&
    cityForDropOffLookup &&
    (canAttemptCOCDropOffSeaPriceOK || canAttemptCOCDropOffRailLegSuccess || canAttemptCOCDropOffSeaPortIsHub)
  ) {
    cocDropOffDetails = findDropOffDetails(values, context, cityForDropOffLookup, seaInfo.seaComment, finalCommentary);
    finalCommentary = cocDropOffDetails.commentaryReason;
  }
  // Attempt SOC Drop-off if applicable
  else if (shipmentType === "SOC" && seaInfo.matchedSeaRouteInfo && cityForDropOffLookup && originPort && containerType && context.isSOCDropOffExcelDataLoaded && destinationPort) {
    socDropOffDetails = findSOCDropOffDetails(values, context, cityForDropOffLookup, destinationPort, finalCommentary);
    finalCommentary = socDropOffDetails.commentaryReason;
  }


  const finalSeaPriceWithMargin = seaInfo.seaPriceNumeric !== null ? seaInfo.seaPriceNumeric + seaMargin : null;
  const finalRailBaseCost24tWithMargin = railDetails?.baseCost24t !== null && railDetails?.baseCost24t !== undefined ? railDetails.baseCost24t + railMargin : null;
  const finalRailBaseCost28tWithMargin = railDetails?.baseCost28t !== null && railDetails?.baseCost28t !== undefined ? railDetails.baseCost28t + railMargin : null;
  const finalRailBaseCost40HCWithMargin = railDetails?.baseCost40HC !== null && railDetails?.baseCost40HC !== undefined ? railDetails.baseCost40HC + railMargin : null;

  try {
    const hasAnyPricedSeaLeg = finalSeaPriceWithMargin !== null;
    const hasAnyPricedRailLeg = (containerType === "20DC" && (finalRailBaseCost24tWithMargin !== null || finalRailBaseCost28tWithMargin !== null)) || (containerType === "40HC" && finalRailBaseCost40HCWithMargin !== null);
    const isPandaLineForCOCDropOff = actualSeaLine?.toLowerCase().includes('panda express line');

    const hasPricedCOCDropOff = shipmentType === "COC" && (cocDropOffDetails?.costNumeric !== null || (cocDropOffDetails?.displayValue !== null && cocDropOffDetails?.displayValue.trim() !== "" && cocDropOffDetails?.displayValue.toLowerCase() !== "n/a") ) && !isPandaLineForCOCDropOff;
    const hasPricedSOCDropOff = shipmentType === "SOC" && (socDropOffDetails?.costNumeric !== null || (socDropOffDetails?.displayValue !== null && socDropOffDetails?.displayValue.trim() !== "" && socDropOffDetails?.displayValue.toLowerCase() !== "n/a"));

    const hasAnyPricedComponent = hasAnyPricedSeaLeg || (isFurtherRailJourney && hasAnyPricedRailLeg) || hasPricedCOCDropOff || hasPricedSOCDropOff;

    const aiInputData: CombinedAiOutput = {
      shipmentType, originCity: originPort!, destinationCity: destinationPort!, seaLineCompany: actualSeaLine, containerType: containerType!, seaCost: finalSeaPriceWithMargin, seaComment: seaInfo.seaComment,
      railCost20DC_24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCost20DC_28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railGuardCost20DC: containerType === "20DC" ? railDetails?.guardCost20DC : null,
      railCost40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null, railGuardCost40HC: containerType === "40HC" ? railDetails?.guardCost40HC : null,
      railArrivalStation: railDetails?.arrivalStation, railDepartureStation: railDetails?.departureStation,

      dropOffCost: shipmentType === "COC" ? cocDropOffDetails?.costNumeric : null,
      dropOffDisplayValue: shipmentType === "COC" ? cocDropOffDetails?.displayValue : null,
      dropOffComment: shipmentType === "COC" ? cocDropOffDetails?.comment : null,

      socDropOffCost: shipmentType === "SOC" ? socDropOffDetails?.costNumeric : null,
      socDropOffComment: shipmentType === "SOC" ? socDropOffDetails?.comment : null,

      socComment: seaInfo.socComment, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : (shipmentType === 'SOC' ? russianDestinationCity : undefined),
      commentary: '', // Placeholder, will be filled by callAiAndSetState
    };

    const calcDetails: CalculationDetailsForInstructions | null = hasAnyPricedComponent ? {
      shipmentType, originPort: originPort!, destinationPort: destinationPort!, seaLineCompany: actualSeaLine, containerType,
      russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : (shipmentType === 'SOC' ? russianDestinationCity : undefined),
      railArrivalStation: railDetails?.arrivalStation ?? undefined, railDepartureStation: railDetails?.departureStation ?? undefined,
      seaCostBase: seaInfo.seaPriceNumeric, seaMarginApplied: seaMargin, seaCostFinal: finalSeaPriceWithMargin, seaComment: seaInfo.seaComment,
      socComment: seaInfo.socComment,
      railCostBase24t: containerType === "20DC" ? railDetails?.baseCost24t : null, railCostBase28t: containerType === "20DC" ? railDetails?.baseCost28t : null, railGuardCost20DC: containerType === "20DC" ? railDetails?.guardCost20DC : null,
      railCostBase40HC: containerType === "40HC" ? railDetails?.baseCost40HC : null, railGuardCost40HC: containerType === "40HC" ? railDetails?.guardCost40HC : null,
      railMarginApplied: railMargin, railCostFinal24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCostFinal28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railCostFinal40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null,

      dropOffCost: shipmentType === "COC" ? cocDropOffDetails?.costNumeric : null,
      dropOffDisplayValue: shipmentType === "COC" ? cocDropOffDetails?.displayValue : null,
      dropOffComment: shipmentType === "COC" ? cocDropOffDetails?.comment : null,

      socDropOffCost: shipmentType === "SOC" ? socDropOffDetails?.costNumeric : null,
      socDropOffComment: shipmentType === "SOC" ? socDropOffDetails?.comment : null,
    } : null;

    const partialPricing = (
        railDetails?.railLegFailed ||
        (shipmentType === "COC" && cocDropOffDetails?.dropOffLegFailed && !isPandaLineForCOCDropOff) ||
        (shipmentType === "SOC" && socDropOffDetails?.socDropOffLegFailed)
      ) ?? false;

    await callAiAndSetState(aiInputData, toast, setShippingInfo, setCachedShippingInfo, calcDetails, setLastSuccessfulCalculation, setCachedLastSuccessfulCalculation, finalCommentary, partialPricing, !hasAnyPricedComponent);

  } catch (error) {
    console.error("Error processing Sea+Rail request:", error);
    if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null);
    if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);
    toast({ variant: "destructive", title: "Error", description: "Failed to process Sea+Rail request." });
  } finally {
    setIsLoading(false);
  }
}


export async function processDirectRailCalculation({
  values, context, toast, setIsLoading, setShippingInfo, setCachedShippingInfo
}: Omit<CalculationArgsBase, 'setLastSuccessfulCalculation' | 'setCachedLastSuccessfulCalculation'>) {
  setIsLoading(true);
  setShippingInfo(null);
  setCachedShippingInfo(null);

  const { directRailAgentName, directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms, directRailBorder } = values;
  if (!directRailAgentName || !directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms || !directRailBorder) {
    toast({ variant: "destructive", title: "Missing Information", description: "Please fill all fields for Direct Rail calculation." });
    setIsLoading(false); return;
  }

  const matchedEntry = findDirectRailEntry(values, context);
  let displayOutput: CombinedAiOutput;

  if (matchedEntry) {
    const finalDirectRailCost = matchedEntry.price; // This is the original Excel value
    const finalDirectRailCommentary = matchedEntry.commentary || ''; // Original commentary

    displayOutput = {
      directRailCityOfDeparture: matchedEntry.cityOfDeparture,
      directRailDepartureStation: matchedEntry.departureStation,
      directRailDestinationCity: matchedEntry.destinationCity,
      directRailBorder: matchedEntry.border,
      directRailCost: finalDirectRailCost, // Store the original value
      directRailETD: matchedEntry.etd,
      directRailCommentary: finalDirectRailCommentary, // Clean commentary
      directRailAgentName: matchedEntry.agentName,
      directRailIncoterms: matchedEntry.incoterms,
      commentary: finalDirectRailCommentary, // Main commentary is the clean Excel commentary
    };
    setShippingInfo(displayOutput);
    setCachedShippingInfo(displayOutput);
    toast({ title: "Direct Rail Price Found", description: "Details displayed below." });
  } else {
    displayOutput = {
        commentary: "No matching direct rail route found.",
        directRailCityOfDeparture: directRailCityOfDeparture,
        directRailDestinationCity: directRailDestinationCityDR,
        directRailAgentName: directRailAgentName,
        directRailIncoterms: directRailIncoterms,
        directRailBorder: directRailBorder,
    };
    setShippingInfo(displayOutput);
    setCachedShippingInfo(displayOutput);
    toast({ variant: "destructive", title: "No Direct Rail Route Found", description: "No matching direct rail route." });
  }
  setIsLoading(false);
}


export function calculateBestPrice({
  form, context, toast, setIsCalculatingBestPrice, setShippingInfo,
  setBestPriceResults, setCachedFormValues, setIsNavigatingToBestPrices
}: BestPriceArgs) {
  const values = form.getValues();
  const { calculationMode, excelRussianDestinationCitiesMasterList, isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, isSOCDropOffExcelDataLoaded, dashboardServiceSections } = context;

  setIsCalculatingBestPrice(true);
  setShippingInfo(null);
  setBestPriceResults(null);

  let potentialRoutes: BestPriceRoute[] = [];

  if (calculationMode === "sea_plus_rail") {
    if (!values.originPort || !values.containerType) {
      toast({ title: "Missing Info", description: "Select Origin Port & Container Type for Best Price (Sea+Rail)." });
      setIsCalculatingBestPrice(false); return;
    }
    if (excelRussianDestinationCitiesMasterList.length > 0 && !values.russianDestinationCity && values.shipmentType === "COC") {
      // Allow COC best price search without Russian Destination City IF a sea destination port is provided.
      // Rail leg will only be considered if russianDestinationCity is also provided.
      // This is implicitly handled by generateSeaPlusRailCandidates' internal logic.
    }
    if (values.shipmentType === "SOC" && !values.russianDestinationCity) {
        toast({ title: "Missing Info", description: "Select Destination City for Best Price (Sea+Rail SOC)." });
        setIsCalculatingBestPrice(false); return;
    }
    if (!isSeaRailExcelDataLoaded) {
      toast({ title: "Data Not Loaded", description: "Please load the Море + Ж/Д Excel file first." });
      setIsCalculatingBestPrice(false); return;
    }
    if (values.shipmentType === "SOC" && !isSOCDropOffExcelDataLoaded) {
        toast({ title: "Data Not Loaded", description: "Please load the SOC Drop-off Excel file for SOC Best Price calculation." });
        setIsCalculatingBestPrice(false); return;
    }
    potentialRoutes = generateSeaPlusRailCandidates(values, context);

    // Add Dashboard Candidates for COC Sea+Rail mode
    if (values.shipmentType === "COC" && isSeaRailExcelDataLoaded && dashboardServiceSections && dashboardServiceSections.length > 0) {
        const dashboardCandidates = generateDashboardCandidates(values, context);
        potentialRoutes = [...potentialRoutes, ...dashboardCandidates];
    }

  } else if (calculationMode === "direct_rail") {
    if (!values.directRailCityOfDeparture || !values.directRailDestinationCityDR || !values.directRailIncoterms) {
      toast({ title: "Missing Info", description: "Select City of Departure, Destination City, and Incoterms for Direct Rail Best Price." });
      setIsCalculatingBestPrice(false); return;
    }
     if (!isDirectRailExcelDataLoaded) {
      toast({ title: "Data Not Loaded", description: "Please load the Прямое ЖД Excel file first." });
      setIsCalculatingBestPrice(false); return;
    }
    potentialRoutes = generateDirectRailCandidates(values, context);
  }

  potentialRoutes.sort((a, b) => a.totalComparisonCostRUB - b.totalComparisonCostRUB);
  const top6Routes = potentialRoutes.slice(0, 6);

  setBestPriceResults(top6Routes);

  if (top6Routes.length > 0) {
    setCachedFormValues(values);
    setIsNavigatingToBestPrices(true);
  } else {
    toast({ title: "No Routes Found", description: "Could not find valid shipping routes for best price with the selected criteria." });
  }
  setIsCalculatingBestPrice(false);
}
