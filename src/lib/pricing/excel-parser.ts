
import * as XLSX from 'xlsx';
import type { UseFormReturn } from 'react-hook-form';
import type {
  ExcelRoute, ExcelSOCRoute, RailDataEntry as ContextRailDataEntry, DropOffEntry, DirectRailEntry,
  RouteFormValues, PricingDataContextType, CombinedAiOutput,
  DashboardServiceSection, DashboardServiceDataRow // Using CombinedAiOutput now
} from '@/types';
import type { useToast } from '@/hooks/use-toast';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';


export function formatDashboardRate(rateString: string | number | undefined): string {
  if (rateString === null || rateString === undefined) return 'N/A';
  let sValue = String(rateString).trim();
  if (sValue === "") return 'N/A';

  let currency = ""; // Default to empty, infer if possible
  let cleanedString = sValue;

  if (sValue.includes('$')) {
    currency = "USD";
    cleanedString = sValue.replace('$', '').trim();
  } else if (sValue.toLowerCase().includes('rub') || sValue.includes('₽')) {
    currency = "RUB";
    cleanedString = sValue.replace(/rub|₽/gi, '').trim();
  } else {
    // Attempt to infer currency if not explicit and if it's just a number
    // If it contains only digits, spaces, commas, periods, assume USD as a fallback
    // or leave currency blank if no strong indicator.
    // For now, if no explicit symbol, let's assume it might be USD or leave currency blank.
    // This part can be refined based on typical data patterns if needed.
    // If only numbers, spaces, and common separators, it's hard to be certain without context.
    // Let's default to USD if only numbers, but this is a guess.
    if (/^[\d\s.,]+$/.test(cleanedString)) {
        // currency = "USD"; // Or leave blank: currency = "";
    }
  }
  
  // Further clean the numeric part: remove all spaces, replace comma with dot for float parsing
  cleanedString = cleanedString.replace(/\s/g, '').replace(',', '.');

  // Remove typical Excel accounting noise if it's at the end, like ",00" or ".-"
  cleanedString = cleanedString.replace(/[,.]00$/, ''); // e.g. "1500,00" -> "1500"
  cleanedString = cleanedString.replace(/\.-$/, '');    // e.g. "1500.-" -> "1500"


  const num = parseFloat(cleanedString);

  if (!isNaN(num)) {
    const formattedNum = num.toLocaleString('fr-FR', {
      minimumFractionDigits: (num % 1 === 0) ? 0 : 2, // Show decimals only if they exist
      maximumFractionDigits: 2
    });
    return currency ? `${formattedNum} ${currency}` : formattedNum; // Append currency if detected
  }

  // If parsing as number failed, but we had an original string, return the original (trimmed).
  // This handles cases like "Market price" or other non-numeric valid entries.
  return sValue;
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  console.log("[ExcelParser] Raw data from dashboard sheet (first 10 rows):", JSON.parse(JSON.stringify(rawData.slice(0, 10))));

  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;

  rawData.forEach((rowArray, rowIndex) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[ExcelParser] Pushing section (due to blank line): ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
        parsedSections.push(currentSection);
      }
      currentSection = null;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim(); // Route (FOB...) or Service Name
    const secondCell = rowArray[1]; // Rate
    const thirdCell = String(rowArray[2] || '').trim(); // Container Info
    const fourthCell = String(rowArray[3] || '').trim(); // Additional Comment / CY indicator

    const isLikelyFOBDataRow = firstCell.toUpperCase().startsWith("FOB") && (secondCell !== null && secondCell !== undefined);
    const isLikelyCYDataRow = fourthCell.toUpperCase().startsWith("CY");

    if (isLikelyCYDataRow && currentSection && currentSection.dataRows.length > 0) {
      // This is a CY row, meant to augment the last FOB row
      const lastFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
      lastFobRow.railwayCost = formatDashboardRate(secondCell); // Column B for CY row is railway cost
      lastFobRow.railwayContainerInfo = thirdCell; // Column C for CY row is railway container info
      lastFobRow.railwayComment = fourthCell.substring(2).trim(); // Remove "CY" prefix and trim
      console.log(`[ExcelParser] Augmented FOB row with CY data: ${lastFobRow.route}, RailwayCost: ${lastFobRow.railwayCost}`);
    } else if (isLikelyFOBDataRow) {
      if (!currentSection) { // Data row appears before a service header
        currentSection = { serviceName: "General Services (Sheet 1)", dataRows: [] };
        console.log("[ExcelParser] Data row found before service header. Creating default section.");
      }
      const dataRow: DashboardServiceDataRow = {
        route: firstCell,
        rate: formatDashboardRate(secondCell),
        containerInfo: thirdCell || 'N/A',
        additionalComment: (fourthCell && !isLikelyCYDataRow) ? fourthCell : '-' // Only use 4th cell if not a CY row's comment
      };
      currentSection.dataRows.push(dataRow);
    } else if (firstCell) { // Potential service name / header (and not an FOB or CY row)
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[ExcelParser] Pushing section (due to new header): ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
        parsedSections.push(currentSection);
      }
      currentSection = { serviceName: firstCell, dataRows: [] };
      console.log(`[ExcelParser] Started new section: ${firstCell}`);
    }
  });

  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[ExcelParser] Pushing final section: ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
    parsedSections.push(currentSection);
  }
  console.log("[ExcelParser] Total parsed dashboard sections:", parsedSections.length);
  return parsedSections;
}


// Helper parsing functions
export function parsePortsCell(cellValue: string | undefined, isDestination: boolean): string[] {
  if (!cellValue) return [];
  const ports = new Set<string>();
  const cellString = String(cellValue).trim();
  const entries = cellString.split(/\/(?![^(]*\))/g); // Split by slash not inside parentheses
  const destPortPattern = /([^\/(]+)\s*\(([^)]+)\)/; // e.g., "PortName (SubPort1/SubPort2)"

  entries.forEach(entry => {
    entry = entry.trim();
    if (!entry) return;
    if (isDestination) {
      const match = entry.match(destPortPattern);
      if (match) {
        const baseName = match[1].trim();
        const subPortsString = match[2];
        subPortsString.split('/').map(p => p.trim()).forEach(subPort => {
          if (subPort) ports.add(baseName + " (" + subPort + ")");
        });
        if (!subPortsString && baseName) { // Case where there's a base name but no sub-ports in parens, e.g. "PortName ()"
           ports.add(baseName);
        }
      } else {
        ports.add(entry); // Regular port name without sub-ports in parens
      }
    } else { // Origin port, simpler parsing
      ports.add(entry);
    }
  });
  return Array.from(ports).sort();
}

export function parseSeaLinesCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  const seaLines = new Set<string>();
  String(cellValue).trim().split('/').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine) seaLines.add(trimmedLine);
  });
  return Array.from(seaLines).sort();
}

export function parseRailStationsCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  const stations = new Set<string>();
  String(cellValue).trim().split('/').forEach(station => {
    const trimmedStation = station.trim();
    if (trimmedStation) stations.add(trimmedStation);
  });
  return Array.from(stations).sort();
}

export function parseDropOffCitiesCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  return String(cellValue).trim().split('/').map(city => city.trim()).filter(city => city);
}

export function parseGenericListCell(cellValue: string | undefined): string[] {
    if (!cellValue) return [];
    const items = new Set<string>();
    String(cellValue).trim().split(/[,;\/]/g).forEach(item => {
        const trimmedItem = item.trim();
        if (trimmedItem) items.add(trimmedItem);
    });
    return Array.from(items).sort();
}


// Updated to return string | number | null to handle cases like "$ 816/$ 1020"
export function parsePriceCell(cellValue: any): string | number | null {
  if (cellValue === null || cellValue === undefined) return null;
  const sValueOriginal = String(cellValue).trim();
  if (sValueOriginal === "") return null;

  // Attempt to parse as a number first
  const sValueNumeric = sValueOriginal.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(sValueNumeric);

  if (!isNaN(num)) {
    return num; // Successfully parsed as a number
  } else {
    // If not a number, return the original string (e.g., for "$ 816/$ 1020" or "Market")
    return sValueOriginal;
  }
}

export interface ExcelParserArgsBase {
  file: File; // Expect a File object directly
  form: UseFormReturn<RouteFormValues>;
  contextSetters: PricingDataContextType;
  setShippingInfoState: (info: CombinedAiOutput | null) => void;
  setHasRestoredFromCacheState: (flag: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
  fileInputRef: React.RefObject<HTMLInputElement>;
  setIsParsingState: (isParsing: boolean) => void;
  setBestPriceResults: PricingDataContextType['setBestPriceResults'];
}


export async function handleSeaRailFileParse(args: ExcelParserArgsBase) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState, setBestPriceResults } = args;

  console.log("[ExcelParser] handleSeaRailFileParse started for file:", file?.name);
  setIsParsingState(true);
  setShippingInfoState(null);
  setBestPriceResults(null);

  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedFormValues(null);
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false);

  contextSetters.setExcelRouteData([]);
  contextSetters.setExcelSOCRouteData([]);
  contextSetters.setExcelRailData([]);
  contextSetters.setExcelDropOffData([]);
  contextSetters.setExcelOriginPorts([]);
  contextSetters.setExcelDestinationPorts([]);
  contextSetters.setExcelRussianDestinationCitiesMasterList([]);
  contextSetters.setDashboardServiceSections([]); // Reset dashboard data

  contextSetters.setIsSeaRailExcelDataLoaded(false);

  const currentValues = form.getValues();
  form.reset({
    ...currentValues,
    shipmentType: "COC",
    originPort: "",
    destinationPort: "",
    seaLineCompany: NONE_SEALINE_VALUE,
    containerType: undefined,
    russianDestinationCity: "",
    arrivalStationSelection: "",
  });


  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const allUniqueOrigins = new Set<string>();
        const allUniqueSeaDestinationsMaster = new Set<string>();

        // Dashboard Data (Sheet 1, index 0)
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          console.log(`[ExcelParser] Attempting to parse dashboard data from sheet: ${firstSheetName}`);
          const newDashboardData = parseDashboardSheet(workbook.Sheets[firstSheetName]);
          console.log('[ExcelParser] Dashboard data parsed result:', newDashboardData);
          contextSetters.setDashboardServiceSections(newDashboardData);
          toast({ title: "Dashboard Data Parsed (Sheet 1)", description: `Found ${newDashboardData.length} service sections.`});
        } else {
          console.log("[ExcelParser] First sheet for dashboard not found.");
          contextSetters.setDashboardServiceSections([]);
           toast({ variant: "default", title: "File Info", description: "First sheet (for dashboard data) not found or not parsable." });
        }


        const thirdSheetName = workbook.SheetNames[2];
        const newRouteDataLocal: ExcelRoute[] = [];
        if (thirdSheetName) {
            const thirdSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[thirdSheetName], { header: 1 });
            const thirdSheetDataToParse = (thirdSheetRawData.length > 0 && Array.isArray(thirdSheetRawData[0]) && thirdSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? thirdSheetRawData.slice(1) : thirdSheetRawData;
            thirdSheetDataToParse.forEach(row => {
              if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
              const originCellVal = row[1] as string | undefined;
              const destCellVal = row[2] as string | undefined;
              const seaLineCellVal = row[3] as string | undefined;
              const price20DCCellVal = row[4];
              const price40HCCellVal = row[5];
              const seaCommentCellVal = row[8] as string | undefined;

              const currentOrigins = parsePortsCell(originCellVal, false);
              const currentDestinations = parsePortsCell(destCellVal, true);
              const currentSeaLines = parseSeaLinesCell(seaLineCellVal);
              const price20DC = parsePriceCell(price20DCCellVal);
              const price40HC = parsePriceCell(price40HCCellVal);
              const seaComment = String(seaCommentCellVal || '').trim();

              currentOrigins.forEach(p => allUniqueOrigins.add(p));
              currentDestinations.forEach(p => allUniqueSeaDestinationsMaster.add(p));

              if (currentOrigins.length > 0 && currentDestinations.length > 0) {
                newRouteDataLocal.push({
                  originPorts: currentOrigins,
                  destinationPorts: currentDestinations,
                  seaLines: currentSeaLines,
                  price20DC: price20DC,
                  price40HC: price40HC,
                  seaComment: seaComment,
                });
              }
            });
            contextSetters.setExcelRouteData(newRouteDataLocal);
            toast({ title: "COC Sea Routes Loaded (Sheet 3)", description: "Found " + newRouteDataLocal.length + " COC sea route entries."});
        } else {
            contextSetters.setExcelRouteData([]);
            toast({ variant: "destructive", title: "File Error", description: "Third sheet (for COC sea routes) not found." });
        }

        const secondSheetName = workbook.SheetNames[1];
        const newSOCRouteDataLocal: ExcelSOCRoute[] = [];
        if (secondSheetName) {
            const secondSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[secondSheetName], { header: 1 });
            const secondSheetDataToParse = (secondSheetRawData.length > 0 && Array.isArray(secondSheetRawData[0]) && secondSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? secondSheetRawData.slice(1) : secondSheetRawData;
            secondSheetDataToParse.forEach(row => {
              if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;

              const depPortsCellVal = row[1] as string | undefined;
              const destPortsCellVal = row[2] as string | undefined;
              const seaLineCellVal = row[3] as string | undefined;
              const price20DCCellVal = row[4];
              const price40HCCellVal = row[5];
              const socCommentCellVal = row[8] as string | undefined;

              const currentDeparturePorts = parsePortsCell(depPortsCellVal, false);
              const currentDestinations = parsePortsCell(destPortsCellVal, true);
              const currentSeaLines = parseSeaLinesCell(seaLineCellVal);
              const price20DC = parsePriceCell(price20DCCellVal);
              const price40HC = parsePriceCell(price40HCCellVal);
              const socComment = String(socCommentCellVal || '').trim();

              currentDeparturePorts.forEach(p => allUniqueOrigins.add(p));
              currentDestinations.forEach(p => allUniqueSeaDestinationsMaster.add(p));

              if (currentDeparturePorts.length > 0 && currentDestinations.length > 0) {
                newSOCRouteDataLocal.push({
                  departurePorts: currentDeparturePorts,
                  destinationPorts: currentDestinations,
                  seaLines: currentSeaLines,
                  price20DC: price20DC,
                  price40HC: price40HC,
                  socComment: socComment,
                });
              }
            });
            contextSetters.setExcelSOCRouteData(newSOCRouteDataLocal);
            toast({ title: "SOC Sea Routes Loaded (Sheet 2)", description: "Found " + newSOCRouteDataLocal.length + " SOC sea route entries." });
        } else {
            contextSetters.setExcelSOCRouteData([]);
            toast({ variant: "destructive", title: "File Error", description: "Second sheet (for SOC sea routes) not found." });
        }

        contextSetters.setExcelOriginPorts(Array.from(allUniqueOrigins).sort());
        contextSetters.setExcelDestinationPorts(Array.from(allUniqueSeaDestinationsMaster).sort((a,b) => {
            if (VLADIVOSTOK_VARIANTS.includes(a) && !VLADIVOSTOK_VARIANTS.includes(b)) return -1;
            if (!VLADIVOSTOK_VARIANTS.includes(a) && VLADIVOSTOK_VARIANTS.includes(b)) return 1;
            if (a === "Владивосток" && b !== "Владивосток") return -1;
            if (a !== "Владивосток" && b === "Владивосток") return 1;
            return a.localeCompare(b);
        }));

        const fourthSheetName = workbook.SheetNames[3];
        const newDropOffDataLocal: DropOffEntry[] = [];
        if (fourthSheetName) {
            const fourthSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[fourthSheetName], { header: 1 });
            const fourthSheetDataToParse = (fourthSheetRawData.length > 0 && Array.isArray(fourthSheetRawData[0]) && fourthSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? fourthSheetRawData.slice(1) : fourthSheetRawData;
            fourthSheetDataToParse.forEach(row => {
                if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
                const seaLine = String(row[0] || '').trim();
                const citiesCellVal = row[1] as string | undefined;
                const price20DC = parsePriceCell(row[2]); // Can return string, number or null
                const price40HC = parsePriceCell(row[3]); // Can return string, number or null
                const comment = String(row[5] || '').trim();

                const parsedCities = parseDropOffCitiesCell(citiesCellVal);

                if (seaLine && parsedCities.length > 0) {
                    newDropOffDataLocal.push({ seaLine, cities: parsedCities, price20DC, price40HC, comment });
                }
            });
            contextSetters.setExcelDropOffData(newDropOffDataLocal);
            toast({ title: "Drop Off Data Loaded (Sheet 4)", description: "Found " + newDropOffDataLocal.length + " drop-off entries." });
        } else {
            contextSetters.setExcelDropOffData([]);
            toast({ variant: "default", title: "File Info", description: "Fourth sheet (for drop-off data) not found." });
        }

        const fifthSheetName = workbook.SheetNames[4];
        const newRailDataLocal: ContextRailDataEntry[] = [];
        const uniqueRussianCitiesFromSheet = new Set<string>();
        if (fifthSheetName) {
          const fifthSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[fifthSheetName], { header: 1 });
          const fifthSheetDataToParse = (fifthSheetRawData.length > 0 && Array.isArray(fifthSheetRawData[0]) && fifthSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? fifthSheetRawData.slice(1) : fifthSheetRawData;
          fifthSheetDataToParse.forEach(row => {
             if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
            const departureStationCellVal = row[1] as string | undefined;
            const arrivalStationCellVal = row[2] as string | undefined;
            const cityOfArrivalCellVal = row[11] as string | undefined;

            const parsedDepartureStations = parseRailStationsCell(departureStationCellVal);
            const parsedArrivalStations = parseRailStationsCell(arrivalStationCellVal);
            const cityOfArrival = String(cityOfArrivalCellVal || '').trim();

            if (parsedDepartureStations.length > 0 && cityOfArrival && parsedArrivalStations.length > 0) {
              newRailDataLocal.push({
                departureStations: parsedDepartureStations,
                arrivalStations: parsedArrivalStations,
                cityOfArrival: cityOfArrival,
                price20DC_24t: parsePriceCell(row[3]) as number | null,
                guardCost20DC: parsePriceCell(row[4]) as number | null,
                price20DC_28t: parsePriceCell(row[5]) as number | null,
                price40HC: parsePriceCell(row[6]) as number | null,
                guardCost40HC: parsePriceCell(row[7]) as number | null,
              });
              if (cityOfArrival) uniqueRussianCitiesFromSheet.add(cityOfArrival);
            }
          });
          contextSetters.setExcelRailData(newRailDataLocal);
          contextSetters.setExcelRussianDestinationCitiesMasterList(Array.from(uniqueRussianCitiesFromSheet).sort());
          toast({ title: "Rail Data Loaded (Sheet 5)", description: "Found " + uniqueRussianCitiesFromSheet.size + " Russian cities & " + newRailDataLocal.length + " rail prices." });
        } else {
          contextSetters.setExcelRailData([]);
          contextSetters.setExcelRussianDestinationCitiesMasterList([]);
          toast({ variant: "default", title: "File Info", description: "Fifth sheet (for rail data) not found." });
        }

        contextSetters.setIsSeaRailExcelDataLoaded(true);
        console.log("[ExcelParser] setIsSeaRailExcelDataLoaded set to true after parsing all Sea+Rail sheets.");
        setHasRestoredFromCacheState(false); // Important: Reset this AFTER data loading and initial form reset based on data
        toast({ title: "Море + Ж/Д Excel Processed", description: "All relevant sheets parsed."});

      } catch (parseError) {
        console.error("Error parsing Sea+Rail Excel:", parseError);
        contextSetters.setIsSeaRailExcelDataLoaded(false);
        toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse Sea+Rail Excel. Check sheet format."});
      } finally {
        setIsParsingState(false);
        console.log("[ExcelParser] handleSeaRailFileParse finished.");
      }
    } else if (typeof XLSX === 'undefined') {
        toast({ variant: "destructive", title: "Setup Incomplete", description: "XLSX library not available."});
        setIsParsingState(false);
        contextSetters.setIsSeaRailExcelDataLoaded(false);
    }
  };
  reader.onerror = () => {
    toast({ variant: "destructive", title: "File Error", description: "Could not read Sea+Rail file." });
    setIsParsingState(false);
    contextSetters.setIsSeaRailExcelDataLoaded(false);
  };
  reader.readAsArrayBuffer(file);
  if (fileInputRef.current) fileInputRef.current.value = "";
}


export async function handleDirectRailFileParse(args: ExcelParserArgsBase) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState } = args;

  console.log("[ExcelParser] handleDirectRailFileParse started for file:", file?.name);
  setIsParsingState(true);
  setShippingInfoState(null);
  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedFormValues(null); // Clear cached form values for the other mode
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false);

  contextSetters.setExcelDirectRailData([]);
  contextSetters.setDirectRailAgents([]);
  contextSetters.setDirectRailDepartureCities([]);
  contextSetters.setDirectRailDestinationCitiesDR([]);
  contextSetters.setDirectRailIncotermsList([]);
  contextSetters.setDirectRailBordersList([]);
  contextSetters.setIsDirectRailExcelDataLoaded(false);

  const currentValues = form.getValues();
  form.reset({
    ...currentValues,
    directRailAgentName: "",
    directRailCityOfDeparture: "",
    directRailDestinationCityDR: "",
    directRailIncoterms: "",
    directRailBorder: "",
  });

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const newDirectRailDataLocal: DirectRailEntry[] = [];
        const uniqueAgents = new Set<string>();
        const uniqueDepCities = new Set<string>();
        const uniqueDestCitiesDR = new Set<string>();
        const uniqueIncoterms = new Set<string>();
        const uniqueBorders = new Set<string>();

        if (firstSheetName) {
          const sheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheetName], { header: 1 });
          const sheetDataToParse = (sheetRawData.length > 0 && Array.isArray(sheetRawData[0]) && sheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? sheetRawData.slice(1) : sheetRawData;
          sheetDataToParse.forEach(row => {
            if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
            const entry: DirectRailEntry = {
              agentName: String(row[0] || '').trim(), cityOfDeparture: String(row[1] || '').trim(),
              departureStation: String(row[2] || '').trim(), border: String(row[3] || '').trim(),
              destinationCity: String(row[4] || '').trim(), incoterms: String(row[5] || '').trim(),
              price: parsePriceCell(row[6]) as number | null,
              etd: String(row[7] || '').trim(), commentary: String(row[8] || '').trim(),
            };
            if (entry.agentName) uniqueAgents.add(entry.agentName);
            if (entry.cityOfDeparture) uniqueDepCities.add(entry.cityOfDeparture);
            if (entry.destinationCity) uniqueDestCitiesDR.add(entry.destinationCity);
            if (entry.incoterms) uniqueIncoterms.add(entry.incoterms);
            if (entry.border) uniqueBorders.add(entry.border);
            if (entry.agentName && entry.cityOfDeparture && entry.destinationCity && entry.incoterms && entry.border) {
              newDirectRailDataLocal.push(entry);
            }
          });
          contextSetters.setExcelDirectRailData(newDirectRailDataLocal);
          contextSetters.setDirectRailAgents(Array.from(uniqueAgents).sort());
          contextSetters.setDirectRailDepartureCities(Array.from(uniqueDepCities).sort());
          contextSetters.setDirectRailDestinationCitiesDR(Array.from(uniqueDestCitiesDR).sort());
          contextSetters.setDirectRailIncotermsList(Array.from(uniqueIncoterms).sort());
          contextSetters.setDirectRailBordersList(Array.from(uniqueBorders).sort());
          contextSetters.setIsDirectRailExcelDataLoaded(true);
          setHasRestoredFromCacheState(false); // Important: Reset this AFTER data loading
          toast({ title: "Прямое ЖД Excel Processed", description: "Found " + newDirectRailDataLocal.length + " entries." });
        } else {
          contextSetters.setIsDirectRailExcelDataLoaded(false);
          toast({ variant: "destructive", title: "File Error", description: "First sheet (Direct Rail) not found." });
        }
      } catch (parseError) {
        console.error("Error parsing Direct Rail Excel:", parseError);
        contextSetters.setIsDirectRailExcelDataLoaded(false);
        toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse Direct Rail Excel."});
      } finally {
        setIsParsingState(false);
        console.log("[ExcelParser] handleDirectRailFileParse finished.");
      }
    } else if (typeof XLSX === 'undefined') {
        toast({ variant: "destructive", title: "Setup Incomplete", description: "XLSX library not available."});
        setIsParsingState(false);
        contextSetters.setIsDirectRailExcelDataLoaded(false);
    }
  };
  reader.onerror = () => {
    toast({ variant: "destructive", title: "File Error", description: "Could not read Direct Rail file." });
    setIsParsingState(false);
    contextSetters.setIsDirectRailExcelDataLoaded(false);
  };
  reader.readAsArrayBuffer(file);
  if (fileInputRef.current) fileInputRef.current.value = "";
}
