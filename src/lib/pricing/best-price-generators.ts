
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
  values: RouteFormValues, // Note: values.russianDestinationCity here can be the mapped city name
  context: PricingDataContextType,
  seaDestPort: string, // This is the sea destination port for the current sea leg candidate
  seaLineCompanyIt: string | undefined,
  currentSeaComment: string | null,
  originPortForSeaRoute: string // This is the originPort of the current sea route candidate (e.g., Qingdao)
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity: formRussianDestinationCity } = values; // formRussianDestinationCity is the (potentially mapped) city
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0;

  let derivedRussianDestinationCityForCandidate: string = "N/A";
  
  if (shipmentType === "COC") {
    const isFurtherRailJourney = formRussianDestinationCity &&
                                 VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) &&
                                 !VLADIVOSTOK_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

    if (isFurtherRailJourney && formRussianDestinationCity && containerType) {
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
      railLegDetails = findRailLegDetails(
        // Pass formRussianDestinationCity (the mapped city) as russianDestinationCity for the lookup
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

    let cityForDropOffLookup = seaDestPort; // Default to sea port
    if (isFurtherRailJourney && formRussianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
        cityForDropOffLookup = formRussianDestinationCity; // If rail to final city, drop-off is there
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
        values, 
        context,
        formRussianDestinationCity,   // cityForDropOffLookup (final drop-off city, mapped)
        seaDestPort,                  // socDepartureCityForDropOff (e.g., Vladivostok, the sea destination port)
        currentSeaComment || ""
      );
      
      if (socDropOffDetails.costNumeric !== null) { // costNumeric is USD
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity; // The mapped city is the final destination
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

  let seaPortsToConsiderForBestPrice: string[];
  const isFurtherRailForBestPrice = russianDestinationCity &&
                                  !VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) && 
                                  (VLADIVOSTOK_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))) || 
                                   VOSTOCHNIY_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))));   

  if (isFurtherRailForBestPrice) {
    seaPortsToConsiderForBestPrice = excelDestinationPorts.filter(dp =>
      VLADIVOSTOK_VARIANTS.some(v => dp.startsWith(v.split(" ")[0])) ||
      VOSTOCHNIY_VARIANTS.some(v => dp.startsWith(v.split(" ")[0]))
    );
  } else {
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

        totalComparisonCostRUB += details.costToAddForDropOffRUB; 
        
        let socInlandRailCostRUB: number | null = null;
        if (shipmentType === "SOC" && details.socDropOffDetails?.costNumeric !== null) {
          socInlandRailCostRUB = details.socDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
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
          railCost20DC_28t_RUB: shipmentType === "COC" ? (details.railLegDetails?.baseCost28t ?? null) : null, 
          railGuardCost20DC_RUB: shipmentType === "COC" ? (details.railLegDetails?.guardCost20DC ?? null) : null, 
          railCost40HC_RUB: shipmentType === "COC" ? (details.railLegDetails?.baseCost40HC ?? null) : (containerType === "40HC" ? socInlandRailCostRUB : null),
          railGuardCost40HC_RUB: shipmentType === "COC" ? (details.railLegDetails?.guardCost40HC ?? null) : null, 

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

      if (!parsedRoute.originPort || parsedRoute.originPort.length === 0 || !parsedRoute.containerType || parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }
      
      const stationNameFromDashboard = parsedRoute.finalRussianDestination; 
      const mappedCityFromStation = stationNameFromDashboard ? getCityFromStationName(stationNameFromDashboard) : null;
      
      if (formRussianDestinationCity) {
        if (mappedCityFromStation) { 
          if (mappedCityFromStation.toLowerCase() !== formRussianDestinationCity.toLowerCase()) {
            return; 
          }
        } else if (parsedRoute.seaDestinationPort) { 
          if (!VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0])) || 
              parsedRoute.seaDestinationPort.toLowerCase() !== formRussianDestinationCity.toLowerCase()) {
            return; 
          }
        } else {
            return; 
        }
      }

      parsedRoute.originPort.forEach(singleOriginPort => {
        let effectiveSeaDestPortForLookups = parsedRoute.seaDestinationPort || "N/A";
        let effectiveRussianDestCityForCandidateRoute = mappedCityFromStation || 
                                                 (parsedRoute.seaDestinationPort && VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0])) ? parsedRoute.seaDestinationPort : "N/A");

        if (mappedCityFromStation && parsedRoute.seaDestinationPort && !VLADIVOSTOK_VARIANTS.some(v => parsedRoute.seaDestinationPort!.startsWith(v.split(" ")[0]))) {
          // If there's a mapped city from a "FOR" clause, but the sea port is NOT a hub like Vladivostok, this is likely an invalid combo for further rail.
          // For now, we prioritize the mapped city if "FOR" clause exists.
          // _getRailAndDropOffDetailsForCandidate will determine if rail is feasible from effectiveSeaDestPortForLookups.
        }
        
        let totalDashboardComparisonCostRUB = parsedRate.amount! * USD_RUB_CONVERSION_RATE;

        // Construct temporary form values for the helper, using the mapped city for russianDestinationCity
        const tempFormValuesForHelper: RouteFormValues = {
            ...values, 
            shipmentType: "COC", 
            originPort: singleOriginPort,
            destinationPort: effectiveSeaDestPortForLookups, 
            seaLineCompany: section.serviceName, 
            containerType: parsedRoute.containerType!, 
            // Use mapped city for internal lookups if available, otherwise the user's input (which might be empty or a hub city)
            russianDestinationCity: mappedCityFromStation || values.russianDestinationCity, 
        };
        
        const additionalDetails = _getRailAndDropOffDetailsForCandidate(
            tempFormValuesForHelper,
            context,
            effectiveSeaDestPortForLookups, 
            section.serviceName,
            row.additionalComment !== '-' ? row.additionalComment : null,
            singleOriginPort
        );

        if (mappedCityFromStation && additionalDetails.railLegDetails?.railLegFailed) {
            return;
        }
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
          russianDestinationCity: effectiveRussianDestCityForCandidateRoute, 
          
          seaCostUSD: parsedRate.amount,
          seaComment: row.additionalComment !== '-' ? row.additionalComment : null,
          
          totalComparisonCostRUB: totalDashboardComparisonCostRUB,
          isDashboardRecommendation: true,
          dashboardSourceService: section.serviceName,
          
          railDepartureStation: additionalDetails.railLegDetails?.departureStation ?? undefined,
          railArrivalStation: additionalDetails.railLegDetails?.arrivalStation ?? (stationNameFromDashboard && mappedCityFromStation ? stationNameFromDashboard : undefined), 
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
    

    

