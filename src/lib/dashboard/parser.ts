
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
    // console.warn("[DashboardParser] processFobOrFiRow determined this is not an FOB/FI row:", rowArray);
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
    railwayLegs: [], // <<< ALWAYS INITIALIZE HERE
  };
}

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim(); // Column A
  const cost = formatDashboardRate(rowArray[1]);      // Column B
  const containerCell = String(rowArray[2] || '').trim(); // Column C
  const commentCellD = String(rowArray[3] || '').trim(); // Column D

  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);
  
  let legComment = commentCellD;
  // If Col D starts with "CY", strip it and take the rest as comment.
  if (isCyRowByColD(commentCellD)) { 
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  }


  if (commentFromLegContainerCell) {
    legComment = legComment 
      ? `${commentFromLegContainerCell} | ${legComment}` 
      : commentFromLegContainerCell;
  }
  
  // Return null if all effectively empty, to avoid pushing empty leg objects
  if (!originInfoRaw && cost === 'N/A' && legContainerType === 'N/A' && !legComment) {
    // console.warn("[DashboardParser] processRailwayLegRow returning null due to all fields being effectively empty for row:", rowArray);
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A", // Ensure no empty strings, default to N/A
    cost: cost,
    containerInfo: legContainerType || "N/A", // Ensure no empty strings
    comment: legComment || '-', // Ensure no empty strings
  };
}

function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    // console.log(`[DashboardParser] FINALIZING section: '${currentSection.serviceName}' with ${currentSection.dataRows.length} FOB/FI rows.`);
    // currentSection.dataRows.forEach((row, idx) => {
    //   console.log(`  Row ${idx}: '${row.route}', Rate: '${row.rate}', Container: '${row.containerInfo}', Comment: '${row.additionalComment}', Railway Legs Cnt: ${row.railwayLegs ? row.railwayLegs.length : 0}`);
    //   if (row.railwayLegs && row.railwayLegs.length > 0) {
    //     row.railwayLegs.forEach((leg, legIdx) => {
    //       console.log(`    Leg ${legIdx}: Origin='${leg.originInfo}', Cost='${leg.cost}', Container='${leg.containerInfo}', Comment='${leg.comment}'`);
    //     });
    //   }
    // });
    parsedSections.push(currentSection);
  } else if (currentSection) {
    // console.log(`[DashboardParser] Finalizing empty section: '${currentSection.serviceName}', not adding to parsedSections.`);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  // console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let hasProcessedFobInCurrentSection = false; // Tracks if the last meaningful data row was FOB/FI

  rawData.forEach((rowArray, index) => {
    // console.log(`[DashboardParser] Processing rawData row ${index}:`, rowArray);
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // console.log(`[DashboardParser] Row ${index} is blank. Finalizing current section: ${currentSection?.serviceName}`);
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      hasProcessedFobInCurrentSection = false;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1]; // Used to check if it's an FOB/FI row
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell);
    const isCyType = isCyByColDType || isCyByColAType;


    if (isFobFiType) {
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        if (!currentSection) {
          currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
          // console.log(`[DashboardParser] Implicit section started for FOB/FI: '${currentSection.serviceName}' at row ${index}`);
        }
        currentSection.dataRows.push(newFobRow);
        hasProcessedFobInCurrentSection = true; // This is now the last data row type added.
        // console.log(`[DashboardParser] >>> FOB/FI Row processed: '${newFobRow.route}'. Current section: ${currentSection.serviceName}. Total rows in section: ${currentSection.dataRows.length}`);
      } else {
        // console.warn(`[DashboardParser] processFobOrFiRow returned null for supposedly FOB/FI row ${index}:`, rowArray);
        hasProcessedFobInCurrentSection = false;
      }
    } else if (isCyType) {
      // console.log(`[DashboardParser] >>> CY Row Encountered at row ${index}. Current section: ${currentSection?.serviceName}`);
      if (currentSection && currentSection.dataRows.length > 0 && hasProcessedFobInCurrentSection) {
        // Append to the last FOB/FI row added to the current section
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // railwayLegs is guaranteed to be initialized by processFobOrFiRow
          parentFobRow.railwayLegs!.push(railwayLegData);
          // console.log(`[DashboardParser]     Added Railway Leg to parent: '${parentFobRow.route}', Leg Origin: '${railwayLegData.originInfo}'. New railwayLegs count: ${parentFobRow.railwayLegs!.length}`);
        } else {
          //  console.log(`[DashboardParser]     processRailwayLegRow returned null for CY row ${index}:`, rowArray);
        }
      } else {
        // console.warn(`[DashboardParser]     Found CY row ${index} but no valid parent FOB/FI row in current section to attach to. Row:`, rowArray);
      }
      hasProcessedFobInCurrentSection = false; // A CY row is not an FOB/FI row
    } else { // Not FOB/FI, not CY - could be a header or an empty/irrelevant row
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyByColDType, isCyByColAType);
      if (isHeader) {
        // console.log(`[DashboardParser] Potential Header Row at index ${index}: '${firstCell}'. Finalizing previous section: ${currentSection?.serviceName}`);
        finalizeCurrentSection(currentSection, parsedSections);
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell;
        
        currentSection = { serviceName: newServiceName || `Service Section (Fallback at row ${index + 1})`, dataRows: [] };
        hasProcessedFobInCurrentSection = false; // Reset for new section
        // console.log(`[DashboardParser] New section started with explicit header: '${currentSection.serviceName}' from row ${index}.`);
      } else {
        // console.log(`[DashboardParser] Skipping unidentified row type ${index} (not FOB/FI, not CY, not Header):`, rowArray);
      }
      hasProcessedFobInCurrentSection = false; // Any other row type also means the last data row wasn't FOB/FI
    }
  });

  // Finalize the last section after the loop
  finalizeCurrentSection(currentSection, parsedSections);
  // console.log("[DashboardParser] Finished parseDashboardSheet, total sections found:", parsedSections.length);
  // console.log("[DashboardParser] Final Structure for context:", JSON.parse(JSON.stringify(parsedSections)));
  return parsedSections;
}
