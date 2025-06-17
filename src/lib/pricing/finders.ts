
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
import { getCityFromStationName } from './city-station-mapper'; // Import the mapper

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
  originPort: string[] | null; // Changed to string[]
  seaDestinationPort: string | null;
  containerType: ContainerType | null;
  finalRussianDestination: string | null; // This will be the station name
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

  // Remove FOB/FI prefixes
  tempRouteString = tempRouteString.replace(/^(FOB|FI)\s*/, "").trim();
  
  let forPart = "";
  if (tempRouteString.includes(" - FOR ")) {
    const forSplit = tempRouteString.split(" - FOR ");
    tempRouteString = forSplit[0].trim();
    forPart = forSplit[1]?.trim() || "";
    result.finalRussianDestination = forPart; 
  }
  
  const mainParts = tempRouteString.split(/\s*-\s*(LO|L0)?\s*/i); 
  
  const originSegment = mainParts[0]?.trim();

  if (originSegment) {
    result.originPort = originSegment.split('/').map(p => p.trim()).filter(p => p.length > 0);
    if (result.originPort.length === 0) result.originPort = null;
  }

  if (mainParts.length > 1 && mainParts[1] && (!forPart || tempRouteString.includes(mainParts[1]))) {
      let potentialSeaDest = mainParts.filter((part, index) => index > 0 && part && !/^(LO|L0)$/i.test(part.trim()));
      if (potentialSeaDest.length > 0) {
        result.seaDestinationPort = potentialSeaDest[0].trim();
      }
  }
  
  if (result.originPort && result.originPort.length > 0 && !result.containerType) {
      const firstOrigin = result.originPort[0];
      const containerInOriginMatch = firstOrigin.match(/(20DC|40HC|20GP|40GP)/);
      if (containerInOriginMatch && containerInOriginMatch[0]) {
          const matchedContainerType = containerInOriginMatch[0] as ContainerType;
          if (CONTAINER_TYPES_CONST.includes(matchedContainerType)) {
              result.containerType = matchedContainerType;
              result.originPort[0] = firstOrigin.replace(matchedContainerType, "").trim();
              if(result.originPort[0] === "") result.originPort.shift(); 
              if(result.originPort.length === 0) result.originPort = null;
          }
      }
  }
  
  if (result.originPort && result.originPort.every(p => p === "")) result.originPort = null;
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

  let numericPart = sValue
    .replace(/\$|€|₽|USD|EUR|RUB|P|р\.|руб\./gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  
  if (numericPart.includes('/') && numericPart.match(/\d[\d.]*\/\d[\d.]*/)) {
    numericPart = numericPart.split('/')[0].trim();
  }
  
  numericPart = numericPart.replace(/\.(0+|0)$/, '');
  numericPart = numericPart.replace(/\.-$/, '');

  const num = parseFloat(numericPart);

  if (!isNaN(num)) {
    result.amount = num;
    if (!result.currency && num > 50000) { 
        result.currency = "RUB";
    } else if (!result.currency) {
        result.currency = "USD"; 
    }
  } else {
      result.currency = null; 
  }
  return result;
}

function isMatchingRailDepartureStation(seaPort: string, railDepStation: string): boolean {
  const normSeaPort = normalizeCityName(seaPort); // e.g., "восточный (вск)" -> "восточный"
  const normRailDepStation = normalizeCityName(railDepStation); // e.g., "ст. восточный порт эксп." -> "ст. восточный порт эксп"

  // Check if both refer to Vladivostok
  const seaIsVlad = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normSeaPort);
  const railIsVlad = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normRailDepStation) || normRailDepStation.includes("владивосток");
  if (seaIsVlad && railIsVlad) return true;

  // Check if both refer to Vostochny
  const seaIsVost = VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normSeaPort);
  const railIsVost = VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normRailDepStation) || normRailDepStation.includes("восточный");
  if (seaIsVost && railIsVost) return true;

  // Check for specific keywords if parenthetical info was present in the original seaPort
  const seaPortParentheticalMatch = seaPort.match(/\(([^)]+)\)/);
  if (seaPortParentheticalMatch && seaPortParentheticalMatch[1]) {
    const keyword = seaPortParentheticalMatch[1].toLowerCase().trim();
    if (railDepStation.toLowerCase().includes(keyword)) return true;
  }
  
  // Fallback: direct substring check if one is a known hub name and the other contains it
  if (seaIsVost && railDepStation.toLowerCase().includes("восточный")) return true;
  if (seaIsVlad && railDepStation.toLowerCase().includes("владивосток")) return true;

  // Broader substring check for less specific matches
  if (normSeaPort.length > 3 && normRailDepStation.includes(normSeaPort)) return true;
  if (normRailDepStation.length > 3 && normSeaPort.includes(normRailDepStation)) return true;
  
  // Check for specific "пасифик лоджистик"
  if (seaPort.toLowerCase().includes("пл") && railDepStation.toLowerCase().includes("пасифик лоджистик")) return true;


  return false;
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
  const normalizedTargetUserCity = normalizeCityName(russianDestinationCity);

  for (const railEntry of excelRailData) {
    const stationOrCityFromExcel = railEntry.cityOfArrival; 
    const mappedCityFromExcelStation = getCityFromStationName(stationOrCityFromExcel);
    const effectiveCityFromExcel = mappedCityFromExcelStation || stationOrCityFromExcel;
    const normalizedEffectiveCityFromExcel = normalizeCityName(effectiveCityFromExcel);

    if (normalizedEffectiveCityFromExcel !== normalizedTargetUserCity) {
      continue;
    }

    if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection) && stationOrCityFromExcel !== arrivalStationSelection) {
        continue;
    }
    
    const compatibleDepartureStation = railEntry.departureStations.find(depStation =>
        isMatchingRailDepartureStation(seaDestinationPort, depStation)
    );

    if (compatibleDepartureStation) {
      railInfo.departureStation = compatibleDepartureStation; 
      if (arrivalStationSelection && railEntry.arrivalStations.includes(arrivalStationSelection)) {
          railInfo.arrivalStation = arrivalStationSelection;
      } else if (arrivalStationSelection && stationOrCityFromExcel === arrivalStationSelection) {
          railInfo.arrivalStation = arrivalStationSelection;
      } else if (railEntry.arrivalStations.length > 0) {
          railInfo.arrivalStation = railEntry.arrivalStations[0];
      } else {
          railInfo.arrivalStation = stationOrCityFromExcel; 
      }
      
      let hasBasePrice = false;
      if (containerType === "20DC") {
        if (railEntry.price20DC_24t !== null) {
          railInfo.baseCost24t = railEntry.price20DC_24t;
          hasBasePrice = true;
        }
        // price20DC_28t is also a base price, can exist independently or with <24t
        if (railEntry.price20DC_28t !== null) {
          railInfo.baseCost28t = railEntry.price20DC_28t;
          hasBasePrice = true;
        }
        if (railEntry.guardCost20DC !== null) {
          railInfo.guardCost20DC = railEntry.guardCost20DC;
        }
        // A leg is considered priced if it has any base price, guard is optional.
        if (hasBasePrice) {
             railCostFound = true;
        }
      } else if (containerType === "40HC") {
        if (railEntry.price40HC !== null) {
          railInfo.baseCost40HC = railEntry.price40HC;
          hasBasePrice = true; // Set for 40HC if base price is found
        }
        if (railEntry.guardCost40HC !== null) {
          railInfo.guardCost40HC = railEntry.guardCost40HC;
        }
        // A leg is considered priced if it has base price for 40HC.
        if (hasBasePrice) {
            railCostFound = true;
        }
      }

      if (railCostFound) {
        railInfo.commentaryReason = currentCommentary; 
        break; 
      } else if (!railInfo.commentaryReason.includes("Rail pricing components")) { 
         railInfo.commentaryReason = appendCommentary(currentCommentary, `Rail pricing components for ${containerType} from ${compatibleDepartureStation} to ${russianDestinationCity}${railInfo.arrivalStation ? ` (station: ${railInfo.arrivalStation})` : ""} are missing.`);
      }
    }
    if (railCostFound) break;
  }

  if (!railCostFound) {
    railInfo.railLegFailed = true;
    const railNotFoundMsg = `No compatible and fully priced rail route found from a ${seaDestinationPort}-related station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""}.`;
    if (!railInfo.commentaryReason.includes(railNotFoundMsg) && !railInfo.commentaryReason.includes("Rail pricing components")) {
       railInfo.commentaryReason = appendCommentary(currentCommentary, railNotFoundMsg);
    } else if (!railInfo.commentaryReason.includes("Rail pricing components") && railInfo.commentaryReason.includes("missing components")) {
      // Retain more specific "missing components" message
    } else if (!railInfo.commentaryReason) { 
        railInfo.commentaryReason = railNotFoundMsg;
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

    