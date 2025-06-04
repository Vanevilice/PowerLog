
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues, PricingDataContextType, ShipmentType, ContainerType,
  ExcelRoute, ExcelSOCRoute, RailDataEntry,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS } from '@/lib/pricing/constants';

interface UseSeaRailDropdownLogicProps {
  form: UseFormReturn<RouteFormValues>;
  context: PricingDataContextType;
  hasRestoredFromCache: boolean;
  setLocalAvailableDestinationPorts: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableDestinationPorts: string[];
  setLocalAvailableSeaLines: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableSeaLines: string[];
  setLocalAvailableRussianDestinationCities: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableRussianDestinationCities: string[];
  setLocalAvailableArrivalStations: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableArrivalStations: string[];
}

// Helper function for Destination Ports effect
function useEffectForDestinationPorts(
  form: UseFormReturn<RouteFormValues>,
  context: PricingDataContextType,
  hasRestoredFromCache: boolean,
  watchedShipmentType: ShipmentType,
  watchedOriginPort: string | undefined,
  localAvailableDestinationPorts: string[],
  setLocalAvailableDestinationPorts: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { getValues, setValue } = form;
  const { isSeaRailExcelDataLoaded, excelRouteData, excelSOCRouteData } = context;

  React.useEffect(() => {
    if (!isSeaRailExcelDataLoaded) {
      if (JSON.stringify(localAvailableDestinationPorts) !== JSON.stringify([])) setLocalAvailableDestinationPorts([]);
      return;
    }
    const currentOriginPort = getValues("originPort");
    const dataset = watchedShipmentType === "COC" ? excelRouteData : excelSOCRouteData;
    const originFieldKey = watchedShipmentType === "COC" ? "originPorts" : "departurePorts";
    let newAvailableDestinations = new Set<string>();

    if (currentOriginPort) {
      dataset.forEach(route => {
        const routeOrigins = route[originFieldKey as keyof ExcelRoute | keyof ExcelSOCRoute] as string[] | undefined;
        const hasSeaLines = Array.isArray(route.seaLines) && route.seaLines.length > 0;
        if (hasSeaLines && Array.isArray(routeOrigins) && routeOrigins.includes(currentOriginPort)) {
          if (Array.isArray(route.destinationPorts)) route.destinationPorts.forEach(dp => newAvailableDestinations.add(dp));
        }
      });
    } else {
      dataset.forEach(route => {
        const hasSeaLines = Array.isArray(route.seaLines) && route.seaLines.length > 0;
        if (hasSeaLines && Array.isArray(route.destinationPorts)) route.destinationPorts.forEach(dp => newAvailableDestinations.add(dp));
      });
    }
    const newAvailableArray = Array.from(newAvailableDestinations).sort((a, b) => {
      if (VLADIVOSTOK_VARIANTS.includes(a) && !VLADIVOSTOK_VARIANTS.includes(b)) return -1;
      if (!VLADIVOSTOK_VARIANTS.includes(a) && VLADIVOSTOK_VARIANTS.includes(b)) return 1;
      return a.localeCompare(b);
    });

    if (JSON.stringify(localAvailableDestinationPorts) !== JSON.stringify(newAvailableArray)) {
      setLocalAvailableDestinationPorts(newAvailableArray);
    }
    if (hasRestoredFromCache) {
      const currentFormDestinationPort = getValues("destinationPort");
      if (currentOriginPort && currentFormDestinationPort && !newAvailableArray.includes(currentFormDestinationPort)) {
        if (getValues("destinationPort") !== "") setValue("destinationPort", "", { shouldValidate: true });
      }
    }
  }, [watchedOriginPort, watchedShipmentType, isSeaRailExcelDataLoaded, excelRouteData, excelSOCRouteData, setValue, getValues, hasRestoredFromCache, localAvailableDestinationPorts, setLocalAvailableDestinationPorts]);
}

// Helper function for Sea Lines effect
function useEffectForSeaLines(
  form: UseFormReturn<RouteFormValues>,
  context: PricingDataContextType,
  hasRestoredFromCache: boolean,
  watchedShipmentType: ShipmentType,
  watchedOriginPort: string | undefined,
  watchedDestinationPort: string | undefined,
  localAvailableSeaLines: string[],
  setLocalAvailableSeaLines: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { getValues, setValue } = form;
  const { isSeaRailExcelDataLoaded, excelRouteData, excelSOCRouteData } = context;

  React.useEffect(() => {
    if (!isSeaRailExcelDataLoaded || !watchedOriginPort || !watchedDestinationPort) {
      if (JSON.stringify(localAvailableSeaLines) !== JSON.stringify([])) setLocalAvailableSeaLines([]);
      if (hasRestoredFromCache && getValues("seaLineCompany") !== NONE_SEALINE_VALUE && getValues("seaLineCompany") !== "") {
        if (getValues("seaLineCompany") !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
      return;
    }
    const currentDataset = watchedShipmentType === "COC" ? excelRouteData : excelSOCRouteData;
    const originFieldKey = watchedShipmentType === "COC" ? "originPorts" : "departurePorts";
    const filteredSeaLines = new Set<string>();
    currentDataset.forEach(route => {
      const routeOrigins = route[originFieldKey as keyof ExcelRoute | keyof ExcelSOCRoute] as string[] | undefined;
      if (Array.isArray(routeOrigins) && routeOrigins.includes(watchedOriginPort) &&
          Array.isArray(route.destinationPorts) && route.destinationPorts.includes(watchedDestinationPort)) {
        if (Array.isArray(route.seaLines)) route.seaLines.forEach(sl => filteredSeaLines.add(sl));
      }
    });
    const newAvailable = Array.from(filteredSeaLines).sort();
    if (JSON.stringify(localAvailableSeaLines) !== JSON.stringify(newAvailable)) setLocalAvailableSeaLines(newAvailable);
    if (hasRestoredFromCache) {
      const currentSeaLineValue = getValues("seaLineCompany");
      if (currentSeaLineValue && currentSeaLineValue !== NONE_SEALINE_VALUE && !newAvailable.includes(currentSeaLineValue)) {
        if (getValues("seaLineCompany") !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
    }
  }, [watchedShipmentType, watchedOriginPort, watchedDestinationPort, excelRouteData, excelSOCRouteData, isSeaRailExcelDataLoaded, setValue, getValues, hasRestoredFromCache, localAvailableSeaLines, setLocalAvailableSeaLines]);
}

// Helper function for Russian Destination Cities effect
function useEffectForRussianDestinationCities(
  form: UseFormReturn<RouteFormValues>,
  context: PricingDataContextType,
  hasRestoredFromCache: boolean,
  watchedOriginPort: string | undefined, // Kept for consistency in auto-clearing if origin changes
  watchedContainerType: ContainerType | undefined,
  localAvailableRussianDestinationCities: string[],
  setLocalAvailableRussianDestinationCities: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { getValues, setValue } = form;
  const { isSeaRailExcelDataLoaded, excelRailData, excelRussianDestinationCitiesMasterList } = context;

  React.useEffect(() => {
    const currentRussianCity = getValues("russianDestinationCity");
    const currentArrivalStation = getValues("arrivalStationSelection");

    if (!isSeaRailExcelDataLoaded || !watchedContainerType || excelRailData.length === 0) {
      if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify([])) {
        setLocalAvailableRussianDestinationCities([]);
      }
      if (hasRestoredFromCache) {
        if (currentRussianCity !== "") setValue("russianDestinationCity", "", { shouldValidate: true });
        if (currentArrivalStation !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
      return;
    }

    const availableCitiesFromRail = new Set<string>();
    excelRailData.forEach(railEntry => {
      const hasPriceForContainer = watchedContainerType === "20DC"
        ? (railEntry.price20DC_24t !== null || railEntry.price20DC_28t !== null)
        : (railEntry.price40HC !== null);

      if (hasPriceForContainer) {
        availableCitiesFromRail.add(railEntry.cityOfArrival);
      }
    });

    const newAvailableArray = Array.from(availableCitiesFromRail).sort();

    if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify(newAvailableArray)) {
      setLocalAvailableRussianDestinationCities(newAvailableArray);
    }

    if (hasRestoredFromCache) {
      if (currentRussianCity && !newAvailableArray.includes(currentRussianCity)) {
        setValue("russianDestinationCity", "", { shouldValidate: true });
        setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
    }
  }, [
    isSeaRailExcelDataLoaded,
    watchedOriginPort, // Retained for potential cascading clear effects.
    watchedContainerType,
    excelRailData,
    excelRussianDestinationCitiesMasterList,
    setLocalAvailableRussianDestinationCities,
    localAvailableRussianDestinationCities,
    getValues,
    setValue,
    hasRestoredFromCache
  ]);
}


// Helper function for Arrival Stations effect
function useEffectForArrivalStations(
  form: UseFormReturn<RouteFormValues>,
  context: PricingDataContextType,
  hasRestoredFromCache: boolean,
  watchedRussianDestinationCity: string | undefined,
  watchedDestinationPort: string | undefined, // Sea port
  localAvailableArrivalStations: string[],
  setLocalAvailableArrivalStations: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { getValues, setValue } = form;
  const { isSeaRailExcelDataLoaded, excelRailData } = context;

  React.useEffect(() => {
    let newAvailableStationsArray: string[] = [];
    const selectedRussianCity = getValues("russianDestinationCity");
    const selectedSeaPort = getValues("destinationPort");

    if (isSeaRailExcelDataLoaded && selectedRussianCity && selectedSeaPort &&
        (VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0])) || VOSTOCHNIY_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0]))) &&
        excelRailData.length > 0) {
      const stationsForCity = new Set<string>();
      const seaPortLower = selectedSeaPort.toLowerCase();
      const seaPortBaseName = selectedSeaPort.split(" ")[0].toLowerCase();
      const specificSeaHubKeywordMatch = selectedSeaPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split(/[/\s-]+/).map(s => s.trim()).filter(Boolean) : [];
      const isVladivostokHubArrival = VLADIVOSTOK_VARIANTS.some(v => seaPortLower.startsWith(v.toLowerCase().split(" ")[0]));
      const isVostochniyHubArrival = VOSTOCHNIY_VARIANTS.some(v => seaPortLower.startsWith(v.toLowerCase().split(" ")[0]));

      excelRailData.forEach(railEntry => {
        if (railEntry.cityOfArrival.toLowerCase() === selectedRussianCity.toLowerCase()) {
          const isDepartureStationCompatible = railEntry.departureStations.some(depStation => {
            const pStationLower = depStation.toLowerCase().trim();
            if (seaPortLower.includes("пл") && pStationLower.includes("пасифик лоджистик")) return true;
            if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
            
            if (isVladivostokHubArrival) {
                if (pStationLower.includes("владивосток")) return true;
                if (VLADIVOSTOK_VARIANTS.some(vladVariant => pStationLower.includes(vladVariant.toLowerCase().split(" ")[0]))) return true;
            }
            if (isVostochniyHubArrival) {
                if (pStationLower.includes("восточный")) return true;
                if (VOSTOCHNIY_VARIANTS.some(vostVariant => pStationLower.includes(vostVariant.toLowerCase().split(" ")[0]))) return true;
            }

            if (pStationLower.includes(seaPortBaseName)) return true;
            const stationBaseNameLower = pStationLower.split(" ")[0];
            if (seaPortLower.includes(stationBaseNameLower)) return true;
            
            return false;
          });
          if (isDepartureStationCompatible) {
            railEntry.arrivalStations.forEach(arrStation => stationsForCity.add(arrStation));
          }
        }
      });
      newAvailableStationsArray = Array.from(stationsForCity).sort();
    }

    if (JSON.stringify(localAvailableArrivalStations) !== JSON.stringify(newAvailableStationsArray)) {
      setLocalAvailableArrivalStations(newAvailableStationsArray);
    }

    if (hasRestoredFromCache) {
      const currentArrivalStationSelection = getValues("arrivalStationSelection");
      if ((currentArrivalStationSelection && !newAvailableStationsArray.includes(currentArrivalStationSelection)) ||
          (newAvailableStationsArray.length === 0 && currentArrivalStationSelection) ||
          (!selectedRussianCity && currentArrivalStationSelection) ||
          (!selectedSeaPort && currentArrivalStationSelection)
          ) {
        if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
    }
  }, [
    watchedRussianDestinationCity,
    watchedDestinationPort,
    isSeaRailExcelDataLoaded,
    excelRailData,
    setValue,
    getValues,
    hasRestoredFromCache,
    localAvailableArrivalStations,
    setLocalAvailableArrivalStations
  ]);
}

// Helper function for Auto-clearing dependent Sea+Rail fields
function useEffectForAutoClearFields(
  form: UseFormReturn<RouteFormValues>,
  hasRestoredFromCache: boolean,
  watchedOriginPort: string | undefined,
  watchedDestinationPort: string | undefined
) {
  const { getValues, setValue } = form;
  React.useEffect(() => {
    if (hasRestoredFromCache) {
      const currentOrigin = getValues("originPort");
      const currentSeaDest = getValues("destinationPort");
      const currentSeaLine = getValues("seaLineCompany");

      if (!currentOrigin) {
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      } else if (currentOrigin && !currentSeaDest) {
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
    }
  }, [watchedOriginPort, watchedDestinationPort, setValue, getValues, hasRestoredFromCache]);
}


export function useSeaRailDropdownLogic({
  form,
  context,
  hasRestoredFromCache,
  setLocalAvailableDestinationPorts,
  localAvailableDestinationPorts,
  setLocalAvailableSeaLines,
  localAvailableSeaLines,
  setLocalAvailableRussianDestinationCities,
  localAvailableRussianDestinationCities,
  setLocalAvailableArrivalStations,
  localAvailableArrivalStations,
}: UseSeaRailDropdownLogicProps) {
  const { watch } = form;

  const watchedShipmentType = watch("shipmentType") as ShipmentType;
  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort");
  const watchedContainerType = watch("containerType");
  const watchedRussianDestinationCity = watch("russianDestinationCity");

  useEffectForDestinationPorts(
    form, context, hasRestoredFromCache, watchedShipmentType, watchedOriginPort,
    localAvailableDestinationPorts, setLocalAvailableDestinationPorts
  );

  useEffectForSeaLines(
    form, context, hasRestoredFromCache, watchedShipmentType, watchedOriginPort, watchedDestinationPort,
    localAvailableSeaLines, setLocalAvailableSeaLines
  );

  useEffectForRussianDestinationCities(
    form, context, hasRestoredFromCache,
    watchedOriginPort, watchedContainerType, // Pass watchedOriginPort, not watchedDestinationPort
    localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities
  );

  useEffectForArrivalStations(
    form, context, hasRestoredFromCache, watchedRussianDestinationCity, watchedDestinationPort,
    localAvailableArrivalStations, setLocalAvailableArrivalStations
  );

  useEffectForAutoClearFields(
    form, hasRestoredFromCache, watchedOriginPort, watchedDestinationPort
  );
}
