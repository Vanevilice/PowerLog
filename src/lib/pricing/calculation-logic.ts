
// src/lib/pricing/calculation-logic.ts
import type { UseFormReturn } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { calculateShippingCost } from "@/ai/flows/smart-pricing";
import { generatePricingCommentary, type PricingCommentaryInput } from "@/ai/flows/pricing-commentary";
import type {
  RouteFormValues, CombinedAiOutput, PricingDataContextType, ExcelRoute, ExcelSOCRoute,
  RailDataEntry, DirectRailEntry, BestPriceRoute, CalculationDetailsForInstructions,
  ShipmentType, ContainerType,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, USD_RUB_CONVERSION_RATE, DROP_OFF_TRIGGER_PHRASES } from './constants';

// --- Helper Types ---
interface CalculationArgsBase {
  values: RouteFormValues;
  context: PricingDataContextType;
  toast: ReturnType<typeof useToast>['toast'];
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setShippingInfo: React.Dispatch<React.SetStateAction<CombinedAiOutput | null>>;
  setLastSuccessfulCalculation?: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>; // Made optional for direct rail
  setCachedShippingInfo: PricingDataContextType['setCachedShippingInfo'];
  setCachedLastSuccessfulCalculation?: PricingDataContextType['setCachedLastSuccessfulCalculation']; // Made optional for direct rail
}

interface SeaPriceInfo {
  seaPriceNumeric: number | null;
  matchedSeaRouteInfo?: ExcelRoute | ExcelSOCRoute;
  seaComment: string | null;
  socComment: string | null;
  commentaryReason: string;
}

interface RailLegInfo {
  baseCost24t: number | null;
  baseCost28t: number | null;
  guardCost20DC: number | null;
  baseCost40HC: number | null;
  guardCost40HC: number | null;
  arrivalStation: string | null;
  departureStation: string | null;
  railLegFailed: boolean;
  commentaryReason: string;
}

interface DropOffInfo {
  costNumeric: number | null;
  displayValue: string | null;
  comment: string | null;
  dropOffLegFailed: boolean;
  commentaryReason: string;
}

// --- Helper Functions ---

function parseFirstNumberFromString(priceString: string | number | null): number | null {
  if (typeof priceString === 'number') return priceString;
  if (typeof priceString === 'string') {
    const match = priceString.match(/(\d+(\.\d+)?)/);
    if (match && match[1]) return parseFloat(match[1]);
  }
  return null;
}

function findSeaPriceAndDetails(
  values: RouteFormValues,
  context: PricingDataContextType
): SeaPriceInfo {
  const { shipmentType, originPort, destinationPort, seaLineCompany, containerType } = values;
  const { excelRouteData, excelSOCRouteData } = context;

  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;
  let foundSeaPrice: number | string | null = null;
  let matchedSeaRouteInfo: ExcelRoute | ExcelSOCRoute | undefined;
  let commentaryReason = "";
  let foundSocComment: string | null = null;
  let foundSeaComment: string | null = null;

  const currentSeaDataset = shipmentType === "COC" ? excelRouteData : excelSOCRouteData;
  const originFieldKey = shipmentType === "COC" ? "originPorts" : "departurePorts";
  const price20DCKey = "price20DC";
  const price40HCKey = "price40HC";

  for (const route of currentSeaDataset) {
    const routeOrigins = route[originFieldKey as keyof typeof route] as string[] | undefined;
    const isOriginMatch = originPort && Array.isArray(routeOrigins) && routeOrigins.includes(originPort);
    const isDestinationMatch = destinationPort && Array.isArray(route.destinationPorts) && route.destinationPorts.includes(destinationPort);

    if (isOriginMatch && isDestinationMatch) {
      const isSeaLineMatch = actualSeaLine ? (Array.isArray(route.seaLines) && route.seaLines.includes(actualSeaLine)) : true;
      if (isSeaLineMatch) {
        const priceForContainer = containerType === "20DC" ? route[price20DCKey] : route[price40HCKey];
        if (priceForContainer !== null) {
          foundSeaPrice = priceForContainer;
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = ""; break;
        } else if (!foundSeaPrice && !matchedSeaRouteInfo) {
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = `Sea pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort}${actualSeaLine ? ` via ${actualSeaLine}` : ""} is not available in Excel.`;
        }
      } else if (!actualSeaLine && !foundSeaPrice && !matchedSeaRouteInfo && Array.isArray(route.seaLines) && route.seaLines.length > 0) {
        const priceForContainer = containerType === "20DC" ? route[price20DCKey] : route[price40HCKey];
        if (priceForContainer === null && !matchedSeaRouteInfo) {
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = `Pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort} is not available for any sea line.`;
        }
      }
    }
  }
  const seaPriceNumeric = typeof foundSeaPrice === 'string' ? parseFirstNumberFromString(foundSeaPrice) : foundSeaPrice;

  if (!matchedSeaRouteInfo && !commentaryReason) {
    commentaryReason = `No sea route found in Excel for ${originPort} to ${destinationPort} for ${shipmentType} shipment.`;
  } else if (seaPriceNumeric === null && matchedSeaRouteInfo && !commentaryReason.startsWith(`Sea pricing for ${containerType}`)) {
    commentaryReason = `Sea pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort}${actualSeaLine ? ` via ${actualSeaLine}` : ""} is not available in Excel.`;
  }
  
  return { seaPriceNumeric, matchedSeaRouteInfo, seaComment: foundSeaComment, socComment: foundSocComment, commentaryReason };
}

function findRailLegDetails(
  values: RouteFormValues,
  context: PricingDataContextType,
  seaDestinationPort: string,
  currentCommentary: string
): RailLegInfo {
  const { containerType, russianDestinationCity, arrivalStationSelection } = values;
  const { excelRailData } = context;

  let railInfo: RailLegInfo = {
    baseCost24t: null, baseCost28t: null, guardCost20DC: null,
    baseCost40HC: null, guardCost40HC: null,
    arrivalStation: null, departureStation: null,
    railLegFailed: false, commentaryReason: currentCommentary,
  };

  if (!russianDestinationCity) { // Ensure russianDestinationCity is present
      railInfo.railLegFailed = true;
      railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + "Russian Destination City not specified for rail leg calculation.";
      return railInfo;
  }

  let railCostFound = false;
  const seaDestPortLower = seaDestinationPort.toLowerCase();
  const seaDestPortBaseName = seaDestinationPort.split(" ")[0].toLowerCase();

  for (const railEntry of excelRailData) {
    if (railEntry.cityOfArrival.toLowerCase() !== russianDestinationCity.toLowerCase()) continue;
    if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection)) continue;

    const compatibleDepartureStation = railEntry.departureStations.find(depStation => {
      const pStationLower = depStation.toLowerCase().trim();
      if (seaDestPortLower.includes("пл")) return pStationLower.includes("пасифик лоджистик");
      const specificSeaHubKeywordMatch = seaDestinationPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split(/[/\s-]+/).map(s => s.trim()).filter(Boolean) : [];
      if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
      return pStationLower.includes(seaDestPortBaseName) || seaDestPortLower.includes(pStationLower);
    });

    if (compatibleDepartureStation) {
      railInfo.departureStation = compatibleDepartureStation;
      railInfo.arrivalStation = arrivalStationSelection || railEntry.arrivalStations[0];
      if (containerType === "20DC") {
        // Ensure prices are not null before assigning
        if (railEntry.price20DC_24t !== null && railEntry.guardCost20DC !== null) { // Check for 24t as primary for 20DC
          railInfo.baseCost24t = railEntry.price20DC_24t;
          railInfo.baseCost28t = railEntry.price20DC_28t; // Can be null if only 24t is priced
          railInfo.guardCost20DC = railEntry.guardCost20DC;
          railCostFound = true; 
        } else if (railEntry.price20DC_28t !== null && railEntry.guardCost20DC !== null) { // Fallback to 28t if 24t is not priced
           railInfo.baseCost24t = null; // Explicitly null
           railInfo.baseCost28t = railEntry.price20DC_28t;
           railInfo.guardCost20DC = railEntry.guardCost20DC;
           railCostFound = true;
        }
      } else if (containerType === "40HC") {
        if (railEntry.price40HC !== null && railEntry.guardCost40HC !== null) {
          railInfo.baseCost40HC = railEntry.price40HC;
          railInfo.guardCost40HC = railEntry.guardCost40HC;
          railCostFound = true;
        }
      }
      // If rail cost found, clear previous commentary, otherwise accumulate
      if (railCostFound) {
        railInfo.commentaryReason = ""; // Reset commentary if a valid price is found
        break; // Exit loop once a priced option is found
      } else if (!railInfo.commentaryReason.includes("Rail pricing components")) {
         railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + `Rail pricing components for ${containerType} from a ${seaDestinationPort}-compatible station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""} are missing for station ${compatibleDepartureStation}.`;
      }
    }
    if (railCostFound) break;
  }

  if (!railCostFound) {
    railInfo.railLegFailed = true;
    if (!railInfo.commentaryReason.includes("missing components") && !railInfo.commentaryReason.includes("No compatible and fully priced rail route")) {
       railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + `No compatible and fully priced rail route found from a ${seaDestinationPort}-related station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""}.`;
    }
  }
  return railInfo;
}

function findDropOffDetails(
  values: RouteFormValues,
  context: PricingDataContextType,
  cityForDropOffLookup: string,
  seaCommentFromRoute: string | null,
  currentCommentary: string
): DropOffInfo {
  const { shipmentType, seaLineCompany, containerType } = values;
  const { excelDropOffData } = context;
  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;

  let dropOffInfo: DropOffInfo = {
    costNumeric: null, displayValue: null, comment: null,
    dropOffLegFailed: false, commentaryReason: currentCommentary
  };

  if (!actualSeaLine) { // If no sea line, can't look up drop-off
    return dropOffInfo;
  }

  const isCKLine = actualSeaLine.toLowerCase().includes('ck line');
  const seaCommentLower = String(seaCommentFromRoute || '').toLowerCase().trim();
  const needsDropOffLookupFromComment = DROP_OFF_TRIGGER_PHRASES.some(phrase => seaCommentLower.includes(phrase));
  const shouldAttemptDropOffLookup = isCKLine || needsDropOffLookupFromComment;
  const isPandaLine = actualSeaLine.toLowerCase().includes('panda express line');

  if (shouldAttemptDropOffLookup && !isPandaLine) {
    let dropOffEntryMatched = false;
    const normalizedLookupCity = (cityForDropOffLookup.toLowerCase().replace(/^г\.\s*/, '') || "").trim();

    for (const dropOffEntry of excelDropOffData) {
      const seaLineFromMainRouteLower = actualSeaLine.toLowerCase().trim();
      const seaLineFromDropOffSheetLower = dropOffEntry.seaLine.toLowerCase().trim();
      const seaLineMatch = seaLineFromMainRouteLower.includes(seaLineFromDropOffSheetLower) || seaLineFromDropOffSheetLower.includes(seaLineFromMainRouteLower);
      if (!seaLineMatch) continue;

      const cityMatch = dropOffEntry.cities.some(excelCity => excelCity.toLowerCase().replace(/^г\.\s*/, '').trim() === normalizedLookupCity);
      if (cityMatch) {
        dropOffInfo.comment = dropOffEntry.comment || null;
        const dropOffPriceRaw = containerType === "20DC" ? dropOffEntry.price20DC : dropOffEntry.price40HC;

        if (typeof dropOffPriceRaw === 'string') {
          dropOffInfo.displayValue = dropOffPriceRaw;
          dropOffInfo.costNumeric = parseFirstNumberFromString(dropOffPriceRaw);
          if (dropOffInfo.costNumeric === null && dropOffPriceRaw.trim() !== "" && dropOffPriceRaw.trim().toLowerCase() !== "n/a") { // Only fail if non-empty and not parseable
            dropOffInfo.dropOffLegFailed = true;
            dropOffInfo.commentaryReason += (dropOffInfo.commentaryReason ? " " : "") + `Drop-off charges for ${actualSeaLine} to ${cityForDropOffLookup} has an unparsable string price for ${containerType}: ${dropOffPriceRaw}.`;
          }
        } else if (typeof dropOffPriceRaw === 'number') {
          dropOffInfo.costNumeric = dropOffPriceRaw;
          dropOffInfo.displayValue = String(dropOffPriceRaw);
        } else if (dropOffPriceRaw === null) { // Explicitly null price in Excel
           // No specific error, just means price is not available.
           // dropOffInfo.dropOffLegFailed might be set if this is considered a failure.
           // For now, assume null means 'not priced' rather than 'failed'.
        }
        dropOffEntryMatched = true; break;
      }
    }
    if (!dropOffEntryMatched) {
      dropOffInfo.commentaryReason += (dropOffInfo.commentaryReason ? " " : "") + `Drop-off charges triggered for ${actualSeaLine} to ${cityForDropOffLookup}, but no matching drop-off pricing entry found.`;
      dropOffInfo.dropOffLegFailed = true;
    }
  } else if (shouldAttemptDropOffLookup && isPandaLine) {
    dropOffInfo.costNumeric = null;
    dropOffInfo.displayValue = null;
    dropOffInfo.comment = "Drop-off N/A for Panda Express Line";
  }
  return dropOffInfo;
}

async function callAiAndSetState(
  aiInput: CombinedAiOutput,
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
  if (noPricedComponents && finalCommentaryReason && aiInput.originCity && aiInput.destinationCity) {
    toast({ title: "Pricing Not Available", description: finalCommentaryReason, variant: "destructive" });
    const commentaryInput: PricingCommentaryInput = {
      originCity: aiInput.originCity!,
      destinationCity: aiInput.destinationCity!,
      containerType: aiInput.containerType as ContainerType,
      russianDestinationCity: aiInput.russianDestinationCity,
    };
    const commentaryResult = await generatePricingCommentary(commentaryInput);
    const displayOutput = { commentary: finalCommentaryReason + "\n\nAI Suggestions: " + commentaryResult.commentary };
    setShippingInfo(displayOutput as CombinedAiOutput);
    setCachedShippingInfo(displayOutput as CombinedAiOutput);
    if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null);
    if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);
  } else if (aiInput.originCity && aiInput.destinationCity) { // Ensure basic info for AI call
    const result = await calculateShippingCost(aiInput);
    setShippingInfo(result);
    setCachedShippingInfo(result);
    if (calcDetails && setLastSuccessfulCalculation && setCachedLastSuccessfulCalculation) {
      setLastSuccessfulCalculation(calcDetails);
      setCachedLastSuccessfulCalculation(calcDetails);
    }
    // Consolidate toast messages
    if (finalCommentaryReason) {
        if (partialPricing && !noPricedComponents) {
            toast({ title: "Partial Pricing Info", description: finalCommentaryReason });
        } else if (!noPricedComponents) {
            toast({ title: "Pricing Information", description: finalCommentaryReason });
        }
        // If noPricedComponents, the toast is already handled above.
    }
  } else {
     // Handle case where essential data for AI call might be missing (should be caught earlier ideally)
     const fallbackCommentary = finalCommentaryReason || "Essential information missing for AI processing.";
     setShippingInfo({ commentary: fallbackCommentary } as CombinedAiOutput);
     setCachedShippingInfo({ commentary: fallbackCommentary } as CombinedAiOutput);
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
    if (!originPort || !destinationPort || !containerType) {
      toast({ variant: "destructive", title: "Missing Information", description: "Origin, Destination Port (Sea), and Container Type are required for Sea+Rail." });
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
  let dropOffDetails: DropOffInfo | null = null;
  
  const isFurtherRailJourney = russianDestinationCity && destinationPort && VLADIVOSTOK_VARIANTS.some(v => destinationPort.startsWith(v.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && destinationPort.startsWith(v.split(" ")[0]));

  if (seaInfo.seaPriceNumeric !== null && seaInfo.matchedSeaRouteInfo && isFurtherRailJourney) {
    railDetails = findRailLegDetails(values, context, destinationPort!, finalCommentary);
    finalCommentary = railDetails.commentaryReason; // Update commentary with rail leg findings
  } else if (seaInfo.seaPriceNumeric === null && isFurtherRailJourney) {
    finalCommentary += (finalCommentary ? " " : "") + `Cannot price rail to ${russianDestinationCity} as sea pricing failed.`;
    if (!railDetails) railDetails = { railLegFailed: true, commentaryReason: finalCommentary } as RailLegInfo; else railDetails.railLegFailed = true;
  }

  let cityForDropOffLookup: string | undefined = undefined;
  if (isFurtherRailJourney && railDetails && !railDetails.railLegFailed && russianDestinationCity) cityForDropOffLookup = russianDestinationCity;
  else if (destinationPort && VLADIVOSTOK_VARIANTS.some(v => destinationPort.startsWith(v.split(" ")[0]))) cityForDropOffLookup = destinationPort;

  if (shipmentType === "COC" && seaInfo.matchedSeaRouteInfo && cityForDropOffLookup &&
      (seaInfo.seaPriceNumeric !== null || (isFurtherRailJourney && railDetails && !railDetails.railLegFailed) || (!isFurtherRailJourney && destinationPort && VLADIVOSTOK_VARIANTS.some(variant => destinationPort.startsWith(variant.split(" ")[0]))))) {
    dropOffDetails = findDropOffDetails(values, context, cityForDropOffLookup, seaInfo.seaComment, finalCommentary);
    finalCommentary = dropOffDetails.commentaryReason; // Update commentary
  }

  const finalSeaPriceWithMargin = seaInfo.seaPriceNumeric !== null ? seaInfo.seaPriceNumeric + seaMargin : null;
  const finalRailBaseCost24tWithMargin = railDetails?.baseCost24t !== null && railDetails?.baseCost24t !== undefined ? railDetails.baseCost24t + railMargin : null;
  const finalRailBaseCost28tWithMargin = railDetails?.baseCost28t !== null && railDetails?.baseCost28t !== undefined ? railDetails.baseCost28t + railMargin : null;
  const finalRailBaseCost40HCWithMargin = railDetails?.baseCost40HC !== null && railDetails?.baseCost40HC !== undefined ? railDetails.baseCost40HC + railMargin : null;

  try {
    const hasAnyPricedSeaLeg = finalSeaPriceWithMargin !== null;
    const hasAnyPricedRailLeg = (containerType === "20DC" && (finalRailBaseCost24tWithMargin !== null || finalRailBaseCost28tWithMargin !== null)) || (containerType === "40HC" && finalRailBaseCost40HCWithMargin !== null);
    const isPandaLineForDropOff = actualSeaLine?.toLowerCase().includes('panda express line');
    const hasPricedDropOff = shipmentType === "COC" && (dropOffDetails?.costNumeric !== null || (dropOffDetails?.displayValue !== null && dropOffDetails?.displayValue.trim() !== "" && dropOffDetails?.displayValue.toLowerCase() !== "n/a") ) && !isPandaLineForDropOff;

    const hasAnyPricedComponent = hasAnyPricedSeaLeg || (isFurtherRailJourney && hasAnyPricedRailLeg) || hasPricedDropOff;
    
    const aiInput: CombinedAiOutput = {
      shipmentType, originCity: originPort!, destinationCity: destinationPort!, seaLineCompany: actualSeaLine, containerType: containerType!, seaCost: finalSeaPriceWithMargin, seaComment: seaInfo.seaComment,
      railCost20DC_24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCost20DC_28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railGuardCost20DC: containerType === "20DC" ? railDetails?.guardCost20DC : null,
      railCost40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null, railGuardCost40HC: containerType === "40HC" ? railDetails?.guardCost40HC : null,
      railArrivalStation: railDetails?.arrivalStation, railDepartureStation: railDetails?.departureStation,
      dropOffCost: shipmentType === "COC" ? dropOffDetails?.costNumeric : null, dropOffDisplayValue: shipmentType === "COC" ? dropOffDetails?.displayValue : null, dropOffComment: shipmentType === "COC" ? dropOffDetails?.comment : null,
      socComment: seaInfo.socComment, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : undefined,
    };

    const calcDetails: CalculationDetailsForInstructions | null = hasAnyPricedComponent ? {
      shipmentType, originPort: originPort!, destinationPort: destinationPort!, seaLineCompany: actualSeaLine, containerType, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : undefined, railArrivalStation: railDetails?.arrivalStation ?? undefined, railDepartureStation: railDetails?.departureStation ?? undefined,
      seaCostBase: seaInfo.seaPriceNumeric, seaMarginApplied: seaMargin, seaCostFinal: finalSeaPriceWithMargin, seaComment: seaInfo.seaComment,
      railCostBase24t: containerType === "20DC" ? railDetails?.baseCost24t : null, railCostBase28t: containerType === "20DC" ? railDetails?.baseCost28t : null, railGuardCost20DC: containerType === "20DC" ? railDetails?.guardCost20DC : null,
      railCostBase40HC: containerType === "40HC" ? railDetails?.baseCost40HC : null, railGuardCost40HC: containerType === "40HC" ? railDetails?.guardCost40HC : null,
      railMarginApplied: railMargin, railCostFinal24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCostFinal28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railCostFinal40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null,
      dropOffCost: shipmentType === "COC" ? dropOffDetails?.costNumeric : null, dropOffDisplayValue: shipmentType === "COC" ? dropOffDetails?.displayValue : null, dropOffComment: shipmentType === "COC" ? dropOffDetails?.comment : null,
      socComment: seaInfo.socComment,
    } : null;

    const partialPricing = (railDetails?.railLegFailed || (dropOffDetails?.dropOffLegFailed && !isPandaLineForDropOff)) ?? false;

    await callAiAndSetState(aiInput, toast, setShippingInfo, setCachedShippingInfo, calcDetails, setLastSuccessfulCalculation, setCachedLastSuccessfulCalculation, finalCommentary, partialPricing, !hasAnyPricedComponent);

  } catch (error) {
    console.error("Error processing Sea+Rail request:", error);
    if (setLastSuccessfulCalculation) setLastSuccessfulCalculation(null); 
    if (setCachedLastSuccessfulCalculation) setCachedLastSuccessfulCalculation(null);
    toast({ variant: "destructive", title: "Error", description: "Failed to process Sea+Rail request." });
  } finally {
    setIsLoading(false);
  }
}

function findDirectRailEntry(values: RouteFormValues, context: PricingDataContextType): DirectRailEntry | undefined {
  const { excelDirectRailData } = context;
  const { directRailAgentName, directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms, directRailBorder } = values;
  
  // Ensure all required fields are present before attempting to find
  if (!directRailAgentName || !directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms || !directRailBorder) {
    return undefined;
  }

  return excelDirectRailData.find(entry =>
    entry.agentName.toLowerCase() === directRailAgentName.toLowerCase() &&
    entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase() &&
    entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase() &&
    entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase() &&
    entry.border.toLowerCase() === directRailBorder.toLowerCase()
  );
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

  if (matchedEntry) {
    const result: CombinedAiOutput = {
      directRailCityOfDeparture: matchedEntry.cityOfDeparture, directRailDepartureStation: matchedEntry.departureStation,
      directRailDestinationCity: matchedEntry.destinationCity, directRailBorder: matchedEntry.border,
      directRailCost: matchedEntry.price, directRailETD: matchedEntry.etd,
      directRailCommentary: matchedEntry.commentary, directRailAgentName: matchedEntry.agentName,
      directRailIncoterms: matchedEntry.incoterms,
      commentary: `Direct rail price from ${matchedEntry.cityOfDeparture} to ${matchedEntry.destinationCity} via ${matchedEntry.border} with agent ${matchedEntry.agentName} (Incoterms: ${matchedEntry.incoterms}). ETD: ${matchedEntry.etd || 'N/A'}. ${matchedEntry.commentary || ""}`,
    };
    setShippingInfo(result);
    setCachedShippingInfo(result);
    toast({ title: "Direct Rail Price Found", description: "Details displayed below." });
  } else {
    const commentaryOutput = { commentary: "No matching direct rail route found." };
    setShippingInfo(commentaryOutput as CombinedAiOutput);
    setCachedShippingInfo(commentaryOutput as CombinedAiOutput);
    toast({ variant: "destructive", title: "No Direct Rail Route Found", description: "No matching direct rail route." });
  }
  setIsLoading(false);
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

function generateSeaPlusRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { shipmentType, originPort, containerType, russianDestinationCity, arrivalStationSelection } = values;
  const { excelRouteData, excelSOCRouteData, excelRailData, excelDropOffData, excelDestinationPorts } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!originPort || !containerType) return candidates; // Guard against missing essential inputs

  const seaDataset = shipmentType === "COC" ? excelRouteData : excelSOCRouteData;
  const originFieldKey = shipmentType === "COC" ? "originPorts" : "departurePorts";
  const price20DCKey = "price20DC"; const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPort => {
    if (!VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) return;

    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort) || !Array.isArray(seaRoute.destinationPorts) || !seaRoute.destinationPorts.includes(seaDestPort)) return;
      
      const seaPriceForContainerRaw = containerType === "20DC" ? seaRoute[price20DCKey] : seaRoute[price40HCKey];
      const seaPriceForContainerNumeric = parseFirstNumberFromString(seaPriceForContainerRaw);
      if (seaPriceForContainerNumeric === null) return;

      (Array.isArray(seaRoute.seaLines) && seaRoute.seaLines.length > 0 ? seaRoute.seaLines : [undefined]).forEach(seaLineCompanyIt => {
        let totalComparisonCostRUB = seaPriceForContainerNumeric * USD_RUB_CONVERSION_RATE;
        const currentSeaComment = shipmentType === "COC" ? (seaRoute as ExcelRoute).seaComment || null : null;
        const currentSocComment = shipmentType === "SOC" ? (seaRoute as ExcelSOCRoute).socComment || null : null;
        
        let railLegDetails: RailLegInfo | null = null;
        const isFurtherRailJourneyBestPrice = russianDestinationCity && VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));
        
        if (isFurtherRailJourneyBestPrice) {
          railLegDetails = findRailLegDetails({ ...values, seaLineCompany: seaLineCompanyIt } as RouteFormValues, context, seaDestPort, "");
          if (railLegDetails.railLegFailed) return; 
          const railCostForComparison = containerType === "20DC" 
            ? (railLegDetails.baseCost24t ?? railLegDetails.baseCost28t ?? 0) + (railLegDetails.guardCost20DC ?? 0)
            : (railLegDetails.baseCost40HC ?? 0) + (railLegDetails.guardCost40HC ?? 0);
          if (railCostForComparison === 0 && ( (containerType === "20DC" && railLegDetails.baseCost24t === null && railLegDetails.baseCost28t === null) || (containerType === "40HC" && railLegDetails.baseCost40HC === null) ) ) return; // Skip if rail has no price
          totalComparisonCostRUB += railCostForComparison;
        }

        let dropOffDetails: DropOffInfo | null = null;
        let cityForDropOffBestPrice = isFurtherRailJourneyBestPrice && !railLegDetails?.railLegFailed && russianDestinationCity ? russianDestinationCity : seaDestPort;
        if (shipmentType === "COC" && seaLineCompanyIt) {
          dropOffDetails = findDropOffDetails({ ...values, seaLineCompany: seaLineCompanyIt } as RouteFormValues, context, cityForDropOffBestPrice, currentSeaComment, "");
          if (dropOffDetails.costNumeric !== null) {
            totalComparisonCostRUB += dropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
          }
        }
        
        candidates.push({
          id: `sroute-${routeIdCounter++}`, mode: 'sea_plus_rail', shipmentType, originPort: originPort!, seaDestinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, containerType: containerType!,
          russianDestinationCity: isFurtherRailJourneyBestPrice && russianDestinationCity ? russianDestinationCity : ((VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && russianDestinationCity && VLADIVOSTOK_VARIANTS.some(vladVariant => vladVariant === russianDestinationCity && seaDestPort.startsWith(vladVariant.split(" ")[0]))) ? seaDestPort : (isFurtherRailJourneyBestPrice && russianDestinationCity ? russianDestinationCity : "N/A")),
          railDepartureStation: railLegDetails?.departureStation ?? undefined, railArrivalStation: railLegDetails?.arrivalStation ?? undefined,
          seaCostUSD: seaPriceForContainerNumeric, seaComment: currentSeaComment, socComment: currentSocComment,
          railCost20DC_24t_RUB: railLegDetails?.baseCost24t ?? null, railCost20DC_28t_RUB: railLegDetails?.baseCost28t ?? null, railGuardCost20DC_RUB: railLegDetails?.guardCost20DC ?? null,
          railCost40HC_RUB: railLegDetails?.baseCost40HC ?? null, railGuardCost40HC_RUB: railLegDetails?.guardCost40HC ?? null,
          dropOffCostUSD: dropOffDetails?.costNumeric ?? null, dropOffDisplayValue: dropOffDetails?.displayValue ?? null, dropOffComment: dropOffDetails?.comment ?? null,
          totalComparisonCostRUB,
        });
      });
    });
  });
  return candidates;
}

function generateDirectRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms } = values;
  const { excelDirectRailData } = context;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms) return candidates;

  excelDirectRailData.forEach(entry => {
    if (
      entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase() &&
      entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase() &&
      entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase() &&
      entry.price !== null
    ) {
      candidates.push({
        id: `droute-${routeIdCounter++}`, mode: 'direct_rail', shipmentType: 'N/A', originPort: entry.cityOfDeparture, seaDestinationPort: entry.destinationCity,
        containerType: '40HC', // As per requirement
        russianDestinationCity: entry.destinationCity, // For consistency in BestPriceRoute structure
        totalComparisonCostRUB: entry.price, 
        directRailAgentName: entry.agentName, 
        directRailIncoterms: entry.incoterms, 
        directRailBorder: entry.border,
        directRailPriceRUB: entry.price, 
        directRailETD: entry.etd, 
        directRailExcelCommentary: entry.commentary,
        railDepartureStation: entry.departureStation, // Using these fields for direct rail stations
        railArrivalStation: entry.destinationCity,  // Using this for direct rail destination for display consistency
        seaCostUSD: null, // Not applicable for direct rail
      });
    }
  });
  return candidates;
}

export function calculateBestPrice({
  form, context, toast, setIsCalculatingBestPrice, setShippingInfo,
  setBestPriceResults, setCachedFormValues, setIsNavigatingToBestPrices
}: BestPriceArgs) {
  const values = form.getValues();
  const { calculationMode, excelRussianDestinationCitiesMasterList, isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded } = context;

  setIsCalculatingBestPrice(true);
  setShippingInfo(null);
  setBestPriceResults(null);

  let potentialRoutes: BestPriceRoute[] = [];

  if (calculationMode === "sea_plus_rail") {
    if (!values.originPort || !values.containerType) {
      toast({ title: "Missing Info", description: "Select Origin Port & Container Type for Best Price (Sea+Rail)." });
      setIsCalculatingBestPrice(false); return;
    }
    if (excelRussianDestinationCitiesMasterList.length > 0 && !values.russianDestinationCity) { // If rail destinations exist, one must be chosen for proper best price
      toast({ title: "Missing Info", description: "Select Destination City for Best Price (Sea+Rail)." });
      setIsCalculatingBestPrice(false); return;
    }
    if (!isSeaRailExcelDataLoaded) {
      toast({ title: "Data Not Loaded", description: "Please load the Море + Ж/Д Excel file first." });
      setIsCalculatingBestPrice(false); return;
    }
    potentialRoutes = generateSeaPlusRailCandidates(values, context);
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
    setCachedFormValues(values); // Cache the form values that led to these results
    setIsNavigatingToBestPrices(true); // This will trigger navigation in PortPriceFinderForm's useEffect
  } else {
    toast({ title: "No Routes Found", description: "Could not find valid shipping routes for best price with the selected criteria." });
  }
  setIsCalculatingBestPrice(false);
}
