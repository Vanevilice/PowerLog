
import * as XLSX from 'xlsx';
import type { UseFormReturn } from 'react-hook-form';
import type {
  ExcelRoute, ExcelSOCRoute, RailDataEntry as ContextRailDataEntry, DropOffEntry, DirectRailEntry,
  RouteFormValues, PricingDataContextType, CombinedAiOutput,
  DashboardServiceSection, DashboardServiceDataRow
} from '@/types';
import type { useToast } from '@/hooks/use-toast';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';


export function formatDashboardRate(rateString: string | number | undefined): string {
  if (rateString === null || rateString === undefined) return 'N/A';
  let sValue = String(rateString).trim();
  if (sValue === "") return 'N/A';

  let currencySymbolDetected: 'USD' | 'RUB' | null = null;
  let numberString = sValue;

  if (sValue.includes('$')) {
    currencySymbolDetected = "USD";
    numberString = sValue.replace(/\$/g, '').trim();
  } else if (sValue.toLowerCase().includes('rub') || sValue.includes('₽')) {
    currencySymbolDetected = "RUB";
    numberString = sValue.replace(/rub|₽/gi, '').trim();
  }
  
  // Clean up the number string further
  numberString = numberString.replace(/\s/g, '').replace(',', '.');
  // Remove .00 or .0 if they are the only decimals
  numberString = numberString.replace(/\.(0+|0)$/, ''); 
  // Also handle cases where it might be just .- (e.g. from "1000.-")
  numberString = numberString.replace(/\.-$/, '');


  const num = parseFloat(numberString);

  if (!isNaN(num)) {
    let finalCurrency: 'USD' | 'RUB';
    if (currencySymbolDetected) {
      finalCurrency = currencySymbolDetected;
    } else {
      // Heuristic based on number of digits (only if no symbol was found)
      const integerPart = String(Math.trunc(num));
      if (integerPart.length > 4) {
        finalCurrency = "RUB";
      } else {
        finalCurrency = "USD";
      }
    }
    const formattedNum = num.toLocaleString('fr-FR', {
      minimumFractionDigits: (num % 1 === 0) ? 0 : 2, 
      maximumFractionDigits: 2 
    }).replace(',', '.'); // Ensure dot as decimal separator for consistency after fr-FR formatting
    return `${formattedNum} ${finalCurrency}`;
  }
  return sValue; // Return original if not a number (e.g., "Market price")
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  console.log("[ExcelParser Dashboard] Raw data from dashboard sheet (first 10 rows):", JSON.parse(JSON.stringify(rawData.slice(0, 10))));

  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let lastPotentialHeader: string | null = null;

  rawData.forEach((rowArray, rowIndex) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // Blank line, signifies end of current section
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[ExcelParser Dashboard] Pushing section (due to blank line): ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
        parsedSections.push(currentSection);
      }
      currentSection = null;
      lastPotentialHeader = null; 
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCell = rowArray[1]; // Rate (Column B)
    const thirdCell = String(rowArray[2] || '').trim(); // Container Info (Column C)
    const fourthCell = String(rowArray[3] || '').trim(); // Additional Comment / CY indicator (Column D)

    const isFOBorFIRow = (firstCell.toUpperCase().startsWith("FOB") || firstCell.toUpperCase().startsWith("FI")) && 
                         (secondCell !== null && secondCell !== undefined && String(secondCell).trim() !== "");
    const isCYRow = fourthCell.toUpperCase().startsWith("CY");

    if (isCYRow) {
      if (currentSection && currentSection.dataRows.length > 0) {
        const lastFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        lastFobRow.railwayCost = formatDashboardRate(secondCell); // Default RUB if no symbol detected
        lastFobRow.railwayContainerInfo = thirdCell || 'N/A';
        lastFobRow.railwayComment = fourthCell.substring(2).trim().replace(/^[:\s]+/, '') || '-';
        console.log(`[ExcelParser Dashboard] Augmented FOB/FI row: ${lastFobRow.route} with CY data. RailwayCost: ${lastFobRow.railwayCost}`);
      } else {
        console.warn(`[ExcelParser Dashboard] Found CY row at index ${rowIndex} but no current section or FOB/FI row to attach it to.`);
      }
    } else if (isFOBorFIRow) {
      if (!currentSection || (lastPotentialHeader && currentSection.serviceName.startsWith("Service Section"))) {
        // This FOB/FI row might be starting a new section, or using a previous potential header
        const serviceName = lastPotentialHeader || `Service Section ${parsedSections.length + 1}`;
        if (currentSection && currentSection.dataRows.length > 0 && currentSection.serviceName !== serviceName) {
          // Push old section if it had a different (placeholder) name and data
           console.log(`[ExcelParser Dashboard] Pushing previous section: ${currentSection.serviceName} before starting new one named: ${serviceName}`);
           parsedSections.push(currentSection);
        }
        currentSection = { serviceName, dataRows: [] };
        console.log(`[ExcelParser Dashboard] Started/Switched to section for FOB/FI row: ${serviceName}`);
        lastPotentialHeader = null; 
      }

      let containerTypeExtracted = 'N/A';
      let commentFromContainerCell = '';
      const containerInfoFull = String(thirdCell).trim();
      // Regex to find common container types
      const containerMatch = containerInfoFull.match(/^(20DC|40HC|20GP|40GP|20OT|40OT|20RF|40RF|ПОСУДА)/i);

      if (containerMatch && containerMatch[0]) {
        containerTypeExtracted = containerMatch[0].toUpperCase();
        commentFromContainerCell = containerInfoFull.substring(containerMatch[0].length).trim().replace(/^[:\s]+/, '');
      } else if (containerInfoFull) { 
        commentFromContainerCell = containerInfoFull; 
      }
      
      let finalAdditionalComment = String(fourthCell || '').trim();
      if (commentFromContainerCell) {
        finalAdditionalComment = finalAdditionalComment 
          ? `${commentFromContainerCell} | ${finalAdditionalComment}` 
          : commentFromContainerCell;
      }

      const dataRow: DashboardServiceDataRow = {
        route: firstCell, // Use the full string from firstCell
        rate: formatDashboardRate(secondCell),
        containerInfo: containerTypeExtracted,
        additionalComment: finalAdditionalComment || '-',
      };
      currentSection.dataRows.push(dataRow);
      console.log(`[ExcelParser Dashboard] Added FOB/FI row to section '${currentSection.serviceName}': ${dataRow.route}, Rate: ${dataRow.rate}, Container: ${dataRow.containerInfo}`);

    } else if (firstCell && !isFOBorFIRow && !isCYRow) { 
      // This looks like a service header line
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[ExcelParser Dashboard] Pushing section (new header found): ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
        parsedSections.push(currentSection);
      }
      currentSection = { serviceName: firstCell, dataRows: [] };
      console.log(`[ExcelParser Dashboard] Started new section from explicit header: ${firstCell}`);
      lastPotentialHeader = null; 
    } else if (firstCell && !currentSection) { 
        // Row has content in first cell, not FOB/CY, and no active section. Treat as potential header.
        lastPotentialHeader = firstCell;
        console.log(`[ExcelParser Dashboard] Stored potential header: ${firstCell}`);
    }
  });

  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[ExcelParser Dashboard] Pushing final section: ${currentSection.serviceName}, rows: ${currentSection.dataRows.length}`);
    parsedSections.push(currentSection);
  }
  console.log("[ExcelParser Dashboard] Total parsed dashboard sections:", parsedSections.length, "Sections:", parsedSections.map(s => s.serviceName));
  return parsedSections;
}


// Helper parsing functions (for calculator data)
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


export function parsePriceCell(cellValue: any): string | number | null { 
  if (cellValue === null || cellValue === undefined) return null;
  const sValueOriginal = String(cellValue).trim();
  if (sValueOriginal === "") return null;

  const sValueNumericCandidate = sValueOriginal.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(sValueNumericCandidate);

  if (!isNaN(num)) {
    return num;
  } else {
    // If not a number but original string was not empty, return original string
    // This handles cases like "$ 816/$ 1020" or "Market Price"
    return sValueOriginal;
  }
}


export interface ExcelParserArgsBase {
  file: File; // Expect File object directly
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

        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          console.log(`[ExcelParser] Attempting to parse dashboard data from sheet: ${firstSheetName}`);
          const newDashboardData = parseDashboardSheet(workbook.Sheets[firstSheetName]);
          console.log('[ExcelParser] Dashboard data parsed result (length):', newDashboardData.length);
          if (newDashboardData.length > 0) {
            console.log('[ExcelParser] First dashboard section name:', newDashboardData[0].serviceName);
          }
          contextSetters.setDashboardServiceSections(newDashboardData);
          if (newDashboardData.length > 0) {
            toast({ title: "Dashboard Data Parsed (Sheet 1)", description: `Found ${newDashboardData.length} service sections.`});
          } else {
            toast({ title: "Dashboard Data (Sheet 1)", description: "First sheet parsed, but no service sections found."});
          }
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
                const price20DC = parsePriceCell(row[2]); 
                const price40HC = parsePriceCell(row[3]); 
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
        setHasRestoredFromCacheState(false); 
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
  contextSetters.setCachedFormValues(null); 
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
          setHasRestoredFromCacheState(false);
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
