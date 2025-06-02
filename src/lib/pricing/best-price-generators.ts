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
  derivedRussianDestinationCityForCandidate: string; // The actual Russian city name for this specific candidate
}

// Internal helper function
function _getRailAndDropOffDetailsForCandidate(
  values: RouteFormValues,
  context: PricingDataContextType,
  seaDestPort: string, // The sea port (e.g., Vladivostok)
  seaLineCompanyIt: string | undefined,
  currentSeaComment: string | null // The comment from the sea route itself
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity, arrivalStationSelection } = values;
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0;
  
  // Determine if a further rail journey to a specific Russian city is intended for this candidate
  const isFurtherRailJourney = russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

  let derivedRussianDestinationCityForCandidate: string = "N/A";
  if (isFurtherRailJourney && russianDestinationCity) {
    derivedRussianDestinationCityForCandidate = russianDestinationCity;
  } else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) {
    // If sea port is Vladivostok-like and no further rail journey, or final city is also Vladivostok-like
    derivedRussianDestinationCityForCandidate = seaDestPort; 
  }


  if (isFurtherRailJourney && russianDestinationCity) {
    railLegDetails = findRailLegDetails(
      { ...values, seaLineCompany: seaLineCompanyIt, arrivalStationSelection: arrivalStationSelection } as RouteFormValues,
      context,
      seaDestPort,
      "" // Initial commentary for rail leg finding
    );
    if (!railLegDetails.railLegFailed) {
      const railCostComponent = containerType === "20DC"
        ? (railLegDetails.baseCost24t ?? railLegDetails.baseCost28t ?? 0) + (railLegDetails.guardCost20DC ?? 0)
        : (railLegDetails.baseCost40HC ?? 0) + (railLegDetails.guardCost40HC ?? 0);
      
      // Only add rail cost if primary components are not all null/0 (indicating a valid price was found)
      if (!(railCostComponent === 0 && 
           ((containerType === "20DC" && railLegDetails.baseCost24t === null && railLegDetails.baseCost28t === null) || 
            (containerType === "40HC" && railLegDetails.baseCost40HC === null))
         )) {
        costToAddForRailRUB = railCostComponent;
      }
    } else {
      // If rail leg failed, we might still proceed if drop-off is to seaDestPort, but costToAddForRailRUB remains 0
    }
  }

  // Determine city for drop-off lookup: final Russian city if rail (and successful), else sea destination.
  let cityForDropOffLookup = seaDestPort; // Default to sea port
  if (isFurtherRailJourney && russianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
    cityForDropOffLookup = russianDestinationCity;
  }
  
  if (shipmentType === "COC" && seaLineCompanyIt && containerType) {
    cocDropOffDetails = findDropOffDetails(
      { ...values, seaLineCompany: seaLineCompanyIt, containerType } as RouteFormValues,
      context,
      cityForDropOffLookup,
      currentSeaComment, // Pass the sea comment from the current sea route
      "" // Initial commentary for drop-off finding
    );
    if (cocDropOffDetails.costNumeric !== null) {
      costToAddForDropOffRUB = cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
    }
  } else if (shipmentType === "SOC" && seaLineCompanyIt && context.isSOCDropOffExcelDataLoaded && containerType) {
    socDropOffDetails = findSOCDropOffDetails(
      { ...values, seaLineCompany: seaLineCompanyIt, containerType } as RouteFormValues,
      context,
      cityForDropOffLookup,
      "" // Initial commentary
    );
    if (socDropOffDetails.costNumeric !== null) {
      costToAddForDropOffRUB = socDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE; // Assuming SOC Drop-off is in USD
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
  const { shipmentType, originPort, containerType, russianDestinationCity, arrivalStationSelection } = values; // Removed seaLineCompany from direct destructuring as it's iterated
  const { excelRouteData, excelSOCRouteData, excelDestinationPorts, isSOCDropOffExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!originPort || !containerType) return candidates; 

  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; 
  const price40HCKey = "price40HC";

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
        const currentSeaComment = shipmentType === "COC" ? (seaRoute as any).seaComment || null : null;
        const currentSocComment = shipmentType === "SOC" ? (seaRoute as any).socComment || null : null;
        
        const details = _getRailAndDropOffDetailsForCandidate(
          values, 
          context, 
          seaDestPort, 
          seaLineCompanyIt,
          currentSeaComment
        );

        // Skip candidate if a required rail leg failed and a Russian destination city was specified
        if (russianDestinationCity && VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0])) && details.railLegDetails?.railLegFailed) {
            return; 
        }
        // Skip candidate if a required COC drop-off leg failed (and it's not Panda line)
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }
        // Skip candidate if a required SOC drop-off leg failed
        if (shipmentType === "SOC" && details.socDropOffDetails?.socDropOffLegFailed) {
            return;
        }

        totalComparisonCostRUB += details.costToAddForRailRUB;
        totalComparisonCostRUB += details.costToAddForDropOffRUB;
        
        candidates.push({
          id: `sroute-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: shipmentType!,
          originPort: originPort!,
          seaDestinationPort: seaDestPort,
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
          socDropOffCostUSD: shipmentType === "SOC" ? (details.socDropOffDetails?.costNumeric ?? null) : null,
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
        id: `droute-${routeIdCounter++}`,
        mode: 'direct_rail',
        shipmentType: 'N/A', 
        originPort: entry.cityOfDeparture, 
        seaDestinationPort: entry.destinationCity, 
        containerType: '40HC', 
        russianDestinationCity: entry.destinationCity, 
        totalComparisonCostRUB: entry.price, 
        
        directRailAgentName: entry.agentName, 
        directRailIncoterms: entry.incoterms,
        directRailBorder: entry.border,
        directRailPriceRUB: entry.price,
        directRailETD: entry.etd,
        directRailExcelCommentary: entry.commentary,
        railDepartureStation: entry.departureStation, 
        railArrivalStation: entry.destinationCity,  
        
        seaCostUSD: null, 
      });
    }
  });
  return candidates;
}
