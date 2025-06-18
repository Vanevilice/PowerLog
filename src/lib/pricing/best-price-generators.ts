
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
  RailLegInfo,
  RailwayLegData,
} from '@/types';
import { USD_RUB_CONVERSION_RATE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, NONE_SEALINE_VALUE } from './constants';
import {
  findRailLegDetails,
  findDropOffDetails,
  findSOCDropOffDetails,
  parseFirstNumberFromString,
  parseDashboardRouteString,
  parseDashboardMonetaryValue,
  type DropOffInfo,
  type SOCDropOffInfo
} from './finders';
import { getCityFromStationName } from './city-station-mapper';
import { parseContainerInfoCell } from '@/lib/dashboard/utils';
import { normalizeCityName, appendCommentary } from './utils'; // Import normalizeCityName and appendCommentary

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
  seaDestPort: string, // This is the specific port from the Excel row, e.g., "Восточный (ВСК)"
  seaLineCompanyIt: string | undefined,
  currentSeaComment: string | null,
  originPortForSeaRoute: string,
  preParsedRailwayLegs?: RailwayLegData[]
): RailAndDropOffCandidateDetails {
  const { shipmentType, containerType, russianDestinationCity: formRussianDestinationCity } = values;
  let railLegDetails: RailLegInfo | null = null;
  let cocDropOffDetails: DropOffInfo | null = null;
  let socDropOffDetails: SOCDropOffInfo | null = null;
  let costToAddForRailRUB = 0;
  let costToAddForDropOffRUB = 0;
  let derivedRussianDestinationCityForCandidate: string = "N/A";

  const isFurtherRailJourney = formRussianDestinationCity &&
    seaDestPort &&
    (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v)) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v))) &&
    !VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(formRussianDestinationCity) === normalizeCityName(v) && normalizeCityName(seaDestPort) === normalizeCityName(v)) &&
    !VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(formRussianDestinationCity) === normalizeCityName(v) && normalizeCityName(seaDestPort) === normalizeCityName(v));


  let railFoundInPreParsed = false;
  if (isFurtherRailJourney && formRussianDestinationCity && containerType && preParsedRailwayLegs && preParsedRailwayLegs.length > 0) {
    for (const leg of preParsedRailwayLegs) {
      let stationNameFromLeg: string | null = null;
      const forMatch = (leg.originInfo || "").match(/FOR\s+(.+)/i);
      if (forMatch && forMatch[1]) {
        stationNameFromLeg = forMatch[1].trim();
      }

      if (stationNameFromLeg) {
        const mappedCityFromLegViaExactStation = getCityFromStationName(stationNameFromLeg);
        const { containerType: legContainerType } = parseContainerInfoCell(leg.containerInfo);
        const normalizedFormRussianDestCity = normalizeCityName(formRussianDestinationCity);
        
        let isMatchForDestination = false;

        // Attempt 1: Direct mapping of the whole "FOR..." string
        if (mappedCityFromLegViaExactStation && normalizeCityName(mappedCityFromLegViaExactStation) === normalizedFormRussianDestCity) {
            isMatchForDestination = true;
        } 
        // Attempt 2: Check for "Мос. узел" variants if user destination is Moscow OR check individual stations if "FOR..." string contains '/'
        else if (normalizedFormRussianDestCity === "москва") {
            const normalizedStationNameFromLegForMoscowCheck = normalizeCityName(stationNameFromLeg);
            if (normalizedStationNameFromLegForMoscowCheck.includes("мос. узла") ||
                normalizedStationNameFromLegForMoscowCheck.includes("московский узел") ||
                normalizedStationNameFromLegForMoscowCheck.includes("станции мос. узла")) {
                isMatchForDestination = true;
            }
            // Attempt 3: Split multi-station "FOR..." strings (e.g., "Селятино/Люберцы/Электроугли") and check each part if user dest is Moscow
            else if (stationNameFromLeg.includes('/')) { 
                const individualStations = stationNameFromLeg.split('/');
                for (const individualStation of individualStations) {
                    const mappedCityFromIndividualStation = getCityFromStationName(individualStation.trim());
                    if (mappedCityFromIndividualStation && normalizeCityName(mappedCityFromIndividualStation) === "москва") {
                        isMatchForDestination = true;
                        break; // Found a match for Moscow
                    }
                }
            }
        }

        if (isMatchForDestination && legContainerType === containerType) {
            const parsedLegCost = parseDashboardMonetaryValue(leg.cost);
            if (parsedLegCost.amount !== null && parsedLegCost.currency === 'RUB') {
                costToAddForRailRUB = parsedLegCost.amount; 
                railLegDetails = { 
                    railLegFailed: false, commentaryReason: "",
                    arrivalStation: stationNameFromLeg, 
                    departureStation: seaDestPort, 
                    baseCost24t: containerType === "20DC" ? parsedLegCost.amount : null,
                    baseCost28t: null, 
                    guardCost20DC: 0, 
                    baseCost40HC: containerType === "40HC" ? parsedLegCost.amount : null,
                    guardCost40HC: 0, 
                };
                railFoundInPreParsed = true;
                break;
            } else { 
                railLegDetails = {
                    railLegFailed: true, 
                    commentaryReason: appendCommentary(currentSeaComment || "", `Dashboard rail leg for "${stationNameFromLeg}" has invalid cost or currency. Cost: ${leg.cost}`),
                    arrivalStation: stationNameFromLeg,
                    departureStation: seaDestPort,
                    baseCost24t: null, baseCost28t: null, guardCost20DC: null,
                    baseCost40HC: null, guardCost40HC: null,
                };
                costToAddForRailRUB = 0; 
                railFoundInPreParsed = true;
                break; 
            }
        }
      }
    }
  }


  if (isFurtherRailJourney && formRussianDestinationCity && containerType && !railFoundInPreParsed) {
    // This block is for generic rail lookup if no pre-parsed leg was found/matched
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
      costToAddForRailRUB = 0; // Ensure no cost added if generic lookup fails
    }
  }


  if (formRussianDestinationCity) {
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
  } else if (seaDestPort && (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v)) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v)))) {
      derivedRussianDestinationCityForCandidate = seaDestPort;
  }



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
        seaDestPort, 
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

// Helper function to check if portA is a match or variant of portB
function isMatchingSeaPortHub(portFromExcelCell: string, targetPortToMatch: string): boolean {
    const normExcelPort = normalizeCityName(portFromExcelCell);
    const normTargetPort = normalizeCityName(targetPortToMatch);

    if (normExcelPort === normTargetPort) {
        return true;
    }

    const isExcelPortVladivostok = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normExcelPort);
    const isTargetPortVladivostok = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normTargetPort);
    if (isExcelPortVladivostok && isTargetPortVladivostok) {
        return true;
    }

    const isExcelPortVostochniy = VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normExcelPort);
    const isTargetPortVostochniy = VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normTargetPort);
    if (isExcelPortVostochniy && isTargetPortVostochniy) {
        return true;
    }
    
    if (normExcelPort.startsWith(normTargetPort) && (isTargetPortVostochniy || isTargetPortVladivostok)) {
        return true;
    }
    if (normTargetPort.startsWith(normExcelPort) && (isExcelPortVostochniy || isExcelPortVladivostok)) {
        return true;
    }

    return false;
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
  const normalizedFormRussianDestinationCity = russianDestinationCity ? normalizeCityName(russianDestinationCity) : null;

  const isFormRequestingFurtherRail = normalizedFormRussianDestinationCity &&
                                  !VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normalizedFormRussianDestinationCity) &&
                                  !VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normalizedFormRussianDestinationCity) &&
                                  (VLADIVOSTOK_VARIANTS.some(v => excelDestinationPorts.some(edp => normalizeCityName(edp) === normalizeCityName(v))) ||
                                   VOSTOCHNIY_VARIANTS.some(v => excelDestinationPorts.some(edp => normalizeCityName(edp) === normalizeCityName(v))));

  if (isFormRequestingFurtherRail) {
    seaPortsToConsiderForBestPrice = excelDestinationPorts.filter(dp =>
      VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(dp) === normalizeCityName(v)) ||
      VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(dp) === normalizeCityName(v))
    );
  } else if (normalizedFormRussianDestinationCity && (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normalizedFormRussianDestinationCity) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normalizedFormRussianDestinationCity))) {
    seaPortsToConsiderForBestPrice = [russianDestinationCity!];
  } else if (destinationPort) { 
    seaPortsToConsiderForBestPrice = [destinationPort];
  } else { 
    seaPortsToConsiderForBestPrice = excelDestinationPorts;
  }


  seaPortsToConsiderForBestPrice.forEach(seaDestPortCandidateToMatch => {
    seaDataset.forEach(seaRoute => {
      const routeOrigins = seaRoute[originFieldKey as keyof typeof seaRoute] as string[] | undefined;
      if (!Array.isArray(routeOrigins) || !routeOrigins.includes(originPort)) return;
      if (!Array.isArray(seaRoute.destinationPorts)) return;

      let actualSeaPortForThisRouteAndCandidate: string | null = null;
      for (const portInExcelCell of seaRoute.destinationPorts) {
        if (isMatchingSeaPortHub(portInExcelCell, seaDestPortCandidateToMatch)) {
          actualSeaPortForThisRouteAndCandidate = portInExcelCell;
          break;
        }
      }

      if (!actualSeaPortForThisRouteAndCandidate) {
        return;
      }

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
          actualSeaPortForThisRouteAndCandidate!, 
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

        const isRailLegApplicableForCandidate = details.derivedRussianDestinationCityForCandidate &&
            details.derivedRussianDestinationCityForCandidate !== "N/A" &&
            (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(actualSeaPortForThisRouteAndCandidate!) === normalizeCityName(v)) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(actualSeaPortForThisRouteAndCandidate!) === normalizeCityName(v))) &&
            !VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(details.derivedRussianDestinationCityForCandidate) === normalizeCityName(v) && normalizeCityName(actualSeaPortForThisRouteAndCandidate!) === normalizeCityName(v)) &&
            !VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(details.derivedRussianDestinationCityForCandidate) === normalizeCityName(v) && normalizeCityName(actualSeaPortForThisRouteAndCandidate!) === normalizeCityName(v));

        if (isRailLegApplicableForCandidate) {
            if (details.railLegDetails?.railLegFailed) {
                return; 
            }
            if (containerType === "20DC") {
                if ((details.railLegDetails?.baseCost24t ?? null) === null && (details.railLegDetails?.baseCost28t ?? null) === null) {
                    return; 
                }
            } else if (containerType === "40HC") {
                if ((details.railLegDetails?.baseCost40HC ?? null) === null) {
                    return; 
                }
            }
            totalComparisonCostRUB += details.costToAddForRailRUB;
        }
        
        totalComparisonCostRUB += details.costToAddForDropOffRUB;


        candidates.push({
          id: `sroute-${routeIdCounter++}`,
          mode: 'sea_plus_rail',
          shipmentType: shipmentType!,
          originPort: originPort!,
          seaDestinationPort: actualSeaPortForThisRouteAndCandidate!, 
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

  const normalizedDepCity = normalizeCityName(directRailCityOfDeparture);
  const normalizedDestCityDR = normalizeCityName(directRailDestinationCityDR);
  const normalizedIncoterms = directRailIncoterms.toLowerCase().trim();


  excelDirectRailData.forEach(entry => {
    if (
      normalizeCityName(entry.cityOfDeparture) === normalizedDepCity &&
      normalizeCityName(entry.destinationCity) === normalizedDestCityDR &&
      entry.incoterms.toLowerCase().trim() === normalizedIncoterms &&
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
  const { shipmentType: formShipmentType, originPort: formOriginPortFromUser, russianDestinationCity: formRussianDestinationCityFromUser, containerType: formContainerTypeFromUser } = values;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded || !dashboardServiceSections || dashboardServiceSections.length === 0 || formShipmentType !== "COC" || !formOriginPortFromUser || !formContainerTypeFromUser) {
    return candidates;
  }

  dashboardServiceSections.forEach(section => {
    section.dataRows.forEach(row => {
      const parsedRoute = parseDashboardRouteString(row.route);
      const parsedRate = parseDashboardMonetaryValue(row.rate);

      if (!parsedRoute.originPort || !parsedRoute.originPort.some(op => normalizeCityName(op) === normalizeCityName(formOriginPortFromUser))) {
        return;
      }
      if (parsedRoute.containerType && parsedRoute.containerType !== formContainerTypeFromUser) {
        return;
      }
      if (parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }

      const actualSeaDestinationPort = parsedRoute.seaDestinationPort || "N/A";
      let mappedCityFromDashboardStation: string | null = null;
      if (parsedRoute.finalRussianDestination) {
          mappedCityFromDashboardStation = getCityFromStationName(parsedRoute.finalRussianDestination);
          // If direct mapping fails for multi-station strings like "Селятино/Люберцы/Электроугли"
          // and user asks for Moscow, try splitting and checking
          if (!mappedCityFromDashboardStation && formRussianDestinationCityFromUser && normalizeCityName(formRussianDestinationCityFromUser) === "москва" && parsedRoute.finalRussianDestination.includes('/')) {
              const individualStations = parsedRoute.finalRussianDestination.split('/');
              for (const individualStation of individualStations) {
                  const mappedCity = getCityFromStationName(individualStation.trim());
                  if (mappedCity && normalizeCityName(mappedCity) === "москва") {
                      mappedCityFromDashboardStation = "Москва"; // Set to canonical "Москва"
                      break;
                  }
              }
          }
      }

      const effectiveRussianDestCityForCandidateLogic = formRussianDestinationCityFromUser || mappedCityFromDashboardStation;

      if (formRussianDestinationCityFromUser) {
        const normFormRussianDest = normalizeCityName(formRussianDestinationCityFromUser);
        const normEffectiveDashboardDest = effectiveRussianDestCityForCandidateLogic ? normalizeCityName(effectiveRussianDestCityForCandidateLogic) : null;
        const normActualSeaDestPort = normalizeCityName(actualSeaDestinationPort);

        // If form requests a specific Russian city, the dashboard route must effectively lead there.
        // This means either the dashboard's own "FOR [station]" maps to that city,
        // OR (if no "FOR [station]") the sea port itself is that city.
        let dashboardRouteMatchesUserRussianCity = false;
        if (normEffectiveDashboardDest && normEffectiveDashboardDest === normFormRussianDest) {
            dashboardRouteMatchesUserRussianCity = true;
        } else if (!parsedRoute.finalRussianDestination && normActualSeaDestPort === normFormRussianDest) {
            // This case handles when user asks for "Vladivostok" as final, and dashboard route is to "Vladivostok" sea port without further rail.
            dashboardRouteMatchesUserRussianCity = true;
        }
        
        if (!dashboardRouteMatchesUserRussianCity) {
            return; // Skip if user's Russian city cannot be matched by this dashboard route
        }
      }
      
      const tempFormValuesForHelper: RouteFormValues = {
        ...values, 
        shipmentType: "COC", 
        originPort: formOriginPortFromUser, 
        destinationPort: actualSeaDestinationPort, 
        containerType: formContainerTypeFromUser, 
        russianDestinationCity: effectiveRussianDestCityForCandidateLogic || undefined, 
        seaLineCompany: section.serviceName, 
      };

      const additionalDetails = _getRailAndDropOffDetailsForCandidate(
          tempFormValuesForHelper,
          context,
          actualSeaDestinationPort, 
          section.serviceName,
          row.additionalComment !== '-' ? row.additionalComment : null,
          formOriginPortFromUser, 
          row.railwayLegs 
      );

      const isFurtherRailNeededForThisDashboardCandidate = additionalDetails.derivedRussianDestinationCityForCandidate &&
          additionalDetails.derivedRussianDestinationCityForCandidate !== "N/A" &&
          (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(actualSeaDestinationPort) === normalizeCityName(v)) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(actualSeaDestinationPort) === normalizeCityName(v))) &&
          !VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(additionalDetails.derivedRussianDestinationCityForCandidate) === normalizeCityName(v) && normalizeCityName(actualSeaDestinationPort) === normalizeCityName(v)) &&
          !VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(additionalDetails.derivedRussianDestinationCityForCandidate) === normalizeCityName(v) && normalizeCityName(actualSeaDestinationPort) === normalizeCityName(v));

      if (isFurtherRailNeededForThisDashboardCandidate) {
          if (additionalDetails.railLegDetails?.railLegFailed) {
              return; 
          }
          if (formContainerTypeFromUser === "20DC") {
              if ((additionalDetails.railLegDetails?.baseCost24t ?? null) === null && (additionalDetails.railLegDetails?.baseCost28t ?? null) === null) {
                  return; 
              }
          } else if (formContainerTypeFromUser === "40HC") {
              if ((additionalDetails.railLegDetails?.baseCost40HC ?? null) === null) {
                  return;
              }
          }
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
        originPort: formOriginPortFromUser,
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

    

    
