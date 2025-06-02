
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

export function parsePriceCell(cellValue: any): string | number | null {
  if (cellValue === null || cellValue === undefined) return null;
  let sValueOriginal = String(cellValue).trim();
  if (sValueOriginal === "" || sValueOriginal.toLowerCase() === "n/a") return null;

  // Handle cases like "1 500 / 1 600" - take the first number
  if (sValueOriginal.includes('/') && sValueOriginal.match(/\d+\s*\/\s*\d+/)) {
    sValueOriginal = sValueOriginal.split('/')[0].trim();
  }
  
  // Remove currency symbols and extra spaces for numeric parsing
  const sValueNumericCandidate = sValueOriginal
    .replace(/\$/g, '')
    .replace(/€/g, '')
    .replace(/₽/g, '')
    .replace(/USD/gi, '')
    .replace(/EUR/gi, '')
    .replace(/RUB/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
    
  const num = parseFloat(sValueNumericCandidate);

  if (!isNaN(num)) {
    return num;
  } else {
    // Return the original string if it's not a simple number but might be a special format like "$ X / $ Y"
    // This is particularly relevant for DropOff prices which might have such formats.
    // However, we already tried to parse the first part if it contains '/'
    // If it's still not a number, it's likely a non-numeric string or complex format we don't fully handle.
    // For simplicity, if it's not parseable to a number after basic cleanup, treat as non-price for calculation.
    // But for display, the original string might be useful.
    // For calculation logic, we primarily need numbers. So, if not a number, return null.
    // If the original string is important for display, the calling code should handle it.
    // Let's return the original if it's not empty and not "N/A", so it can be displayed as text.
    // The calculation logic (parseFirstNumberFromString) will then attempt to get a number from it.
    return sValueOriginal;
  }
}
