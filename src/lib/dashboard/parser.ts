
import * as XLSX from 'xlsx';
import type { DashboardServiceSection, DashboardServiceDataRow } from '@/types';
import { formatDashboardRate, parseContainerInfoCell } from './utils';
import { isFobOrFiRow, isCyRow, isPotentialServiceHeaderRow } from './row-identifier';

export function parseDashboardSheet(worksheet: XLSX.WorkSheet): DashboardServiceSection[] {
  console.log("[DashboardParser] Starting parseDashboardSheet");
  const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
  const parsedSections: DashboardServiceSection[] = [];
  let currentSection: DashboardServiceSection | null = null;
  let lastFobRow: DashboardServiceDataRow | null = null;

  rawData.forEach((rowArray) => {
    if (!Array.isArray(rowArray) || rowArray.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[DashboardParser] Pushing section (due to blank row): ${currentSection.serviceName} with ${currentSection.dataRows.length} rows`);
        parsedSections.push(currentSection);
      }
      currentSection = null;
      lastFobRow = null;
      return;
    }

    const firstCell = String(rowArray[0] || '').trim();
    const secondCellContent = rowArray[1];
    const thirdCellContent = String(rowArray[2] || '').trim();
    const fourthCellContent = String(rowArray[3] || '').trim();

    const isFobFiType = isFobOrFiRow(firstCell, secondCellContent);
    const isCyType = isCyRow(fourthCellContent);

    if (isCyType) {
      if (lastFobRow && currentSection) { // Ensure currentSection is also active
        console.log("[DashboardParser] Processing CY Row for last FOB row:", lastFobRow.route);
        lastFobRow.railwayOriginInfo = firstCell || 'N/A'; // Column A for CY row
        lastFobRow.railwayCost = formatDashboardRate(secondCellContent);
        
        const { containerType: cyContainerType, comment: cyCommentFromContainerCell } = parseContainerInfoCell(thirdCellContent);
        lastFobRow.railwayContainerInfo = cyContainerType;
        
        const commentFromColDCY = fourthCellContent.substring(2).trim().replace(/^[:\s]+/, '');
        lastFobRow.railwayComment = [cyCommentFromContainerCell, commentFromColDCY].filter(Boolean).join(' | ') || '-';
      } else {
        console.warn("[DashboardParser] Found CY row but no preceding FOB/FI row OR no current section:", rowArray);
      }
    } else if (isFobFiType) {
      if (!currentSection) {
        currentSection = { serviceName: `Service Section ${parsedSections.length + 1}`, dataRows: [] };
        console.log(`[DashboardParser] New implicit section started for FOB/FI row: ${currentSection.serviceName}`);
      }
      
      const { containerType: containerTypeExtracted, comment: commentFromContainerCell } = parseContainerInfoCell(thirdCellContent);
      
      let finalAdditionalComment = String(fourthCellContent || '').trim();
      if (commentFromContainerCell) {
        finalAdditionalComment = finalAdditionalComment 
          ? `${commentFromContainerCell} | ${finalAdditionalComment}` 
          : commentFromContainerCell;
      }

      const dataRow: DashboardServiceDataRow = {
        route: firstCell,
        rate: formatDashboardRate(secondCellContent),
        containerInfo: containerTypeExtracted,
        additionalComment: finalAdditionalComment || '-',
      };
      currentSection.dataRows.push(dataRow);
      lastFobRow = dataRow;
      console.log("[DashboardParser] Added FOB/FI row:", dataRow.route);

    } else if (isPotentialServiceHeaderRow(rowArray, firstCell, isFobFiType, isCyType)) {
      if (currentSection && currentSection.dataRows.length > 0) {
        console.log(`[DashboardParser] Pushing section (due to new header): ${currentSection.serviceName} with ${currentSection.dataRows.length} rows`);
        parsedSections.push(currentSection);
      }
      
      const serviceNameColB = String(rowArray[1] || '').trim();
      const serviceNameColC = String(rowArray[2] || '').trim();
      let newServiceName = "";

      if (serviceNameColB && serviceNameColC) {
        newServiceName = `${serviceNameColB} ${serviceNameColC}`;
      } else if (serviceNameColB) {
        newServiceName = serviceNameColB;
      } else if (serviceNameColC) {
        newServiceName = serviceNameColC;
      } else if (firstCell) { // Fallback to first cell if B and C are empty but A has content
        newServiceName = firstCell;
      }

      if (!newServiceName) { // Should not happen if isPotentialServiceHeaderRow is true
        newServiceName = `Service Section ${parsedSections.length + 1}`;
      }
      currentSection = { serviceName: newServiceName, dataRows: [] };
      lastFobRow = null; // Reset for the new section
      console.log(`[DashboardParser] New section started with header: ${newServiceName}`);
    }
  });

  if (currentSection && currentSection.dataRows.length > 0) {
    console.log(`[DashboardParser] Pushing final section: ${currentSection.serviceName} with ${currentSection.dataRows.length} rows`);
    parsedSections.push(currentSection);
  }
  console.log("[DashboardParser] Finished parseDashboardSheet, sections found:", parsedSections.length);
  return parsedSections;
}
