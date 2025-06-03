
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
  costToAddForDropOffRUB: number; // This will be either COC or SOC drop-off cost in RUB
  derivedRussianDestinationCityForCandidate: string; 
}

// Internal helper function
function _getRailAndDropOffDetailsForCandidate(
  values: RouteFormValues, // These are the main form values
  context: PricingDataContextType,
  seaDestPort: string, // The sea port for the current sea route candidate (e.g., Vladivostok)
  seaLineCompanyIt: string | undefined, // The specific sea line for the current sea route candidate
  currentSeaComment: string | null, // Comment from the specific sea route
  originPortForSeaRoute: string // The origin port of the current sea route candidate
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity, arrivalStationSelection } = values; // From main form
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0; // Will hold either COC or SOC drop-off cost in RUB
  
  const isFurtherRailJourney = russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

  let derivedRussianDestinationCityForCandidate: string = "N/A";
  if (isFurtherRailJourney && russianDestinationCity) {
    derivedRussianDestinationCityForCandidate = russianDestinationCity;
  } else if (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) {
    derivedRussianDestinationCityForCandidate = seaDestPort; 
  }

  if (isFurtherRailJourney && russianDestinationCity) {
    railLegDetails = findRailLegDetails(
      // Pass values for rail leg specific to this candidate
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

  // Determine city for drop-off lookup. For SOC, this is the final russianDestinationCity.
  // For COC, it's more complex (final city if rail, else sea dest).
  let cityForDropOffLookup = seaDestPort; 
  if (shipmentType === "SOC" && russianDestinationCity) {
    cityForDropOffLookup = russianDestinationCity;
  } else if (shipmentType === "COC") {
    if (isFurtherRailJourney && russianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
      cityForDropOffLookup = russianDestinationCity;
    }
    // else for COC, it remains seaDestPort (Vladivostok-like)
  }
  
  if (shipmentType === "COC" && seaLineCompanyIt && containerType) {
    cocDropOffDetails = findDropOffDetails(
      { ...values, seaLineCompany: seaLineCompanyIt, containerType, destinationPort: seaDestPort, originPort: originPortForSeaRoute } as RouteFormValues,
      context,
      cityForDropOffLookup, // For COC, this is where the drop-off happens
      currentSeaComment, 
      "" 
    );
    if (cocDropOffDetails.costNumeric !== null) {
      costToAddForDropOffRUB = cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
    }
  } else if (shipmentType === "SOC" && context.isSOCDropOffExcelDataLoaded && containerType && russianDestinationCity) {
    // For SOC, drop-off lookup uses originPortForSeaRoute as the "departure" for SOC drop-off,
    // and russianDestinationCity (from form) as the "drop-off" city.
    socDropOffDetails = findSOCDropOffDetails(
      { ...values, originPort: originPortForSeaRoute, containerType } as RouteFormValues, // Override originPort for this specific lookup
      context,
      russianDestinationCity, // This is the final drop-off city for SOC
      "" 
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
  const { shipmentType, originPort, containerType, russianDestinationCity } = values; 
  const { excelRouteData, excelSOCRouteData, excelDestinationPorts, isSOCDropOffExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!originPort || !containerType) return candidates; 
  if (shipmentType === "SOC" && !isSOCDropOffExcelDataLoaded) {
      // console.warn("SOC Drop-off Excel not loaded. Cannot generate SOC Best Price candidates.");
      return candidates; // Cannot proceed for SOC without its drop-off data
  }
  if (shipmentType === "SOC" && !russianDestinationCity) {
      // console.warn("Russian Destination City not selected. Cannot generate SOC Best Price candidates as drop-off city is required.");
      return candidates;
  }


  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; 
  const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPortCandidate => { // Iterate through all possible sea destination ports (e.g., Vladivostok, Vostochny)
    if (!VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]))) return; // Only consider Vladivostok-like ports as sea destinations for rail onward

    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      // Match current form's originPort with the seaRoute's origin/departure ports
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort)) return;
      // Match the current seaDestPortCandidate with the seaRoute's destination ports
      if (!Array.isArray(seaRoute.destinationPorts) || !seaRoute.destinationPorts.includes(seaDestPortCandidate)) return;
      
      const seaPriceForContainerRaw = containerType === "20DC" ? seaRoute[price20DCKey] : seaRoute[price40HCKey];
      const seaPriceForContainerNumeric = parseFirstNumberFromString(seaPriceForContainerRaw);
      if (seaPriceForContainerNumeric === null) return; // If no sea price, this permutation is invalid

      (Array.isArray(seaRoute.seaLines) && seaRoute.seaLines.length > 0 ? seaRoute.seaLines : [undefined]).forEach(seaLineCompanyIt => {
        let totalComparisonCostRUB = seaPriceForContainerNumeric * USD_RUB_CONVERSION_RATE;
        const currentSeaComment = shipmentType === "COC" ? (seaRoute as any).seaComment || null : null;
        const currentSocComment = shipmentType === "SOC" ? (seaRoute as any).socComment || null : null;
        
        const details = _getRailAndDropOffDetailsForCandidate(
          values, // Pass main form values
          context, 
          seaDestPortCandidate, // Current sea destination port being considered
          seaLineCompanyIt,
          currentSeaComment,
          originPort // The origin port from the main form, which is the seaRoute's origin here
        );

        // Skip candidate if a required rail leg failed
        const isFurtherRailJourneyForCandidate = russianDestinationCity && 
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) && 
                               !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));
        if (isFurtherRailJourneyForCandidate && details.railLegDetails?.railLegFailed) {
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
        totalComparisonCostRUB += details.costToAddForDropOffRUB; // This will be COC or SOC drop-off based on type
        
        candidates.push({
          id: `sroute-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: shipmentType!,
          originPort: originPort!, // This is the main origin from the form
          seaDestinationPort: seaDestPortCandidate, // The specific sea port for this candidate
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
        containerType: '40HC', // Defaulting or could be based on excel if column added
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

