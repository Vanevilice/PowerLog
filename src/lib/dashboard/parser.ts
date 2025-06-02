
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
    // console.log(`[processFobOrFiRow] Row is not FOB/FI type. First cell: '${firstCell}', Second cell: '${secondCellContent}'`);
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
    containerInfo: containerTypeExtracted, // Will be 'N/A' if not parsed
    additionalComment: finalAdditionalComment || '-',
    railwayLegs: [], // CRITICAL: Initialize railwayLegs as an empty array
  };
}

function processRailwayLegRow(rowArray: any[]): RailwayLegData | null {
  const originInfoRaw = String(rowArray[0] || '').trim();
  const costRaw = rowArray[1]; // Keep raw value for formatDashboardRate
  const containerCell = String(rowArray[2] || '').trim();
  const commentCellD = String(rowArray[3] || '').trim();

  const costFormatted = formatDashboardRate(costRaw); // Handles null, undefined, string, number
  const { containerType: legContainerType, comment: commentFromLegContainerCell } = parseContainerInfoCell(containerCell);

  let legComment = commentCellD;
  if (isCyRowByColD(commentCellD)) { // If "CY..." is in Column D
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) { // If "CY" is in Column A and NOT in Column D
      legComment = commentCellD; // Use Column D as is for comment
  }
  // If neither, legComment remains as commentCellD (which could be empty)

  if (commentFromLegContainerCell) {
    legComment = legComment ? `${commentFromLegContainerCell} | ${legComment}` : commentFromLegContainerCell;
  }
  const finalComment = legComment.trim();

  // A leg is valid if it has an origin, or a non-"N/A" cost, or a non-"N/A" container type (from parseContainerInfoCell), or a non-empty comment.
  const hasOrigin = originInfoRaw !== '';
  const hasCost = costFormatted !== 'N/A'; 
  // legContainerType from parseContainerInfoCell defaults to 'N/A' if not found.
  const hasContainer = legContainerType !== 'N/A'; 
  const hasComment = finalComment !== '' && finalComment !== '-';

  if (!hasOrigin && !hasCost && !hasContainer && !hasComment) {
    // This log helps identify rows that are CY-type but considered empty by this logic
    // console.log(`[processRailwayLegRow] Returning null (all fields empty/default for CY row). Raw: [${rowArray.join('|')}]`);
    return null;
  }

  return {
    originInfo: originInfoRaw || "N/A", // Default to "N/A" if raw is empty
    cost: costFormatted, // formatDashboardRate handles 'N/A' for null/undefined/empty inputs
    containerInfo: legContainerType, // parseContainerInfoCell defaults to 'N/A'
    comment: finalComment || '-', // Default to '-' if comment is empty after trim
  };
}


function finalizeCurrentSection(currentSection: DashboardServiceSection | null, parsedSections: DashboardServiceSection[]): void {
  if (currentSection && currentSection.dataRows.length > 0) {
    // console.log(`[DashboardParser] >>> Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    // currentSection.dataRows.forEach((row, index) => {
    //   console.log(
    //     `  [FOB Row ${index} in finalizing section "${currentSection.serviceName}"] Route: '${row.route}', Railway Legs count: ${row.railwayLegs ? row.railwayLegs.length : 'undefined/null'}`
    //   );
    //   if (row.railwayLegs && row.railwayLegs.length > 0) {
    //     // console.log(`    First leg for '${row.route}':`, JSON.stringify(row.railwayLegs[0]));
    //   } else if (row.railwayLegs && row.railwayLegs.length === 0) {
    //     // console.log(`    WARNING: Row '${row.route}' has an empty railwayLegs array.`);
    //   } else {
    //     // console.log(`    WARNING: Row '${row.route}' has railwayLegs as undefined/null.`);
    //   }
    // });
    parsedSections.push(currentSection);
    // console.log(`[DashboardParser] <<< Finished finalizing section: "${currentSection.serviceName}". Section pushed to parsedSections.`);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let currentFobRowForLegs: DashboardServiceDataRow | null = null; 

  // console.log(`[DashboardParser] Starting to parse ${rawData.length} raw rows.`);

  rawData.forEach((rowArray, index) => {
    const excelRowNum = index + 1; // 1-based for easier Excel reference
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // console.log(`[DashboardParser] Row ${excelRowNum}: Skipping completely blank row.`);
      return; // Skip fully blank rows
    }

    const firstCell = String(rowArray[0] || '').trim();
    const colB = String(rowArray[1] || '').trim();
    const colC = String(rowArray[2] || '').trim();
    const colD = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, rowArray[1]);
    const isCyColDType = isCyRowByColD(colD);
    const isCyColAType = !isFobFiType && isCyInColA(firstCell); // Must not also be an FOB/FI row
    const isCyType = isCyColDType || isCyColAType;
    const isHeaderType = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyColDType, isCyColAType);

    // console.log(`[DashboardParser] Row ${excelRowNum}: Data [${rowArray.slice(0,4).join('|')}], isHeader=${isHeaderType}, isFobFi=${isFobFiType}, isCy=${isCyType} (isCyColD=${isCyColDType}, isCyColA=${isCyColAType})`);

    if (isHeaderType) {
      finalizeCurrentSection(currentSection, parsedSections);
      currentFobRowForLegs = null; // Reset FOB/FI context for new section
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
      currentSection = { serviceName: newServiceName || `Service Section (Row ${excelRowNum})`, dataRows: [] };
      // console.log(`[DashboardParser] Row ${excelRowNum}: New Header identified: "${currentSection.serviceName}". Reset currentFobRowForLegs.`);
    } else if (isFobFiType) {
      if (!currentSection) { // If no current section, start a new one implicitly
        currentSection = { serviceName: `Service Section (Implicit at row ${excelRowNum})`, dataRows: [] };
        // console.log(`[DashboardParser] Row ${excelRowNum}: Implicit Header created: "${currentSection.serviceName}". currentFobRowForLegs is currently ${currentFobRowForLegs ? `'${currentFobRowForLegs.route}'` : 'null'}.`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        currentFobRowForLegs = newFobRow; // << Point to the object that was just pushed
        // console.log(`[DashboardParser] Row ${excelRowNum}: Processed FOB/FI row, added to section "${currentSection.serviceName}". Route: '${newFobRow.route}'. Set as currentFobRowForLegs. Legs count: ${newFobRow.railwayLegs.length}.`);
      } else {
        currentFobRowForLegs = null; // Invalid FOB/FI row, so clear current parent context
        // console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as FOB/FI type, but processFobOrFiRow returned null. Cleared currentFobRowForLegs.`);
      }
    } else if (isCyType) {
      if (currentFobRowForLegs) {
        // console.log(`[DashboardParser] Row ${excelRowNum}: Identified as CY. Attempting to attach to currentFobRowForLegs: '${currentFobRowForLegs.route}'. Legs before: ${currentFobRowForLegs.railwayLegs.length}`);
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // console.log(`[DashboardParser DEBUG] About to push leg to '${currentFobRowForLegs.route}'. Current legs count: ${currentFobRowForLegs.railwayLegs.length}. Leg Data:`, JSON.stringify(railwayLegData));
          currentFobRowForLegs.railwayLegs.push(railwayLegData);
          // console.log(`[DashboardParser] Row ${excelRowNum}: Attached Railway Leg ('${railwayLegData.originInfo}') to '${currentFobRowForLegs.route}'. Total legs on parent now: ${currentFobRowForLegs.railwayLegs.length}.`);
        } else {
          // console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as CY for '${currentFobRowForLegs.route}', but processRailwayLegRow returned null. Not attached. Raw CY data: [${rowArray.join('|')}]`);
        }
      } else {
        // console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as CY, but no currentFobRowForLegs (no active FOB/FI parent). Raw CY data: [${rowArray.join('|')}] Skipping.`);
      }
    } else {
      // This row is not a header, not FOB/FI, and not CY.
      // It could be a spacer or miscellaneous text.
      // currentFobRowForLegs is intentionally NOT reset here.
      // console.log(`[DashboardParser] Row ${excelRowNum}: Not Header, FOB/FI, or CY. currentFobRowForLegs ('${currentFobRowForLegs?.route || 'null'}') maintained. Data: [${rowArray.join('|')}]`);
    }
  });

  finalizeCurrentSection(currentSection, parsedSections); // Finalize the last section
  // console.log(`[DashboardParser] Finished parsing all rows. Total sections parsed: ${parsedSections.length}`);
  return parsedSections;
}

    