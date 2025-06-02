
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isCyInColA, isPotentialServiceHeaderRow } from './row-identifier';

// --- Helper functions to process individual row types (largely unchanged, but ensure initialization) ---

function processFobOrFiRow(rowArray: any[], excelRowNum: number): DashboardServiceDataRow | null {
  const firstCell = String(rowArray[0] || '').trim();
  const secondCellContent = rowArray[1]; // Rate column
  const thirdCellContent = String(rowArray[2] || '').trim(); // Container info column
  const fourthCellContent = String(rowArray[3] || '').trim(); // Potential comment column

  if (!isFobOrFiRow(firstCell, secondCellContent)) {
    // console.log(`[processFobOrFiRow - Row ${excelRowNum}] Not FOB/FI type.`);
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

  const hasOrigin = originInfoRaw !== '';
  const hasCost = costFormatted !== 'N/A';
  const hasContainer = legContainerType !== 'N/A';
  const hasComment = finalComment !== '' && finalComment !== '-';

  if (!hasOrigin && !hasCost && !hasContainer && !hasComment) {
    // console.log(`[processRailwayLegRow - Row ${excelRowNum}] Considered empty, returning null.`);
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A",
    cost: costFormatted,
    containerInfo: legContainerType,
    comment: finalComment || '-',
  };
}

// --- New Two-Pass Parsing Logic ---

type ParsedRowItem =
  | { type: 'header'; serviceName: string; originalRowIndex: number }
  | { type: 'fobFi'; data: DashboardServiceDataRow; originalRowIndex: number }
  | { type: 'railwayLeg'; data: RailwayLegData; originalRowIndex: number }
  | { type: 'blankOrOther'; originalRowIndex: number };

function classifyAndParseAllRows(rawData: any[][]): ParsedRowItem[] {
  const typedRows: ParsedRowItem[] = [];

  rawData.forEach((rowArray, index) => {
    const excelRowNum = index + 1; // 1-based for Excel reference

    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
      // console.log(`[Pass 1 - Row ${excelRowNum}]: Classified as blankOrOther (empty)`);
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
      // console.log(`[Pass 1 - Row ${excelRowNum}]: Classified as HEADER. Name: "${serviceName}"`);
    } else if (isFobFiType) {
      const fobFiData = processFobOrFiRow(rowArray, excelRowNum);
      if (fobFiData) {
        typedRows.push({ type: 'fobFi', data: fobFiData, originalRowIndex: index });
        // console.log(`[Pass 1 - Row ${excelRowNum}]: Classified as FOB/FI. Route: "${fobFiData.route}"`);
      } else {
        // This case should ideally not happen if isFobFiType is true, but as a fallback:
        typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
        // console.warn(`[Pass 1 - Row ${excelRowNum}]: Identified as FOB/FI type, but processFobOrFiRow returned null. Classifying as blankOrOther.`);
      }
    } else if (isCyType) {
      const railwayLegData = processRailwayLegRow(rowArray, excelRowNum);
      if (railwayLegData) {
        typedRows.push({ type: 'railwayLeg', data: railwayLegData, originalRowIndex: index });
        // console.log(`[Pass 1 - Row ${excelRowNum}]: Classified as RAILWAY_LEG. Origin: "${railwayLegData.originInfo}"`);
      } else {
        // This row looked like a CY row but processed to null, treat as other.
        typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
        // console.log(`[Pass 1 - Row ${excelRowNum}]: Identified as CY_TYPE, but processRailwayLegRow returned null. Classifying as blankOrOther.`);
      }
    } else {
      typedRows.push({ type: 'blankOrOther', originalRowIndex: index });
      // console.log(`[Pass 1 - Row ${excelRowNum}]: Classified as blankOrOther (default). Content: [${rowArray.slice(0,4).join('|')}]`);
    }
  });
  return typedRows;
}

export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  // console.log(`[parseDashboardSheet] Raw data rows from Excel: ${rawData.length}`);

  const typedRowItems = classifyAndParseAllRows(rawData);
  // console.log(`[parseDashboardSheet] Typed row items from Pass 1: ${typedRowItems.length}`);

  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let currentFobFiParentForRow: DashboardServiceDataRow | null = null;

  function finalizeCurrentSection() {
    if (currentSection && currentSection.dataRows.length > 0) {
      // console.log(`[Pass 2] >>> Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
      // currentSection.dataRows.forEach((row, idx) => {
      //   console.log(`  [FOB Row ${idx} in final section "${currentSection.serviceName}"] Route: '${row.route}', Railway Legs count: ${row.railwayLegs.length}`);
      //   if (row.railwayLegs.length > 0) {
      //      console.log(`    First leg for '${row.route}':`, JSON.stringify(row.railwayLegs[0]));
      //   }
      // });
      parsedSections.push(currentSection);
    }
    currentSection = null;
    currentFobFiParentForRow = null;
  }

  typedRowItems.forEach((item) => {
    const excelRowNum = item.originalRowIndex + 1;
    switch (item.type) {
      case 'header':
        finalizeCurrentSection(); // Finalize previous before starting new
        currentSection = { serviceName: item.serviceName, dataRows: [] };
        currentFobFiParentForRow = null; // Reset parent context for new section
        // console.log(`[Pass 2 - Row ${excelRowNum}]: HEADER encountered. New section: "${item.serviceName}". Reset currentFobFiParentForRow.`);
        break;
      case 'fobFi':
        if (!currentSection) { // Implicit section start if no header was found first
          currentSection = { serviceName: `Service Section (Implicit at row ${excelRowNum})`, dataRows: [] };
          // console.log(`[Pass 2 - Row ${excelRowNum}]: FOB/FI encountered. Implicit new section: "${currentSection.serviceName}".`);
        }
        currentSection.dataRows.push(item.data);
        // IMPORTANT: currentFobFiParentForRow must refer to the object *inside* currentSection.dataRows
        currentFobFiParentForRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        // console.log(`[Pass 2 - Row ${excelRowNum}]: FOB/FI processed. Route: "${item.data.route}". Set as currentFobFiParentForRow. Legs attached so far to this parent: ${currentFobFiParentForRow.railwayLegs.length}`);
        break;
      case 'railwayLeg':
        if (currentFobFiParentForRow) {
          currentFobFiParentForRow.railwayLegs.push(item.data);
          // console.log(`[Pass 2 - Row ${excelRowNum}]: RAILWAY_LEG processed. Origin: "${item.data.originInfo}". Attached to parent: "${currentFobFiParentForRow.route}". Parent now has ${currentFobFiParentForRow.railwayLegs.length} legs.`);
        } else {
          // console.warn(`[Pass 2 - Row ${excelRowNum}]: RAILWAY_LEG found (Origin: "${item.data.originInfo}") but no currentFobFiParentForRow. Orphaned leg.`);
        }
        break;
      case 'blankOrOther':
        // Generally, blank lines do not reset the currentFobFiParentForRow context.
        // It remains active until a new header or a new FOB/FI row changes it.
        // console.log(`[Pass 2 - Row ${excelRowNum}]: BLANK_OR_OTHER encountered. currentFobFiParentForRow ("${currentFobFiParentForRow?.route || 'null'}") maintained.`);
        break;
    }
  });

  finalizeCurrentSection(); // Finalize the very last section
  // console.log(`[parseDashboardSheet] Finished Pass 2. Total sections structured: ${parsedSections.length}`);
  return parsedSections;
}

    