
// src/lib/pricing/form-file-handlers.ts
import * as XLSX from 'xlsx';
import type { UseFormReturn } from 'react-hook-form';
import type {
  ExcelRoute, ExcelSOCRoute, RailDataEntry as ContextRailDataEntry, DropOffEntry, DirectRailEntry,
  RouteFormValues, PricingDataContextType, CombinedAiOutput
} from '@/types';
import type { useToast } from '@/hooks/use-toast';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';
import { parseDashboardSheet } from '@/lib/dashboard/parser';
import {
  parsePortsCell, parseSeaLinesCell, parseRailStationsCell,
  parseDropOffCitiesCell, parsePriceCell
} from './excel-parser-utils';

export interface ExcelParserArgsBase {
  file: File;
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

  setIsParsingState(true);
  setShippingInfoState(null);
  setBestPriceResults(null); // Clear previous best price results

  // Clear cached values related to previous calculations or file loads
  contextSetters.setCachedShippingInfo(null);
  contextSetters.setCachedFormValues(null);
  contextSetters.setCachedLastSuccessfulCalculation(null);
  setHasRestoredFromCacheState(false); // Reset cache restoration flag

  // Reset context data related to Excel sheets
  contextSetters.setExcelRouteData([]);
  contextSetters.setExcelSOCRouteData([]);
  contextSetters.setExcelRailData([]);
  contextSetters.setExcelDropOffData([]);
  contextSetters.setExcelOriginPorts([]);
  contextSetters.setExcelDestinationPorts([]);
  contextSetters.setExcelRussianDestinationCitiesMasterList([]);
  contextSetters.setDashboardServiceSections([]);
  contextSetters.setIsSeaRailExcelDataLoaded(false);

  // Reset form fields specific to Sea+Rail mode
  const currentValues = form.getValues();
  form.reset({
    ...currentValues, // Preserve common fields like margins, direct rail values
    shipmentType: "COC", originPort: "", destinationPort: "", seaLineCompany: NONE_SEALINE_VALUE,
    containerType: undefined, russianDestinationCity: "", arrivalStationSelection: "",
    calculationModeToggle: "sea_plus_rail", // Explicitly set mode after Sea+Rail file load
  });
  contextSetters.setCalculationMode("sea_plus_rail"); // Also update context mode


  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const allUniqueOrigins = new Set<string>();
        const allUniqueSeaDestinationsMaster = new Set<string>();

        // Dashboard Data (Sheet 1)
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          const newDashboardData = parseDashboardSheet(workbook.Sheets[firstSheetName]);
          // Force a deep copy to ensure React sees a new object structure for state update
          const trulyNewDashboardData = JSON.parse(JSON.stringify(newDashboardData));
          contextSetters.setDashboardServiceSections(trulyNewDashboardData);
          if (newDashboardData.length > 0) {
            toast({ title: "Dashboard Data Parsed (Sheet 1)", description: `Found ${newDashboardData.length} service sections.`});
          } else {
            toast({ title: "Dashboard Data (Sheet 1)", description: "First sheet parsed, but no service sections found."});
          }
        } else {
          contextSetters.setDashboardServiceSections([]);
          toast({ variant: "default", title: "File Info", description: "First sheet (for dashboard data) not found or not parsable." });
        }

        // COC Data (Sheet 3, index 2)
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
                  originPorts: currentOrigins, destinationPorts: currentDestinations,
                  seaLines: parseSeaLinesCell(row[3] as string | undefined),
                  price20DC: parsePriceCell(row[4]), price40HC: parsePriceCell(row[5]),
                  seaComment: String(row[8] || '').trim(),
                });
              }
            });
            contextSetters.setExcelRouteData(newRouteDataLocal);
            toast({ title: "COC Sea Routes Loaded (Sheet 3)", description: `Found ${newRouteDataLocal.length} entries.`});
        } else {
            contextSetters.setExcelRouteData([]);
            toast({ variant: "destructive", title: "File Error", description: "Third sheet (COC sea routes) not found." });
        }

        // SOC Data (Sheet 2, index 1)
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
                  departurePorts: currentDeparturePorts, destinationPorts: currentDestinations,
                  seaLines: parseSeaLinesCell(row[3] as string | undefined),
                  price20DC: parsePriceCell(row[4]), price40HC: parsePriceCell(row[5]),
                  socComment: String(row[8] || '').trim(),
                });
              }
            });
            contextSetters.setExcelSOCRouteData(newSOCRouteDataLocal);
            toast({ title: "SOC Sea Routes Loaded (Sheet 2)", description: `Found ${newSOCRouteDataLocal.length} entries.` });
        } else {
            contextSetters.setExcelSOCRouteData([]);
            toast({ variant: "destructive", title: "File Error", description: "Second sheet (SOC sea routes) not found." });
        }

        contextSetters.setExcelOriginPorts(Array.from(allUniqueOrigins).sort());
        contextSetters.setExcelDestinationPorts(Array.from(allUniqueSeaDestinationsMaster).sort((a,b) => {
            if (VLADIVOSTOK_VARIANTS.includes(a) && !VLADIVOSTOK_VARIANTS.includes(b)) return -1;
            if (!VLADIVOSTOK_VARIANTS.includes(a) && VLADIVOSTOK_VARIANTS.includes(b)) return 1;
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
                const parsedCities = parseDropOffCitiesCell(row[1] as string | undefined);
                if (seaLine && parsedCities.length > 0) {
                    newDropOffDataLocal.push({ seaLine, cities: parsedCities, price20DC: parsePriceCell(row[2]), price40HC: parsePriceCell(row[3]), comment: String(row[5] || '').trim() });
                }
            });
            contextSetters.setExcelDropOffData(newDropOffDataLocal);
            toast({ title: "Drop Off Data Loaded (Sheet 4)", description: `Found ${newDropOffDataLocal.length} entries.` });
        } else {
            contextSetters.setExcelDropOffData([]);
            toast({ variant: "default", title: "File Info", description: "Fourth sheet (drop-off) not found." });
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
            const parsedDepartureStations = parseRailStationsCell(row[1] as string | undefined);
            const cityOfArrival = String(row[11] || '').trim();
            const parsedArrivalStations = parseRailStationsCell(row[2] as string | undefined);
            if (parsedDepartureStations.length > 0 && cityOfArrival && parsedArrivalStations.length > 0) {
              newRailDataLocal.push({
                departureStations: parsedDepartureStations, arrivalStations: parsedArrivalStations, cityOfArrival,
                price20DC_24t: parsePriceCell(row[3]) as number | null, guardCost20DC: parsePriceCell(row[4]) as number | null,
                price20DC_28t: parsePriceCell(row[5]) as number | null, price40HC: parsePriceCell(row[6]) as number | null,
                guardCost40HC: parsePriceCell(row[7]) as number | null,
              });
              if (cityOfArrival) uniqueRussianCitiesFromSheet.add(cityOfArrival);
            }
          });
          contextSetters.setExcelRailData(newRailDataLocal);
          contextSetters.setExcelRussianDestinationCitiesMasterList(Array.from(uniqueRussianCitiesFromSheet).sort());
          toast({ title: "Rail Data Loaded (Sheet 5)", description: `Found ${uniqueRussianCitiesFromSheet.size} cities & ${newRailDataLocal.length} prices.` });
        } else {
          contextSetters.setExcelRailData([]);
          contextSetters.setExcelRussianDestinationCitiesMasterList([]);
          toast({ variant: "default", title: "File Info", description: "Fifth sheet (rail data) not found." });
        }

        contextSetters.setIsSeaRailExcelDataLoaded(true);
        setHasRestoredFromCacheState(true);
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
  if (file) {
    reader.readAsArrayBuffer(file);
  } else {
    toast({ variant: "destructive", title: "File Error", description: "No file provided to Sea+Rail parser." });
    setIsParsingState(false);
    contextSetters.setIsSeaRailExcelDataLoaded(false);
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
}

export async function handleDirectRailFileParse(args: ExcelParserArgsBase) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState, setBestPriceResults } = args;

  setIsParsingState(true);
  setShippingInfoState(null);
  setBestPriceResults(null); // Clear previous best price results

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
    ...currentValues, // Preserve common fields and sea+rail fields
    directRailAgentName: "", directRailCityOfDeparture: "", directRailDestinationCityDR: "",
    directRailIncoterms: "", directRailBorder: "",
    calculationModeToggle: "direct_rail", // Explicitly set mode
  });
  contextSetters.setCalculationMode("direct_rail");


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
            // Only add if essential fields are present
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
          setHasRestoredFromCacheState(true);
          toast({ title: "Прямое ЖД Excel Processed", description: `Found ${newDirectRailDataLocal.length} entries.` });
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
  if (file) {
    reader.readAsArrayBuffer(file);
  } else {
    toast({ variant: "destructive", title: "File Error", description: "No file provided to Direct Rail parser." });
    setIsParsingState(false);
    contextSetters.setIsDirectRailExcelDataLoaded(false);
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
}


    