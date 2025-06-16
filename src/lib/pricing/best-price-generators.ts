
// src/lib/pricing/best-price-generators.ts
import type {
  RouteFormValues,
  PricingDataContextType,
  BestPriceRoute,
  ShipmentType,
  ContainerType,
  ExcelSOCDropOffEntry,
  DashboardServiceDataRow, 
  DashboardServiceSection, 
} from '@/types';
import { USD_RUB_CONVERSION_RATE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, NONE_SEALINE_VALUE } from './constants';
import {
  findRailLegDetails,
  findDropOffDetails,
  findSOCDropOffDetails,
  parseFirstNumberFromString,
  parseDashboardRouteString,    
  parseDashboardMonetaryValue, 
  type RailLegInfo,
  type DropOffInfo,
  type SOCDropOffInfo
} from './finders';
import { getCityFromStationName } from './city-station-mapper'; // Import the new utility

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
  const { shipmentType, containerType, russianDestinationCity: formRussianDestinationCity } = values; // Renamed to avoid conflict
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0;

  let derivedRussianDestinationCityForCandidate: string = "N/A";
  
  // Use formRussianDestinationCity for logic based on user's direct input in the form
  // The `russianDestinationCity` parameter in `findRailLegDetails` etc. will be the one derived from dashboard or form as appropriate

  if (shipmentType === "COC") {
    const isFurtherRailJourney = formRussianDestinationCity &&
                                 VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) &&
                                 !VLADIVOSTOK_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

    if (isFurtherRailJourney && formRussianDestinationCity && containerType) {
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
      railLegDetails = findRailLegDetails(
        { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity, containerType } as RouteFormValues,
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
    if (isFurtherRailJourney && formRussianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
        cityForDropOffLookup = formRussianDestinationCity;
    }

    if (seaLineCompanyIt && containerType && cityForDropOffLookup) {
      cocDropOffDetails = findDropOffDetails(
        { ...values, seaLineCompany: seaLineCompanyIt, containerType, destinationPort: seaDestPort, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity } as RouteFormValues,
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
    costToAddForRailRUB = 0; 
    railLegDetails = null; 

    if (context.isSOCDropOffExcelDataLoaded && formRussianDestinationCity && seaDestPort && containerType) {
      socDropOffDetails = findSOCDropOffDetails(
        values, // Pass full form values
        context,
        formRussianDestinationCity,       // cityForDropOffLookup (final drop-off city)
        seaDestPort,                  // socDepartureCityForDropOff (e.g., Vladivostok, the sea destination port)
        currentSeaComment || ""
      );
      
      if (socDropOffDetails.costNumeric !== null) { // costNumeric is USD
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
    } else {
      socDropOffDetails = {
        socDropOffLegFailed: true,
        commentaryReason: "SOC Drop-off data not loaded or key info (sea destination port, final city, container) missing for lookup.",
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

  // Determine the sea destination ports to iterate over FOR BEST PRICE
  let seaPortsToConsiderForBestPrice: string[];
  const isFurtherRailForBestPrice = russianDestinationCity &&
                                  !VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) && // True if russianCity is set and is NOT a hub like Vlad.
                                  (VLADIVOSTOK_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))) || // And excel has some Vlad hubs
                                   VOSTOCHNIY_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))));   // Or excel has some Vost hubs

  if (isFurtherRailForBestPrice) {
    // If a specific Russian rail destination is given (and it's not a hub itself),
    // we should only consider sea hubs like Vladivostok/Vostochniy that are in our excel data.
    seaPortsToConsiderForBestPrice = excelDestinationPorts.filter(dp =>
      VLADIVOSTOK_VARIANTS.some(v => dp.startsWith(v.split(" ")[0])) ||
      VOSTOCHNIY_VARIANTS.some(v => dp.startsWith(v.split(" ")[0]))
    );
    // If, for some reason, no hubs were found in excelDestinationPorts after filtering,
    // (which would be unusual if isFurtherRailForBestPrice was true),
    // then this list might be empty. This is okay, loop won't run.
  } else {
    // If no specific "further" Russian rail destination (or it is a hub like Vladivostok itself),
    // or if no hubs are in excel data to begin with,
    // consider all destination ports from excel to find the best direct sea route.
    seaPortsToConsiderForBestPrice = excelDestinationPorts;
  }
  
  const seaDestinationPortCandidatesToIterate = seaPortsToConsiderForBestPrice;


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

        // For Sea+Rail candidates, `values` (from form) is the source of truth for destination desires.
        // _getRailAndDropOffDetailsForCandidate will use values.russianDestinationCity.
        const details = _getRailAndDropOffDetailsForCandidate(
          values,
          context,
          seaDestPortCandidate,
          seaLineCompanyIt,
          currentSeaComment,
          originPort 
        );

        const isFurtherRailJourneyForCandidate = shipmentType === "COC" && values.russianDestinationCity &&
                               VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) &&
                               !VLADIVOSTOK_VARIANTS.some(v => v === values.russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));

        if (shipmentType === "SOC" && details.socDropOffDetails?.socDropOffLegFailed) {
            return; 
        }
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }
        if (shipmentType === "COC" && isFurtherRailJourneyForCandidate && details.railLegDetails?.railLegFailed) {
            return;
        }

        totalComparisonCostRUB += details.costToAddForDropOffRUB; // This is the RUB equivalent of drop-off (COC or SOC)
        
        let socInlandRailCostRUB: number | null = null;
        if (shipmentType === "SOC" && details.socDropOffDetails?.costNumeric !== null) {
          socInlandRailCostRUB = details.socDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
           // For SOC, costToAddForRailRUB is already 0, so no double count for total.
        } else if (shipmentType === "COC") {
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
          
          railCost20DC_24t_RUB: shipmentType === "COC" ? (details.railLegDetails?.baseCost24t ?? null) : (containerType === "20DC" ? socInlandRailCostRUB : null),
          railCost20DC_28t_RUB: shipmentType === "COC" ? (details.railLegDetails?.baseCost28t ?? null) : null, // SOC doesn't have 28t variant in this model
          railGuardCost20DC_RUB: shipmentType === "COC" ? (details.railLegDetails?.guardCost20DC ?? null) : null, // No guard for SOC
          railCost40HC_RUB: shipmentType === "COC" ? (details.railLegDetails?.baseCost40HC ?? null) : (containerType === "40HC" ? socInlandRailCostRUB : null),
          railGuardCost40HC_RUB: shipmentType === "COC" ? (details.railLegDetails?.guardCost40HC ?? null) : null, // No guard for SOC

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

export function generateDashboardCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = context;
  const { shipmentType: formShipmentType, russianDestinationCity: formRussianDestinationCity } = values; 
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded || !dashboardServiceSections || dashboardServiceSections.length === 0) {
    return candidates;
  }

  dashboardServiceSections.forEach(section => {
    section.dataRows.forEach(row => {
      if (formShipmentType !== "COC") return;

      const parsedRoute = parseDashboardRouteString(row.route);
      const parsedRate = parseDashboardMonetaryValue(row.rate);

      // Ensure primary parsed components are valid before proceeding
      if (!parsedRoute.originPort || parsedRoute.originPort.length === 0 || !parsedRoute.containerType || parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }
      
      // Determine the target city for this dashboard entry
      const stationNameFromDashboard = parsedRoute.finalRussianDestination; // This is the station name from "FOR [Station]"
      const mappedCityFromStation = stationNameFromDashboard ? getCityFromStationName(stationNameFromDashboard) : null;
      
      // If the form has a specific Russian destination city, the dashboard entry must match it (either directly or via station mapping)
      if (formRussianDestinationCity) {
        if (mappedCityFromStation) { // Dashboard entry has a "FOR [Station]"
          if (mappedCityFromStation.toLowerCase() !== formRussianDestinationCity.toLowerCase()) {
            return; // Mapped city doesn't match user's desired city
          }
        } else if (parsedRoute.seaDestinationPort) { // No "FOR" clause, compare sea destination
          if (!VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0])) || 
              parsedRoute.seaDestinationPort.toLowerCase() !== formRussianDestinationCity.toLowerCase()) {
             // If Sea Dest is not a hub like Vladivostok AND it doesn't match the form's Russian city
             // OR if it is a hub but doesn't match the form's Russian city (which implies user wants direct to hub)
            return; 
          }
        } else {
            return; // No way to match dashboard entry to user's desired Russian city
        }
      }
      // If formRussianDestinationCity is NOT set, we consider all dashboard entries that can be priced.

      parsedRoute.originPort.forEach(singleOriginPort => {
        let effectiveSeaDestPortForLookups = parsedRoute.seaDestinationPort || "N/A";
        // The russianDestinationCity for the BestPriceRoute object should be the *mapped city* if available,
        // otherwise it's the sea destination port (if a hub) or remains N/A.
        let effectiveRussianDestCityForCandidate = mappedCityFromStation || 
                                                 (parsedRoute.seaDestinationPort && VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0])) ? parsedRoute.seaDestinationPort : "N/A");

        if (mappedCityFromStation && parsedRoute.seaDestinationPort && !VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0]))) {
            // If there's a mapped city from a "FOR" clause, but the sea port is NOT a hub like Vladivostok, this is likely an invalid combo for further rail.
            // However, we might still want to price it up to the sea port.
            // For now, we prioritize the mapped city if "FOR" clause exists.
            // The _getRailAndDropOffDetailsForCandidate will determine if rail is feasible from effectiveSeaDestPortForLookups.
        }
        
        let totalDashboardComparisonCostRUB = parsedRate.amount! * USD_RUB_CONVERSION_RATE;

        // Construct temporary form values for the helper, using the mapped city for russianDestinationCity
        const tempFormValuesForHelper: RouteFormValues = {
            ...values, // Spread base values from the form
            shipmentType: "COC", 
            originPort: singleOriginPort,
            destinationPort: effectiveSeaDestPortForLookups, // Sea port
            seaLineCompany: section.serviceName, 
            containerType: parsedRoute.containerType!, 
            russianDestinationCity: mappedCityFromStation || values.russianDestinationCity, // Use mapped city if available for internal lookups, else form's
        };
        
        const additionalDetails = _getRailAndDropOffDetailsForCandidate(
            tempFormValuesForHelper,
            context,
            effectiveSeaDestPortForLookups, // Sea port for context
            section.serviceName,
            row.additionalComment !== '-' ? row.additionalComment : null,
            singleOriginPort
        );

        // If rail was expected (based on mappedCityFromStation indicating a rail dest) but failed, skip candidate
        if (mappedCityFromStation && additionalDetails.railLegDetails?.railLegFailed) {
            return;
        }
        // If drop-off was expected (COC non-Panda) but failed, skip candidate
        if (!section.serviceName?.toLowerCase().includes('panda express line') && additionalDetails.cocDropOffDetails?.dropOffLegFailed){
            return;
        }


        totalDashboardComparisonCostRUB += additionalDetails.costToAddForRailRUB;
        totalDashboardComparisonCostRUB += additionalDetails.costToAddForDropOffRUB;
        
        candidates.push({
          id: `dash-${section.serviceName.replace(/\s+/g, '-')}-${singleOriginPort}-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: "COC", 
          originPort: singleOriginPort,
          seaDestinationPort: effectiveSeaDestPortForLookups, 
          seaLineCompany: section.serviceName, 
          containerType: parsedRoute.containerType!, 
          russianDestinationCity: effectiveRussianDestCityForCandidate, // Use the city name here
          
          seaCostUSD: parsedRate.amount,
          seaComment: row.additionalComment !== '-' ? row.additionalComment : null,
          
          totalComparisonCostRUB: totalDashboardComparisonCostRUB,
          isDashboardRecommendation: true,
          dashboardSourceService: section.serviceName,
          
          railDepartureStation: additionalDetails.railLegDetails?.departureStation ?? undefined,
          railArrivalStation: additionalDetails.railLegDetails?.arrivalStation ?? (stationNameFromDashboard && mappedCityFromStation ? stationNameFromDashboard : undefined), // Store original station name if mapped
          railCost20DC_24t_RUB: additionalDetails.railLegDetails?.baseCost24t ?? null,
          railCost20DC_28t_RUB: additionalDetails.railLegDetails?.baseCost28t ?? null,
          railGuardCost20DC_RUB: additionalDetails.railLegDetails?.guardCost20DC ?? null,
          railCost40HC_RUB: additionalDetails.railLegDetails?.baseCost40HC ?? null,
          railGuardCost40HC_RUB: additionalDetails.railLegDetails?.guardCost40HC ?? null,
          
          dropOffCostUSD: additionalDetails.cocDropOffDetails?.costNumeric ?? null,
          dropOffDisplayValue: additionalDetails.cocDropOffDetails?.displayValue ?? null,
          dropOffComment: additionalDetails.cocDropOffDetails?.comment ?? null,
        });
      });
    });
  });

  return candidates;
}
    

    
