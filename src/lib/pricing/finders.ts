
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
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, DROP_OFF_TRIGGER_PHRASES } from './constants';

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
  displayValue: string | null;
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
  seaDestinationPort: string, // This is the sea port (e.g., Vladivostok)
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
      railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + "Russian Destination City not specified for rail leg calculation.";
      return railInfo;
  }

  let railCostFound = false;
  const seaDestPortLower = seaDestinationPort.toLowerCase();
  const seaDestPortBaseName = seaDestinationPort.split(" ")[0].toLowerCase();

  for (const railEntry of excelRailData) {
    if (railEntry.cityOfArrival.toLowerCase() !== russianDestinationCity.toLowerCase()) continue;
    if (arrivalStationSelection && !railEntry.arrivalStations.includes(arrivalStationSelection)) continue;

    const compatibleDepartureStation = railEntry.departureStations.find(depStation => {
      const pStationLower = depStation.toLowerCase().trim();
      if (seaDestPortLower.includes("пл")) return pStationLower.includes("пасифик лоджистик"); // Pacific Logistic
      const specificSeaHubKeywordMatch = seaDestinationPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split(/[/\s-]+/).map(s => s.trim()).filter(Boolean) : [];
      if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
      return pStationLower.includes(seaDestPortBaseName) || seaDestPortLower.includes(pStationLower);
    });

    if (compatibleDepartureStation) {
      railInfo.departureStation = compatibleDepartureStation;
      railInfo.arrivalStation = arrivalStationSelection || railEntry.arrivalStations[0]; // Default to first if specific not selected
      if (containerType === "20DC") {
        if (railEntry.price20DC_24t !== null && railEntry.guardCost20DC !== null) { // Check for both price and guard cost
          railInfo.baseCost24t = railEntry.price20DC_24t;
          railInfo.baseCost28t = railEntry.price20DC_28t; // Can be null, that's fine
          railInfo.guardCost20DC = railEntry.guardCost20DC;
          railCostFound = true; 
        } else if (railEntry.price20DC_28t !== null && railEntry.guardCost20DC !== null) { // If <24t is null, try <28t
           railInfo.baseCost24t = null; // Explicitly null
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
        railInfo.commentaryReason = ""; // Clear commentary if successful
        break; // Found a suitable and priced rail leg
      } else if (!railInfo.commentaryReason.includes("Rail pricing components")) {
         // If no cost found for THIS compatible station, set reason
         railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + `Rail pricing components for ${containerType} from a ${seaDestinationPort}-compatible station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""} are missing for station ${compatibleDepartureStation}.`;
      }
    }
    // Don't break loop if only some components found; try next departure station
    if (railCostFound) break;
  }

  if (!railCostFound) {
    railInfo.railLegFailed = true;
    // If loop finishes and no cost found, update commentary if it wasn't already set for missing components
    if (!railInfo.commentaryReason.includes("missing components") && !railInfo.commentaryReason.includes("No compatible and fully priced rail route")) {
       railInfo.commentaryReason = (currentCommentary ? currentCommentary + " " : "") + `No compatible and fully priced rail route found from a ${seaDestinationPort}-related station to ${russianDestinationCity}${arrivalStationSelection ? ` (station: ${arrivalStationSelection})` : ""}.`;
    }
  }
  return railInfo;
}

export function findDropOffDetails( // COC Drop-off
  values: RouteFormValues,
  context: PricingDataContextType,
  cityForDropOffLookup: string,
  seaCommentFromRoute: string | null,
  currentCommentary: string
): DropOffInfo {
  const { shipmentType, seaLineCompany, containerType } = values;
  const { excelDropOffData } = context; // COC Drop-off data
  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;

  let dropOffInfo: DropOffInfo = {
    costNumeric: null, displayValue: null, comment: null,
    dropOffLegFailed: false, commentaryReason: currentCommentary
  };

  // Drop-off is only for COC and if a sea line is specified
  if (shipmentType !== "COC" || !actualSeaLine) {
    return dropOffInfo;
  }

  // Check if drop-off is explicitly mentioned in sea route comment or if it's CK Line
  const isCKLine = actualSeaLine.toLowerCase().includes('ck line');
  const seaCommentLower = String(seaCommentFromRoute || '').toLowerCase().trim();
  const needsDropOffLookupFromComment = DROP_OFF_TRIGGER_PHRASES.some(phrase => seaCommentLower.includes(phrase));

  const shouldAttemptDropOffLookup = isCKLine || needsDropOffLookupFromComment;
  const isPandaLine = actualSeaLine.toLowerCase().includes('panda express line');


  if (shouldAttemptDropOffLookup && !isPandaLine) {
    let dropOffEntryMatched = false;
    const normalizedLookupCity = (cityForDropOffLookup.toLowerCase().replace(/^г\.\s*/, '') || "").trim();

    for (const dropOffEntry of excelDropOffData) {
      const seaLineFromMainRouteLower = actualSeaLine.toLowerCase().trim();
      const seaLineFromDropOffSheetLower = dropOffEntry.seaLine.toLowerCase().trim();
      // More robust sea line matching (e.g., "SINOKOR" vs "SINOKOR MERCHANT MARINE")
      const seaLineMatch = seaLineFromMainRouteLower.includes(seaLineFromDropOffSheetLower) || seaLineFromDropOffSheetLower.includes(seaLineFromMainRouteLower);
      if (!seaLineMatch) continue;

      const cityMatch = dropOffEntry.cities.some(excelCity => excelCity.toLowerCase().replace(/^г\.\s*/, '').trim() === normalizedLookupCity);
      if (cityMatch) {
        dropOffInfo.comment = dropOffEntry.comment || null;
        const dropOffPriceRaw = containerType === "20DC" ? dropOffEntry.price20DC : dropOffEntry.price40HC;

        if (typeof dropOffPriceRaw === 'string') {
          dropOffInfo.displayValue = dropOffPriceRaw;
          dropOffInfo.costNumeric = parseFirstNumberFromString(dropOffPriceRaw);
          // If parsing failed but string is not empty/N/A, it's a problematic price string.
          if (dropOffInfo.costNumeric === null && dropOffPriceRaw.trim() !== "" && dropOffPriceRaw.trim().toLowerCase() !== "n/a") { 
            dropOffInfo.dropOffLegFailed = true;
            dropOffInfo.commentaryReason += (dropOffInfo.commentaryReason ? " " : "") + `COC Drop-off charges for ${actualSeaLine} to ${cityForDropOffLookup} has an unparsable string price for ${containerType}: ${dropOffPriceRaw}.`;
          }
        } else if (typeof dropOffPriceRaw === 'number') {
          dropOffInfo.costNumeric = dropOffPriceRaw;
          dropOffInfo.displayValue = String(dropOffPriceRaw); // Store as string for consistency
        }
        // If cost is explicitly null from Excel but was matched, it's a valid "no price" entry
        dropOffEntryMatched = true; break;
      }
    }
    if (!dropOffEntryMatched) {
      dropOffInfo.commentaryReason += (dropOffInfo.commentaryReason ? " " : "") + `COC Drop-off charges triggered for ${actualSeaLine} to ${cityForDropOffLookup}, but no matching COC drop-off pricing entry found.`;
      dropOffInfo.dropOffLegFailed = true; // Mark as failed if lookup was expected but no entry found
    }
  } else if (shouldAttemptDropOffLookup && isPandaLine) {
    // Special handling for Panda Express Line - no drop-off cost
    dropOffInfo.costNumeric = null;
    dropOffInfo.displayValue = null; // Explicitly no display value
    dropOffInfo.comment = "Drop-off N/A for Panda Express Line";
  }
  return dropOffInfo;
}

export function findSOCDropOffDetails( // SOC Drop-off (New Function)
  values: RouteFormValues,
  context: PricingDataContextType,
  cityForDropOffLookup: string,
  currentCommentary: string
): SOCDropOffInfo {
  const { seaLineCompany, containerType } = values;
  const { excelSOCDropOffData, isSOCDropOffExcelDataLoaded } = context;
  const actualSeaLine = seaLineCompany === NONE_SEALINE_VALUE ? undefined : seaLineCompany;

  let socDropOffInfo: SOCDropOffInfo = {
    costNumeric: null, displayValue: null, comment: null,
    socDropOffLegFailed: false, commentaryReason: currentCommentary
  };

  // SOC Drop-off requires the specific Excel to be loaded, sea line, container type, and city.
  if (!isSOCDropOffExcelDataLoaded || !actualSeaLine || !containerType || !cityForDropOffLookup) {
    if (isSOCDropOffExcelDataLoaded && actualSeaLine && containerType && cityForDropOffLookup) { // Only add specific message if some params were there
        socDropOffInfo.commentaryReason += (socDropOffInfo.commentaryReason ? " " : "") + `SOC Drop-off data not fully available or missing parameters.`;
    }
    socDropOffInfo.socDropOffLegFailed = true;
    return socDropOffInfo;
  }

  let entryMatched = false;
  const normalizedLookupCity = (cityForDropOffLookup.toLowerCase().replace(/^г\.\s*/, '') || "").trim();

  for (const entry of excelSOCDropOffData) {
    const seaLineMatch = entry.seaLine.toLowerCase().trim() === actualSeaLine.toLowerCase().trim();
    const cityMatch = entry.destination.toLowerCase().replace(/^г\.\s*/, '').trim() === normalizedLookupCity;
    const containerMatch = entry.containerType === containerType;

    if (seaLineMatch && cityMatch && containerMatch) {
      socDropOffInfo.comment = entry.comment || null;
      const priceRaw = entry.price;

      if (typeof priceRaw === 'string') {
        socDropOffInfo.displayValue = priceRaw;
        socDropOffInfo.costNumeric = parseFirstNumberFromString(priceRaw);
        if (socDropOffInfo.costNumeric === null && priceRaw.trim() !== "" && priceRaw.trim().toLowerCase() !== "n/a") {
          socDropOffInfo.socDropOffLegFailed = true;
          socDropOffInfo.commentaryReason += (socDropOffInfo.commentaryReason ? " " : "") + `SOC Drop-off charges for ${actualSeaLine} to ${cityForDropOffLookup} (${containerType}) has an unparsable string price: ${priceRaw}.`;
        }
      } else if (typeof priceRaw === 'number') {
        socDropOffInfo.costNumeric = priceRaw;
        socDropOffInfo.displayValue = String(priceRaw);
      }
      entryMatched = true;
      break;
    }
  }

  if (!entryMatched) {
    socDropOffInfo.commentaryReason += (socDropOffInfo.commentaryReason ? " " : "") + `No matching SOC Drop-off pricing found for ${actualSeaLine} to ${cityForDropOffLookup} (${containerType}).`;
    socDropOffInfo.socDropOffLegFailed = true;
  }
  return socDropOffInfo;
}

export function findDirectRailEntry(values: RouteFormValues, context: PricingDataContextType): DirectRailEntry | undefined {
  const { excelDirectRailData } = context;
  const { directRailAgentName, directRailCityOfDeparture, directRailDestinationCityDR, directRailIncoterms, directRailBorder } = values;
  
  // All fields are required for a specific direct rail entry lookup
  if (!directRailAgentName || !directRailCityOfDeparture || !directRailDestinationCityDR || !directRailIncoterms || !directRailBorder) {
    return undefined;
  }

  return excelDirectRailData.find(entry =>
    entry.agentName.toLowerCase() === directRailAgentName.toLowerCase() &&
    entry.cityOfDeparture.toLowerCase() === directRailCityOfDeparture.toLowerCase() &&
    entry.destinationCity.toLowerCase() === directRailDestinationCityDR.toLowerCase() &&
    entry.incoterms.toLowerCase() === directRailIncoterms.toLowerCase() &&
    entry.border.toLowerCase() === directRailBorder.toLowerCase()
  );
}

    