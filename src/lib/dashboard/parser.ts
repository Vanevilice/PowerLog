
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isCyInColA, isPotentialServiceHeaderRow } from './row-identifier';

// --- Helper functions to process individual row types ---

function processFobOrFiRow(rowArray: any[], excelRowNum: number): DashboardServiceDataRow | null {
  const firstCell = String(rowArray[0] || '').trim();
  const secondCellContent = rowArray[1]; // Rate column
  const thirdCellContent = String(rowArray[2] || '').trim(); // Container info column
  const fourthCellContent = String(rowArray[3] || '').trim(); // Potential comment column

  if (!isFobOrFiRow(firstCell, secondCellContent)) {
    return null;
  }

  const { containerType: containerTypeExtracted, comment: commentFromContainerCell } = parseContainerInfoCell(thirdCellContent);

  let finalAdditionalComment = String(fourthCellContent || '').trim();
  if (commentFromContainerCell) {
    finalAdditionalComment = finalAdditionalComment
      ? `${commentFromContainerCell} | ${finalAdditionalComment}`
      : commentFromContainerCell;
  }

  return {
    route: firstCell,
    rate: formatDashboardRate(secondCellContent),
    containerInfo: containerTypeExtracted,
    additionalComment: finalAdditionalComment || '-',
    railwayLegs: [], // CRITICAL: Initialize railwayLegs as an empty array
  };
}

function processRailwayLegRow(rowArray: any[], excelRowNum: number): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim();
  const costRaw = rowArray[1];
  const containerCell = String(rowArray[2] || '').trim();
  const commentCellD = String(rowArray[3] || '').trim();

  const costFormatted = formatDashboardRate(costRaw);
  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);

  let legComment = commentCellD;
  if (isCyRowByColD(commentCellD)) {
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) {
      legComment = commentCellD;
  }


  if (commentFromLegContainerCell) {
    legComment = legComment ? `${commentFromLegContainerCell} | ${legComment}` : commentFromLegContainerCell;
  }
  const finalComment = legComment.trim();

  const hasOrigin = originInfoRaw !== '' && originInfoRaw.toLowerCase() !== 'n/a';
  const hasCost = costFormatted !== 'N/A';
  const hasContainer = legContainerType !== 'N/A';
  const hasMeaningfulComment = finalComment !== '' && finalComment !== '-';

  // A railway leg is valid if any of its key fields have meaningful data.
  if (!hasOrigin && !hasCost && !hasContainer && !hasMeaningfulComment) {
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A",
    cost: costFormatted, 
    containerInfo: legContainerType, 
    comment: finalComment || '-',
  };
}

// --- Two-Pass Parsing Logic ---

type ParsedRowItem =
  | { type: 'header'; serviceName: string; originalRowIndex: number }
  | { type: 'fobFi'; data: DashboardServiceDataRow; originalRowIndex: number }
  | { type: 'railwayLeg'; data: RailwayLegData; originalRowIndex: number }
  | { type: 'blankOrOther'; originalRowIndex: number };

function classifyAndParseAllRows(rawData: any[][]): ParsedRowItem[] {
  const typedRows: ParsedRowItem[] = [];

  rawData.forEach((rowArray, index) => {
    const excelRowNum = index + 1; 

    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const colB = String(rowArray[1] || '').trim();
    const colC = String(rowArray[2] || '').trim();
    const colD = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, rowArray[1]);
    const isCyColDType = isCyRowByColD(colD);
    const isCyColAType = !isFobFiType && isCyInColA(firstCell);
    const isCyType = isCyColDType || isCyColAType;
    const isHeaderType = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyColDType, isCyColAType);

    if (isHeaderType) {
      let serviceName = "";
      if (colB && colC) serviceName = `${colB} ${colC}`;
      else if (colB) serviceName = colB;
      else if (colC) serviceName = colC;
      else if (firstCell) serviceName = firstCell;
      typedRows.push({ type: 'header', serviceName: serviceName || `Service Section (Row ${excelRowNum})`, originalRowIndex: index });
    } else if (isFobFiType) {
      const fobFiData = processFobOrFiRow(rowArray, excelRowNum);
      if (fobFiData) {
        typedRows.push({ type: 'fobFi', data: fobFiData, originalRowIndex: index });
      } else {
        typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
      }
    } else if (isCyType) {
      const railwayLegData = processRailwayLegRow(rowArray, excelRowNum);
      if (railwayLegData) {
        typedRows.push({ type: 'railwayLeg', data: railwayLegData, originalRowIndex: index });
      } else {
        typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
      }
    } else {
      typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
    }
  });
  return typedRows;
}

export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const typedRowItems = classifyAndParseAllRows(rawData);

  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let currentFobFiParentForRow: DashboardServiceDataRow | null = null;

  function finalizeCurrentSection() {
    if (currentSection && currentSection.dataRows.length > 0) {
      parsedSections.push(currentSection);
    }
    currentSection = null;
    currentFobFiParentForRow = null;
  }

  typedRowItems.forEach((item) => {
    const excelRowNum = item.originalRowIndex + 1; 
    switch (item.type) {
      case 'header':
        finalizeCurrentSection(); 
        currentSection = { serviceName: item.serviceName, dataRows: [] };
        currentFobFiParentForRow = null; 
        break;
      case 'fobFi':
        if (!currentSection) { 
          currentSection = { serviceName: `Service Section (Implicit at row ${excelRowNum})`, dataRows: [] };
        }
        const newFobFiDataRow: DashboardServiceDataRow = {
          ...item.data, // Spread properties from the parsed data in Pass 1
          railwayLegs: [], // Explicitly re-initialize railwayLegs for this new object
        };
        currentSection.dataRows.push(newFobFiDataRow);
        currentFobFiParentForRow = newFobFiDataRow; // Point to the newly created and pushed object
        break;
      case 'railwayLeg':
        if (currentFobFiParentForRow) {
          if (!currentFobFiParentForRow.railwayLegs) { // Defensive check, should be initialized
            currentFobFiParentForRow.railwayLegs = [];
          }
          currentFobFiParentForRow.railwayLegs.push(item.data);
        }
        break;
      case 'blankOrOther':
        // Blank lines generally do not reset the currentFobFiParentForRow context.
        break;
    }
  });

  finalizeCurrentSection(); 

  // --- Third Pass: Post-processing to copy railway legs ---
  parsedSections.forEach(section => {
    if (section.dataRows && section.dataRows.length > 0) {
      const lastDataRow = section.dataRows[section.dataRows.length - 1];
      if (lastDataRow && lastDataRow.railwayLegs && lastDataRow.railwayLegs.length > 0) {
        // Deep copy the railway legs from the last row
        const legsToCopy = JSON.parse(JSON.stringify(lastDataRow.railwayLegs)) as RailwayLegData[];
        
        section.dataRows.forEach((dataRow, index) => {
          if (index < section.dataRows.length - 1) { // Don't copy to the last row itself
            dataRow.railwayLegs = JSON.parse(JSON.stringify(legsToCopy)); // Assign a fresh deep copy
          }
        });
      }
    }
  });

  return parsedSections;
}

