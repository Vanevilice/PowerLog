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
  originPortForSeaRoute: string 
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity } = values; 
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0; 
  
  const isFurtherRailJourney = russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

  let derivedRussianDestinationCityForCandidate: string = "N/A";
  if (isFurtherRailJourney && russianDestinationCity) {
    derivedRussianDestinationCityForCandidate = russianDestinationCity;
  } else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) {
    derivedRussianDestinationCityForCandidate = seaDestPort; 
  } else if (shipmentType === "SOC" && russianDestinationCity) {
    derivedRussianDestinationCityForCandidate = russianDestinationCity; // For SOC, if russianDestCity is given, that's the final point.
  }


  if (isFurtherRailJourney && russianDestinationCity) {
    railLegDetails = findRailLegDetails(
      { ...values, seaLineCompany: seaLineCompanyIt, destinationPort: seaDestPort, originPort: originPortForSeaRoute } as RouteFormValues,
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
  }

  let cityForDropOffLookup = seaDestPort; 
  if (shipmentType === "SOC" && russianDestinationCity) {
    cityForDropOffLookup = russianDestinationCity;
  } else if (shipmentType === "COC") {
    if (isFurtherRailJourney && russianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
      cityForDropOffLookup = russianDestinationCity;
    }
  }
  
  if (shipmentType === "COC" && seaLineCompanyIt && containerType && cityForDropOffLookup) {
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
  } else if (shipmentType === "SOC" && context.isSOCDropOffExcelDataLoaded && containerType && russianDestinationCity && originPortForSeaRoute) {
    socDropOffDetails = findSOCDropOffDetails(
      { ...values, originPort: originPortForSeaRoute, containerType } as RouteFormValues, 
      context,
      russianDestinationCity, // Final drop-off city for SOC
      originPortForSeaRoute,  // Departure city for this SOC drop-off leg
      "" 
    );
    if (socDropOffDetails.costNumeric !== null) {
      costToAddForDropOffRUB = socDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE; 
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
  const { excelRouteData, excelSOCRouteData, excelDestinationPorts, isSOCDropOffExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!originPort || !containerType) return candidates; 
  if (shipmentType === "SOC" && !isSOCDropOffExcelDataLoaded) {
      return candidates; 
  }
  if (shipmentType === "SOC" && !russianDestinationCity) {
      return candidates;
  }


  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; 
  const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPortCandidate => { 
    if (shipmentType === "COC" && !VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]))) {
        // For COC, if a rail destination is specified, sea port must be Vladivostok-like
        if (russianDestinationCity && !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]))) {
            return;
        }
    }
    // For SOC, seaDestPortCandidate can be any port, the rail/drop-off happens to russianDestinationCity.

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
          originPort 
        );

        const isFurtherRailJourneyForCandidate = russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));
        
        if (isFurtherRailJourneyForCandidate && details.railLegDetails?.railLegFailed) {
            return; 
        }
        
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }
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
