
import * as XLSX from 'xlsx';
import type { UseFormReturn } from 'react-hook-form';
import type {
  ExcelRoute, ExcelSOCRoute, RailDataEntry as ContextRailDataEntry, DropOffEntry, DirectRailEntry,
  RouteFormValues, PricingDataContextType, SmartPricingOutput, PricingCommentaryOutput, // Using consolidated types
} from '@/types';
import type { useToast } from '@/hooks/use-toast';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';

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


export function parsePriceCell(cellValue: any): number | null {
  const num = parseFloat(String(cellValue).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

interface ExcelParserArgsBase {
  file: File; // Changed from event to file
  form: UseFormReturn<RouteFormValues>;
  contextSetters: PricingDataContextType;
  setShippingInfoState: (info: SmartPricingOutput | PricingCommentaryOutput | null) => void;
  setHasRestoredFromCacheState: (flag: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
  fileInputRef: React.RefObject<HTMLInputElement>;
  setIsParsingState: (isParsing: boolean) => void;
  setBestPriceResults: PricingDataContextType['setBestPriceResults'];
}


export async function handleSeaRailFileParse(args: ExcelParserArgsBase) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState, setBestPriceResults } = args;

  if (!file) { // Secondary guard, primary guard is now in PortPriceFinderForm
    toast({ variant: "destructive", title: "File Error", description: "No file provided to parser." });
    setIsParsingState(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return;
  }

  setIsParsingState(true);
  setShippingInfoState(null);
  setBestPriceResults(null); // Clear previous best price results

  // Reset context states related to Excel data
  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedFormValues(null);
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false); // Important to reset this for subsequent uploads

  contextSetters.setExcelRouteData([]);
  contextSetters.setExcelSOCRouteData([]);
  contextSetters.setExcelRailData([]);
  contextSetters.setExcelDropOffData([]);
  contextSetters.setExcelOriginPorts([]);
  contextSetters.setExcelDestinationPorts([]); // Use the context setter
  // localAvailableDestinationPorts will be updated by effects
  contextSetters.setExcelRussianDestinationCitiesMasterList([]);
  // localAvailableRussianDestinationCities, localAvailableSeaLines, localAvailableArrivalStations are local UI states, reset via effects or form reset

  contextSetters.setIsSeaRailExcelDataLoaded(false);

  // Reset relevant form fields for sea+rail mode
  // Preserve margins and other mode's values if they exist
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
    // seaMargin and railMargin are preserved from currentValues
    // Direct rail fields are also preserved from currentValues
  });


  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const allUniqueOrigins = new Set<string>();
        const allUniqueSeaDestinationsMaster = new Set<string>();

        // COC Data (Sheet 3, index 2)
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

        // SOC Data (Sheet 2, index 1)
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

        // Drop Off Data (Sheet 4, index 3)
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

        // Rail Data (Sheet 5, index 4)
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
                price20DC_24t: parsePriceCell(row[3]),
                guardCost20DC: parsePriceCell(row[4]),
                price20DC_28t: parsePriceCell(row[5]),
                price40HC: parsePriceCell(row[6]),
                guardCost40HC: parsePriceCell(row[7]),
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
        setHasRestoredFromCacheState(false); // Ensure effects re-run for newly loaded data
        toast({ title: "Море + Ж/Д Excel Processed", description: "All relevant sheets parsed."});
      } catch (parseError) {
        console.error("Error parsing Sea+Rail Excel:", parseError);
        contextSetters.setIsSeaRailExcelDataLoaded(false);
        toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse Sea+Rail Excel. Check sheet format."});
      } finally {
        setIsParsingState(false);
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

  if (!file) { // Secondary guard
    toast({ variant: "destructive", title: "File Error", description: "No file provided to parser." });
    setIsParsingState(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return;
  }

  setIsParsingState(true);
  setShippingInfoState(null);
  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedFormValues(null); // Also clear form cache if needed
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false);

  // Clear previous Direct Rail data
  contextSetters.setExcelDirectRailData([]);
  contextSetters.setDirectRailAgents([]);
  contextSetters.setDirectRailDepartureCities([]);
  contextSetters.setDirectRailDestinationCitiesDR([]);
  contextSetters.setDirectRailIncotermsList([]);
  contextSetters.setDirectRailBordersList([]);
  contextSetters.setIsDirectRailExcelDataLoaded(false);

  // Reset direct rail form fields
  const currentValues = form.getValues();
  form.reset({
    ...currentValues,
    directRailAgentName: "",
    directRailCityOfDeparture: "",
    directRailDestinationCityDR: "",
    directRailIncoterms: "",
    directRailBorder: "",
    // Sea+Rail and margin fields are preserved from currentValues
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
              price: parsePriceCell(row[6]), etd: String(row[7] || '').trim(), commentary: String(row[8] || '').trim(),
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
