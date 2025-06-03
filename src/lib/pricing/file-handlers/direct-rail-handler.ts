// src/lib/pricing/file-handlers/direct-rail-handler.ts
import * as XLSX from 'xlsx';
import type { DirectRailEntry } from '@/types';
import type { ExcelParserArgsBase } from './types';
import { parsePriceCell } from '../excel-parser-utils';

export async function handleDirectRailFileParse(args: ExcelParserArgsBase) {
  const { file, form, contextSetters, setShippingInfoState, setHasRestoredFromCacheState, toast, fileInputRef, setIsParsingState, setBestPriceResults } = args;

  setIsParsingState(true);
  setShippingInfoState(null);
  setBestPriceResults(null);

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
    directRailAgentName: "", directRailCityOfDeparture: "", directRailDestinationCityDR: "",
    directRailIncoterms: "", directRailBorder: "",
    calculationModeToggle: "direct_rail",
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

        if (firstSheetName && workbook.Sheets[firstSheetName]) {
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
