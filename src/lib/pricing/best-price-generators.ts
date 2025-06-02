
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
import { findRailLegDetails, findDropOffDetails, findSOCDropOffDetails, parseFirstNumberFromString, type RailLegInfo, type DropOffInfo, type SOCDropOffInfo } from './finders';

export function generateSeaPlusRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { shipmentType, originPort, containerType, russianDestinationCity, arrivalStationSelection, seaLineCompany } = values;
  const { excelRouteData, excelSOCRouteData, excelRailData, excelDropOffData, excelDestinationPorts, excelSOCDropOffData, isSOCDropOffExcelDataLoaded } = context;
  
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!originPort || !containerType) return candidates; 

  const seaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC"; const price40HCKey = "price40HC";

  excelDestinationPorts.forEach(seaDestPort => {
    // Only consider Vladivostok variants as sea destination ports for this logic
    if (!VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) return;

    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort) || !Array.isArray(seaRoute.destinationPorts) || !seaRoute.destinationPorts.includes(seaDestPort)) return;
      
      const seaPriceForContainerRaw = containerType === "20DC" ? seaRoute[price20DCKey] : seaRoute[price40HCKey];
      const seaPriceForContainerNumeric = parseFirstNumberFromString(seaPriceForContainerRaw);
      if (seaPriceForContainerNumeric === null) return; // Skip if no sea price

      (Array.isArray(seaRoute.seaLines) && seaRoute.seaLines.length > 0 ? seaRoute.seaLines : [undefined]).forEach(seaLineCompanyIt => {
        let totalComparisonCostRUB = seaPriceForContainerNumeric * USD_RUB_CONVERSION_RATE;
        const currentSeaComment = shipmentType === "COC" ? (seaRoute as any).seaComment || null : null;
        const currentSocComment = shipmentType === "SOC" ? (seaRoute as any).socComment || null : null;
        
        let railLegDetails: RailLegInfo | null = null;
        // Determine if a further rail journey to a specific Russian city is intended
        const isFurtherRailJourneyBestPrice = russianDestinationCity && 
                                           VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && // Sea port must be Vladivostok-like
                                           !VLADIVOSTOK_VARIANTS.some(v => v === russianDestinationCity && seaDestPort.startsWith(v.split(" ")[0])); // And final city isn't just Vladivostok itself
        
        if (isFurtherRailJourneyBestPrice) {
          railLegDetails = findRailLegDetails({ ...values, seaLineCompany: seaLineCompanyIt, arrivalStationSelection: arrivalStationSelection } as RouteFormValues, context, seaDestPort, "");
          if (railLegDetails.railLegFailed) return; // Skip if rail leg fails completely
          
          // Calculate rail cost component for comparison
          const railCostForComparison = containerType === "20DC" 
            ? (railLegDetails.baseCost24t ?? railLegDetails.baseCost28t ?? 0) + (railLegDetails.guardCost20DC ?? 0)
            : (railLegDetails.baseCost40HC ?? 0) + (railLegDetails.guardCost40HC ?? 0);

          // If all key rail cost components are 0 or null, it might mean no valid price, skip
          if (railCostForComparison === 0 && ( (containerType === "20DC" && railLegDetails.baseCost24t === null && railLegDetails.baseCost28t === null) || (containerType === "40HC" && railLegDetails.baseCost40HC === null) ) ) return;
          
          totalComparisonCostRUB += railCostForComparison;
        }

        let cocDropOffDetails: DropOffInfo | null = null;
        let socDropOffDetailsForBestPrice: SOCDropOffInfo | null = null;
        // Determine city for drop-off lookup: final Russian city if rail, else sea destination.
        let cityForDropOffBestPrice = isFurtherRailJourneyBestPrice && !railLegDetails?.railLegFailed && russianDestinationCity ? russianDestinationCity : seaDestPort;

        if (shipmentType === "COC" && seaLineCompanyIt) {
          cocDropOffDetails = findDropOffDetails({ ...values, seaLineCompany: seaLineCompanyIt } as RouteFormValues, context, cityForDropOffBestPrice, currentSeaComment, "");
          if (cocDropOffDetails.costNumeric !== null) {
            totalComparisonCostRUB += cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
          }
        } else if (shipmentType === "SOC" && seaLineCompanyIt && isSOCDropOffExcelDataLoaded && containerType) {
            socDropOffDetailsForBestPrice = findSOCDropOffDetails({ ...values, seaLineCompany: seaLineCompanyIt, containerType } as RouteFormValues, context, cityForDropOffBestPrice, "");
            if (socDropOffDetailsForBestPrice.costNumeric !== null) {
                 totalComparisonCostRUB += socDropOffDetailsForBestPrice.costNumeric * USD_RUB_CONVERSION_RATE; // Assuming SOC Drop-off is in USD
            }
        }
        
        candidates.push({
          id: `sroute-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: shipmentType!,
          originPort: originPort!,
          seaDestinationPort: seaDestPort,
          seaLineCompany: seaLineCompanyIt,
          containerType: containerType!,
          russianDestinationCity: isFurtherRailJourneyBestPrice && russianDestinationCity ? russianDestinationCity : ((VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) && russianDestinationCity && VLADIVOSTOK_VARIANTS.some(vladVariant => vladVariant === russianDestinationCity && seaDestPort.startsWith(vladVariant.split(" ")[0]))) ? seaDestPort : (isFurtherRailJourneyBestPrice && russianDestinationCity ? russianDestinationCity : "N/A")),
          railDepartureStation: railLegDetails?.departureStation ?? undefined,
          railArrivalStation: railLegDetails?.arrivalStation ?? undefined,
          seaCostUSD: seaPriceForContainerNumeric,
          seaComment: currentSeaComment,
          socComment: currentSocComment,
          railCost20DC_24t_RUB: railLegDetails?.baseCost24t ?? null,
          railCost20DC_28t_RUB: railLegDetails?.baseCost28t ?? null,
          railGuardCost20DC_RUB: railLegDetails?.guardCost20DC ?? null,
          railCost40HC_RUB: railLegDetails?.baseCost40HC ?? null,
          railGuardCost40HC_RUB: railLegDetails?.guardCost40HC ?? null,
          dropOffCostUSD: shipmentType === "COC" ? (cocDropOffDetails?.costNumeric ?? null) : null,
          dropOffDisplayValue: shipmentType === "COC" ? (cocDropOffDetails?.displayValue ?? null) : null,
          dropOffComment: shipmentType === "COC" ? (cocDropOffDetails?.comment ?? null) : null,
          socDropOffCostUSD: shipmentType === "SOC" ? (socDropOffDetailsForBestPrice?.costNumeric ?? null) : null,
          socDropOffComment: shipmentType === "SOC" ? (socDropOffDetailsForBestPrice?.comment ?? null) : null,
          totalComparisonCostRUB,
        });
      });
    });
  });
  return candidates;
}

export function generateDirectRailCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms } = values; // Agent and Border are not primary filters for initial candidate generation
  const { excelDirectRailData } = context;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms) return candidates;

  excelDirectRailData.forEach(entry => {
    if (
      entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase() &&
      entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase() &&
      entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase() &&
      entry.price !== null // Only consider entries with a price
    ) {
      candidates.push({
        id: `droute-${routeIdCounter++}`,
        mode: 'direct_rail',
        shipmentType: 'N/A', // Not applicable or not specified for DR best price
        originPort: entry.cityOfDeparture, // Mapping DR city to originPort field
        seaDestinationPort: entry.destinationCity, // Mapping DR city to seaDestinationPort field
        containerType: '40HC', // Assuming 40HC as default/common for DR, or could be made dynamic
        russianDestinationCity: entry.destinationCity, // Final destination is the DR destination city
        totalComparisonCostRUB: entry.price, // Direct rail price is the comparison cost
        
        directRailAgentName: entry.agentName, // Include all DR details
        directRailIncoterms: entry.incoterms,
        directRailBorder: entry.border,
        directRailPriceRUB: entry.price,
        directRailETD: entry.etd,
        directRailExcelCommentary: entry.commentary,
        railDepartureStation: entry.departureStation, // For completeness
        railArrivalStation: entry.destinationCity,  // For completeness
        
        seaCostUSD: null, // Not applicable
      });
    }
  });
  return candidates;
}

    