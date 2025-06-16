
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
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS, DROP_OFF_TRIGGER_PHRASES, CONTAINER_TYPES_CONST } from './constants';
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

export interface ParsedDashboardRoute {
  originPort: string | null;
  seaDestinationPort: string | null;
  containerType: ContainerType | null;
  finalRussianDestination: string | null;
}

export function parseDashboardRouteString(routeString: string): ParsedDashboardRoute {
  const result: ParsedDashboardRoute = {
    originPort: null,
    seaDestinationPort: null,
    containerType: null,
    finalRussianDestination: null,
  };

  if (!routeString) return result;

  let tempRouteString = routeString.toUpperCase();

  // Extract Container Type
  const containerMatch = tempRouteString.match(/(20DC|40HC|20GP|40GP)/);
  if (containerMatch && containerMatch[0]) {
    const matchedContainerType = containerMatch[0] as ContainerType;
    if (CONTAINER_TYPES_CONST.includes(matchedContainerType)) {
        result.containerType = matchedContainerType;
        tempRouteString = tempRouteString.replace(matchedContainerType, "").trim();
    }
  }

  // Remove FOB/FI
  tempRouteString = tempRouteString.replace(/^(FOB|FI)\s*/, "").trim();

  const parts = tempRouteString.split(/\s*-\s*/).map(part => part.trim());

  if (parts.length === 0) return result;

  result.originPort = parts.shift() || null;

  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    const forMatch = lastPart.match(/^FOR\s+(.+)/);
    if (forMatch && forMatch[1]) {
      result.finalRussianDestination = forMatch[1].trim();
      parts.pop(); // Remove the "FOR CITY" part
      if (parts.length > 0) {
        result.seaDestinationPort = parts.pop() || null;
      }
    } else {
      result.seaDestinationPort = parts.pop() || null;
    }
  }
  
  // If originPort still contains container type (e.g. if regex didn't catch it initially due to spacing)
  if (result.originPort && !result.containerType) {
    const containerInOriginMatch = result.originPort.match(/(20DC|40HC|20GP|40GP)/);
    if (containerInOriginMatch && containerInOriginMatch[0]) {
        const matchedContainerType = containerInOriginMatch[0] as ContainerType;
        if (CONTAINER_TYPES_CONST.includes(matchedContainerType)) {
            result.containerType = matchedContainerType;
            result.originPort = result.originPort.replace(matchedContainerType, "").trim();
        }
    }
  }
  
  // Normalize extracted port/city names if needed or ensure they are not empty strings
  if (result.originPort === "") result.originPort = null;
  if (result.seaDestinationPort === "") result.seaDestinationPort = null;
  if (result.finalRussianDestination === "") result.finalRussianDestination = null;


  return result;
}

export interface ParsedMonetaryValue {
  amount: number | null;
  currency: 'USD' | 'RUB' | null;
}

export function parseDashboardMonetaryValue(valueString: string | undefined | null): ParsedMonetaryValue {
  const result: ParsedMonetaryValue = { amount: null, currency: null };
  if (valueString === null || valueString === undefined) return result;

  let sValue = String(valueString).trim();
  if (sValue === "" || sValue.toLowerCase() === "n/a" || sValue === "-") return result;

  if (sValue.includes('$') || sValue.toUpperCase().includes('USD')) {
    result.currency = "USD";
  } else if (sValue.toLowerCase().includes('rub') || sValue.includes('₽') || sValue.toLowerCase().includes('руб')) {
    result.currency = "RUB";
  }

  // Remove currency symbols/units and spaces. Standardize decimal separator.
  let numericPart = sValue
    .replace(/\$|€|₽|USD|EUR|RUB|P|р\.|руб\./gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  
  // Handle cases like "1 500 / 1 600" - take the first number
  if (numericPart.includes('/') && numericPart.match(/\d[\d.]*\/\d[\d.]*/)) {
    numericPart = numericPart.split('/')[0].trim();
  }
  
  // Remove trailing .0 or .00
  numericPart = numericPart.replace(/\.(0+|0)$/, '');
  // If rate was like "1000.-", remove the trailing ".-"
  numericPart = numericPart.replace(/\.-$/, '');

  const num = parseFloat(numericPart);

  if (!isNaN(num)) {
    result.amount = num;
    // If currency wasn't explicitly found but it's a large number, assume RUB
    if (!result.currency && num > 50000) { // Heuristic: numbers > 50k likely RUB if not specified
        result.currency = "RUB";
    } else if (!result.currency) {
        result.currency = "USD"; // Default to USD for smaller numbers if unspecified
    }
  } else {
      // If parsing fails, keep amount null and potentially clear currency if it was a bad heuristic
      result.currency = null; 
  }
  return result;
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

