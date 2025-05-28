
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isCyInColA, isPotentialServiceHeaderRow } from './row-identifier';

// This function processes a row identified as an FOB or FI data row.
function processFobOrFiRow(rowArray: any[]): DashboardServiceDataRow | null {
  const firstCell = String(rowArray[0] || '').trim();
  const secondCellContent = rowArray[1]; // Rate column
  const thirdCellContent = String(rowArray[2] || '').trim(); // Container info column
  const fourthCellContent = String(rowArray[3] || '').trim(); // Potential comment column

  if (!isFobOrFiRow(firstCell, secondCellContent)) {
    // console.warn("[DashboardParser] processFobOrFiRow called on non-FOB/FI row:", firstCell);
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
    railwayLegs: [], // Initialize railwayLegs as an empty array directly here
  };
}

// This function processes a row identified as a railway leg (CY row).
function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);
  
  let legComment = commentCellD;
  // If Col D starts with "CY", strip it and take the rest as comment.
  // For CY in Col A, Col D is entirely comment.
  if (isCyRowByColD(commentCellD)) { 
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  }

  if (commentFromLegContainerCell) {
    legComment = legComment 
      ? `${commentFromLegContainerCell} | ${legComment}` 
      : commentFromLegContainerCell;
  }
  
  // Avoid adding an empty leg if all crucial fields are effectively empty
  if (!originInfoRaw && cost === 'N/A' && legContainerType === 'N/A' && !legComment) {
    // console.log("[DashboardParser] Skipped processing an empty or N/A railway leg row.");
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A", // Default to "N/A" if empty
    cost: cost,
    containerInfo: legContainerType || "N/A",
    comment: legComment || '-', // Default to '-' if empty
  };
}

// Finalizes the current section and adds it to the list of parsed sections.
function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    // console.log(`[DashboardParser] Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    // currentSection.dataRows.forEach((row, index) => {
    //   console.log(`  [FOB Row ${index}]: ${row.route}, Railway Legs: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
    //   if (row.railwayLegs) {
    //     row.railwayLegs.forEach((leg, legIdx) => {
    //       console.log(`    [Leg ${legIdx}]: ${leg.originInfo}, Cost: ${leg.cost}`);
    //     });
    //   }
    // });
    parsedSections.push(currentSection);
  }
}

export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  // console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // Blank row, finalize current section and reset
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      // console.log(`[DashboardParser] Blank row at index ${index}, section finalized.`);
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1]; // Used to check for FOB/FI rate
    const fourthCellContent = String(rowArray[3] || '').trim(); // Used for CY check

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell); // Ensure it's not also FOB/FI
    const isCyType = isCyByColDType || isCyByColAType;
    
    const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyType);

    if (isHeader) {
      finalizeCurrentSection(currentSection, parsedSections); // Finalize previous section before starting new
      
      const serviceNameColB = String(rowArray[1] || '').trim();
      const serviceNameColC = String(rowArray[2] || '').trim();
      let newServiceName = "";

      if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
      else if (serviceNameColB) newServiceName = serviceNameColB;
      else if (serviceNameColC) newServiceName = serviceNameColC;
      else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
      
      currentSection = { serviceName: newServiceName || `Service Section (Row ${index + 1})`, dataRows: [] };
      // console.log(`[DashboardParser] Started new section: "${currentSection.serviceName}" at row index ${index}`);
    } else if (isFobFiType) {
      if (!currentSection) { // If an FOB/FI row appears before any header
        currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
        // console.log(`[DashboardParser] Started new implicit section for FOB/FI: "${currentSection.serviceName}" at row index ${index}`);
      }
      const newFobRow = processFobOrFiRow(rowArray); // newFobRow will have railwayLegs: []
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        // console.log(`[DashboardParser] Processed FOB/FI row: ${newFobRow.route}. Added to section "${currentSection.serviceName}". RailwayLegs initialized count: ${newFobRow.railwayLegs.length}`);
      }
    } else if (isCyType) {
      if (currentSection && currentSection.dataRows.length > 0) {
        // Append to the last FOB/FI row in the current section's dataRows
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // railwayLegs array is already initialized in parentFobRow by processFobOrFiRow
          parentFobRow.railwayLegs.push(railwayLegData);
          // console.log(`[DashboardParser] Added railway leg to ${parentFobRow.route}. Current legs count: ${parentFobRow.railwayLegs.length}`);
        }
      } else {
        // console.log(`[DashboardParser] Skipped CY row at index ${index}: No current section or no FOB/FI rows in current section to attach to.`);
      }
    } else {
      // Row is not a header, not FOB/FI, and not CY. It might be an empty-ish row or separator.
      // We don't necessarily finalize the section here unless it's a truly blank row (handled at the top).
      // console.log(`[DashboardParser] Encountered other row type or non-data row at index ${index}: "${firstCell}"`);
    }
  });

  finalizeCurrentSection(currentSection, parsedSections); // Finalize the last section
  // console.log("[DashboardParser] Finished parseDashboardSheet. Total sections:", parsedSections.length);
  return parsedSections;
}

    