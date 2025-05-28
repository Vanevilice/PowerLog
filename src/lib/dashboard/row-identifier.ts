
export function isFobOrFiRow(firstCell: string, secondCellContent: any): boolean {
  const fCell = String(firstCell || '').trim().toUpperCase();
  return (fCell.startsWith("FOB") || fCell.startsWith("FI")) &&
         (secondCellContent !== null && secondCellContent !== undefined && String(secondCellContent).trim() !== "");
}

export function isCyRowByColD(fourthCellContent: any): boolean { // Checks Column D for "CY"
  const fourthCell = String(fourthCellContent || '').trim().toUpperCase();
  return fourthCell.startsWith("CY");
}

export function isCyInColA(firstCellContent: any): boolean { // Checks Column A for "CY"
    const firstCell = String(firstCellContent || '').trim().toUpperCase();
    return firstCell.includes("CY");
}


// A row is a potential header if it's not FOB/FI, not CY (by col D), not CY in Col A, and has meaningful content in columns A, B, or C.
export function isPotentialServiceHeaderRow(
  rowArray: any[],
  firstCellString: string,
  isFobFi: boolean,
  isCyColD: boolean,
  isCyColA: boolean
): boolean {
  if (isFobFi || isCyColD || isCyColA) return false;

  const colB = String(rowArray[1] || '').trim();
  const colC = String(rowArray[2] || '').trim();
  if (colB !== '' || colC !== '') {
    return true;
  }
  return firstCellString !== '';
}
