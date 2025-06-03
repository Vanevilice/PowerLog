
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
  seaDestPort: string, // This is the sea destination port for the current sea leg candidate
  seaLineCompanyIt: string | undefined, 
  currentSeaComment: string | null, 
  originPortForSeaRoute: string // This is the originPort of the current sea route candidate (e.g., Qingdao)
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity } = values; // russianDestinationCity is the FINAL target drop-off for SOC
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
        // Pass values for form context, seaDestPort as the specific sea destination for this leg
        { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity } as RouteFormValues,
        context,
        seaDestPort, // Sea port for rail departure lookup
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
    costToAddForRailRUB = 0; // Explicit rail legs (like Vlad to Moscow) are not added for SOC cost breakdown here.
    railLegDetails = null; 

    // For SOC, the drop-off is from the original sea leg origin (originPortForSeaRoute) to the final russianDestinationCity.
    if (context.isSOCDropOffExcelDataLoaded && russianDestinationCity && originPortForSeaRoute && containerType) {
      socDropOffDetails = findSOCDropOffDetails(
        values, // Pass the main form values
        context,
        russianDestinationCity,       // cityForDropOffLookup (final drop-off city)
        originPortForSeaRoute,        // socDepartureCityForDropOff (e.g., Qingdao)
        ""                            // currentCommentary
      );
      if (socDropOffDetails.costNumeric !== null) {
        // SOC Drop-off Excel prices are in RUB.
        costToAddForDropOffRUB = socDropOffDetails.costNumeric; 
      }
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
  const { shipmentType, originPort, destinationPort, containerType, russianDestinationCity } = values; 
  const { excelRouteData, excelSOCRouteData, excelDestinationPorts, isSOCDropOffExcelDataLoaded, isSeaRailExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded) return candidates; 
  if (!originPort || !containerType) return candidates; 
  
  if (shipmentType === "SOC") {
      if (!isSOCDropOffExcelDataLoaded) {
          return candidates; 
      }
      if (!russianDestinationCity) { // For SOC Best Price, final drop-off city is mandatory
          return candidates;
      }
  }


  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; 
  const price40HCKey = "price40HC";

  // Iterate through potential sea destination ports.
  // If form's destinationPort (sea) is filled, only use that. Otherwise, iterate all known sea destinations.
  const seaDestinationPortCandidatesToIterate = destinationPort ? [destinationPort] : excelDestinationPorts;

  seaDestinationPortCandidatesToIterate.forEach(seaDestPortCandidate => { 
    // SOC Specific Filter: If final target is an inland Russian city, the sea leg must go to a Vladivostok-like port.
    if (shipmentType === "SOC" && russianDestinationCity &&
        !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity) && // final dest is inland
        !VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) // current sea port is NOT Vlad-like
       ) {
      return; // Skip this seaDestPortCandidate, it's not a valid transit port for this SOC inland destination
    }
    
    // For COC, if a specific Russian destination city is targeted (and it's inland),
    // the seaDestPortCandidate also needs to be Vladivostok-like.
    if (shipmentType === "COC" && russianDestinationCity && 
        !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity) && // final dest is inland
        !VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) // current sea port is NOT Vlad-like
        ) {
        return; // Skip if COC to inland city and sea port isn't Vlad-like
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
          seaDestPortCandidate, // The current sea destination being evaluated
          seaLineCompanyIt,
          currentSeaComment,
          originPort // Pass the main originPort as originPortForSeaRoute for this candidate path
        );

        const isFurtherRailJourneyForCandidate = shipmentType === "COC" && russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));
        
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
        if (shipmentType === "COC") { 
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
          
          socDropOffCostUSD: shipmentType === "SOC" ? (details.socDropOffDetails?.costNumeric ?? null) : null, // Storing the RUB value here
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

    
