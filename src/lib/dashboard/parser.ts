
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
    railwayLegs: [], // Initialize railwayLegs as an empty array
    railwayOriginInfo: undefined, // Will be populated by CY row if applicable
  };
}

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);

  let legComment = commentCellD;
  if (isCyRowByColD(commentCellD)) { // Check if comment in D starts with CY
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) { // If CY is in Col A and not in D, Col D is pure comment
      legComment = commentCellD;
  }


  if (commentFromLegContainerCell) {
    legComment = legComment
      ? `${commentFromLegContainerCell} | ${legComment}`
      : commentFromLegContainerCell;
  }

  // Only return a leg if there's some meaningful data
  if (!originInfoRaw && cost === 'N/A' && legContainerType === 'N/A' && !legComment) {
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A", // Store the full content of Col A for railway leg
    cost: cost,
    containerInfo: legContainerType || "N/A",
    comment: legComment || '-',
  };
}


function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    // console.log(`[DashboardParser] Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    // currentSection.dataRows.forEach((row, index) => {
    //   console.log(`  [FOB Row ${index}]: ${row.route}, Railway Legs: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
    //   if (row.railwayLegs) {
    //     row.railwayLegs.forEach((leg, legIdx) => {
    //       console.log(`    [Leg ${legIdx}]: Origin: ${leg.originInfo}, Cost: ${leg.cost}, Container: ${leg.containerInfo}, Comment: ${leg.comment}`);
    //     });
    //   }
    // });
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let currentFobRowForLegs: DashboardServiceDataRow | null = null; // Holds a direct reference to the current FOB/FI row object in dataRows

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // Blank row. Does not reset currentFobRowForLegs, as CY rows might appear after a blank line.
      // Section finalization is primarily driven by new headers.
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const colB = String(rowArray[1] || '').trim();
    const colC = String(rowArray[2] || '').trim();
    const colD = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, rowArray[1]);
    const isCyByColDType = isCyRowByColD(colD);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell);
    const isCyType = isCyByColDType || isCyByColAType;
    
    const isHeaderType = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyType);

    if (isHeaderType) {
      finalizeCurrentSection(currentSection, parsedSections);
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell;
      currentSection = { serviceName: newServiceName || `Service Section (Row ${index + 1})`, dataRows: [] };
      currentFobRowForLegs = null; // New section, so no current FOB row
    } else if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        // Get a direct reference to the object just added to the array
        currentFobRowForLegs = currentSection.dataRows[currentSection.dataRows.length - 1];
      }
    } else if (isCyType) {
      if (currentFobRowForLegs) { // Check if there's an active FOB/FI row (referenced object)
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // railwayLegs array is initialized in processFobOrFiRow
          currentFobRowForLegs.railwayLegs!.push(railwayLegData); // Modify the referenced object directly

          // Set railwayOriginInfo on the parent FOB row if it's the first leg and info is useful
          if (currentFobRowForLegs.railwayLegs!.length === 1 && !currentFobRowForLegs.railwayOriginInfo && railwayLegData.originInfo && railwayLegData.originInfo !== 'N/A') {
            currentFobRowForLegs.railwayOriginInfo = railwayLegData.originInfo;
          }
        }
      } else {
        // console.warn(`[DashboardParser] CY row at index ${index} found, but no current FOB/FI row reference to attach it to. Skipping.`);
      }
    } else {
      // Non-header, non-FOB/FI, non-CY row.
      // We don't reset currentFobRowForLegs here, as CY rows might follow this "noise".
      // A new header or a new FOB/FI row will reset it.
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  return parsedSections;
}
