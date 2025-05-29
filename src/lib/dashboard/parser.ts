
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
  // If Column D starts with "CY", treat the rest as the comment
  if (isCyRowByColD(commentCellD)) {
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) {
      // If CY is in Col A and not in D, then Col D is purely a comment
      legComment = commentCellD;
  }
  // else, legComment remains commentCellD (which might be empty)

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
    console.log(`[DashboardParser] Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    currentSection.dataRows.forEach((row, index) => {
      console.log(`  [FOB Row ${index} ('${row.route}')]: Railway Legs count: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
      if (row.railwayLegs && row.railwayLegs.length > 0) {
        // console.log(`    Legs Data for '${row.route}':`, JSON.parse(JSON.stringify(row.railwayLegs)));
      }
    });
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // console.log(`[DashboardParser] Row ${index + 1} is blank.`);
      return; // Skip fully blank rows
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
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
      currentSection = { serviceName: newServiceName || `Service Section (Row ${index + 1})`, dataRows: [] };
      // console.log(`[DashboardParser] New Header: ${currentSection.serviceName} at row ${index + 1}.`);
    } else if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
        // console.log(`[DashboardParser] Implicit Header: ${currentSection.serviceName} at row ${index + 1}`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        // console.log(`[DashboardParser] Processed FOB/FI row: '${newFobRow.route}'. Initial railway legs count: ${newFobRow.railwayLegs?.length}`);
      }
    } else if (isCyType) {
      if (currentSection && currentSection.dataRows.length > 0) {
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // parentFobRow.railwayLegs is guaranteed to be initialized by processFobOrFiRow
          parentFobRow.railwayLegs.push(railwayLegData);
          // console.log(`[DashboardParser] Added Railway Leg to '${parentFobRow.route}': Origin: ${railwayLegData.originInfo}. Total legs now: ${parentFobRow.railwayLegs.length}`);
        }
      } else {
        // console.warn(`[DashboardParser] CY row at index ${index} found, but no current section or no FOB/FI rows in current section to attach it to. Skipping. Current Section: ${currentSection?.serviceName}`);
      }
    } else {
      // This is a non-blank, non-header, non-FOB/FI, non-CY row.
      // It might be a note or other data. We don't reset any context here.
      // console.log(`[DashboardParser] Other type of row at index ${index}. Content: ${firstCell}.`);
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  // console.log("[DashboardParser] Finished parseDashboardSheet. Total sections:", parsedSections.length);
  return parsedSections;
}
