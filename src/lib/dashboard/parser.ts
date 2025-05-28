
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isPotentialServiceHeaderRow, isCyInColA } from './row-identifier';

function processFobOrFiRow(rowArray: any[]): DashboardServiceDataRow | null {
  const firstCell = String(rowArray[0] || '').trim();
  const secondCellContent = rowArray[1];
  const thirdCellContent = String(rowArray[2] || '').trim();
  const fourthCellContent = String(rowArray[3] || '').trim();

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
    railwayLegs: [], // Initialize as empty array
  };
}

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfo = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);
  
  let legComment = commentCellD;
  // If CY was in col D, strip it. If it was from Col A, commentCellD might be the actual comment for the leg
  if (isCyRowByColD(commentCellD)) {
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  }

  if (commentFromLegContainerCell) {
    legComment = legComment 
      ? `${commentFromLegContainerCell} | ${legComment}` 
      : commentFromLegContainerCell;
  }
  
  // A railway leg must at least have some origin info or a cost to be valid
  if (!originInfo && cost === 'N/A') {
    return null;
  }

  return {
    originInfo: originInfo || "N/A", // Default if empty
    cost: cost,
    containerInfo: legContainerType,
    comment: legComment || '-',
  };
}

function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[DashboardParser] Pushing section: ${currentSection.serviceName} with ${currentSection.dataRows.length} rows`);
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let lastFobRow: DashboardServiceDataRow | null = null;

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      lastFobRow = null;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1];
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    // Check if it's a railway leg indicated by "CY" in Column A, and it's not already an FOB/FI row.
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell);


    if (isFobFiType) {
      if (!currentSection) {
        // If an FOB/FI row appears without a preceding header, start a default section
        currentSection = { serviceName: `Service Section ${parsedSections.length + 1}`, dataRows: [] };
        console.log(`[DashboardParser] New implicit section started for FOB/FI row: ${currentSection.serviceName}`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        lastFobRow = newFobRow;
        console.log("[DashboardParser] Added FOB/FI row:", newFobRow.route);
      }
    } else if (isCyByColDType || isCyByColAType) {
      if (lastFobRow && currentSection) {
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          if (!lastFobRow.railwayLegs) {
            lastFobRow.railwayLegs = [];
          }
          lastFobRow.railwayLegs.push(railwayLegData);
          console.log("[DashboardParser] Added Railway Leg to:", lastFobRow.route, "Leg Origin:", railwayLegData.originInfo);
        }
      } else {
        console.warn("[DashboardParser] Found CY row but no preceding FOB/FI row OR no current section:", rowArray);
      }
    } else { // Potential Header or other row
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyByColDType, isCyByColAType);
      if (isHeader) {
        finalizeCurrentSection(currentSection, parsedSections);
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
        
        currentSection = { serviceName: newServiceName || `Service Section ${parsedSections.length + 1}`, dataRows: [] };
        lastFobRow = null; // Reset for the new section
        console.log(`[DashboardParser] New section started with header: ${currentSection.serviceName}`);
      } else {
         // This row is not FOB/FI, not CY, and not identified as a header. Could be an orphan comment or formatting row.
         console.log("[DashboardParser] Skipping unidentified row type:", rowArray);
      }
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  console.log("[DashboardParser] Finished parseDashboardSheet, sections found:", parsedSections.length);
  return parsedSections;
}
