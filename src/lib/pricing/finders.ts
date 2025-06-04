
// src/lib/pricing/finders.ts
import type {
  RouteFormValues,
  PricingDataContextType,
  ExcelRoute,
  ExcelSOCRoute,
  RailDataEntry,
  DirectRailEntry,
  DropOffEntry,
  ExcelSOCDropOffEntry,
  ContainerType,
  ShipmentType,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, DROP_OFF_TRIGGER_PHRASES } from './constants';
import { appendCommentary, normalizeCityName } from './utils';

// --- Helper Interfaces (can be moved to types if they become more widely used) ---
export interface SeaPriceInfo {
  seaPriceNumeric: number | null;
  matchedSeaRouteInfo?: ExcelRoute | ExcelSOCRoute;
  seaComment: string | null;
  socComment: string | null;
  commentaryReason: string;
}

export interface RailLegInfo {
  baseCost24t: number | null;
  baseCost28t: number | null;
  guardCost20DC: number | null;
  baseCost40HC: number | null;
  guardCost40HC: number | null;
  arrivalStation: string | null;
  departureStation: string | null;
  railLegFailed: boolean;
  commentaryReason: string;
}

export interface DropOffInfo { // For COC Drop-off
  costNumeric: number | null;
  displayValue: string | null;
  comment: string | null;
  dropOffLegFailed: boolean;
  commentaryReason: string;
}

export interface SOCDropOffInfo { // For SOC Drop-off
  costNumeric: number | null;
  displayValue: string | null; // Can hold original string representation if numeric parsing is tricky
  comment: string | null;
  socDropOffLegFailed: boolean;
  commentaryReason: string;
}

// --- Utility Function ---
export function parseFirstNumberFromString(priceString: string | number | null): number | null {
  if (typeof priceString === 'number') return priceString;
  if (typeof priceString === 'string') {
    const match = priceString.match(/(\d+(\.\d+)?)/);
    if (match && match[1]) return parseFloat(match[1]);
  }
  return null;
}

// --- Finder Functions ---
export function findSeaPriceAndDetails(
  values: RouteFormValues,
  context: PricingDataContextType
): SeaPriceInfo {
  const { shipmentType, originPort, destinationPort, seaLineCompany, containerType } = values;
  const { excelRouteData, excelSOCRouteData } = context;

  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;
  let foundSeaPrice: number | string | null = null;
  let matchedSeaRouteInfo: ExcelRoute | ExcelSOCRoute | undefined;
  let commentaryReason = "";
  let foundSocComment: string | null = null;
  let foundSeaComment: string | null = null;

  const currentSeaDataset = shipmentType === "SOC" ? excelSOCRouteData : excelRouteData;
  const originFieldKey = shipmentType === "SOC" ? "departurePorts" : "originPorts";
  const price20DCKey = "price20DC";
  const price40HCKey = "price40HC";

  for (const route of currentSeaDataset) {
    const routeOrigins = route[originFieldKey as keyof typeof route] as string[] | undefined;
    const isOriginMatch = originPort && Array.isArray(routeOrigins) && routeOrigins.includes(originPort);
    const isDestinationMatch = destinationPort && Array.isArray(route.destinationPorts) && route.destinationPorts.includes(destinationPort);

    if (isOriginMatch && isDestinationMatch) {
      const isSeaLineMatch = actualSeaLine ? (Array.isArray(route.seaLines) && route.seaLines.includes(actualSeaLine)) : true;
      if (isSeaLineMatch) {
        const priceForContainer = containerType === "20DC" ? route[price20DCKey] : route[price40HCKey];
        if (priceForContainer !== null && priceForContainer !== undefined) {
          foundSeaPrice = priceForContainer;
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = ""; break;
        } else if (!foundSeaPrice && !matchedSeaRouteInfo) {
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = `Sea pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort}${actualSeaLine ? ` via ${actualSeaLine}` : ""} is not available in Excel.`;
        }
      } else if (!actualSeaLine && !foundSeaPrice && !matchedSeaRouteInfo && Array.isArray(route.seaLines) && route.seaLines.length > 0) {
        const priceForContainer = containerType === "20DC" ? route[price20DCKey] : route[price40HCKey];
        if (priceForContainer === null && !matchedSeaRouteInfo) {
          matchedSeaRouteInfo = route;
          if (shipmentType === "SOC") foundSocComment = (route as ExcelSOCRoute).socComment || null;
          else if (shipmentType === "COC") foundSeaComment = (route as ExcelRoute).seaComment || null;
          commentaryReason = `Pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort} is not available for any sea line.`;
        }
      }
    }
  }
  const seaPriceNumeric = typeof foundSeaPrice === 'string' ? parseFirstNumberFromString(foundSeaPrice) : (typeof foundSeaPrice === 'number' ? foundSeaPrice : null);


  if (!matchedSeaRouteInfo && !commentaryReason) {
    commentaryReason = `No sea route found in Excel for ${originPort} to ${destinationPort} for ${shipmentType} shipment.`;
  } else if (seaPriceNumeric === null && matchedSeaRouteInfo && !commentaryReason.startsWith(`Sea pricing for ${containerType}`)) {
    commentaryReason = `Sea pricing for ${containerType} on ${shipmentType} route ${originPort} to ${destinationPort}${actualSeaLine ? ` via ${actualSeaLine}` : ""} is not available in Excel.`;
  }

  return { seaPriceNumeric, matchedSeaRouteInfo, seaComment: foundSeaComment, socComment: foundSocComment, commentaryReason };
}

export function findRailLegDetails(
  values: RouteFormValues,
  context: PricingDataContextType,
  seaDestinationPort: string, 
  currentCommentary: string
): RailLegInfo {
  const { containerType, russianDestinationCity, arrivalStationSelection } = values;
  const { excelRailData } = context;

  let railInfo: RailLegInfo = {
    baseCost24t: null, baseCost28t: null, guardCost20DC: null,
    baseCost40HC: null, guardCost40HC: null,
    arrivalStation: null, departureStation: null,
    railLegFailed: false, commentaryReason: currentCommentary,
  };

  if (!russianDestinationCity) {
      railInfo.railLegFailed = true;
      railInfo.commentaryReason = appendCommentary(currentCommentary, "Russian Destination City not specified for rail leg calculation.");
      return railInfo;
  }

  let railCostFound = false;
  const seaDestPortLower = seaDestinationPort.toLowerCase();
  const isVladivostokHub = VLADIVOSTOK_VARIANTS.some(v => seaDestPortLower.startsWith(v.toLowerCase().split(" ")[0]));
  const isVostochniyHub = VOSTOCHNIY_VARIANTS.some(v => seaDestPortLower.startsWith(v.toLowerCase().split(" ")[0]));

  for (const railEntry of excelRailData) {
    if (railEntry.cityOfArrival.toLowerCase() !== russianDestinationCity.toLowerCase()) continue;
    if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection)) continue;

    const compatibleDepartureStation = railEntry.departureStations.find(depStation => {
      const pStationLower = depStation.toLowerCase().trim();
      if (seaDestPortLower.includes("пл") && pStationLower.includes("пасифик лоджистик")) return true;
      const specificSeaHubKeywordMatch = seaDestinationPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split(/[/\s-]+/).map(s => s.trim()).filter(Boolean) : [];
      if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;

      if (isVladivostokHub) {
          if (pStationLower.includes("владивосток")) return true;
          if (VLADIVOSTOK_VARIANTS.some(vladVariant => pStationLower.includes(vladVariant.toLowerCase().split(" ")[0]))) return true;
      }
      if (isVostochniyHub) {
          if (pStationLower.includes("восточный")) return true;
          if (VOSTOCHNIY_VARIANTS.some(vostVariant => pStationLower.includes(vostVariant.toLowerCase().split(" ")[0]))) return true;
      }
      
      const seaPortBaseNameLower = seaDestPortLower.split(" ")[0];
      if (pStationLower.includes(seaPortBaseNameLower)) return true;
      const stationBaseNameLower = pStationLower.split(" ")[0];
      if (seaDestPortLower.includes(stationBaseNameLower)) return true;

      return false;
    });

    if (compatibleDepartureStation) {
      railInfo.departureStation = compatibleDepartureStation;
      railInfo.arrivalStation = arrivalStationSelection || railEntry.arrivalStations[0]; 
      if (containerType === "20DC") {
        if (railEntry.price20DC_24t !== null && railEntry.guardCost20DC !== null) {
          railInfo.baseCost24t = railEntry.price20DC_24t;
          railInfo.baseCost28t = railEntry.price20DC_28t; 
          railInfo.guardCost20DC = railEntry.guardCost20DC;
          railCostFound = true;
        } else if (railEntry.price20DC_28t !== null && railEntry.guardCost20DC !== null) {
           railInfo.baseCost28t = railEntry.price20DC_28t;
           railInfo.guardCost20DC = railEntry.guardCost20DC;
           railCostFound = true;
        }
      } else if (containerType === "40HC") {
        if (railEntry.price40HC !== null && railEntry.guardCost40HC !== null) {
          railInfo.baseCost40HC = railEntry.price40HC;
          railInfo.guardCost40HC = railEntry.guardCost40HC;
          railCostFound = true;
        }
      }
      if (railCostFound) {
        railInfo.commentaryReason = currentCommentary; 
        break; 
      } else if (!railInfo.commentaryReason.includes("Rail pricing components")) { 
         railInfo.commentaryReason = appendCommentary(currentCommentary, `Rail pricing components for ${containerType} from a ${seaDestinationPort}-compatible station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""} are missing for station ${compatibleDepartureStation}.`);
      }
    }
    if (railCostFound) break;
  }

  if (!railCostFound) {
    railInfo.railLegFailed = true;
    if (!railInfo.commentaryReason.includes("missing components") && !railInfo.commentaryReason.includes("No compatible and fully priced rail route")) {
       railInfo.commentaryReason = appendCommentary(currentCommentary, `No compatible and fully priced rail route found from a ${seaDestinationPort}-related station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""}.`);
    }
  }
  return railInfo;
}

export function findDropOffDetails(
  values: RouteFormValues,
  context: PricingDataContextType,
  cityForDropOffLookup: string,
  seaCommentFromRoute: string | null,
  currentCommentary: string
): DropOffInfo {
  const { shipmentType, seaLineCompany, containerType } = values;
  const { excelDropOffData } = context;
  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;

  let dropOffInfo: DropOffInfo = {
    costNumeric: null, displayValue: null, comment: null,
    dropOffLegFailed: false, commentaryReason: currentCommentary
  };

  if (shipmentType !== "COC" || !actualSeaLine) {
    return dropOffInfo; // No COC drop-off for SOC or if sea line is not specified
  }

  const isPandaLine = actualSeaLine.toLowerCase().includes('panda express line');
  const seaCommentLower = String(seaCommentFromRoute || '').toLowerCase().trim();
  
  // Specific Panda Express Line rules
  if (isPandaLine) {
    const excludedCitiesPanda = ["москва", "екатеринбург", "новосибирск"].map(normalizeCityName);
    const normalizedCityForDropOffPanda = normalizeCityName(cityForDropOffLookup);

    if (excludedCitiesPanda.includes(normalizedCityForDropOffPanda)) {
      dropOffInfo.costNumeric = null;
      dropOffInfo.displayValue = "N/A";
      dropOffInfo.comment = "Drop-off not applicable for Panda Express to this city.";
      dropOffInfo.dropOffLegFailed = false; // Rule applied, not a failure
      // Retain currentCommentary as no new failure occurred related to drop-off
      return dropOffInfo;
    } else {
      // For Panda Express to other cities, drop-off is generally not itemized
      dropOffInfo.costNumeric = null;
      dropOffInfo.displayValue = "N/A";
      dropOffInfo.comment = "Drop-off generally not applicable for Panda Express Line.";
      dropOffInfo.dropOffLegFailed = false; // Default for Panda, not a lookup failure
      return dropOffInfo;
    }
  }

  // Logic for other sea lines (CK Line or comment-triggered lookup)
  const isCKLine = actualSeaLine.toLowerCase().includes('ck line');
  const needsDropOffLookupFromComment = DROP_OFF_TRIGGER_PHRASES.some(phrase => seaCommentLower.includes(phrase));
  const shouldAttemptDropOffLookup = isCKLine || needsDropOffLookupFromComment;

  if (shouldAttemptDropOffLookup) {
    let dropOffEntryMatched = false;
    const normalizedLookupCity = normalizeCityName(cityForDropOffLookup); 

    for (const dropOffEntry of excelDropOffData) {
      const seaLineFromMainRouteLower = actualSeaLine.toLowerCase().trim();
      const seaLineFromDropOffSheetLower = dropOffEntry.seaLine.toLowerCase().trim();
      const seaLineMatch = seaLineFromMainRouteLower.includes(seaLineFromDropOffSheetLower) || seaLineFromDropOffSheetLower.includes(seaLineFromMainRouteLower);
      if (!seaLineMatch) continue;

      const cityMatch = dropOffEntry.cities.some(excelCity => normalizeCityName(excelCity) === normalizedLookupCity);
      if (cityMatch) {
        dropOffInfo.comment = dropOffEntry.comment || null;
        const dropOffPriceRaw = containerType === "20DC" ? dropOffEntry.price20DC : dropOffEntry.price40HC;

        if (typeof dropOffPriceRaw === 'string') {
          dropOffInfo.displayValue = dropOffPriceRaw;
          dropOffInfo.costNumeric = parseFirstNumberFromString(dropOffPriceRaw);
          if (dropOffInfo.costNumeric === null && dropOffPriceRaw.trim() !== "" && dropOffPriceRaw.trim().toLowerCase() !== "n/a") {
            dropOffInfo.dropOffLegFailed = true;
            dropOffInfo.commentaryReason = appendCommentary(dropOffInfo.commentaryReason, `COC Drop-off charges for ${actualSeaLine} to ${cityForDropOffLookup} has an unparsable string price for ${containerType}: ${dropOffPriceRaw}.`);
          }
        } else if (typeof dropOffPriceRaw === 'number') {
          dropOffInfo.costNumeric = dropOffPriceRaw;
          dropOffInfo.displayValue = String(dropOffPriceRaw);
        }
        if (!dropOffInfo.dropOffLegFailed) dropOffInfo.commentaryReason = currentCommentary; 
        dropOffEntryMatched = true; break;
      }
    }
    if (!dropOffEntryMatched) {
      dropOffInfo.commentaryReason = appendCommentary(dropOffInfo.commentaryReason, `COC Drop-off charges triggered for ${actualSeaLine} to ${cityForDropOffLookup}, but no matching COC drop-off pricing entry found.`);
      dropOffInfo.dropOffLegFailed = true;
    }
  }
  // If not CK Line and no comment trigger, dropOffInfo remains as initialized (costNumeric: null, not a failure)
  return dropOffInfo;
}

export function findSOCDropOffDetails(
  values: RouteFormValues,
  context: PricingDataContextType,
  cityForDropOffLookup: string, 
  socDepartureCityForDropOff: string, 
  currentCommentary: string
): SOCDropOffInfo {
  const { excelSOCDropOffData, isSOCDropOffExcelDataLoaded } = context;
  const { containerType } = values;

  let socDropOffInfo: SOCDropOffInfo = {
    costNumeric: null, displayValue: null, comment: null,
    socDropOffLegFailed: false, commentaryReason: currentCommentary
  };

  if (!isSOCDropOffExcelDataLoaded || !containerType || !cityForDropOffLookup || !socDepartureCityForDropOff) {
    socDropOffInfo.socDropOffLegFailed = true;
    if (isSOCDropOffExcelDataLoaded) { 
        socDropOffInfo.commentaryReason = appendCommentary(currentCommentary, `SOC Drop-off lookup missing key parameters (container type: ${containerType}, drop-off city: ${cityForDropOffLookup}, or departure city for drop-off: ${socDepartureCityForDropOff}).`);
    } else if (!isSOCDropOffExcelDataLoaded) {
        socDropOffInfo.commentaryReason = appendCommentary(currentCommentary, "SOC Drop-off Excel data not loaded.");
    }
    return socDropOffInfo;
  }

  let entryMatched = false;
  const normalizedLookupDropOffCity = normalizeCityName(cityForDropOffLookup);
  const normalizedLookupDepartureCity = normalizeCityName(socDepartureCityForDropOff);

  if (!normalizedLookupDropOffCity || !normalizedLookupDepartureCity) {
    socDropOffInfo.socDropOffLegFailed = true;
    socDropOffInfo.commentaryReason = appendCommentary(currentCommentary, `SOC Drop-off lookup failed due to empty normalized city names (Drop-off: '${normalizedLookupDropOffCity}', Departure: '${normalizedLookupDepartureCity}').`);
    return socDropOffInfo;
  }

  for (const entry of excelSOCDropOffData) {
    const departureMatch = entry.departureCity === normalizedLookupDepartureCity ||
                           (entry.departureCity.includes(normalizedLookupDepartureCity) && normalizedLookupDepartureCity.length > 2) ||
                           (normalizedLookupDepartureCity.includes(entry.departureCity) && entry.departureCity.length > 2);
                           
    const dropOffCityMatch = entry.dropOffCity === normalizedLookupDropOffCity; 
    const containerMatch = entry.containerType === containerType;

    if (departureMatch && dropOffCityMatch && containerMatch) {
      socDropOffInfo.costNumeric = entry.price;
      socDropOffInfo.displayValue = entry.price !== null ? String(entry.price) : null;
      entryMatched = true;

      if (entry.price === null) {
        socDropOffInfo.socDropOffLegFailed = true;
        socDropOffInfo.commentaryReason = appendCommentary(currentCommentary, `SOC Drop-off price for ${containerType} from ${socDepartureCityForDropOff} to ${cityForDropOffLookup} is not available in Excel (matched entry has null price).`);
      } else {
        socDropOffInfo.socDropOffLegFailed = false; 
        socDropOffInfo.commentaryReason = currentCommentary; 
      }
      break; 
    }
  }

  if (!entryMatched) {
    socDropOffInfo.socDropOffLegFailed = true;
    socDropOffInfo.commentaryReason = appendCommentary(currentCommentary, `No matching SOC Drop-off pricing found for ${containerType} from ${socDepartureCityForDropOff} (normalized: ${normalizedLookupDepartureCity}) to ${cityForDropOffLookup} (normalized: ${normalizedLookupDropOffCity}).`);
  }
  return socDropOffInfo;
}


export function findDirectRailEntry(values: RouteFormValues, context: PricingDataContextType): DirectRailEntry | undefined {
  const { excelDirectRailData } = context;
  const { directRailAgentName, directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms, directRailBorder } = values;

  if (!directRailAgentName || !directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms || !directRailBorder) {
    return undefined;
  }

  const normalizedAgentName = directRailAgentName.toLowerCase().trim();
  const normalizedDepCity = normalizeCityName(directRailCityOfDeparture);
  const normalizedDestCityDR = normalizeCityName(directRailDestinationCityDR);
  const normalizedIncoterms = directRailIncoterms.toLowerCase().trim();
  const normalizedBorder = normalizeCityName(directRailBorder);


  return excelDirectRailData.find(entry =>
    entry.agentName.toLowerCase().trim() === normalizedAgentName &&
    normalizeCityName(entry.cityOfDeparture) === normalizedDepCity &&
    normalizeCityName(entry.destinationCity) === normalizedDestCityDR &&
    entry.incoterms.toLowerCase().trim() === normalizedIncoterms &&
    normalizeCityName(entry.border) === normalizedBorder
  );
}

