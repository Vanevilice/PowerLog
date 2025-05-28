
import * as XLSX from 'xlsx';
import type { UseFormReturn } from 'react-hook-form';
import type {
  ExcelRoute,
  ExcelSOCRoute,
  RailDataEntry as ContextRailDataEntry, // Renamed to avoid conflict
  DropOffEntry,
  DirectRailEntry,
  RouteFormValues,
  ShipmentType,
  PricingDataContextType,
} from '@/types'; // Adjust if types are moved
import { useToast } from '@/hooks/use-toast'; // Assuming useToast is accessible
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';

// Helper parsing functions (moved from original component)
export function parsePortsCell(cellValue: string | undefined, isDestination: boolean): string[] {
  if (!cellValue) return [];
  const ports = new Set<string>();
  const cellString = String(cellValue).trim();
  const entries = cellString.split(/\/(?![^(]*\))/g);
  const destPortPattern = /([^\/(]+)\s*\(([^)]+)\)/;

  entries.forEach(entry => {
    entry = entry.trim();
    if (!entry) return;
    if (isDestination) {
      const match = entry.match(destPortPattern);
      if (match) {
        const baseName = match[1].trim();
        const subPortsString = match[2];
        subPortsString.split('/').map(p => p.trim()).forEach(subPort => {
          if (subPort) ports.add(\`\${baseName} (\${subPort})\`);
        });
        if (!subPortsString && baseName) {
           ports.add(baseName);
        }
      } else {
        ports.add(entry);
      }
    } else {
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

interface ExcelParserArgs {
  file: File;
  form: UseFormReturn<RouteFormValues>;
  contextSetters: Pick<
    PricingDataContextType,
    | 'setExcelRouteData' | 'setExcelSOCRouteData' | 'setExcelRailData' | 'setExcelDropOffData'
    | 'setExcelDirectRailData' | 'setIsSeaRailExcelDataLoaded' | 'setIsDirectRailExcelDataLoaded'
    | 'setExcelOriginPorts' | 'setExcelDestinationPorts' | 'setExcelRussianDestinationCitiesMasterList'
    | 'setDirectRailAgents' | 'setDirectRailDepartureCities' | 'setDirectRailDestinationCitiesDR'
    | 'setDirectRailIncotermsList' | 'setDirectRailBordersList'
    | 'setCachedShippingInfo' | 'setCachedFormValues' | 'setCachedLastSuccessfulCalculation'
    | 'setBestPriceResults'
  >;
  setShippingInfoState: (info: any | null) => void; // From component's useState
  setHasRestoredFromCacheState: (flag: boolean) => void; // From component's useState
  toast: ReturnType<typeof useToast>['toast'];
  fileInputRef: React.RefObject<HTMLInputElement>;
}

// Sea + Rail Excel Processing
export async function handleSeaRailFileParse(args: ExcelParserArgs & {
    setIsParsingState: (isParsing: boolean) => void;
}) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState } = args;
  
  setIsParsingState(true);
  setShippingInfoState(null);
  contextSetters.setBestPriceResults(null);
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
  contextSetters.setIsSeaRailExcelDataLoaded(false);
  
  form.reset({
    ...form.getValues(),
    shipmentType: "COC" as ShipmentType,
    originPort: "",
    destinationPort: "",
    seaLineCompany: NONE_SEALINE_VALUE,
    containerType: undefined,
    russianDestinationCity: "",
    arrivalStationSelection: "",
    // Keep margins if they were set
    seaMargin: form.getValues('seaMargin'),
    railMargin: form.getValues('railMargin'),
  });

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const allUniqueOrigins = new Set<string>();
        const allUniqueSeaDestinationsMaster = new Set<string>();

        // COC Data (Sheet 3)
        const thirdSheetName = workbook.SheetNames[2];
        const newRouteDataLocal: ExcelRoute[] = [];
        if (thirdSheetName) {
            const thirdSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[thirdSheetName], { header: 1 });
            const thirdSheetDataToParse = (thirdSheetRawData.length > 0 && Array.isArray(thirdSheetRawData[0]) && thirdSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? thirdSheetRawData.slice(1) : thirdSheetRawData;
            thirdSheetDataToParse.forEach(row => {
              if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
              const currentOrigins = parsePortsCell(row[1] as string | undefined, false);
              const currentDestinations = parsePortsCell(row[2] as string | undefined, true);
              currentOrigins.forEach(p => allUniqueOrigins.add(p));
              currentDestinations.forEach(p => allUniqueSeaDestinationsMaster.add(p));
              if (currentOrigins.length > 0 && currentDestinations.length > 0) {
                newRouteDataLocal.push({
                  originPorts: currentOrigins,
                  destinationPorts: currentDestinations,
                  seaLines: parseSeaLinesCell(row[3] as string | undefined),
                  price20DC: parsePriceCell(row[4]),
                  price40HC: parsePriceCell(row[5]),
                  seaComment: String(row[8] || '').trim(),
                });
              }
            });
            contextSetters.setExcelRouteData(newRouteDataLocal);
            toast({ title: "COC Sea Routes Loaded", description: \`Found \${newRouteDataLocal.length} entries.\`});
        } else {
            toast({ variant: "destructive", title: "File Error", description: "Sheet 3 (COC sea routes) not found." });
        }

        // SOC Data (Sheet 2)
        const secondSheetName = workbook.SheetNames[1];
        const newSOCRouteDataLocal: ExcelSOCRoute[] = [];
        if (secondSheetName) {
            const secondSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[secondSheetName], { header: 1 });
            const secondSheetDataToParse = (secondSheetRawData.length > 0 && Array.isArray(secondSheetRawData[0]) && secondSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? secondSheetRawData.slice(1) : secondSheetRawData;
            secondSheetDataToParse.forEach(row => {
              if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
              const currentDeparturePorts = parsePortsCell(row[1] as string | undefined, false);
              const currentDestinations = parsePortsCell(row[2] as string | undefined, true);
              currentDeparturePorts.forEach(p => allUniqueOrigins.add(p));
              currentDestinations.forEach(p => allUniqueSeaDestinationsMaster.add(p));
              if (currentDeparturePorts.length > 0 && currentDestinations.length > 0) {
                newSOCRouteDataLocal.push({
                  departurePorts: currentDeparturePorts,
                  destinationPorts: currentDestinations,
                  seaLines: parseSeaLinesCell(row[3] as string | undefined),
                  price20DC: parsePriceCell(row[4]),
                  price40HC: parsePriceCell(row[5]),
                  socComment: String(row[8] || '').trim(),
                });
              }
            });
            contextSetters.setExcelSOCRouteData(newSOCRouteDataLocal);
            toast({ title: "SOC Sea Routes Loaded", description: \`Found \${newSOCRouteDataLocal.length} entries.\` });
        } else {
            toast({ variant: "destructive", title: "File Error", description: "Sheet 2 (SOC sea routes) not found." });
        }

        contextSetters.setExcelOriginPorts(Array.from(allUniqueOrigins).sort());
        contextSetters.setExcelDestinationPorts(Array.from(allUniqueSeaDestinationsMaster).sort((a,b) => {
            if (VLADIVOSTOK_VARIANTS.includes(a) && !VLADIVOSTOK_VARIANTS.includes(b)) return -1;
            if (!VLADIVOSTOK_VARIANTS.includes(a) && VLADIVOSTOK_VARIANTS.includes(b)) return 1;
            return a.localeCompare(b);
        }));

        // Drop Off Data (Sheet 4)
        const fourthSheetName = workbook.SheetNames[3];
        const newDropOffDataLocal: DropOffEntry[] = [];
        if (fourthSheetName) {
            const fourthSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[fourthSheetName], { header: 1 });
            const fourthSheetDataToParse = (fourthSheetRawData.length > 0 && Array.isArray(fourthSheetRawData[0]) && fourthSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? fourthSheetRawData.slice(1) : fourthSheetRawData;
            fourthSheetDataToParse.forEach(row => {
                if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
                const seaLine = String(row[0] || '').trim();
                const parsedCities = parseDropOffCitiesCell(row[1] as string | undefined);
                if (seaLine && parsedCities.length > 0) {
                    newDropOffDataLocal.push({ seaLine, cities: parsedCities, price20DC: parsePriceCell(row[2]), price40HC: parsePriceCell(row[3]), comment: String(row[5] || '').trim() });
                }
            });
            contextSetters.setExcelDropOffData(newDropOffDataLocal);
            toast({ title: "Drop Off Data Loaded", description: \`Found \${newDropOffDataLocal.length} entries.\` });
        } else {
            toast({ variant: "default", title: "File Info", description: "Sheet 4 (drop-off) not found." });
        }

        // Rail Data (Sheet 5)
        const fifthSheetName = workbook.SheetNames[4];
        const newRailDataLocal: ContextRailDataEntry[] = [];
        const uniqueRussianCitiesFromSheet = new Set<string>();
        if (fifthSheetName) {
          const fifthSheetRawData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[fifthSheetName], { header: 1 });
          const fifthSheetDataToParse = (fifthSheetRawData.length > 0 && Array.isArray(fifthSheetRawData[0]) && fifthSheetRawData[0].some(cell => typeof cell === 'string' && String(cell).trim().length > 0)) ? fifthSheetRawData.slice(1) : fifthSheetRawData;
          fifthSheetDataToParse.forEach(row => {
             if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) return;
            const parsedDepartureStations = parseRailStationsCell(row[1] as string | undefined);
            const parsedArrivalStations = parseRailStationsCell(row[2] as string | undefined);
            const cityOfArrival = String(row[11] || '').trim();
            if (parsedDepartureStations.length > 0 && cityOfArrival && parsedArrivalStations.length > 0) {
              newRailDataLocal.push({
                departureStations: parsedDepartureStations, arrivalStations: parsedArrivalStations, cityOfArrival: cityOfArrival,
                price20DC_24t: parsePriceCell(row[3]), guardCost20DC: parsePriceCell(row[4]), price20DC_28t: parsePriceCell(row[5]),
                price40HC: parsePriceCell(row[6]), guardCost40HC: parsePriceCell(row[7]),
              });
              if (cityOfArrival) uniqueRussianCitiesFromSheet.add(cityOfArrival);
            }
          });
          contextSetters.setExcelRailData(newRailDataLocal);
          contextSetters.setExcelRussianDestinationCitiesMasterList(Array.from(uniqueRussianCitiesFromSheet).sort());
          toast({ title: "Rail Data Loaded", description: \`Found \${uniqueRussianCitiesFromSheet.size} Russian cities & \${newRailDataLocal.length} rail prices.\` });
        } else {
          toast({ variant: "default", title: "File Info", description: "Sheet 5 (rail data) not found." });
        }

        contextSetters.setIsSeaRailExcelDataLoaded(true);
        setHasRestoredFromCacheState(false);
        toast({ title: "Море + Ж/Д Excel Processed", description: "All relevant sheets parsed."});
      } catch (parseError) {
        console.error("Error parsing Sea+Rail Excel:", parseError);
        contextSetters.setIsSeaRailExcelDataLoaded(false);
        toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse Sea+Rail Excel."});
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


// Direct Rail Excel Processing
export async function handleDirectRailFileParse(args: ExcelParserArgs & {
    setIsParsingState: (isParsing: boolean) => void;
}) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState } = args;
  
  setIsParsingState(true);
  setShippingInfoState(null);
  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false);

  contextSetters.setExcelDirectRailData([]);
  contextSetters.setDirectRailAgents([]);
  contextSetters.setDirectRailDepartureCities([]);
  contextSetters.setDirectRailDestinationCitiesDR([]);
  contextSetters.setDirectRailIncotermsList([]);
  contextSetters.setDirectRailBordersList([]);
  contextSetters.setIsDirectRailExcelDataLoaded(false);

  form.reset({
    ...form.getValues(),
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
          toast({ title: "Прямое ЖД Excel Processed", description: \`Found \${newDirectRailDataLocal.length} entries.\` });
        } else {
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
