
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
    railwayLegs: [], // Initialize with an empty array for railway legs
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
  // For CY in Col A, Col D is entirely comment.
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
    parsedSections.push(currentSection);
  }
}


export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let lastFobRowRef: DashboardServiceDataRow | null = null; 
  let hasProcessedFobInCurrentSection = false; // Indicates if the current context is following an FOB/FI row

  rawData.forEach((rowArray, index) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      finalizeCurrentSection(currentSection, parsedSections);
      currentSection = null;
      lastFobRowRef = null;
      hasProcessedFobInCurrentSection = false;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1];
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyByColDType = isCyRowByColD(fourthCellContent);
    const isCyByColAType = !isFobFiType && isCyInColA(firstCell); // Ensure it's not also FOB/FI
    const isCyType = isCyByColDType || isCyByColAType;

    if (isFobFiType) {
      // If there's an existing currentSection, finalize it before starting a new implicit one (if needed) or adding to it.
      // However, an FOB/FI row usually belongs to the current or a new section.
      // If it's a new logical block of FOB/FI, it might imply the previous header's section continues or a new implicit one.
      // For simplicity, if currentSection is null, we create one.
      if (!currentSection) {
         currentSection = { serviceName: `Service Section (Implicit at row ${index + 1})`, dataRows: [] };
      }

      const newFobRow = processFobOrFiRow(rowArray);
      if (newFobRow) {
        currentSection.dataRows.push(newFobRow);
        lastFobRowRef = newFobRow; // This is the crucial reference for upcoming CY rows
        hasProcessedFobInCurrentSection = true;
      } else {
        // This case (isFobFiType is true but processFobOrFiRow returns null) should be rare if isFobOrFiRow is accurate.
        // It means the row looked like FOB/FI but couldn't be processed. Break the chain.
        hasProcessedFobInCurrentSection = false;
        lastFobRowRef = null; 
      }
    } else if (isCyType) {
      if (currentSection && lastFobRowRef && hasProcessedFobInCurrentSection) {
        // This CY row belongs to the `lastFobRowRef`
        const railwayLegData = processRailwayLegRow(rowArray);
        if (railwayLegData) {
          // railwayLegs array is initialized in processFobOrFiRow
          lastFobRowRef.railwayLegs!.push(railwayLegData);
        }
      }
      // A CY row continues the FOB/FI context, so hasProcessedFobInCurrentSection remains true.
      // It does not change lastFobRowRef, as it's a child of the current lastFobRowRef.
    } else { 
      // Neither FOB/FI nor CY. Could be a header or an irrelevant row.
      const isHeader = isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyType);
      if (isHeader) {
        finalizeCurrentSection(currentSection, parsedSections); // Finalize previous section
        
        const serviceNameColB = String(rowArray[1] || '').trim();
        const serviceNameColC = String(rowArray[2] || '').trim();
        let newServiceName = "";

        if (serviceNameColB && serviceNameColC) newServiceName = `${serviceNameColB} ${serviceNameColC}`;
        else if (serviceNameColB) newServiceName = serviceNameColB;
        else if (serviceNameColC) newServiceName = serviceNameColC;
        else if (firstCell) newServiceName = firstCell; // Fallback to first cell if B and C are empty
        
        currentSection = { serviceName: newServiceName || `Service Section (Fallback at row ${index + 1})`, dataRows: [] };
        lastFobRowRef = null; // Reset for the new section
        hasProcessedFobInCurrentSection = false; // New section starts, no FOB/FI processed yet.
      } else {
        // If it's not a header, and not FOB/FI/CY, it's an unknown row type or blank-ish row.
        // This breaks the FOB/FI chain for appending CY rows.
        hasProcessedFobInCurrentSection = false;
        // We don't reset lastFobRowRef here, as it might just be an intermittent non-data row within a service.
        // If a new FOB/FI row comes, it will correctly set lastFobRowRef.
      }
    }
  });

  finalizeCurrentSection(currentSection, parsedSections);
  return parsedSections;
}

    