
export function isFobOrFiRow(firstCell: string, secondCellContent: any): boolean {
  const fCell = String(firstCell || '').trim().toUpperCase();
  return (fCell.startsWith("FOB") || fCell.startsWith("FI")) &&
         (secondCellContent !== null && secondCellContent !== undefined && String(secondCellContent).trim() !== "");
}

export function isCyRow(fourthCellContent: any): boolean {
  const fourthCell = String(fourthCellContent || '').trim().toUpperCase();
  return fourthCell.startsWith("CY");
}

// A row is a potential header if it's not FOB/FI, not CY, and has meaningful content in columns A, B, or C.
export function isPotentialServiceHeaderRow(rowArray: any[], firstCellString: string, isFobFi: boolean, isCy: boolean): boolean {
  if (isFobFi || isCy) return false; // If it's already identified as FOB/FI or CY, it's not a header.
  
  // Check if column B or C has content, these are primary indicators for service names.
  const colB = String(rowArray[1] || '').trim();
  const colC = String(rowArray[2] || '').trim();
  if (colB !== '' || colC !== '') {
    return true;
  }
  
  // Fallback: if A has content and B & C are empty, it might still be a header (less likely for multi-word service names)
  // but we accept it if other conditions (not FOB/FI/CY) are met.
  return firstCellString !== '';
}
