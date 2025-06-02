
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
  if (isCyRowByColD(commentCellD)) {
      legComment = commentCellD.substring(2).trim().replace(/^[:\s]+/, '');
  } else if (isCyInColA(originInfoRaw) && !isCyRowByColD(commentCellD)) {
      legComment = commentCellD;
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
    console.log(`[DashboardParser] >>> Finalizing section: "${currentSection.serviceName}" with ${currentSection.dataRows.length} FOB/FI rows.`);
    currentSection.dataRows.forEach((row, index) => {
      console.log(`  [FOB Row ${index} of section "${currentSection.serviceName}"] Route: '${row.route}', Railway Legs count: ${row.railwayLegs ? row.railwayLegs.length : 'undefined/null'}`);
      if (row.railwayLegs && row.railwayLegs.length > 0) {
         // console.log(`    Legs Data for '${row.route}':`, JSON.parse(JSON.stringify(row.railwayLegs)));
      }
    });
    console.log(`[DashboardParser] <<< Finished finalizing section: "${currentSection.serviceName}".`);
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;

  console.log(`[DashboardParser] Starting to parse ${rawData.length} raw rows.`);

  rawData.forEach((rowArray, index) => {
    const excelRowNum = index + 1; // 1-based for easier Excel correlation
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      // console.log(`[DashboardParser] Row ${excelRowNum} is blank, skipping.`);
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const colB = String(rowArray[1] || '').trim();
    const colC = String(rowArray[2] || '').trim();
    const colD = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, rowArray[1]);
    const isCyColDType = isCyRowByColD(colD);
    const isCyColAType = !isFobFiType && isCyInColA(firstCell); // CY determined by Col A only if not FOB/FI
    const isCyType = isCyColDType || isCyColAType;

    const isHeaderType = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyColDType, isCyColAType);

    // console.log(`[DashboardParser] Row ${excelRowNum}: Raw: [${rowArray.join('|')}], isHeader: ${isHeaderType}, isFobFi: ${isFobFiType}, isCy: ${isCyType}`);

    if (isHeaderType) {
      finalizeCurrentSection(currentSection, parsedSections);
      let newServiceName = "";
      if (colB && colC) newServiceName = `${colB} ${colC}`;
      else if (colB) newServiceName = colB;
      else if (colC) newServiceName = colC;
      else if (firstCell) newServiceName = firstCell;
      currentSection = { serviceName: newServiceName || `Service Section (Row ${excelRowNum})`, dataRows: [] };
      console.log(`[DashboardParser] Row ${excelRowNum}: New Header identified: "${currentSection.serviceName}".`);
    } else if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section (Implicit at row ${excelRowNum})`, dataRows: [] };
        console.log(`[DashboardParser] Row ${excelRowNum}: Implicit Header created: "${currentSection.serviceName}".`);
      }
      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        console.log(`[DashboardParser] Row ${excelRowNum}: Processed FOB/FI row, added to section "${currentSection.serviceName}". Route: '${newFobRow.route}'. Initial railway legs: ${newFobRow.railwayLegs.length}. Current dataRows in section: ${currentSection.dataRows.length}`);
      } else {
         console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as FOB/FI type, but processFobOrFiRow returned null.`);
      }
    } else if (isCyType) {
      if (currentSection && currentSection.dataRows.length > 0) {
        const parentFobRow = currentSection.dataRows[currentSection.dataRows.length - 1];
        console.log(`[DashboardParser] Row ${excelRowNum}: Identified as CY. Attempting to attach to parent FOB/FI row '${parentFobRow.route}' (Index ${currentSection.dataRows.length - 1} in current section). Parent railwayLegs before: ${parentFobRow.railwayLegs?.length || 'undefined/null'}`);
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          if (!parentFobRow.railwayLegs) { // Should be initialized, but defensive check
            parentFobRow.railwayLegs = [];
            console.warn(`[DashboardParser] Row ${excelRowNum}: Parent FOB/FI row '${parentFobRow.route}' railwayLegs was unexpectedly not initialized. Initialized now.`);
          }
          parentFobRow.railwayLegs.push(railwayLegData);
          console.log(`[DashboardParser] Row ${excelRowNum}: Attached Railway Leg ('${railwayLegData.originInfo}') to parent '${parentFobRow.route}'. Total legs on parent now: ${parentFobRow.railwayLegs.length}.`);
        } else {
           console.log(`[DashboardParser] Row ${excelRowNum}: Identified as CY, but processRailwayLegRow returned null. Not attached. Raw CY data: [${rowArray.join('|')}]`);
        }
      } else {
        console.warn(`[DashboardParser] Row ${excelRowNum}: Identified as CY, but no current section or no FOB/FI rows in current section to attach it to. Raw CY data: [${rowArray.join('|')}] Skipping.`);
      }
    } else {
      // console.log(`[DashboardParser] Row ${excelRowNum}: Not Header, FOB/FI, or CY. Skipping main logic. Content: ${firstCell}`);
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  console.log(`[DashboardParser] Finished parsing all rows. Total sections parsed: ${parsedSections.length}`);
  return parsedSections;
}

