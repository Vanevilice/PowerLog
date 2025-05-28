
import * as XLSX from 'xlsx'; // Added this import
import type { DashboardServiceSection, DashboardServiceDataRow, RailwayLegData } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRowByColD, isPotentialServiceHeaderRow, isCyInColA } from './row-identifier';

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
  // If Col D starts with "CY", strip it and take the rest as comment.
  // This logic is now part of the primary CY check, but good to keep for comment extraction
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
  let lastFobRowRef: DashboardServiceDataRow | null = null; // Reference to the last FOB/FI row object

  rawData.forEach((rowArray, index) => {
    // console.log(`[DashboardParser] Processing rawData row ${index}:`, rowArray);
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // console.log(`[DashboardParser] Row ${index} is blank. Finalizing current section: ${currentSection?.serviceName}`);
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      lastFobRowRef = null; 
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1]; // Used to check if it's an FOB/FI row
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell); // A row is a CY by Col A if it's not FOB/FI and Col A contains "CY"
    const isCyType = isCyByColDType || isCyByColAType;


    if (isFobFiType) {
      if (!currentSection) {
        // This logic should ideally be handled by potential header row processing
        // For safety, if an FOB/FI row appears without a preceding header, create an implicit section
        currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
        // console.log(`[DashboardParser] Implicit section started for FOB/FI: '${currentSection.serviceName}' at row ${index}`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        lastFobRowRef = newFobRow; // <<<< Key: lastFobRowRef now points to the newly added FOB/FI row object
        // console.log(`[DashboardParser] >>> FOB/FI Row processed: '${newFobRow.route}'. Set lastFobRowRef. Current section: ${currentSection.serviceName}.`);
      } else {
        // console.warn(`[DashboardParser] processFobOrFiRow returned null for supposedly FOB/FI row ${index}:`, rowArray);
      }
    } else if (isCyType) {
      // console.log(`[DashboardParser] >>> CY Row Encountered at row ${index}. lastFobRowRef: ${lastFobRowRef?.route}, currentSection: ${currentSection?.serviceName}`);
      if (lastFobRowRef) { // Check if there is an FOB/FI row to attach to
        // Ensure railwayLegs array exists (it should be initialized by processFobOrFiRow)
        if (!lastFobRowRef.railwayLegs) {
          lastFobRowRef.railwayLegs = []; // Safety initialization
          // console.warn(`[DashboardParser] Initialized railwayLegs for ${lastFobRowRef.route} because it was undefined.`);
        }
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          lastFobRowRef.railwayLegs.push(railwayLegData);
          // console.log(`[DashboardParser]     Added Railway Leg to parent: '${lastFobRowRef.route}', Leg Origin: '${railwayLegData.originInfo}'. New railwayLegs count: ${lastFobRowRef.railwayLegs.length}`);
        } else {
          //  console.log(`[DashboardParser]     processRailwayLegRow returned null for CY row ${index}:`, rowArray);
        }
      } else {
        // console.warn(`[DashboardParser]     Found CY row ${index} but no 'lastFobRowRef' to attach to. Row:`, rowArray);
      }
    } else { // Not FOB/FI, not CY - could be a header or an empty/irrelevant row
      // Use the refined header check
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyByColDType, isCyByColAType);
      if (isHeader) {
        // console.log(`[DashboardParser] Potential Header Row at index ${index}: '${firstCell}'. Finalizing previous section: ${currentSection?.serviceName}`);
        finalizeCurrentSection(currentSection, parsedSections); // Finalize previous section before starting new
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty but A has content
        
        currentSection = { serviceName: newServiceName || `Service Section (Fallback at row ${index + 1})`, dataRows: [] };
        lastFobRowRef = null; // Reset for new section
        // console.log(`[DashboardParser] New section started with explicit header: '${currentSection.serviceName}' from row ${index}. lastFobRowRef reset.`);
      } else {
        //  console.log(`[DashboardParser] Skipping unidentified row type ${index} (not FOB/FI, not CY, not Header):`, rowArray);
      }
    }
  });

  // Finalize the last section after the loop
  finalizeCurrentSection(currentSection, parsedSections);
  // console.log("[DashboardParser] Finished parseDashboardSheet, total sections found:", parsedSections.length);
  // console.log("[DashboardParser] Final Structure:", JSON.parse(JSON.stringify(parsedSections)));
  return parsedSections;
}
