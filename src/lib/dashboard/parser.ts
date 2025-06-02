
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isCyInColA, isPotentialServiceHeaderRow } from './row-identifier';

function processFobOrFiRow(rowArray: any[]): DashboardServiceDataRow | null {
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

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);

  let legComment = commentCellD;
  if (isCyRowByColD(commentCellD)) {
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) {
      legComment = commentCellD;
  }

  if (commentFromLegContainerCell) {
    legComment = legComment
      ? `${commentFromLegContainerCell} | ${legComment}`
      : commentFromLegContainerCell;
  }

  if (!originInfoRaw && cost === 'N/A' && legContainerType === 'N/A' && !legComment) {
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A",
    cost: cost,
    containerInfo: legContainerType || "N/A",
    comment: legComment || '-',
  };
}


function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[DashboardParser] >>> Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    currentSection.dataRows.forEach((row, index) => {
      console.log(`  [FOB Row ${index} of section "${currentSection.serviceName}"] Route: '${row.route}', Railway Legs count: ${row.railwayLegs ? row.railwayLegs.length : 'undefined/null'}`);
      if (row.railwayLegs && row.railwayLegs.length > 0) {
         // console.log(`    Legs Data for '${row.route}':`, JSON.parse(JSON.stringify(row.railwayLegs)));
      }
    });
    console.log(`[DashboardParser] <<< Finished finalizing section: "${currentSection.serviceName}".`);
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let currentFobRowForLegs: DashboardServiceDataRow | null = null; // Tracks the current FOB/FI parent

  console.log(`[DashboardParser] Starting to parse ${rawData.length} raw rows.`);

  rawData.forEach((rowArray, index) => {
    const excelRowNum = index + 1;
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
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
      finalizeCurrentSection(currentSection, parsedSections);
      currentFobRowForLegs = null; // Reset FOB/FI context for new section
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell;
      currentSection = { serviceName: newServiceName || `Service Section (Row ${excelRowNum})`, dataRows: [] };
      console.log(`[DashboardParser] Row ${excelRowNum}: New Header identified: "${currentSection.serviceName}". Reset currentFobRowForLegs.`);
    } else if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit at row ${excelRowNum})`, dataRows: [] };
        console.log(`[DashboardParser] Row ${excelRowNum}: Implicit Header created: "${currentSection.serviceName}".`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        currentFobRowForLegs = newFobRow; // Set this new FOB/FI row as the current parent for legs
        console.log(`[DashboardParser] Row ${excelRowNum}: Processed FOB/FI row, added to section "${currentSection.serviceName}". Route: '${newFobRow.route}'. Set as currentFobRowForLegs. Legs count: ${newFobRow.railwayLegs.length}.`);
      } else {
        currentFobRowForLegs = null; // Invalid FOB/FI row, so clear current parent context
        console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as FOB/FI type, but processFobOrFiRow returned null. Cleared currentFobRowForLegs.`);
      }
    } else if (isCyType) {
      if (currentFobRowForLegs) { // Check if there's an active FOB/FI parent
        console.log(`[DashboardParser] Row ${excelRowNum}: Identified as CY. Attempting to attach to currentFobRowForLegs: '${currentFobRowForLegs.route}'. Legs before: ${currentFobRowForLegs.railwayLegs.length}`);
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          currentFobRowForLegs.railwayLegs.push(railwayLegData);
          console.log(`[DashboardParser] Row ${excelRowNum}: Attached Railway Leg ('${railwayLegData.originInfo}') to '${currentFobRowForLegs.route}'. Total legs on parent now: ${currentFobRowForLegs.railwayLegs.length}.`);
        } else {
           console.log(`[DashboardParser] Row ${excelRowNum}: Identified as CY for '${currentFobRowForLegs.route}', but processRailwayLegRow returned null. Not attached. Raw CY data: [${rowArray.join('|')}]`);
        }
      } else {
        console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as CY, but no currentFobRowForLegs (no active FOB/FI parent). Raw CY data: [${rowArray.join('|')}] Skipping.`);
      }
    } else {
      // This row is not a header, not FOB/FI, and not CY.
      // Decide if this should reset currentFobRowForLegs. For now, it does not,
      // allowing CY rows to appear after minor non-data spacer rows.
      // If such rows should definitively break the FOB/FI context, then uncomment:
      // currentFobRowForLegs = null;
      // console.log(`[DashboardParser] Row ${excelRowNum}: Not Header, FOB/FI, or CY. currentFobRowForLegs ('${currentFobRowForLegs?.route || 'null'}') maintained.`);
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  console.log(`[DashboardParser] Finished parsing all rows. Total sections parsed: ${parsedSections.length}`);
  return parsedSections;
}
