
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

// Internal helper function
function _getRailAndDropOffDetailsForCandidate(
  values: RouteFormValues,
  context: PricingDataContextType,
  seaDestPort: string,
  seaLineCompanyIt: string | undefined,
  currentSeaComment: string | null,
  originPortForSeaRoute: string,
  // New optional parameter for pre-parsed railway legs
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
    seaDestPort && // ensure seaDestPort is defined
    (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0]))) &&
    !VLADIVOSTOK_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0])) &&
    !VOSTOCHNIY_VARIANTS.some(v => v === formRussianDestinationCity && seaDestPort.startsWith(v.split(" ")[0]));


  if (shipmentType === "COC") {
    let railFoundInPreParsed = false;
    if (isFurtherRailJourney && formRussianDestinationCity && containerType && preParsedRailwayLegs && preParsedRailwayLegs.length > 0) {
      for (const leg of preParsedRailwayLegs) {
        let stationNameFromLeg: string | null = null;
        const forMatch = leg.originInfo.match(/FOR\s+([^\s,(-]+)/i);
        if (forMatch && forMatch[1]) {
          stationNameFromLeg = forMatch[1];
        }
        if (stationNameFromLeg) {
          const mappedCity = getCityFromStationName(stationNameFromLeg);
          const { containerType: legContainerType } = parseContainerInfoCell(leg.containerInfo);

          if (mappedCity && mappedCity.toLowerCase() === formRussianDestinationCity.toLowerCase() && legContainerType === containerType) {
            const parsedLegCost = parseDashboardMonetaryValue(leg.cost);
            if (parsedLegCost.amount !== null && parsedLegCost.currency === 'RUB') {
              costToAddForRailRUB = parsedLegCost.amount;
              railLegDetails = {
                railLegFailed: false, commentaryReason: "",
                arrivalStation: stationNameFromLeg,
                departureStation: seaDestPort, // Assuming rail starts from the sea port
                baseCost24t: containerType === "20DC" ? parsedLegCost.amount : null,
                baseCost28t: null, // Not specified in this dashboard leg format
                guardCost20DC: 0, // Assuming guard cost is bundled or N/A for this dashboard leg
                baseCost40HC: containerType === "40HC" ? parsedLegCost.amount : null,
                guardCost40HC: 0, // Assuming guard cost is bundled or N/A
              };
              railFoundInPreParsed = true;
              break;
            }
          }
        }
      }
    }

    if (isFurtherRailJourney && formRussianDestinationCity && containerType && !railFoundInPreParsed) {
      // Fallback to findRailLegDetails if not found in preParsedRailwayLegs
      const genericRailDetails = findRailLegDetails(
        { ...values, destinationPort: seaDestPort, seaLineCompany: seaLineCompanyIt, originPort: originPortForSeaRoute, russianDestinationCity: formRussianDestinationCity, containerType } as RouteFormValues,
        context,
        seaDestPort,
        "" // Start with fresh commentary for this specific lookup
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

    if (formRussianDestinationCity) {
        derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
    } else if (seaDestPort && (VLADIVOSTOK_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPort.startsWith(v.split(" ")[0])))) {
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
        "" // Start with fresh commentary for this specific lookup
      );
      if (cocDropOffDetails.costNumeric !== null) {
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
        formRussianDestinationCity,
        seaDestPort, // Correctly pass seaDestPort as socDepartureCityForDropOff
        currentSeaComment || ""
      );

      if (socDropOffDetails.costNumeric !== null) {
        costToAddForDropOffRUB = (socDropOffDetails.costNumeric ?? 0) * USD_RUB_CONVERSION_RATE;
      }
      derivedRussianDestinationCityForCandidate = formRussianDestinationCity;
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
      if (!russianDestinationCity) { // For SOC, final city is mandatory for SOC drop-off lookup
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
    // User selected a hub city like Vladivostok as the final destination
    seaPortsToConsiderForBestPrice = [russianDestinationCity];
  } else if (destinationPort) { // User selected a specific sea port in the form
    seaPortsToConsiderForBestPrice = [destinationPort];
  } else { // No specific sea port or Russian city, consider all Excel destinations
    seaPortsToConsiderForBestPrice = excelDestinationPorts;
  }


  seaPortsToConsiderForBestPrice.forEach(seaDestPortCandidate => {
    if (shipmentType === "SOC" && russianDestinationCity &&
        !(VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])))
       ) {
      // For SOC, if a final Russian city is given, the sea port must be a hub like Vladivostok/Vostochny
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

        // Use `values` from the form directly, `_getRailAndDropOffDetailsForCandidate` will use `values.russianDestinationCity`
        const details = _getRailAndDropOffDetailsForCandidate(
          values, // Pass the original form values; `formRussianDestinationCity` is used internally by the helper
          context,
          seaDestPortCandidate,
          seaLineCompanyIt,
          currentSeaComment,
          originPort
          // No preParsedRailwayLegs here, this is for generic Excel data
        );

        if (shipmentType === "SOC" && details.socDropOffDetails?.socDropOffLegFailed) {
            return;
        }
        if (shipmentType === "COC" && details.cocDropOffDetails?.dropOffLegFailed && !seaLineCompanyIt?.toLowerCase().includes('panda express line')) {
            return;
        }

        const isRailLegApplicable = values.russianDestinationCity &&
            (VLADIVOSTOK_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => seaDestPortCandidate.startsWith(v.split(" ")[0]))) &&
            !VLADIVOSTOK_VARIANTS.some(v => v === values.russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0])) &&
            !VOSTOCHNIY_VARIANTS.some(v => v === values.russianDestinationCity && seaDestPortCandidate.startsWith(v.split(" ")[0]));


        if (shipmentType === "COC" && isRailLegApplicable && details.railLegDetails?.railLegFailed) {
            return;
        }

        totalComparisonCostRUB += details.costToAddForDropOffRUB;
        if (shipmentType === "COC" && isRailLegApplicable) {
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

          railCost20DC_24t_RUB: shipmentType === "COC" && isRailLegApplicable ? (details.railLegDetails?.baseCost24t ?? null) : (shipmentType === "SOC" && containerType === "20DC" ? details.costToAddForRailRUB / USD_RUB_CONVERSION_RATE : null), // For SOC this was already in RUB, converting back for consistency if needed, or store as RUB. Store as RUB.
          railCost20DC_28t_RUB: shipmentType === "COC" && isRailLegApplicable ? (details.railLegDetails?.baseCost28t ?? null) : null,
          railGuardCost20DC_RUB: shipmentType === "COC" && isRailLegApplicable ? (details.railLegDetails?.guardCost20DC ?? null) : null,
          railCost40HC_RUB: shipmentType === "COC" && isRailLegApplicable ? (details.railLegDetails?.baseCost40HC ?? null) : (shipmentType === "SOC" && containerType === "40HC" ? details.costToAddForRailRUB / USD_RUB_CONVERSION_RATE : null),
          railGuardCost40HC_RUB: shipmentType === "COC" && isRailLegApplicable ? (details.railLegDetails?.guardCost40HC ?? null) : null,

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
        seaDestinationPort: entry.destinationCity, // For direct rail, this is the final rail destination
        containerType: '40HC', // Default or parse if available
        russianDestinationCity: entry.destinationCity,
        totalComparisonCostRUB: entry.price,

        directRailAgentName: entry.agentName,
        directRailIncoterms: entry.incoterms,
        directRailBorder: entry.border,
        directRailPriceRUB: entry.price,
        directRailETD: entry.etd,
        directRailExcelCommentary: entry.commentary,
        railDepartureStation: entry.departureStation, // Store actual station
        railArrivalStation: entry.destinationCity, // Or a more specific station if parsed

        seaCostUSD: null, // Not applicable
      });
    }
  });
  return candidates;
}

export function generateDashboardCandidates(values: RouteFormValues, context: PricingDataContextType): BestPriceRoute[] {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = context;
  const { shipmentType: formShipmentType, originPort: formOriginPort, russianDestinationCity: formRussianDestinationCity, containerType: formContainerType } = values;
  const candidates: BestPriceRoute[] = [];
  let routeIdCounter = 0;

  if (!isSeaRailExcelDataLoaded || !dashboardServiceSections || dashboardServiceSections.length === 0 || formShipmentType !== "COC" || !formOriginPort || !formContainerType) {
    return candidates;
  }

  dashboardServiceSections.forEach(section => {
    section.dataRows.forEach(row => {
      const parsedRoute = parseDashboardRouteString(row.route);
      const parsedRate = parseDashboardMonetaryValue(row.rate);

      if (!parsedRoute.originPort || !parsedRoute.originPort.includes(formOriginPort) || parsedRoute.containerType !== formContainerType || parsedRate.amount === null || parsedRate.currency !== 'USD') {
        return;
      }

      const effectiveSeaDestPort = parsedRoute.seaDestinationPort || "N/A";
      let stationNameFromDashboardFORClause = parsedRoute.finalRussianDestination; // This is the station from "FOR [Station]"
      let cityMappedFromDashboardFORClause = stationNameFromDashboardFORClause ? getCityFromStationName(stationNameFromDashboardFORClause) : null;

      // Determine the actual final city for this candidate.
      // If user selected a specific Russian city, that's the target.
      // If dashboard has a FOR clause mapping to a city, that's also a strong indicator.
      let finalCityForCandidate = formRussianDestinationCity;
      if (!finalCityForCandidate && cityMappedFromDashboardFORClause) {
          finalCityForCandidate = cityMappedFromDashboardFORClause;
      } else if (!finalCityForCandidate && (VLADIVOSTOK_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0])))) {
          finalCityForCandidate = effectiveSeaDestPort; // If sea port is a hub and no other city specified
      }

      // If a final city is determined (either from form or dashboard FOR clause) but it doesn't match what user wants (if specified), skip.
      if (formRussianDestinationCity && cityMappedFromDashboardFORClause && cityMappedFromDashboardFORClause.toLowerCase() !== formRussianDestinationCity.toLowerCase()){
          return;
      }
      // If user wants a specific city, but dashboard row has no FOR clause and its sea port is not that city (and not a hub leading to it), skip.
      if (formRussianDestinationCity && !cityMappedFromDashboardFORClause &&
          !(VLADIVOSTOK_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0]))) &&
          effectiveSeaDestPort.toLowerCase() !== formRussianDestinationCity.toLowerCase() ) {
          return;
      }


      let totalDashboardComparisonCostRUB = parsedRate.amount * USD_RUB_CONVERSION_RATE;
      let railDetailsForRoute: RailLegInfo | null = null;
      let cocDropOffDetailsForRoute: DropOffInfo | null = null;
      let costToAddForRailFromHelper = 0;
      let costToAddForDropOffFromHelper = 0;


      // Construct temporary form values for the helper, using the user's target city for lookups
      // The `russianDestinationCity` in `tempFormValuesForHelper` should be the user's ultimate target.
      const tempFormValuesForHelper: RouteFormValues = {
        ...values, // Includes formShipmentType, formOriginPort, formContainerType, formRussianDestinationCity
        destinationPort: effectiveSeaDestPort, // Sea port from dashboard
        seaLineCompany: section.serviceName,
        // `russianDestinationCity` from `values` is the user's target.
      };

      const additionalDetails = _getRailAndDropOffDetailsForCandidate(
          tempFormValuesForHelper,
          context,
          effectiveSeaDestPort,
          section.serviceName,
          row.additionalComment !== '-' ? row.additionalComment : null,
          formOriginPort, // This is the specific origin port we are making a candidate for
          row.railwayLegs // Pass pre-parsed railway legs specific to this dashboard row
      );
      
      // Use details from the helper
      railDetailsForRoute = additionalDetails.railLegDetails;
      cocDropOffDetailsForRoute = additionalDetails.cocDropOffDetails;
      costToAddForRailFromHelper = additionalDetails.costToAddForRailRUB;
      costToAddForDropOffFromHelper = additionalDetails.costToAddForDropOffRUB;


      // Validation based on helper results
      const isFurtherRailNeededForThisCandidate = finalCityForCandidate && effectiveSeaDestPort &&
          (VLADIVOSTOK_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => effectiveSeaDestPort.startsWith(v.split(" ")[0]))) &&
          !VLADIVOSTOK_VARIANTS.some(v => v === finalCityForCandidate && effectiveSeaDestPort.startsWith(v.split(" ")[0])) &&
          !VOSTOCHNIY_VARIANTS.some(v => v === finalCityForCandidate && effectiveSeaDestPort.startsWith(v.split(" ")[0]));


      if (isFurtherRailNeededForThisCandidate && railDetailsForRoute?.railLegFailed) {
          return; // Skip if necessary rail leg failed
      }
      if (!section.serviceName?.toLowerCase().includes('panda express line') && cocDropOffDetailsForRoute?.dropOffLegFailed){
          return; // Skip if necessary drop-off failed
      }

      totalDashboardComparisonCostRUB += costToAddForRailFromHelper;
      totalDashboardComparisonCostRUB += costToAddForDropOffFromHelper;

      candidates.push({
        id: `dash-${section.serviceName.replace(/\s+/g, '-')}-${formOriginPort}-${routeIdCounter++}`,
        mode: 'sea_plus_rail',
        shipmentType: "COC",
        originPort: formOriginPort, // The matched origin port from user's selection
        seaDestinationPort: effectiveSeaDestPort,
        seaLineCompany: section.serviceName,
        containerType: formContainerType,
        russianDestinationCity: additionalDetails.derivedRussianDestinationCityForCandidate, // Use derived city from helper
        
        seaCostUSD: parsedRate.amount,
        seaComment: row.additionalComment !== '-' ? row.additionalComment : null,
        
        totalComparisonCostRUB: totalDashboardComparisonCostRUB,
        isDashboardRecommendation: true,
        dashboardSourceService: section.serviceName,
        
        railDepartureStation: railDetailsForRoute?.departureStation ?? undefined,
        railArrivalStation: railDetailsForRoute?.arrivalStation ?? undefined,
        railCost20DC_24t_RUB: railDetailsForRoute?.baseCost24t ?? null,
        railCost20DC_28t_RUB: railDetailsForRoute?.baseCost28t ?? null,
        railGuardCost20DC_RUB: railDetailsForRoute?.guardCost20DC ?? null,
        railCost40HC_RUB: railDetailsForRoute?.baseCost40HC ?? null,
        railGuardCost40HC_RUB: railDetailsForRoute?.guardCost40HC ?? null,
        
        dropOffCostUSD: cocDropOffDetailsForRoute?.costNumeric ?? null,
        dropOffDisplayValue: cocDropOffDetailsForRoute?.displayValue ?? null,
        dropOffComment: cocDropOffDetailsForRoute?.comment ?? null,
      });
    });
  });

  return candidates;
}
