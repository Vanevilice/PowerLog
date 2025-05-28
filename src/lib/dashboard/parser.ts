
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
    railwayLegs: [], // Initialize as empty array
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
    originInfo: originInfoRaw || "N/A",
    cost: cost,
    containerInfo: legContainerType || "N/A",
    comment: legComment || '-',
  };
}

function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[DashboardParser] FINALIZING section: '${currentSection.serviceName}' with ${currentSection.dataRows.length} FOB/FI rows.`);
    currentSection.dataRows.forEach((row, idx) => {
      console.log(`  Row ${idx}: '${row.route}', Rate: '${row.rate}', Container: '${row.containerInfo}', Comment: '${row.additionalComment}', Railway Legs: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
      if (row.railwayLegs && row.railwayLegs.length > 0) {
        row.railwayLegs.forEach((leg, legIdx) => {
          console.log(`    Leg ${legIdx}: Origin='${leg.originInfo}', Cost='${leg.cost}', Container='${leg.containerInfo}', Comment='${leg.comment}'`);
        });
      }
    });
    parsedSections.push(currentSection);
  } else if (currentSection) {
    console.log(`[DashboardParser] Finalizing empty section: '${currentSection.serviceName}', not adding to parsedSections.`);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let lastProcessedFobRowInDataRows: DashboardServiceDataRow | null = null;

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      lastProcessedFobRowInDataRows = null; 
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1]; 
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell);

    if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit ${parsedSections.length + 1})`, dataRows: [] };
        console.log(`[DashboardParser] Implicit section started for FOB/FI: '${currentSection.serviceName}'`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        // Explicitly get the reference to the object just pushed into the array
        lastProcessedFobRowInDataRows = currentSection.dataRows[currentSection.dataRows.length - 1];
        console.log(`[DashboardParser] Added FOB/FI row: '${newFobRow.route}' to section: '${currentSection.serviceName}'. lastProcessedFobRowInDataRows updated.`);
      }
    } else if (isCyByColDType || isCyByColAType) {
      if (lastProcessedFobRowInDataRows && currentSection && currentSection.dataRows.includes(lastProcessedFobRowInDataRows)) {
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          lastProcessedFobRowInDataRows.railwayLegs = lastProcessedFobRowInDataRows.railwayLegs || [];
          lastProcessedFobRowInDataRows.railwayLegs.push(railwayLegData);
          console.log(`[DashboardParser] Added Railway Leg to parent: '${lastProcessedFobRowInDataRows.route}', Leg Origin: '${railwayLegData.originInfo}', Total legs now: ${lastProcessedFobRowInDataRows.railwayLegs.length}`);
        }
      } else {
        console.warn(`[DashboardParser] Found CY row but no valid 'lastProcessedFobRowInDataRows' to attach to. Current section: ${currentSection?.serviceName}, Row:`, rowArray);
      }
    } else { 
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyByColDType, isCyByColAType);
      if (isHeader) {
        finalizeCurrentSection(currentSection, parsedSections); 
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell; 
        
        currentSection = { serviceName: newServiceName || `Service Section (Fallback ${parsedSections.length + 1})`, dataRows: [] };
        lastProcessedFobRowInDataRows = null; 
        console.log(`[DashboardParser] New section started with explicit header: '${currentSection.serviceName}'`);
      } else {
         console.log("[DashboardParser] Skipping unidentified row type (not FOB/FI, not CY, not Header):", rowArray);
      }
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  console.log("[DashboardParser] Finished parseDashboardSheet, total sections found:", parsedSections.length);
  return parsedSections;
}
