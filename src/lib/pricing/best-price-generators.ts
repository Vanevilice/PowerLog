
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
  RailLegInfo, // Ensure RailLegInfo is imported
  RailwayLegData, // Import for preParsedRailwayLegs
} from '@/types';
import { USD_RUB_CONVERSION_RATE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, NONE_SEALINE_VALUE } from './constants';
import {
  findRailLegDetails,
  findDropOffDetails,
  findSOCDropOffDetails,
  parseFirstNumberFromString,
  parseDashboardRouteString,
  parseDashboardMonetaryValue,
  type DropOffInfo, // Ensure this is imported
  type SOCDropOffInfo // Ensure this is imported
} from './finders';
import { getCityFromStationName } from './city-station-mapper';
import { parseContainerInfoCell } from '@/lib/dashboard/utils'; // For parsing container from dashboard rail leg

// Interface for the return type of _getRailAndDropOffDetailsForCandidate
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
  originPortForSeaRoute: string,
  preParsedRailwayLegs?: RailwayLegData[] // Optional parameter for pre-parsed railway legs
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity: formRussianDestinationCity } = values; // formRussianDestinationCity can be the mapped city
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0;
  let derivedRussianDestinationCityForCandidate: string = "N/A";

  const isFurtherRailJourney = formRussianDestinationCity &&
    seaDestPort &&
    (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) &&
    !VLADIVOSTOK_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0])) &&
    !VOSTOCHNIY_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));

  // Prioritize pre-parsed railway legs if available and relevant
  let railFoundInPreParsed = false;
  if (isFurtherRailJourney && formRussianDestinationCity && containerType && preParsedRailwayLegs && preParsedRailwayLegs.length > 0) {
    for (const leg of preParsedRailwayLegs) {
      let stationNameFromLeg: string | null = null;
      const forMatch = leg.originInfo.match(/FOR\s+([^\s,(-]+(?:\s+[^\s,(-]+)*)/i);
      if (forMatch && forMatch[1]) {
        stationNameFromLeg = forMatch[1].trim();
      }

      if (stationNameFromLeg) {
        const mappedCityFromLeg = getCityFromStationName(stationNameFromLeg);
        const { containerType: legContainerType } = parseContainerInfoCell(leg.containerInfo);

        if (mappedCityFromLeg && mappedCityFromLeg.toLowerCase() === formRussianDestinationCity.toLowerCase() && legContainerType === containerType) {
          const parsedLegCost = parseDashboardMonetaryValue(leg.cost);
          if (parsedLegCost.amount !== null && parsedLegCost.currency === 'RUB') {
            costToAddForRailRUB = parsedLegCost.amount;
            railLegDetails = {
              railLegFailed: false, commentaryReason: "",
              arrivalStation: stationNameFromLeg,
              departureStation: seaDestPort,
              baseCost24t: containerType === "20DC" ? parsedLegCost.amount : null,
              baseCost28t: null, // Dashboard format might not specify this breakdown, assume N/A for now
              guardCost20DC: 0,  // Assume bundled or N/A from dashboard simple format
              baseCost40HC: containerType === "40HC" ? parsedLegCost.amount : null,
              guardCost40HC: 0,   // Assume bundled or N/A
            };
            railFoundInPreParsed = true;
            break;
          }
        }
      }
    }
  }

  // If rail not found in pre-parsed or not applicable, try finding from excelRailData (Sheet 5)
  if (isFurtherRailJourney && formRussianDestinationCity && containerType && !railFoundInPreParsed) {
    const genericRailDetails = findRailLegDetails(
      { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity, containerType } as RouteFormValues,
      context,
      seaDestPort,
      ""
    );
    if (!genericRailDetails.railLegFailed) {
      railLegDetails = genericRailDetails;
      costToAddForRailRUB = (containerType === "20DC"
        ? (genericRailDetails.baseCost24t ?? genericRailDetails.baseCost28t ?? 0) + (genericRailDetails.guardCost20DC ?? 0)
        : (genericRailDetails.baseCost40HC ?? 0) + (genericRailDetails.guardCost40HC ?? 0));
    } else {
      railLegDetails = { railLegFailed: true, commentaryReason: genericRailDetails.commentaryReason } as RailLegInfo;
    }
  }

  // Determine derivedRussianDestinationCityForCandidate
  if (formRussianDestinationCity) {
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
  } else if (seaDestPort && (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])))) {
      derivedRussianDestinationCityForCandidate = seaDestPort;
  }


  // Drop-off calculation logic (COC and SOC)
  if (shipmentType === "COC") {
    let cityForDropOffLookup = seaDestPort;
    if (isFurtherRailJourney && formRussianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
      cityForDropOffLookup = formRussianDestinationCity;
    } else if (!isFurtherRailJourney && formRussianDestinationCity) {
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
      if (cocDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = cocDropOffDetails.costNumeric * USD_RUB_CONVERSION_RATE;
      }
    }
  } else if (shipmentType === "SOC") {
    if (context.isSOCDropOffExcelDataLoaded && formRussianDestinationCity && seaDestPort && containerType) {
      socDropOffDetails = findSOCDropOffDetails(
        values,
        context,
        formRussianDestinationCity,
        seaDestPort, // Corrected: seaDestPort is the SOC departure city for drop-off
        currentSeaComment || ""
      );

      if (socDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
    } else {
      socDropOffDetails = {
        socDropOffLegFailed: true,
        commentaryReason: "SOC Drop-off data not loaded or key info missing.",
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
  const isFormRequestingFurtherRail = russianDestinationCity &&
                                  !VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) &&
                                  !VOSTOCHNIY_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) &&
                                  (VLADIVOSTOK_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))) ||
                                   VOSTOCHNIY_VARIANTS.some(v => excelDestinationPorts.some(edp => edp.startsWith(v.split(" ")[0]))));

  if (isFormRequestingFurtherRail) {
    seaPortsToConsiderForBestPrice = excelDestinationPorts.filter(dp =>
      VLADIVOSTOK_VARIANTS.some(v => dp.startsWith(v.split(" ")[0])) ||
      VOSTOCHNIY_VARIANTS.some(v => dp.startsWith(v.split(" ")[0]))
    );
  } else if (russianDestinationCity && (VLADIVOSTOK_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => russianDestinationCity.startsWith(v.split(" ")[0])))) {
    seaPortsToConsiderForBestPrice = [russianDestinationCity];
  } else if (destinationPort) {
    seaPortsToConsiderForBestPrice = [destinationPort];
  } else {
    seaPortsToConsiderForBestPrice = excelDestinationPorts;
  }


  seaPortsToConsiderForBestPrice.forEach(seaDestPortCandidate => {
    if (shipmentType === "SOC" && russianDestinationCity &&
        !(VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])))
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

        if (shipmentType === "SOC" && details.socDropOffDetails?.socDropOffLegFailed) {
            return;
        }
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }

        const isRailLegApplicableForCandidate = details.derivedRussianDestinationCityForCandidate !== "N/A" &&
            (VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]))) &&
            !VLADIVOSTOK_VARIANTS.some(v => v === details.derivedRussianDestinationCityForCandidate && seaDestPortCandidate.startsWith(v.split(" ")[0])) &&
            !VOSTOCHNIY_VARIANTS.some(v => v === details.derivedRussianDestinationCityForCandidate && seaDestPortCandidate.startsWith(v.split(" ")[0]));


        if (shipmentType === "COC" && isRailLegApplicableForCandidate && details.railLegDetails?.railLegFailed) {
            return;
        }

        totalComparisonCostRUB += details.costToAddForDropOffRUB;
        if (shipmentType === "COC" && isRailLegApplicableForCandidate) {
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

          railCost20DC_24t_RUB: (details.railLegDetails?.baseCost24t ?? null),
          railCost20DC_28t_RUB: (details.railLegDetails?.baseCost28t ?? null),
          railGuardCost20DC_RUB: (details.railLegDetails?.guardCost20DC ?? null),
          railCost40HC_RUB: (details.railLegDetails?.baseCost40HC ?? null),
          railGuardCost40HC_RUB: (details.railLegDetails?.guardCost40HC ?? null),

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
        containerType: '40HC', // Default or parse if available
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
  const { shipmentType: formShipmentType, originPort: formOriginPortFromUser, russianDestinationCity: formRussianDestinationCityFromUser, containerType: formContainerTypeFromUser } = values;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded || !dashboardServiceSections || dashboardServiceSections.length === 0 || formShipmentType !== "COC" || !formOriginPortFromUser || !formContainerTypeFromUser) {
    return candidates;
  }

  dashboardServiceSections.forEach(section => {
    section.dataRows.forEach(row => {
      const parsedRoute = parseDashboardRouteString(row.route); // Contains string[] for originPort
      const parsedRate = parseDashboardMonetaryValue(row.rate);

      if (!parsedRoute.originPort || !parsedRoute.originPort.some(op => op.toUpperCase().includes(formOriginPortFromUser.toUpperCase()))) {
        return;
      }
      if (parsedRoute.containerType !== formContainerTypeFromUser) {
        return;
      }
      if (parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }

      const actualSeaDestinationPort = parsedRoute.seaDestinationPort || "N/A";
      let mappedCityFromDashboardStation: string | null = null;
      if (parsedRoute.finalRussianDestination) { // This is the station name from "FOR" clause
          mappedCityFromDashboardStation = getCityFromStationName(parsedRoute.finalRussianDestination);
      }

      // Effective Russian Destination City for this dashboard candidate:
      // 1. User's input if provided.
      // 2. Mapped city from dashboard's "FOR [station]" if user didn't specify.
      // 3. Null if neither above.
      const effectiveRussianDestCityForCandidateLogic = formRussianDestinationCityFromUser || mappedCityFromDashboardStation;

      // Filtering logic based on destination match
      if (formRussianDestinationCityFromUser) { // User specified a final Russian destination
        if (!effectiveRussianDestCityForCandidateLogic || effectiveRussianDestCityForCandidateLogic.toLowerCase() !== formRussianDestinationCityFromUser.toLowerCase()) {
          // If dashboard's FOR clause led to a *different* city than user explicitly wants, OR if dashboard had no FOR clause, skip.
          // Unless, the dashboard sea port itself is the target city (and no FOR clause on dashboard)
           if (!(!parsedRoute.finalRussianDestination && actualSeaDestinationPort.toLowerCase() === formRussianDestinationCityFromUser.toLowerCase())) {
                return;
           }
        }
      } else { // User did NOT specify a final Russian destination. Use what dashboard provides.
          // If dashboard has a FOR clause, effectiveRussianDestCityForCandidateLogic is already set to the mapped city.
          // If dashboard has NO FOR clause, effectiveRussianDestCityForCandidateLogic is null.
          // In this case, the final destination is implied by the sea port.
      }
      
      const tempFormValuesForHelper: RouteFormValues = {
        ...values, // Includes formShipmentType, formOriginPortFromUser, formContainerTypeFromUser
        russianDestinationCity: effectiveRussianDestCityForCandidateLogic || undefined, // Pass mapped city or undefined
        destinationPort: actualSeaDestinationPort,
        seaLineCompany: section.serviceName,
      };

      const additionalDetails = _getRailAndDropOffDetailsForCandidate(
          tempFormValuesForHelper,
          context,
          actualSeaDestinationPort,
          section.serviceName,
          row.additionalComment !== '-' ? row.additionalComment : null,
          formOriginPortFromUser, // The specific origin port from the form that matched
          row.railwayLegs
      );

      const isFurtherRailNeededForThisDashboardCandidate = additionalDetails.derivedRussianDestinationCityForCandidate &&
          additionalDetails.derivedRussianDestinationCityForCandidate !== "N/A" &&
          (VLADIVOSTOK_VARIANTS.some(v => actualSeaDestinationPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => actualSeaDestinationPort.startsWith(v.split(" ")[0]))) &&
          !VLADIVOSTOK_VARIANTS.some(v => v === additionalDetails.derivedRussianDestinationCityForCandidate && actualSeaDestinationPort.startsWith(v.split(" ")[0])) &&
          !VOSTOCHNIY_VARIANTS.some(v => v === additionalDetails.derivedRussianDestinationCityForCandidate && actualSeaDestinationPort.startsWith(v.split(" ")[0]));


      if (isFurtherRailNeededForThisDashboardCandidate && additionalDetails.railLegDetails?.railLegFailed) {
          return;
      }
      if (!section.serviceName?.toLowerCase().includes('panda express line') && additionalDetails.cocDropOffDetails?.dropOffLegFailed){
          return;
      }

      let totalDashboardComparisonCostRUB = parsedRate.amount * USD_RUB_CONVERSION_RATE;
      totalDashboardComparisonCostRUB += additionalDetails.costToAddForRailRUB;
      totalDashboardComparisonCostRUB += additionalDetails.costToAddForDropOffRUB;

      candidates.push({
        id: `dash-${section.serviceName.replace(/\s+/g, '-')}-${formOriginPortFromUser}-${routeIdCounter++}`,
        mode: 'sea_plus_rail',
        shipmentType: "COC",
        originPort: formOriginPortFromUser, // Use the user's input origin that matched
        seaDestinationPort: actualSeaDestinationPort,
        seaLineCompany: section.serviceName,
        containerType: formContainerTypeFromUser,
        russianDestinationCity: additionalDetails.derivedRussianDestinationCityForCandidate,
        
        seaCostUSD: parsedRate.amount,
        seaComment: row.additionalComment !== '-' ? row.additionalComment : null,
        
        totalComparisonCostRUB: totalDashboardComparisonCostRUB,
        isDashboardRecommendation: true,
        dashboardSourceService: section.serviceName,
        
        railDepartureStation: additionalDetails.railLegDetails?.departureStation ?? undefined,
        railArrivalStation: additionalDetails.railLegDetails?.arrivalStation ?? undefined,
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

  return candidates;
}
