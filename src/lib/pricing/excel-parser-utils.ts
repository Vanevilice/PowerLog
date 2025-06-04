
// src/lib/pricing/excel-parser-utils.ts

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
  // Split by slash or comma
  String(cellValue).trim().split(/[,/]/g).forEach(line => {
    const trimmedLine = line.trim();
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
  // Split by slash or comma
  return String(cellValue).trim().split(/[,/]/g).map(city => city.trim()).filter(city => city);
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
  let sValueOriginal = String(cellValue).trim();
  // Check for common non-price strings or empty strings after trim
  if (sValueOriginal === "" || sValueOriginal.toLowerCase() === "n/a" || sValueOriginal === "-") return null;

  // Handle cases like "1 500 / 1 600" - take the first number
  if (sValueOriginal.includes('/') && sValueOriginal.match(/\d[\d\s.,]*\/\d[\d\s.,]*/)) {
    sValueOriginal = sValueOriginal.split('/')[0].trim();
  }

  // Remove currency symbols/units (like P, $, €, RUB, USD, EUR, р., руб.)
  // and spaces. Standardize decimal separator.
  const sValueNumericCandidate = sValueOriginal
    .replace(/\$|€|₽|USD|EUR|RUB|P|р\.|руб\./gi, '') // Remove common currency symbols/units. Note: "р." includes dot.
    .replace(/\s/g, '')    // Remove all spaces (e.g., "149 000" -> "149000")
    .replace(',', '.');     // Standardize decimal separator to dot (e.g., "123,45" -> "123.45")

  const num = parseFloat(sValueNumericCandidate);

  if (!isNaN(num)) {
    return num;
  } else {
    // console.warn(`parsePriceCell could not parse "${String(cellValue).trim()}" to a number (cleaned: "${sValueNumericCandidate}"). Returning null.`);
    return null; // If not a number after cleaning, return null
  }
}
