
// src/lib/pricing/city-station-mapper.ts

interface StationCityMapping {
  city: string;
  stationKeywords: string[]; // Keywords to identify stations belonging to this city
}

// Normalize keywords to uppercase for case-insensitive matching
const STATION_TO_CITY_MAPPINGS: StationCityMapping[] = [
  {
    city: "Москва", // Moscow
    stationKeywords: [
      "ТУЧКОВО", "КУПАВНА", "СЕЛЯТИНО", "ЛЮБЕРЦЫ", "ЭЛЕКТРОУГЛИ",
      "СТАНЦИИ МОС. УЗЛА", "МОС. УЗЛА" // "станции Мос. узла" and "Мос. узла"
    ]
  },
  {
    city: "Екатеринбург", // Ekaterinburg
    stationKeywords: ["ЕКБ-ТОВАРНЫЙ", "ЕКБ-ТОВ.", "АППАРАТНАЯ"] // "ЕКБ-Тов." and "Аппаратная"
  },
  {
    city: "Новосибирск", // Novosibirsk
    stationKeywords: ["ЧИК", "ЧЕМСКОЙ"]
  },
  {
    city: "Санкт-Петербург", // Saint-Petersburg
    stationKeywords: ["ЗАНЕВСКИЙ ПОСТ (СПБ)", "ЗАНЕВСКИЙ ПОСТ"] // Handles with and without (СПб)
  }
  // Add more mappings as needed
];

/**
 * Gets the mapped city name from a given station name string.
 * The station name is normalized (uppercase, trimmed) and checked against keywords.
 * @param stationName The station name string, possibly containing extra details.
 * @returns The mapped city name (e.g., "Москва", "Екатеринбург") or null if no match.
 */
export function getCityFromStationName(stationName: string | null | undefined): string | null {
  if (!stationName || typeof stationName !== 'string') {
    return null;
  }

  const normalizedStationInput = stationName.toUpperCase().trim();

  for (const mapping of STATION_TO_CITY_MAPPINGS) {
    for (const keyword of mapping.stationKeywords) {
      // Check if the normalized input *contains* the keyword.
      // This allows for variations like "FOR станция Купавна (новая)" to match "Купавна".
      if (normalizedStationInput.includes(keyword)) {
        return mapping.city;
      }
    }
  }

  return null; // No city found for the given station name
}
