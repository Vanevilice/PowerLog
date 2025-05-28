
import type { UseFormReturn } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { calculateShippingCost } from "@/ai/flows/smart-pricing";
import { generatePricingCommentary, type PricingCommentaryInput } from "@/ai/flows/pricing-commentary";
import type {
  RouteFormValues, SmartPricingOutput, PricingDataContextType, ExcelRoute, ExcelSOCRoute,
  RailDataEntry, DirectRailEntry, BestPriceRoute, CalculationDetailsForInstructions,
  ShipmentType, ContainerType,
} from '@/types'; // Centralized types
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, USD_RUB_CONVERSION_RATE, DROP_OFF_TRIGGER_PHRASES } from './constants';

interface CalculationArgsBase {
  values: RouteFormValues;
  context: PricingDataContextType;
  toast: ReturnType<typeof useToast>['toast'];
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setShippingInfo: React.Dispatch<React.SetStateAction<SmartPricingOutput | PricingCommentaryOutput | null>>;
  setLastSuccessfulCalculation: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>;
  setCachedShippingInfo: PricingDataContextType['setCachedShippingInfo'];
  setCachedLastSuccessfulCalculation: PricingDataContextType['setCachedLastSuccessfulCalculation'];
}

export async function processSeaPlusRailCalculation({
  values, context, toast, setIsLoading, setShippingInfo, setLastSuccessfulCalculation,
  setCachedShippingInfo, setCachedLastSuccessfulCalculation
}: CalculationArgsBase ) {
  const { excelRouteData, excelSOCRouteData, excelRailData, excelDropOffData } = context;

  // Enhanced checks for essential fields for "Get Price & Commentary"
  if (context.calculationMode === "sea_plus_rail") {
    if (!values.originPort) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select an Origin Port." });
      setIsLoading(false);
      return;
    }
    if (!values.destinationPort) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select a Destination Port (Sea)." });
      setIsLoading(false);
      return;
    }
    if (!values.containerType) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select a Container Type." });
      setIsLoading(false);
      return;
    }
  }

  setIsLoading(true);
  setShippingInfo(null);
  setLastSuccessfulCalculation(null);
  setCachedShippingInfo(null);
  setCachedLastSuccessfulCalculation(null);

  const { shipmentType, originPort, destinationPort, seaLineCompany, containerType, russianDestinationCity, arrivalStationSelection } = values;
  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;
  const seaMargin = parseFloat(values.seaMargin || "0") || 0;
  const railMargin = parseFloat(values.railMargin || "0") || 0;

  let foundSeaPrice: number | null = null;
  let matchedSeaRouteInfo: ExcelRoute | ExcelSOCRoute | undefined;
  let commentaryReason = "";
  let foundSocComment: string | null = null;
  let foundSeaComment: string | null = null;
  let foundRailBaseCost24t: number | null = null, foundRailBaseCost28t: number | null = null, foundRailGuardCost20DC: number | null = null;
  let foundRailBaseCost40HC: number | null = null, foundRailGuardCost40HC: number | null = null;
  let foundRailArrivalStation: string | null = null, foundRailDepartureStation: string | null = null;
  let foundDropOffCost: number | null = null, foundDropOffComment: string | null = null;
  let railLegFailed = false, dropOffLegFailed = false;

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
          commentaryReason = "Sea pricing for " + containerType + " on " + shipmentType + " route " + originPort + " to " + destinationPort + (actualSeaLine ? " via " + actualSeaLine : "") + " is not available in Excel.";
        }
      } else if (!actualSeaLine && !foundSeaPrice && !matchedSeaRouteInfo && Array.isArray(route.seaLines) && route.seaLines.length > 0) {
        const priceForContainer = containerType === "20DC" ? route[price20DCKey] : route[price40HCKey];
        if (priceForContainer === null && !matchedSeaRouteInfo) {
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = "Pricing for " + containerType + " on " + shipmentType + " route " + originPort + " to " + destinationPort + " is not available for any sea line.";
        }
      }
    }
  }
  if (!matchedSeaRouteInfo && !commentaryReason) commentaryReason = "No sea route found in Excel for " + originPort + " to " + destinationPort + " for " + shipmentType + " shipment.";
  else if (foundSeaPrice === null && matchedSeaRouteInfo && !commentaryReason.startsWith("Sea pricing for " + containerType)) commentaryReason = "Sea pricing for " + containerType + " on " + shipmentType + " route " + originPort + " to " + destinationPort + (actualSeaLine ? " via " + actualSeaLine : "") + " is not available in Excel.";

  const isFurtherRailJourney = russianDestinationCity && destinationPort && VLADIVOSTOK_VARIANTS.some(v => destinationPort.startsWith(v.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && destinationPort.startsWith(v.split(" ")[0]));

  if (foundSeaPrice !== null && matchedSeaRouteInfo && isFurtherRailJourney && russianDestinationCity) {
    let railCostFound = false;
    const seaDestinationPortLower = destinationPort!.toLowerCase();
    const seaDestinationPortBaseName = destinationPort!.split(" ")[0].toLowerCase();
    for (const railEntry of excelRailData) {
      if (railEntry.cityOfArrival.toLowerCase() !== russianDestinationCity.toLowerCase()) continue;
      if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection)) continue;
      const compatibleDepartureStation = railEntry.departureStations.find(depStation => {
        const pStationLower = depStation.toLowerCase().trim();
        if (seaDestinationPortLower.includes("пл")) return pStationLower.includes("пасифик лоджистик");
        const specificSeaHubKeywordMatch = destinationPort!.match(/\(([^)]+)\)/);
        const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split('/').map(s => s.trim()) : [];
        if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
        if (pStationLower.includes(seaDestinationPortBaseName)) return true;
        if (seaDestinationPortLower.includes(pStationLower)) return true;
        return false;
      });
      if (compatibleDepartureStation) {
        foundRailDepartureStation = compatibleDepartureStation;
        foundRailArrivalStation = arrivalStationSelection || railEntry.arrivalStations[0];
        if (containerType === "20DC") {
          if (railEntry.price20DC_24t !== null && railEntry.guardCost20DC !== null) {
            foundRailBaseCost24t = railEntry.price20DC_24t; foundRailBaseCost28t = railEntry.price20DC_28t; foundRailGuardCost20DC = railEntry.guardCost20DC;
            railCostFound = true; commentaryReason = ""; break;
          }
        } else if (containerType === "40HC") {
          if (railEntry.price40HC !== null && railEntry.guardCost40HC !== null) {
            foundRailBaseCost40HC = railEntry.price40HC; foundRailGuardCost40HC = railEntry.guardCost40HC;
            railCostFound = true; commentaryReason = ""; break;
          }
        }
        if (!railCostFound && !commentaryReason.includes("Rail pricing components")) commentaryReason = (commentaryReason ? commentaryReason + " " : "") + "Rail pricing components for " + containerType + " from a " + destinationPort + "-compatible station to " + russianDestinationCity + (arrivalStationSelection ? " (station: " + arrivalStationSelection + ")" : "") + " are missing for station " + compatibleDepartureStation + ".";
      }
      if (railCostFound) break;
    }
    if (!railCostFound && !commentaryReason.includes("missing components")) { commentaryReason = (commentaryReason ? commentaryReason + " " : "") + "No compatible and fully priced rail route found from a " + destinationPort + "-related station to " + russianDestinationCity + (arrivalStationSelection ? " (station: " + arrivalStationSelection + ")" : "") + "."; railLegFailed = true; }
    else if (!railCostFound && commentaryReason.includes("missing components")) railLegFailed = true;
  } else if (foundSeaPrice === null && isFurtherRailJourney) { commentaryReason += (commentaryReason ? " " : "") + "Cannot price rail to " + russianDestinationCity + " as sea pricing failed."; railLegFailed = true; }

  let cityForDropOffLookup: string | undefined = undefined;
  if (isFurtherRailJourney && !railLegFailed && russianDestinationCity) cityForDropOffLookup = russianDestinationCity;
  else if (destinationPort && VLADIVOSTOK_VARIANTS.some(v => destinationPort.startsWith(v.split(" ")[0]))) cityForDropOffLookup = destinationPort;

  if (shipmentType === "COC" && matchedSeaRouteInfo && cityForDropOffLookup && actualSeaLine && (foundSeaPrice !== null || (!railLegFailed && isFurtherRailJourney) || (!isFurtherRailJourney && VLADIVOSTOK_VARIANTS.some(v => destinationPort!.startsWith(v.split(" ")[0]))))) {
    const seaCommentLower = String(foundSeaComment || '').toLowerCase().trim();
    const needsDropOff = DROP_OFF_TRIGGER_PHRASES.some(phrase => seaCommentLower.includes(phrase));
    const isPandaLine = actualSeaLine.toLowerCase().includes('panda express line');
    if (needsDropOff) {
      let dropOffEntryMatched = false;
      const normalizedLookupCity = (cityForDropOffLookup.toLowerCase().replace(/^г\.\s*/, '') || "").trim();
      for (const dropOffEntry of excelDropOffData) {
        const seaLineFromMainRouteLower = actualSeaLine.toLowerCase().trim();
        const seaLineFromDropOffSheetLower = dropOffEntry.seaLine.toLowerCase().trim();
        const seaLineMatch = seaLineFromMainRouteLower.includes(seaLineFromDropOffSheetLower) || seaLineFromDropOffSheetLower.includes(seaLineFromMainRouteLower);
        if (!seaLineMatch) continue;
        const cityMatch = dropOffEntry.cities.some(excelCity => excelCity.toLowerCase().replace(/^г\.\s*/, '').trim() === normalizedLookupCity);
        if (cityMatch) {
          foundDropOffComment = dropOffEntry.comment || null;
          if (isPandaLine) foundDropOffCost = null;
          else {
            const dropOffPriceForContainer = containerType === "20DC" ? dropOffEntry.price20DC : dropOffEntry.price40HC;
            if (dropOffPriceForContainer !== null) foundDropOffCost = dropOffPriceForContainer;
            else { dropOffLegFailed = true; commentaryReason += (commentaryReason ? " " : "") + "Drop-off charges triggered for " + actualSeaLine + " to " + cityForDropOffLookup + ", but price for " + containerType + " is missing."; }
          }
          dropOffEntryMatched = true; break;
        }
      }
      if (!dropOffEntryMatched && !isPandaLine) { commentaryReason += (commentaryReason ? " " : "") + "Drop-off charges triggered for " + actualSeaLine + " to " + cityForDropOffLookup + ", but no matching drop-off pricing entry found."; dropOffLegFailed = true; }
    }
  }

  const finalSeaPriceWithMargin = foundSeaPrice !== null ? foundSeaPrice + seaMargin : null;
  const finalRailBaseCost24tWithMargin = foundRailBaseCost24t !== null ? foundRailBaseCost24t + railMargin : null;
  const finalRailBaseCost28tWithMargin = foundRailBaseCost28t !== null ? foundRailBaseCost28t + railMargin : null;
  const finalRailBaseCost40HCWithMargin = foundRailBaseCost40HC !== null ? foundRailBaseCost40HC + railMargin : null;

  try {
    const hasAnyPricedSeaLeg = finalSeaPriceWithMargin !== null;
    const hasAnyPricedRailLeg = (containerType === "20DC" && (finalRailBaseCost24tWithMargin !== null || finalRailBaseCost28tWithMargin !== null)) || (containerType === "40HC" && finalRailBaseCost40HCWithMargin !== null);
    const hasPricedDropOff = shipmentType === "COC" && foundDropOffCost !== null && !actualSeaLine?.toLowerCase().includes('panda express line');
    const hasAnyPricedComponent = hasAnyPricedSeaLeg || (isFurtherRailJourney && hasAnyPricedRailLeg) || hasPricedDropOff;

    if (hasAnyPricedComponent && !commentaryReason.startsWith("No sea route found")) {
      const aiInput: SmartPricingOutput = {
        shipmentType, originCity: originPort!, destinationCity: destinationPort!, seaLineCompany: actualSeaLine, containerType: containerType!, seaCost: finalSeaPriceWithMargin, seaComment: foundSeaComment,
        railCost20DC_24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCost20DC_28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railGuardCost20DC: containerType === "20DC" ? foundRailGuardCost20DC : null,
        railCost40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null, railGuardCost40HC: containerType === "40HC" ? foundRailGuardCost40HC : null,
        railArrivalStation: foundRailArrivalStation, railDepartureStation: foundRailDepartureStation, dropOffCost: shipmentType === "COC" ? foundDropOffCost : null, dropOffComment: shipmentType === "COC" ? foundDropOffComment : null, socComment, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : undefined,
      };
      const result = await calculateShippingCost(aiInput);
      setShippingInfo(result);
      setCachedShippingInfo(result);
      const calcDetails: CalculationDetailsForInstructions = {
        shipmentType, originPort: originPort!, destinationPort: destinationPort!, seaLineCompany: actualSeaLine, containerType, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : undefined, railArrivalStation: foundRailArrivalStation, railDepartureStation: foundRailDepartureStation,
        seaCostBase: foundSeaPrice, seaMarginApplied: seaMargin, seaCostFinal: finalSeaPriceWithMargin, seaComment: foundSeaComment,
        railCostBase24t: containerType === "20DC" ? foundRailBaseCost24t : null, railCostBase28t: containerType === "20DC" ? foundRailBaseCost28t : null, railGuardCost20DC: containerType === "20DC" ? foundRailGuardCost20DC : null,
        railCostBase40HC: containerType === "40HC" ? foundRailBaseCost40HC : null, railGuardCost40HC: containerType === "40HC" ? foundRailGuardCost40HC : null,
        railMarginApplied: railMargin, railCostFinal24t: containerType === "20DC" ? finalRailBaseCost24tWithMargin : null, railCostFinal28t: containerType === "20DC" ? finalRailBaseCost28tWithMargin : null, railCostFinal40HC: containerType === "40HC" ? finalRailBaseCost40HCWithMargin : null,
        dropOffCost: shipmentType === "COC" ? foundDropOffCost : null, dropOffComment: shipmentType === "COC" ? foundDropOffComment : null, socComment,
      };
      setLastSuccessfulCalculation(calcDetails);
      setCachedLastSuccessfulCalculation(calcDetails);
      if ((railLegFailed || (dropOffLegFailed && !actualSeaLine?.toLowerCase().includes('panda express line'))) && result.commentary && !result.commentary.includes("No compatible and complete rail route") && !result.commentary.includes("Drop-off charges triggered")) {
        toast({ title: "Partial Pricing Info", description: commentaryReason || "Rail/Drop-off pricing not fully available." });
      } else if (commentaryReason && commentaryReason.length > 0 && !hasAnyPricedComponent) {
        toast({ title: "Pricing Not Available", description: commentaryReason, variant: "destructive" });
      } else if (commentaryReason && commentaryReason.length > 0) {
        toast({ title: "Pricing Information", description: commentaryReason });
      }
    } else {
      setLastSuccessfulCalculation(null); setCachedLastSuccessfulCalculation(null);
      if (!commentaryReason) commentaryReason = "Pricing data unavailable for selected options.";
      toast({ title: "Pricing Not Available", description: commentaryReason, variant: "destructive" });
      const commentaryInput: PricingCommentaryInput = { originCity: originPort!, destinationCity: destinationPort!, containerType, russianDestinationCity: isFurtherRailJourney ? russianDestinationCity : undefined };
      const commentaryResult = await generatePricingCommentary(commentaryInput);
      let finalCommentaryText = commentaryResult.commentary;
      if (commentaryReason && !commentaryReason.includes("General commentary provided.") && !commentaryReason.includes("Please select a specific Sea Line") && !commentaryReason.startsWith("Pricing data is unavailable")) {
        finalCommentaryText = commentaryReason + "\n\nAI Suggestions: " + commentaryResult.commentary;
      }
      const commentaryOutputDisplay = { commentary: finalCommentaryText };
      setShippingInfo(commentaryOutputDisplay as SmartPricingOutput); 
      setCachedShippingInfo(commentaryOutputDisplay as SmartPricingOutput);
    }
  } catch (error) {
    console.error("Error processing shipping request:", error);
    setLastSuccessfulCalculation(null); setCachedLastSuccessfulCalculation(null);
    toast({ variant: "destructive", title: "Error", description: "Failed to process shipping request." });
  } finally {
    setIsLoading(false);
  }
}


export async function processDirectRailCalculation({
  values, context, toast, setIsLoading, setShippingInfo, setLastSuccessfulCalculation,
  setCachedShippingInfo, setCachedLastSuccessfulCalculation
}: CalculationArgsBase) {
  const { excelDirectRailData } = context;
  setIsLoading(true);
  setShippingInfo(null);
  setLastSuccessfulCalculation(null);
  setCachedShippingInfo(null);
  setCachedLastSuccessfulCalculation(null);

  const { directRailAgentName, directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms, directRailBorder } = values;
  if (!directRailAgentName || !directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms || !directRailBorder) {
    toast({ variant: "destructive", title: "Missing Information", description: "Please fill all fields for Direct Rail calculation." });
    setIsLoading(false); return;
  }
  let matchedDirectRailEntry: DirectRailEntry | undefined;
  for (const entry of excelDirectRailData) {
    const isAgentMatch = entry.agentName.toLowerCase() === directRailAgentName.toLowerCase();
    const isDepartureCityMatch = entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase();
    const isDestinationCityMatch = entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase();
    const isIncotermsMatch = entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase();
    const isBorderMatch = entry.border.toLowerCase() === directRailBorder.toLowerCase();
    if (isAgentMatch && isDepartureCityMatch && isDestinationCityMatch && isIncotermsMatch && isBorderMatch) {
      matchedDirectRailEntry = entry; break;
    }
  }
  if (matchedDirectRailEntry) {
    const result: SmartPricingOutput = { 
      directRailCityOfDeparture: matchedDirectRailEntry.cityOfDeparture, directRailDepartureStation: matchedDirectRailEntry.departureStation,
      directRailDestinationCity: matchedDirectRailEntry.destinationCity, directRailBorder: matchedDirectRailEntry.border,
      directRailCost: matchedDirectRailEntry.price, directRailETD: matchedDirectRailEntry.etd,
      directRailCommentary: matchedDirectRailEntry.commentary, directRailAgentName: matchedDirectRailEntry.agentName,
      directRailIncoterms: matchedDirectRailEntry.incoterms,
      commentary: "Direct rail price from " + matchedDirectRailEntry.cityOfDeparture + " to " + matchedDirectRailEntry.destinationCity + " via " + matchedDirectRailEntry.border + " with agent " + matchedDirectRailEntry.agentName + " (Incoterms: " + matchedDirectRailEntry.incoterms + "). ETD: " + (matchedDirectRailEntry.etd || 'N/A') + ". " + (matchedDirectRailEntry.commentary || ""),
    };
    setShippingInfo(result);
    setCachedShippingInfo(result);
    toast({ title: "Direct Rail Price Found", description: "Details displayed below." });
  } else {
    toast({ variant: "destructive", title: "No Direct Rail Route Found", description: "No matching direct rail route." });
    setShippingInfo({ commentary: "No matching direct rail route found." } as SmartPricingOutput);
    setCachedShippingInfo({ commentary: "No matching direct rail route found." } as SmartPricingOutput);
  }
  setIsLoading(false);
}


interface BestPriceArgs {
  form: UseFormReturn<RouteFormValues>; 
  context: PricingDataContextType;
  toast: ReturnType<typeof useToast>['toast'];
  setIsCalculatingBestPrice: React.Dispatch<React.SetStateAction<boolean>>;
  setShippingInfo: React.Dispatch<React.SetStateAction<SmartPricingOutput | PricingCommentaryOutput | null>>;
  setBestPriceResults: PricingDataContextType['setBestPriceResults'];
  setCachedFormValues: PricingDataContextType['setCachedFormValues'];
  setIsNavigatingToBestPrices: React.Dispatch<React.SetStateAction<boolean>>;
}

export function calculateBestPrice({
  form, context, toast, setIsCalculatingBestPrice, setShippingInfo,
  setBestPriceResults, setCachedFormValues, setIsNavigatingToBestPrices
}: BestPriceArgs) {
  const { getValues } = form;
  const {
    excelRouteData, excelSOCRouteData, excelRailData, excelDropOffData,
    excelDestinationPorts, excelRussianDestinationCitiesMasterList
  } = context;

  const { shipmentType, originPort, containerType, russianDestinationCity, arrivalStationSelection } = getValues();
  if (!originPort || !containerType) {
    toast({ title: "Missing Info", description: "Select Origin Port & Container Type for Best Price." }); return;
  }
  if (excelRussianDestinationCitiesMasterList.length > 0 && !russianDestinationCity) {
    toast({ title: "Missing Info", description: "Select Destination City for Best Price." }); return;
  }

  setIsCalculatingBestPrice(true);
  setShippingInfo(null);
  setBestPriceResults(null);

  const potentialRoutes: BestPriceRoute[] = [];
  let routeIdCounter = 0;
  const seaDataset = shipmentType === "COC" ? excelRouteData : excelSOCRouteData;
  const originFieldKey = shipmentType === "COC" ? "originPorts" : "departurePorts";
  const price20DCKey = "price20DC"; const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPort => {
    if (!VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) return;
    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort) || !Array.isArray(seaRoute.destinationPorts) || !seaRoute.destinationPorts.includes(seaDestPort)) return;
      const currentSeaCommentFromExcel: string | null = shipmentType === "COC" ? (seaRoute as ExcelRoute).seaComment || null : null;
      const currentSocCommentFromExcel: string | null = shipmentType === "SOC" ? (seaRoute as ExcelSOCRoute).socComment || null : null;

      (Array.isArray(seaRoute.seaLines) && seaRoute.seaLines.length > 0 ? seaRoute.seaLines : [undefined]).forEach(seaLine => {
        const actualSeaLineForIteration = seaLine;
        let currentDropOffCostUSD: number | null = null;
        let currentDropOffComment: string | null = null;
        let bestRailLegDetails: { railCost20DC_24t_RUB: number | null; railCost20DC_28t_RUB: number | null; railGuardCost20DC_RUB: number | null; railCost40HC_RUB: number | null; railGuardCost40HC_RUB: number | null; railDepartureStation: string; railArrivalStation: string; } | null = null;
        const seaPriceForContainer = containerType === "20DC" ? seaRoute[price20DCKey] : seaRoute[price40HCKey];
        if (seaPriceForContainer === null) return;
        const seaCostUSD = seaPriceForContainer;
        let totalComparisonCostRUB = seaCostUSD * USD_RUB_CONVERSION_RATE;
        const isBestPriceRussianCitySelectedForOnwardRail = russianDestinationCity && VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));
        let railDepartureStationForDisplay: string | undefined = undefined;
        let railArrivalStationForDisplay: string | undefined = undefined;

        if (isBestPriceRussianCitySelectedForOnwardRail && russianDestinationCity) {
          let minRailLegTotalCostRUB = Infinity;
          let cheapestRailOptionForCity: typeof bestRailLegDetails = null;
          const seaDestPortLower = seaDestPort.toLowerCase();
          const seaDestPortBaseName = seaDestPort.split(" ")[0].toLowerCase();
          excelRailData.forEach(railEntry => {
            if (railEntry.cityOfArrival.toLowerCase() === russianDestinationCity.toLowerCase()) {
              if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection)) return;
              railEntry.departureStations.forEach(depStation => {
                const pStationLower = depStation.toLowerCase().trim();
                let isCompatibleStation = false;
                if (seaDestPortLower.includes("пл")) isCompatibleStation = pStationLower.includes("пасифик лоджистик");
                else {
                  const specificSeaHubKeywordMatch = seaDestPort.match(/\(([^)]+)\)/);
                  const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split('/').map(s => s.trim()) : [];
                  if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) isCompatibleStation = true;
                  else if (pStationLower.includes(seaDestPortBaseName)) isCompatibleStation = true;
                  else if (seaDestPortLower.includes(pStationLower)) isCompatibleStation = true;
                }
                if (isCompatibleStation) {
                  let tempRailCost24t: number | null = null, tempRailCost28t: number | null = null, tempGuardCost20DC: number | null = null;
                  let tempRailCost40HC: number | null = null, tempGuardCost40HC: number | null = null;
                  let currentRailLegTotalForComparison = Infinity;
                  if (containerType === "20DC") {
                    tempRailCost24t = railEntry.price20DC_24t; tempRailCost28t = railEntry.price20DC_28t; tempGuardCost20DC = railEntry.guardCost20DC;
                    if (tempRailCost24t !== null && tempGuardCost20DC !== null) currentRailLegTotalForComparison = tempRailCost24t + tempGuardCost20DC;
                    else if (tempRailCost28t !== null && tempGuardCost20DC !== null && tempRailCost24t === null) currentRailLegTotalForComparison = tempRailCost28t + tempGuardCost20DC;
                  } else if (containerType === "40HC") {
                    tempRailCost40HC = railEntry.price40HC; tempGuardCost40HC = railEntry.guardCost40HC;
                    if (tempRailCost40HC !== null && tempGuardCost40HC !== null) currentRailLegTotalForComparison = tempRailCost40HC + tempGuardCost40HC;
                  }
                  if (currentRailLegTotalForComparison < minRailLegTotalCostRUB) {
                    minRailLegTotalCostRUB = currentRailLegTotalForComparison;
                    railDepartureStationForDisplay = depStation;
                    railArrivalStationForDisplay = arrivalStationSelection && railEntry.arrivalStations.includes(arrivalStationSelection) ? arrivalStationSelection : railEntry.arrivalStations[0];
                    cheapestRailOptionForCity = {
                      railCost20DC_24t_RUB: containerType === "20DC" ? tempRailCost24t : null, railCost20DC_28t_RUB: containerType === "20DC" ? tempRailCost28t : null, railGuardCost20DC_RUB: containerType === "20DC" ? tempGuardCost20DC : null,
                      railCost40HC_RUB: containerType === "40HC" ? tempRailCost40HC : null, railGuardCost40HC_RUB: containerType === "40HC" ? tempGuardCost40HC : null,
                      railDepartureStation: railDepartureStationForDisplay!, railArrivalStation: railArrivalStationForDisplay!,
                    };
                  }
                }
              });
            }
          });
          bestRailLegDetails = cheapestRailOptionForCity;
          if (bestRailLegDetails && minRailLegTotalCostRUB !== Infinity) totalComparisonCostRUB += minRailLegTotalCostRUB;
          else return;
        } else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && russianDestinationCity && !isBestPriceRussianCitySelectedForOnwardRail) {}
        else if (!VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && russianDestinationCity && seaDestPort !== russianDestinationCity) return;

        let cityForDropOffLookupForBestPrice: string | undefined = undefined;
        if (isBestPriceRussianCitySelectedForOnwardRail && bestRailLegDetails && russianDestinationCity) cityForDropOffLookupForBestPrice = russianDestinationCity;
        else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) cityForDropOffLookupForBestPrice = seaDestPort;

        if (shipmentType === "COC" && currentSeaCommentFromExcel && cityForDropOffLookupForBestPrice && actualSeaLineForIteration) {
          const seaCommentLower = currentSeaCommentFromExcel.toLowerCase().trim();
          const needsDropOff = DROP_OFF_TRIGGER_PHRASES.some(phrase => seaCommentLower.includes(phrase));
          const isPandaLineBestPrice = actualSeaLineForIteration.toLowerCase().includes('panda express line');
          if (needsDropOff) {
            const normalizedLookupCityForBestPrice = (cityForDropOffLookupForBestPrice.toLowerCase().replace(/^г\.\s*/, '') || "").trim();
            for (const dropOffEntry of excelDropOffData) {
              const seaLineFromMainRouteLowerTrimmed = actualSeaLineForIteration.toLowerCase().trim();
              const seaLineFromDropOffSheetLowerTrimmed = dropOffEntry.seaLine.toLowerCase().trim();
              const seaLineMatch = seaLineFromMainRouteLowerTrimmed.includes(seaLineFromDropOffSheetLowerTrimmed) || seaLineFromDropOffSheetLowerTrimmed.includes(seaLineFromMainRouteLowerTrimmed);
              if (!seaLineMatch) continue;
              const cityMatch = dropOffEntry.cities.some(excelCity => excelCity.toLowerCase().replace(/^г\.\s*/, '').trim() === normalizedLookupCityForBestPrice);
              if (cityMatch) {
                currentDropOffComment = dropOffEntry.comment || null;
                if (isPandaLineBestPrice) currentDropOffCostUSD = null;
                else {
                  const dropOffPriceForContainer = containerType === "20DC" ? dropOffEntry.price20DC : dropOffEntry.price40HC;
                  if (dropOffPriceForContainer !== null) { currentDropOffCostUSD = dropOffPriceForContainer; totalComparisonCostRUB += currentDropOffCostUSD * USD_RUB_CONVERSION_RATE; }
                  else currentDropOffCostUSD = null;
                }
                break;
              }
            }
          }
        }
        const routeEntry: BestPriceRoute = {
          id: "route-" + routeIdCounter++,
          shipmentType, originPort: originPort!, seaDestinationPort: seaDestPort, seaLineCompany: actualSeaLineForIteration, containerType: containerType!,
          russianDestinationCity: isBestPriceRussianCitySelectedForOnwardRail && russianDestinationCity ? russianDestinationCity : ((VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && russianDestinationCity && VLADIVOSTOK_VARIANTS.some(vladVariant => vladVariant === russianDestinationCity && seaDestPort.startsWith(vladVariant.split(" ")[0]))) ? seaDestPort : (isBestPriceRussianCitySelectedForOnwardRail && russianDestinationCity ? russianDestinationCity : "N/A")),
          railCost20DC_24t_RUB: bestRailLegDetails?.railCost20DC_24t_RUB ?? null, railCost20DC_28t_RUB: bestRailLegDetails?.railCost20DC_28t_RUB ?? null, railGuardCost20DC_RUB: bestRailLegDetails?.railGuardCost20DC_RUB ?? null,
          railCost40HC_RUB: bestRailLegDetails?.railCost40HC_RUB ?? null, railGuardCost40HC_RUB: bestRailLegDetails?.railGuardCost40HC_RUB ?? null,
          railDepartureStation: bestRailLegDetails?.railDepartureStation, railArrivalStation: bestRailLegDetails?.railArrivalStation,
          seaCostUSD, seaComment: currentSeaCommentFromExcel, dropOffCostUSD: currentDropOffCostUSD, dropOffComment: currentDropOffComment, socComment: currentSocCommentFromExcel,
          totalComparisonCostRUB,
        };
        potentialRoutes.push(routeEntry);
      });
    });
  });
  potentialRoutes.sort((a, b) => a.totalComparisonCostRUB - b.totalComparisonCostRUB);
  const top6Routes = potentialRoutes.slice(0, 6);
  setBestPriceResults(top6Routes);
  if (top6Routes.length > 0) {
    setCachedFormValues(getValues());
    setIsNavigatingToBestPrices(true);
  } else {
    toast({ title: "No Routes Found", description: "Could not find valid shipping routes for best price." });
  }
  setIsCalculatingBestPrice(false);
}
