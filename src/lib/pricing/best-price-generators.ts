
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
    // Ensure seaDestPort is a hub OR we are attempting rail regardless of hub status (controlled by caller)
    // The check for whether rail *should* be attempted is now more in generateDashboardCandidates
    normalizeCityName(formRussianDestinationCity) !== normalizeCityName(seaDestPort);


  let railFoundInPreParsed = false;
  if (isFurtherRailJourney && formRussianDestinationCity && containerType && preParsedRailwayLegs && preParsedRailwayLegs.length > 0) {
    for (const leg of preParsedRailwayLegs) {
      let stationNameFromLeg: string | null = null;
      const forMatch = (leg.originInfo || "").match(/FOR\s+(.+)/i);
      if (forMatch && forMatch[1]) {
        stationNameFromLeg = forMatch[1].trim();
      }

      if (stationNameFromLeg) {
        const normalizedFormRussianDestCity = normalizeCityName(formRussianDestinationCity);
        const normalizedStationNameFromLegForMoscowCheck = normalizeCityName(stationNameFromLeg);
        
        let isMatchForDestination = false;
        const mappedCityFromLegDirect = getCityFromStationName(stationNameFromLeg);

        if (mappedCityFromLegDirect && normalizeCityName(mappedCityFromLegDirect) === normalizedFormRussianDestCity) {
            isMatchForDestination = true;
        } else if (normalizedFormRussianDestCity === "москва") { // Special handling for Moscow
            if (normalizedStationNameFromLegForMoscowCheck.includes("мос. узла") ||
                normalizedStationNameFromLegForMoscowCheck.includes("московский узел") ||
                normalizedStationNameFromLegForMoscowCheck.includes("станции мос. узла")) {
                isMatchForDestination = true;
            } else if (stationNameFromLeg.includes('/')) {
                const individualStations = stationNameFromLeg.split('/');
                for (const individualStation of individualStations) {
                    const mappedCityFromIndividualStation = getCityFromStationName(individualStation.trim());
                    if (mappedCityFromIndividualStation && normalizeCityName(mappedCityFromIndividualStation) === "москва") {
                        isMatchForDestination = true;
                        break; 
                    }
                }
            }
        }
        
        const { containerType: legContainerType } = parseContainerInfoCell(leg.containerInfo);

        if (isMatchForDestination && legContainerType === containerType) {
            const parsedLegCost = parseDashboardMonetaryValue(leg.cost);
            if (parsedLegCost.amount !== null && parsedLegCost.currency === 'RUB') {
                costToAddForRailRUB = parsedLegCost.amount;
                railLegDetails = {
                    railLegFailed: false, commentaryReason: "",
                    arrivalStation: stationNameFromLeg,
                    departureStation: seaDestPort, // Assuming seaDestPort is the departure for this pre-parsed leg
                    baseCost24t: containerType === "20DC" ? parsedLegCost.amount : null,
                    baseCost28t: null, // pre-parsed legs might not differentiate 24/28t unless explicitly stated
                    guardCost20DC: 0, // Guard cost typically not in simple pre-parsed legs, might need separate lookup
                    baseCost40HC: containerType === "40HC" ? parsedLegCost.amount : null,
                    guardCost40HC: 0, 
                };
            } else {
                 costToAddForRailRUB = 0; 
                 railLegDetails = {
                    railLegFailed: true,
                    commentaryReason: appendCommentary(currentSeaComment || "", `Dashboard rail leg for "${stationNameFromLeg}" has invalid cost or currency. Cost: ${leg.cost}`),
                    arrivalStation: stationNameFromLeg, departureStation: seaDestPort,
                    baseCost24t: null, baseCost28t: null, guardCost20DC: null,
                    baseCost40HC: null, guardCost40HC: null,
                };
            }
            railFoundInPreParsed = true;
            break;
        }
      }
    }
  }


  if (isFurtherRailJourney && formRussianDestinationCity && containerType && !railFoundInPreParsed) {
    const genericRailDetails = findRailLegDetails(
      { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity, containerType } as RouteFormValues,
      context,
      seaDestPort, // Pass the actual sea port of the candidate for rail departure lookup
      currentSeaComment || "" // Pass current commentary for appending
    );
    if (!genericRailDetails.railLegFailed) {
      railLegDetails = genericRailDetails;
      costToAddForRailRUB = (containerType === "20DC"
        ? (genericRailDetails.baseCost24t ?? genericRailDetails.baseCost28t ?? 0) + (genericRailDetails.guardCost20DC ?? 0)
        : (genericRailDetails.baseCost40HC ?? 0) + (genericRailDetails.guardCost40HC ?? 0));
    } else {
      railLegDetails = { railLegFailed: true, commentaryReason: genericRailDetails.commentaryReason } as RailLegInfo;
      costToAddForRailRUB = 0; 
    }
  }


  if (formRussianDestinationCity) {
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
  } else if (seaDestPort && (VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v)) || VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(seaDestPort) === normalizeCityName(v)))) {
      derivedRussianDestinationCityForCandidate = seaDestPort;
  }



  if (shipmentType === "COC") {
    let cityForDropOffLookup = seaDestPort; // Default to sea port
    if (isFurtherRailJourney && formRussianDestinationCity && railLegDetails && !railLegDetails.railLegFailed) {
      cityForDropOffLookup = formRussianDestinationCity; // If successful rail, drop-off at final city
    } else if (!isFurtherRailJourney && formRussianDestinationCity) {
      // If no "further" rail (e.g. sea to Vlad, final to Vlad), but a Russian city is specified, use it
      cityForDropOffLookup = formRussianDestinationCity;
    }


    if (seaLineCompanyIt && containerType && cityForDropOffLookup) {
      cocDropOffDetails = findDropOffDetails(
        { ...values, seaLineCompany: seaLineCompanyIt, containerType, destinationPort: seaDestPort, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity } as RouteFormValues,
        context,
        cityForDropOffLookup,
        currentSeaComment,
        railLegDetails?.commentaryReason || currentSeaComment || "" // Pass along commentary
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
        seaDestPort, // SOC drop-off typically from sea port
        railLegDetails?.commentaryReason || currentSeaComment || ""
      );

      if (socDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
    } else {
      socDropOffDetails = {
        socDropOffLegFailed: true,
        commentaryReason: "SOC Drop-off data not loaded or key info missing for lookup.",
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
            if (details.railLegDetails?.railLegFailed) { // If rail is applicable BUT failed, skip this candidate
                return;
            }
            // If rail is applicable and did not fail, check if specific container type has price
            if (containerType === "20DC") {
                if ((details.railLegDetails?.baseCost24t ?? null) === null && (details.railLegDetails?.baseCost28t ?? null) === null) {
                    return; // Skip if no 20DC rail price
                }
            } else if (containerType === "40HC") {
                if ((details.railLegDetails?.baseCost40HC ?? null) === null) {
                    return; // Skip if no 40HC rail price
                }
            }
            // If rail is applicable, did not fail, and has a price for the container type, add its cost.
            totalComparisonCostRUB += details.costToAddForRailRUB;
        }
        
        // Add drop-off cost if not failed
        if (shipmentType === "COC" && details.cocDropOffDetails && !details.cocDropOffDetails.dropOffLegFailed) {
            totalComparisonCostRUB += details.costToAddForDropOffRUB;
        } else if (shipmentType === "SOC" && details.socDropOffDetails && !details.socDropOffDetails.socDropOffLegFailed) {
            totalComparisonCostRUB += details.costToAddForDropOffRUB;
        }


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
      entry.price !== null // Ensure price exists
    ) {
      let comparisonCostInRub: number;
      let originalPriceValue: number = entry.price; 
      let commentary = entry.commentary;

      if (entry.price < 100000) { 
        comparisonCostInRub = entry.price * USD_RUB_CONVERSION_RATE;
      } else { 
        comparisonCostInRub = entry.price;
      }
      
      candidates.push({
        id: `droute-${routeIdCounter++}`,
        mode: 'direct_rail',
        shipmentType: 'N/A',
        originPort: entry.cityOfDeparture,
        seaDestinationPort: entry.destinationCity,
        containerType: '40HC', 
        russianDestinationCity: entry.destinationCity,
        totalComparisonCostRUB: comparisonCostInRub, 

        directRailAgentName: entry.agentName,
        directRailIncoterms: entry.incoterms,
        directRailBorder: entry.border,
        directRailPriceRUB: originalPriceValue, 
        directRailETD: entry.etd,
        directRailExcelCommentary: commentary, 
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
      
      // If dashboard route string specifies a container type, it must match the form's container type
      if (parsedRoute.containerType && parsedRoute.containerType !== formContainerTypeFromUser) {
        return;
      }
      // If dashboard route string does NOT specify a container type, this candidate is potentially valid for the form's container type.
      // The specific pricing for rail/drop-off will depend on formContainerTypeFromUser.

      if (parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }

      const actualSeaDestinationPort = parsedRoute.seaDestinationPort || "N/A";
      let mappedCityFromDashboardStation: string | null = null;
      if (parsedRoute.finalRussianDestination) {
          mappedCityFromDashboardStation = getCityFromStationName(parsedRoute.finalRussianDestination);
          if (!mappedCityFromDashboardStation && formRussianDestinationCityFromUser && normalizeCityName(formRussianDestinationCityFromUser) === "москва" && parsedRoute.finalRussianDestination.includes('/')) {
              const individualStations = parsedRoute.finalRussianDestination.split('/');
              for (const individualStation of individualStations) {
                  const mappedCity = getCityFromStationName(individualStation.trim());
                  if (mappedCity && normalizeCityName(mappedCity) === "москва") {
                      mappedCityFromDashboardStation = "Москва";
                      break;
                  }
              }
          }
      }

      const effectiveRussianDestCityForCandidateLogic = formRussianDestinationCityFromUser || mappedCityFromDashboardStation;

      
      if (formRussianDestinationCityFromUser) {
        const normFormRussianDest = normalizeCityName(formRussianDestinationCityFromUser);
        const normEffectiveDashboardDest = effectiveRussianDestCityForCandidateLogic ? normalizeCityName(effectiveRussianDestCityForCandidateLogic) : null;
        
        let dashboardRouteMatchesUserRussianCity = false;
        
        if (normEffectiveDashboardDest && normEffectiveDashboardDest === normFormRussianDest) {
            dashboardRouteMatchesUserRussianCity = true;
        } 
        else if (!effectiveRussianDestCityForCandidateLogic && normalizeCityName(actualSeaDestinationPort) === normFormRussianDest) {
            dashboardRouteMatchesUserRussianCity = true;
        }
        
        if (!dashboardRouteMatchesUserRussianCity) {
            return; 
        }
      }
      
      const tempFormValuesForHelper: RouteFormValues = {
        ...values, 
        shipmentType: "COC",
        originPort: formOriginPortFromUser,
        destinationPort: actualSeaDestinationPort, 
        containerType: formContainerTypeFromUser, // Use the filtered/overridden container type
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
      
      const isFurtherRailNeededForThisDashboardCandidate =
        effectiveRussianDestCityForCandidateLogic &&
        effectiveRussianDestCityForCandidateLogic !== "N/A" &&
        actualSeaDestinationPort &&
        actualSeaDestinationPort !== "N/A" &&
        normalizeCityName(effectiveRussianDestCityForCandidateLogic) !== normalizeCityName(actualSeaDestinationPort);

      // Stricter check: if rail is needed, it must be successfully priced for the current container type
      if (isFurtherRailNeededForThisDashboardCandidate) {
        const railFailed = additionalDetails.railLegDetails?.railLegFailed;
        let railPriceMissingForContainerType = false;
        if (formContainerTypeFromUser === "20DC") {
          if ((additionalDetails.railLegDetails?.baseCost24t ?? null) === null && (additionalDetails.railLegDetails?.baseCost28t ?? null) === null) {
            railPriceMissingForContainerType = true;
          }
        } else if (formContainerTypeFromUser === "40HC") {
          if ((additionalDetails.railLegDetails?.baseCost40HC ?? null) === null) {
            railPriceMissingForContainerType = true;
          }
        }

        if (railFailed || railPriceMissingForContainerType) {
          return; // Skip this dashboard candidate if essential rail leg cannot be priced for the filtered container type
        }
      }
      
      // Also, if COC drop-off is applicable and fails (and not Panda line), skip
      if (formShipmentType === "COC" && !section.serviceName?.toLowerCase().includes('panda express line') && additionalDetails.cocDropOffDetails?.dropOffLegFailed){
          return;
      }


      let totalDashboardComparisonCostRUB = parsedRate.amount * USD_RUB_CONVERSION_RATE;
      
      if (additionalDetails.railLegDetails && !additionalDetails.railLegDetails.railLegFailed && additionalDetails.costToAddForRailRUB > 0) {
        totalDashboardComparisonCostRUB += additionalDetails.costToAddForRailRUB;
      }
      if (additionalDetails.cocDropOffDetails && !additionalDetails.cocDropOffDetails.dropOffLegFailed && additionalDetails.costToAddForDropOffRUB > 0) {
          totalDashboardComparisonCostRUB += additionalDetails.costToAddForDropOffRUB;
      } else if (additionalDetails.socDropOffDetails && !additionalDetails.socDropOffDetails.socDropOffLegFailed && additionalDetails.costToAddForDropOffRUB > 0) {
          // This branch might not be hit due to formShipmentType === "COC" check earlier for dashboard
          totalDashboardComparisonCostRUB += additionalDetails.costToAddForDropOffRUB;
      }

      candidates.push({
        id: `dash-${section.serviceName.replace(/\s+/g, '-')}-${formOriginPortFromUser}-${routeIdCounter++}`,
        mode: 'sea_plus_rail',
        shipmentType: "COC",
        originPort: formOriginPortFromUser,
        seaDestinationPort: actualSeaDestinationPort,
        seaLineCompany: section.serviceName,
        containerType: formContainerTypeFromUser, // Reflect the filtered container type
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
        
        socDropOffCostUSD: null, 
        socDropOffComment: null,
        socComment: null,
      });
    });
  });

  return candidates;
}

