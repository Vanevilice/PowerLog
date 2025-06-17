
// src/lib/pricing/excel-parser-utils.ts
import { normalizeCityName } from './utils'; // Import normalizeCityName

export function parsePortsCell(cellValue: string | undefined, isDestination: boolean): string[] {
  if (!cellValue) return [];
  const ports = new Set<string>();
  const cellString = String(cellValue).trim();
  // Split by slash not inside parentheses: /\/(?![^(]*\))/g
  // Split by slash OR comma not inside parentheses: /[,/](?![^(]*\))/g
  const entries = cellString.split(/[,/](?![^(]*\))/g);
  const destPortPattern = /([^\/(,]+)\s*\(([^)]+)\)/; // Adjusted to not split on slash within parentheses

  entries.forEach(entry => {
    entry = entry.trim();
    if (!entry) return;
    if (isDestination) {
      const match = entry.match(destPortPattern);
      if (match) {
        const baseName = match[1].trim();
        const subPortsString = match[2];
        // Split sub-ports by slash or comma
        subPortsString.split(/[,/]/g).map(p => p.trim()).forEach(subPort => {
          if (subPort) ports.add(`${baseName} (${subPort})`);
        });
        if (!subPortsString.trim() && baseName) { // Case like "PortName ()"
           ports.add(baseName);
        }
      } else {
        ports.add(entry);
      }
    } else {
      ports.add(entry);
    }
  });
  return Array.from(ports).sort();
}

export function parseSeaLinesCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  const seaLines = new Set<string>();
  let processedCellValue = String(cellValue).trim();

  // Define the specific string and a placeholder
  const targetString = "REEL/HUB Shipping";
  const placeholder = "___PLACEHOLDER_REEL_HUB_SHIPPING___"; // Unique placeholder

  // Temporarily replace the target string (case-insensitive)
  // Escape special characters in targetString for RegExp
  const escapedTargetString = targetString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexTarget = new RegExp(escapedTargetString, 'gi');
  processedCellValue = processedCellValue.replace(regexTarget, placeholder);

  // Split by slash or comma
  processedCellValue.split(/[,/]/g).forEach(line => {
    let trimmedLine = line.trim();
    // Restore the placeholder
    if (trimmedLine === placeholder) {
      trimmedLine = targetString; // Restore to original/desired casing
    }
    if (trimmedLine) seaLines.add(trimmedLine);
  });
  return Array.from(seaLines).sort();
}

export function parseRailStationsCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  const stations = new Set<string>();
  // Split by slash or comma
  String(cellValue).trim().split(/[,/]/g).forEach(station => {
    const trimmedStation = station.trim();
    if (trimmedStation) stations.add(trimmedStation);
  });
  return Array.from(stations).sort();
}

export function parseDropOffCitiesCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  // Split by slash or comma, then normalize each city name
  return String(cellValue).trim().split(/[,/]/g)
    .map(city => normalizeCityName(city.trim())) // Use normalizeCityName here
    .filter(city => city); // Filter out any empty strings that might result from normalization
}

export function parseGenericListCell(cellValue: string | undefined): string[] {
    if (!cellValue) return [];
    const items = new Set<string>();
    String(cellValue).trim().split(/[,;/]/g).forEach(item => {
        const trimmedItem = item.trim();
        if (trimmedItem) items.add(trimmedItem);
    });
    return Array.from(items).sort();
}

export function parsePriceCell(cellValue: any): number | null {
  if (cellValue === null || cellValue === undefined) return null;
  let sValue = String(cellValue).trim();
  
  if (sValue === "" || sValue.toLowerCase() === "n/a" || sValue === "-") return null;

  // Handle cases like "1 500 / 2 000" - take the first part
  if (sValue.includes('/') && sValue.match(/\d[\d\s.,]*\/\d[\d\s.,]*/)) {
    sValue = sValue.split('/')[0].trim();
  }

  // 1. Replace common currency symbols or text (rub, usd, $, р.) if they are not part of a word.
  //    Using word boundaries \b to avoid replacing parts of words.
  sValue = sValue.replace(/\b(rub|usd|р\.|руб)\b|\$|€|₽/gi, '').trim();

  // 2. Replace all comma decimal separators with a period.
  let numericString = sValue.replace(/,/g, '.');
  
  // 3. Filter the string to keep only digits and the first decimal point found.
  let hasDecimal = false;
  numericString = Array.from(numericString).filter(char => {
    if (char >= '0' && char <= '9') return true;
    if (char === '.' && !hasDecimal) {
      hasDecimal = true;
      return true;
    }
    return false;
  }).join('');
  
  if (numericString === "") return null; // If nothing is left after stripping

  const num = parseFloat(numericString);

  if (!isNaN(num)) {
    return num;
  }
  
  // console.warn(`parsePriceCell (aggressive) could not parse "${String(cellValue).trim()}" (cleaned: "${numericString}") to number. Returning null.`);
  return null;
}

