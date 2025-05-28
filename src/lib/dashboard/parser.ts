
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isPotentialServiceHeaderRow, isCyInColA } from './row-identifier';

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
    railwayLegs: [], // Initialize as empty array, to be populated by subsequent CY rows
  };
}

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);
  
  let legComment = commentCellD;
  // If CY was in col D (original check), strip it.
  // If CY was from Col A, commentCellD might be the actual comment for the leg or empty.
  if (isCyRowByColD(commentCellD)) { 
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  }

  if (commentFromLegContainerCell) {
    legComment = legComment 
      ? `${commentFromLegContainerCell} | ${legComment}` 
      : commentFromLegContainerCell;
  }
  
  // A railway leg must at least have some origin info or a cost to be valid
  if (!originInfoRaw && cost === 'N/A') {
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A", // Default if empty
    cost: cost,
    containerInfo: legContainerType || "N/A",
    comment: legComment || '-',
  };
}

function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[DashboardParser] FINALIZING section: ${currentSection.serviceName}`);
    currentSection.dataRows.forEach((row, idx) => {
      console.log(`  Row ${idx}: ${row.route}, Railway Legs: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
      if (row.railwayLegs) {
        row.railwayLegs.forEach((leg, legIdx) => {
          console.log(`    Leg ${legIdx}: ${leg.originInfo} - ${leg.cost}`);
        });
      }
    });
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  // Removed lastFobRow variable, will directly use currentSection.dataRows last element

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // Blank row signifies end of a section
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1]; // Rate or part of header
    const thirdCellContent = String(rowArray[2] || '').trim(); // Container Info or part of header
    const fourthCellContent = String(rowArray[3] || '').trim(); // Comment or CY indicator

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell); // Check Col A for CY, ensure it's not also an FOB/FI row

    if (isFobFiType) {
      if (!currentSection) {
        // Start a default section if an FOB/FI row appears without a preceding explicit header
        currentSection = { serviceName: `Service Section (Implicit ${parsedSections.length + 1})`, dataRows: [] };
        console.log(`[DashboardParser] New implicit section started for FOB/FI row: ${currentSection.serviceName}`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        console.log("[DashboardParser] Added FOB/FI row:", newFobRow.route, "to section:", currentSection.serviceName);
      }
    } else if (isCyByColDType || isCyByColAType) {
      if (currentSection && currentSection.dataRows.length > 0) {
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          if (!parentFobRow.railwayLegs) { // Should have been initialized by processFobOrFiRow
            parentFobRow.railwayLegs = [];
          }
          parentFobRow.railwayLegs.push(railwayLegData);
          console.log("[DashboardParser] Added Railway Leg to parent:", parentFobRow.route, "Leg Origin:", railwayLegData.originInfo, "Total legs now:", parentFobRow.railwayLegs.length);
        }
      } else {
        console.warn("[DashboardParser] Found CY row but no current section or section has no FOB/FI rows yet:", rowArray);
      }
    } else { // Potential Header or other row
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyByColDType, isCyByColAType);
      if (isHeader) {
        finalizeCurrentSection(currentSection, parsedSections); // Finalize previous section
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
        
        currentSection = { serviceName: newServiceName || `Service Section (Fallback ${parsedSections.length + 1})`, dataRows: [] };
        console.log(`[DashboardParser] New section started with explicit header: ${currentSection.serviceName}`);
      } else {
         console.log("[DashboardParser] Skipping unidentified row type (not FOB/FI, not CY, not Header):", rowArray);
      }
    }
  });

  finalizeCurrentSection(currentSection, parsedSections); // Finalize the last section
  console.log("[DashboardParser] Finished parseDashboardSheet, total sections found:", parsedSections.length);
  return parsedSections;
}
