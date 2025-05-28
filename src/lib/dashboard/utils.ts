
// Regex for container types for dashboard parsing
const DASHBOARD_CONTAINER_REGEX = /^(20DC|40HC|20GP|40GP|20OT|40OT|20RF|40RF|ПОСУДА|20'DC|40'HC|20'GP|40'GP|20'OT|40'OT|20'RF|40'RF)/i;

export function formatDashboardRate(rateString: string | number | undefined | null): string {
  if (rateString === null || rateString === undefined) return 'N/A';
  let sValue = String(rateString).trim();
  if (sValue === "") return 'N/A';

  let currencySymbol: 'USD' | 'RUB' | null = null;
  let numberString = sValue;

  if (sValue.includes('$')) {
    currencySymbol = "USD";
    numberString = sValue.replace(/\$/g, '').trim();
  } else if (sValue.toLowerCase().includes('rub') || sValue.includes('₽')) {
    currencySymbol = "RUB";
    numberString = sValue.replace(/rub|₽/gi, '').trim();
  }
  
  numberString = numberString.replace(/\s/g, '').replace(',', '.');
  // Remove trailing .0 or .00
  numberString = numberString.replace(/\.(0+|0)$/, ''); 
  // If rate was like "1000.-", remove the trailing ".-"
  numberString = numberString.replace(/\.-$/, '');

  const num = parseFloat(numberString);

  if (!isNaN(num)) {
    let finalCurrency: 'USD' | 'RUB' = currencySymbol || 'USD'; // Default to USD if no explicit symbol

    if (!currencySymbol) { // Apply heuristic if no symbol was found
        const integerPart = String(Math.trunc(num));
        if (integerPart.length > 4) { 
            finalCurrency = "RUB";
        } else {
            finalCurrency = "USD";
        }
    }
    
    const formattedNum = num.toLocaleString('fr-FR', {
      minimumFractionDigits: (num % 1 === 0) ? 0 : 2, 
      maximumFractionDigits: 2 
    }).replace(',', '.'); 
    return `${formattedNum} ${finalCurrency}`;
  }
  return sValue; // Return original string if not parsable as number after cleanup
}

export function parseContainerInfoCell(cellValue: string | undefined | null): { containerType: string; comment: string } {
  const fullCellText = String(cellValue || '').trim();
  if (!fullCellText) {
    return { containerType: 'N/A', comment: '' };
  }

  const match = fullCellText.match(DASHBOARD_CONTAINER_REGEX);
  // Ensure the match is at the beginning of the string
  if (match && fullCellText.toUpperCase().startsWith(match[0].toUpperCase())) {
    const containerType = match[0].toUpperCase();
    // Correctly take the substring *after* the matched container type
    const remainingComment = fullCellText.substring(match[0].length).trim().replace(/^[:\s]+/, '');
    return { containerType, comment: remainingComment };
  }
  // If no standard type found at the beginning, the whole cell is a comment
  return { containerType: 'N/A', comment: fullCellText };
}
