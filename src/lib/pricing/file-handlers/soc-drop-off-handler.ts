
// src/lib/pricing/file-handlers/soc-drop-off-handler.ts
import * as XLSX from 'xlsx';
import type { ExcelSOCDropOffEntry } from '@/types';
import { normalizeCityName } from '../utils';
import { parsePriceCell } from '../excel-parser-utils';
import type { ExcelParserArgsBase } from './types';

export async function handleSOCDropOffFileParse(args: ExcelParserArgsBase) {
  const { file, contextSetters, toast, fileInputRef, setIsParsingState, setHasRestoredFromCacheState } = args;

  setIsParsingState(true);
  let parsedSuccessfullyWithData = false;
  contextSetters.setExcelSOCDropOffData([]);
  contextSetters.setIsSOCDropOffExcelDataLoaded(false); // Initialize before parsing

  // Note: setHasRestoredFromCacheState is destructured but intentionally NOT called here.
  // Cache restoration state is managed by the primary file handlers (sea-rail, direct-rail).

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result;
    if (arrayBuffer && typeof XLSX !== 'undefined') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const newSOCDropOffDataLocal: ExcelSOCDropOffEntry[] = [];

        if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
          toast({ variant: "destructive", title: "File Error", description: "First sheet (SOC Drop-off) not found." });
          setIsParsingState(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const excelData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheetName], { header: 1, defval: null });

        // Excel Row 1: Drop-off City names (merged cells), Excel Row 2: Container Types
        if (excelData.length < 2) {
          toast({ title: "SOC Drop-off File Error", description: "File has fewer than 2 rows for headers.", variant: "destructive" });
          setIsParsingState(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const dropOffCityHeaderRow = excelData[0]; // Original Excel Row 1
        const containerTypeHeaderRow = excelData[1]; // Original Excel Row 2

        // Map: NormalizedDropOffCityName -> { "20DC_ColIndex": number, "40HC_ColIndex": number } (absolute indices)
        const dropOffCityMap: { [normalizedCityName: string]: { "20DC_ColIndex": number, "40HC_ColIndex": number } } = {};

        // Iterate through header row (Excel Row 1, Drop-off City Names) starting from original Column C (index 2)
        for (let j = 2; j < dropOffCityHeaderRow.length; ) {
          const cityCellRaw = String(dropOffCityHeaderRow[j] || '').trim();
          const normalizedCityName = normalizeCityName(cityCellRaw);

          if (normalizedCityName && !(normalizedCityName in dropOffCityMap)) { // Process each unique normalized city name once
            let colIndexFor20DC = -1;
            let colIndexFor40HC = -1;
            let advanceBy = 1; // Default advance by 1 column

            // Check current column (j) and next column (j+1) in Container Type Row (Excel Row 2)
            if (j < containerTypeHeaderRow.length && String(containerTypeHeaderRow[j] || '').toUpperCase() === "20DC") {
              colIndexFor20DC = j;
            }
            if (j + 1 < containerTypeHeaderRow.length && String(containerTypeHeaderRow[j + 1] || '').toUpperCase() === "40HC") {
              colIndexFor40HC = j + 1;
              if (colIndexFor20DC === j) advanceBy = 2; // If 20DC was in current and 40HC in next, we advance by 2
            }
            
            // If the first one was 40HC and the next was 20DC (less common)
             if (j < containerTypeHeaderRow.length && String(containerTypeHeaderRow[j] || '').toUpperCase() === "40HC" && colIndexFor40HC === -1) {
                colIndexFor40HC = j;
             }
             if (j + 1 < containerTypeHeaderRow.length && String(containerTypeHeaderRow[j+1] || '').toUpperCase() === "20DC" && colIndexFor20DC === -1) {
                colIndexFor20DC = j + 1;
                 if (colIndexFor40HC === j) advanceBy = 2;
             }


            if (colIndexFor20DC !== -1 || colIndexFor40HC !== -1) {
              dropOffCityMap[normalizedCityName] = {
                "20DC_ColIndex": colIndexFor20DC,
                "40HC_ColIndex": colIndexFor40HC
              };
            }
            j += advanceBy;
          } else {
            j++; // Skip empty or already processed city header cells
          }
        }
        
        if (Object.keys(dropOffCityMap).length === 0) {
          toast({ title: "SOC Drop-off File Info", description: "No drop-off cities mapped from Excel Row 1 headers (Col C onwards)." });
        }

        // Data rows start from original Excel Row 3 (index 2 in excelData)
        const dataRowsToProcess = excelData.slice(2);
        if (dataRowsToProcess.length === 0) {
            toast({ title: "SOC Drop-off File Info", description: "No data rows found (expected from Excel Row 3 onwards)." });
        }

        dataRowsToProcess.forEach((fullDataRowArray) => {
          if (!fullDataRowArray || !Array.isArray(fullDataRowArray) || fullDataRowArray.length < 2) return;

          const departureCityRaw = String(fullDataRowArray[1] || '').trim(); // Original Col B
          const normalizedDepartureForStorage = normalizeCityName(departureCityRaw);
          if (!normalizedDepartureForStorage) return;

          for (const normalizedDropOffCityKeyInMap in dropOffCityMap) {
            const cityColIndices = dropOffCityMap[normalizedDropOffCityKeyInMap];

            // Process 20DC
            if (cityColIndices["20DC_ColIndex"] !== -1 && cityColIndices["20DC_ColIndex"] < fullDataRowArray.length) {
              const price20DC_raw = fullDataRowArray[cityColIndices["20DC_ColIndex"]];
              const price20DC = parsePriceCell(price20DC_raw) as number | null;
              if (price20DC !== null) {
                newSOCDropOffDataLocal.push({
                  departureCity: normalizedDepartureForStorage,
                  dropOffCity: normalizedDropOffCityKeyInMap,
                  containerType: "20DC",
                  price: price20DC,
                } as ExcelSOCDropOffEntry);
              }
            }
            
            // Process 40HC
            if (cityColIndices["40HC_ColIndex"] !== -1 && cityColIndices["40HC_ColIndex"] < fullDataRowArray.length) {
              const price40HC_raw = fullDataRowArray[cityColIndices["40HC_ColIndex"]];
              const price40HC = parsePriceCell(price40HC_raw) as number | null;
              if (price40HC !== null) {
                newSOCDropOffDataLocal.push({
                  departureCity: normalizedDepartureForStorage,
                  dropOffCity: normalizedDropOffCityKeyInMap,
                  containerType: "40HC",
                  price: price40HC,
                } as ExcelSOCDropOffEntry);
              }
            }
          }
        });

        if (newSOCDropOffDataLocal.length > 0) {
          contextSetters.setExcelSOCDropOffData(newSOCDropOffDataLocal);
          parsedSuccessfullyWithData = true;
          toast({ title: "SOC Drop-off Excel Processed", description: `Found ${newSOCDropOffDataLocal.length} valid price entries.` });
        } else if (Object.keys(dropOffCityMap).length > 0 && dataRowsToProcess.length > 0) { // Headers were found, data rows existed, but no prices
          toast({ title: "SOC Drop-off File Info", description: "No valid SOC drop-off price entries extracted from data rows." });
        }

      } catch (parseError) {
        console.error("Error parsing SOC Drop-off Excel:", parseError);
        toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse SOC Drop-off Excel."});
      } finally {
        contextSetters.setIsSOCDropOffExcelDataLoaded(parsedSuccessfullyWithData);
        setIsParsingState(false);
      }
    } else if (typeof XLSX === 'undefined') {
        toast({ variant: "destructive", title: "Setup Incomplete", description: "XLSX library not available."});
        setIsParsingState(false);
        contextSetters.setIsSOCDropOffExcelDataLoaded(false);
    }
  };
  reader.onerror = () => {
    toast({ variant: "destructive", title: "File Error", description: "Could not read SOC Drop-off file." });
    setIsParsingState(false);
    contextSetters.setIsSOCDropOffExcelDataLoaded(false);
  };
  if (file) {
    reader.readAsArrayBuffer(file);
  } else {
    toast({ variant: "destructive", title: "File Error", description: "No file provided to SOC Drop-off parser." });
    setIsParsingState(false);
    contextSetters.setIsSOCDropOffExcelDataLoaded(false);
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
}
