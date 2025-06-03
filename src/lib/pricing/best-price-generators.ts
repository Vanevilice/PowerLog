
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
  costToAddForDropOffRUB: number; // This will represent the RUB equivalent of the drop-off cost
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
        { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity } as RouteFormValues,
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
      if (cocDropOffDetails.costNumeric !== null) { // COC Drop-off cost is in USD
        costToAddForDropOffRUB = cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
      }
    }
  } else if (shipmentType === "SOC") {
    costToAddForRailRUB = 0; // No separate rail leg calculation for SOC in this context, it's part of drop-off if applicable
    railLegDetails = null;

    if (context.isSOCDropOffExcelDataLoaded && russianDestinationCity && originPortForSeaRoute && containerType) {
      socDropOffDetails = findSOCDropOffDetails(
        values,
        context,
        russianDestinationCity,       // cityForDropOffLookup (final drop-off city)
        originPortForSeaRoute,        // socDepartureCityForDropOff (e.g., Qingdao, the sea leg's origin)
        currentSeaComment || ""
      );
      // Assuming socDropOffDetails.costNumeric is now USD
      if (socDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
      derivedRussianDestinationCityForCandidate = russianDestinationCity;
    } else {
      socDropOffDetails = {
        socDropOffLegFailed: true,
        commentaryReason: "SOC Drop-off data not loaded or key info (origin, final city, container) missing for lookup.",
        costNumeric: null, displayValue: null, comment: null
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
      if (!russianDestinationCity) {
          return candidates;
      }
  }

  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC";
  const price40HCKey = "price40HC";

  const seaDestinationPortCandidatesToIterate = destinationPort ? [destinationPort] : excelDestinationPorts;

  seaDestinationPortCandidatesToIterate.forEach(seaDestPortCandidate => {
    if (shipmentType === "SOC" && russianDestinationCity &&
        !VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) && 
        !VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]))     
       ) {
      return; 
    }

    if (shipmentType === "COC" && russianDestinationCity &&
        !VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) && 
        !VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) 
        ) {
        return; 
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
          originPort 
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

        totalComparisonCostRUB += details.costToAddForDropOffRUB; // This is now the RUB equivalent
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

          // Store SOC drop-off cost as USD
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
    
