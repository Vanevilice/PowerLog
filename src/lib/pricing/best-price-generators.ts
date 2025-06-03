
// src/lib/pricing/best-price-generators.ts
import type {
  RouteFormValues,
  PricingDataContextType,
  BestPriceRoute,
  ShipmentType,
  ContainerType,
  ExcelSOCDropOffEntry
} from '@/types';
import { USD_RUB_CONVERSION_RATE, VLADIVOSTOK_VARIANTS, NONE_SEALINE_VALUE } from './constants';
import { 
  findRailLegDetails, 
  findDropOffDetails, 
  findSOCDropOffDetails, 
  parseFirstNumberFromString, 
  type RailLegInfo, 
  type DropOffInfo, 
  type SOCDropOffInfo 
} from './finders';

interface RailAndDropOffCandidateDetails {
  railLegDetails: RailLegInfo | null;
  cocDropOffDetails: DropOffInfo | null;
  socDropOffDetails: SOCDropOffInfo | null;
  costToAddForRailRUB: number;
  costToAddForDropOffRUB: number; 
  derivedRussianDestinationCityForCandidate: string; 
}

// Internal helper function
function _getRailAndDropOffDetailsForCandidate(
  values: RouteFormValues, 
  context: PricingDataContextType,
  seaDestPort: string, 
  seaLineCompanyIt: string | undefined, 
  currentSeaComment: string | null, 
  originPortForSeaRoute: string // This is the originPort of the current sea route candidate
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity } = values; 
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0; 
  
  let derivedRussianDestinationCityForCandidate: string = "N/A";

  if (shipmentType === "COC") {
    const isFurtherRailJourney = russianDestinationCity && 
                                 VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && 
                                 !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

    if (isFurtherRailJourney && russianDestinationCity) {
      derivedRussianDestinationCityForCandidate = russianDestinationCity;
      railLegDetails = findRailLegDetails(
        { ...values, seaLineCompany: seaLineCompanyIt, destinationPort: seaDestPort, originPort: originPortForSeaRoute, russianDestinationCity } as RouteFormValues,
        context,
        seaDestPort,
        "" 
      );
      if (!railLegDetails.railLegFailed) {
        const railCostComponent = containerType === "20DC"
          ? (railLegDetails.baseCost24t ?? railLegDetails.baseCost28t ?? 0) + (railLegDetails.guardCost20DC ?? 0)
          : (railLegDetails.baseCost40HC ?? 0) + (railLegDetails.guardCost40HC ?? 0);
        
        if (!(railCostComponent === 0 && 
             ((containerType === "20DC" && railLegDetails.baseCost24t === null && railLegDetails.baseCost28t === null) || 
              (containerType === "40HC" && railLegDetails.baseCost40HC === null))
           )) {
          costToAddForRailRUB = railCostComponent;
        }
      }
    } else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) {
        derivedRussianDestinationCityForCandidate = seaDestPort; 
    }

    let cityForDropOffLookup = seaDestPort; 
    if (isFurtherRailJourney && russianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
        cityForDropOffLookup = russianDestinationCity;
    }

    if (seaLineCompanyIt && containerType && cityForDropOffLookup) {
      cocDropOffDetails = findDropOffDetails(
        { ...values, seaLineCompany: seaLineCompanyIt, containerType, destinationPort: seaDestPort, originPort: originPortForSeaRoute } as RouteFormValues,
        context,
        cityForDropOffLookup, 
        currentSeaComment, 
        "" 
      );
      if (cocDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
      }
    }
  } else if (shipmentType === "SOC") {
    // For SOC, explicit rail leg addition from findRailLegDetails is generally not done here.
    // The primary additional cost is the SOC drop-off.
    costToAddForRailRUB = 0;
    railLegDetails = null; // No separate rail leg processing for SOC cost breakdown.

    if (context.isSOCDropOffExcelDataLoaded && russianDestinationCity && originPortForSeaRoute && containerType) {
      socDropOffDetails = findSOCDropOffDetails(
        // Pass originPortForSeaRoute as the departure city for this SOC drop-off leg context
        // Pass russianDestinationCity as the cityForDropOffLookup
        { ...values, originPort: originPortForSeaRoute, containerType, russianDestinationCity } as RouteFormValues,
        context,
        russianDestinationCity,    // cityForDropOffLookup for SOC Drop-off
        originPortForSeaRoute,     // socDepartureCityForDropOff for SOC Drop-off
        ""                         // currentCommentary
      );
      if (socDropOffDetails.costNumeric !== null) {
        // **CRITICAL ASSUMPTION CHANGE**: Assume SOC Drop-off Excel prices are in RUB.
        costToAddForDropOffRUB = socDropOffDetails.costNumeric; 
      }
      // socDropOffLegFailed is checked by the caller
      derivedRussianDestinationCityForCandidate = russianDestinationCity;
    } else {
      socDropOffDetails = { 
        socDropOffLegFailed: true, 
        commentaryReason: "SOC Drop-off data not loaded or key info (origin, final city, container) missing for lookup.", 
        costNumeric: null, 
        displayValue: null, 
        comment: null 
      };
    }
  }

  return {
    railLegDetails,
    cocDropOffDetails,
    socDropOffDetails,
    costToAddForRailRUB,
    costToAddForDropOffRUB,
    derivedRussianDestinationCityForCandidate,
  };
}


export function generateSeaPlusRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { shipmentType, originPort, containerType, russianDestinationCity } = values; 
  const { excelRouteData, excelSOCRouteData, excelDestinationPorts, isSOCDropOffExcelDataLoaded, isSeaRailExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded) return candidates; // Main Excel must be loaded
  if (!originPort || !containerType) return candidates; 
  
  if (shipmentType === "SOC") {
      if (!isSOCDropOffExcelDataLoaded) {
          // console.log("SOC Best Price: SOC Drop-off Excel not loaded. Returning empty candidates.");
          return candidates; 
      }
      if (!russianDestinationCity) {
          // console.log("SOC Best Price: Russian Destination City not provided for SOC. Returning empty candidates.");
          return candidates;
      }
  }


  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; 
  const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPortCandidate => { 
    if (shipmentType === "COC" && russianDestinationCity) {
        // For COC, if a rail destination is specified, sea port must be Vladivostok-like to enable rail.
        // Or, if russianDestinationCity is a Vladivostok variant itself, seaDestPortCandidate must match it.
        const isSeaDestVladLike = VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]));
        const isRussianDestVladLikeAndMatches = VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));

        if (!isSeaDestVladLike && !isRussianDestVladLikeAndMatches) {
            // If final dest is specified and not Vlad-like, and current sea dest is also not Vlad-like,
            // this sea port cannot lead to the final rail destination.
            if (!VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity)){ // Check if russianDest is not Vlad-like itself
                 return;
            }
        }
    }

    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort)) return;
      if (!Array.isArray(seaRoute.destinationPorts) || !seaRoute.destinationPorts.includes(seaDestPortCandidate)) return;
      
      const seaPriceForContainerRaw = containerType === "20DC" ? seaRoute[price20DCKey] : seaRoute[price40HCKey];
      const seaPriceForContainerNumeric = parseFirstNumberFromString(seaPriceForContainerRaw);
      if (seaPriceForContainerNumeric === null) return; 

      (Array.isArray(seaRoute.seaLines) && seaRoute.seaLines.length > 0 ? seaRoute.seaLines : [undefined]).forEach(seaLineCompanyIt => {
        let totalComparisonCostRUB = seaPriceForContainerNumeric * USD_RUB_CONVERSION_RATE;
        const currentSeaComment = shipmentType === "COC" ? (seaRoute as any).seaComment || null : null;
        const currentSocComment = shipmentType === "SOC" ? (seaRoute as any).socComment || null : null;
        
        const details = _getRailAndDropOffDetailsForCandidate(
          values, 
          context, 
          seaDestPortCandidate, 
          seaLineCompanyIt,
          currentSeaComment,
          originPort // Pass the main originPort as originPortForSeaRoute for this candidate path
        );

        const isFurtherRailJourneyForCandidate = shipmentType === "COC" && russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));
        
        // Skip candidate if a required leg failed
        if (shipmentType === "SOC" && details.socDropOffDetails?.socDropOffLegFailed) {
            return; 
        }
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }
        if (shipmentType === "COC" && isFurtherRailJourneyForCandidate && details.railLegDetails?.railLegFailed) {
            return; 
        }

        totalComparisonCostRUB += details.costToAddForDropOffRUB; 
        if (shipmentType === "COC") { // Only add explicit rail cost for COC
             totalComparisonCostRUB += details.costToAddForRailRUB;
        }
        
        candidates.push({
          id: `sroute-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: shipmentType!,
          originPort: originPort!, 
          seaDestinationPort: seaDestPortCandidate, 
          seaLineCompany: seaLineCompanyIt,
          containerType: containerType!,
          russianDestinationCity: details.derivedRussianDestinationCityForCandidate,
          railDepartureStation: details.railLegDetails?.departureStation ?? undefined,
          railArrivalStation: details.railLegDetails?.arrivalStation ?? undefined,
          seaCostUSD: seaPriceForContainerNumeric,
          seaComment: currentSeaComment,
          socComment: currentSocComment,
          railCost20DC_24t_RUB: details.railLegDetails?.baseCost24t ?? null,
          railCost20DC_28t_RUB: details.railLegDetails?.baseCost28t ?? null,
          railGuardCost20DC_RUB: details.railLegDetails?.guardCost20DC ?? null,
          railCost40HC_RUB: details.railLegDetails?.baseCost40HC ?? null,
          railGuardCost40HC_RUB: details.railLegDetails?.guardCost40HC ?? null,
          
          dropOffCostUSD: shipmentType === "COC" ? (details.cocDropOffDetails?.costNumeric ?? null) : null,
          dropOffDisplayValue: shipmentType === "COC" ? (details.cocDropOffDetails?.displayValue ?? null) : null,
          dropOffComment: shipmentType === "COC" ? (details.cocDropOffDetails?.comment ?? null) : null,
          
          socDropOffCostUSD: shipmentType === "SOC" ? (details.socDropOffDetails?.costNumeric ?? null) : null, // Storing the RUB value here for now, will be relabeled or handled at display
          socDropOffComment: shipmentType === "SOC" ? (details.socDropOffDetails?.comment ?? null) : null,
          
          totalComparisonCostRUB,
        });
      });
    });
  });
  return candidates;
}

export function generateDirectRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms } = values; 
  const { excelDirectRailData, isDirectRailExcelDataLoaded } = context;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isDirectRailExcelDataLoaded) return candidates;
  if (!directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms) return candidates;

  excelDirectRailData.forEach(entry => {
    if (
      entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase() &&
      entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase() &&
      entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase() &&
      entry.price !== null 
    ) {
      candidates.push({
        id: `droute-${routeIdCounter++}`,
        mode: 'direct_rail',
        shipmentType: 'N/A', // Direct rail doesn't typically distinguish COC/SOC in this context
        originPort: entry.cityOfDeparture, 
        seaDestinationPort: entry.destinationCity, 
        containerType: '40HC', // Default or assume 40HC for direct rail comparison, or make selectable
        russianDestinationCity: entry.destinationCity, 
        totalComparisonCostRUB: entry.price, // Assuming price is in RUB
        
        directRailAgentName: entry.agentName, 
        directRailIncoterms: entry.incoterms,
        directRailBorder: entry.border,
        directRailPriceRUB: entry.price,
        directRailETD: entry.etd,
        directRailExcelCommentary: entry.commentary,
        railDepartureStation: entry.departureStation, 
        railArrivalStation: entry.destinationCity,  // For direct rail, final dest city is the arrival point
        
        seaCostUSD: null, // Not applicable
      });
    }
  });
  return candidates;
}

