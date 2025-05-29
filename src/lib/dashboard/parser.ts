
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

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const colB = String(rowArray[1] || '').trim();
    const colC = String(rowArray[2] || '').trim();
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFi = isFobOrFiRow(firstCell, rowArray[1]);
    const isCyByD = isCyRowByColD(fourthCellContent);
    const isCyByA = !isFobFi && isCyInColA(firstCell);
    const isCy = isCyByD || isCyByA;
    const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFi, isCy);

    if (isHeader) {
      finalizeCurrentSection(currentSection, parsedSections);
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell;
      currentSection = { serviceName: newServiceName || `Service Section (Row ${index + 1})`, dataRows: [] };
    } else if (isFobFi) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
      }
      const newFobRow = processFobOrFiRow(rowArray); // Initializes railwayLegs = []
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
      }
    } else if (isCy) {
      if (currentSection && currentSection.dataRows.length > 0) {
        // Append to the last FOB/FI row in the current section's dataRows
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // railwayLegs should have been initialized by processFobOrFiRow
          if (!parentFobRow.railwayLegs) { 
            // This is a safeguard, should ideally not be needed if processFobOrFiRow is correct
            parentFobRow.railwayLegs = []; 
          }
          parentFobRow.railwayLegs.push(railwayLegData);
        }
      }
    }
    // "Other" rows are ignored for now unless they are blank (which finalizes a section)
  });

  finalizeCurrentSection(currentSection, parsedSections);
  return parsedSections;
}
