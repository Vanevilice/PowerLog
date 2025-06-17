
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues, PricingDataContextType, ShipmentType, ContainerType,
  ExcelRoute, ExcelSOCRoute, RailDataEntry,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS } from '../lib/pricing/constants';
import { normalizeCityName } from '../lib/pricing/utils'; // Import normalizeCityName

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

    // Consolidate display for Vladivostok and Vostochny variants
    const displayDestinations = new Set<string>();
    const processedNormalizedHubs = new Set<string>(); // To track if canonical hub form is added

    newAvailableDestinations.forEach(port => {
        const normalized = normalizeCityName(port);
        if (normalized === "восточный") {
            if (!processedNormalizedHubs.has("восточный")) {
                displayDestinations.add("Восточный");
                processedNormalizedHubs.add("восточный");
            }
        } else if (normalized === "владивосток") {
            if (!processedNormalizedHubs.has("владивосток")) {
                displayDestinations.add("Владивосток");
                processedNormalizedHubs.add("владивосток");
            }
        } else {
            displayDestinations.add(port); // Add other ports as is
        }
    });

    const newAvailableArray = Array.from(displayDestinations).sort((a, b) => {
        const aIsVlad = a === "Владивосток";
        const bIsVlad = b === "Владивосток";
        const aIsVost = a === "Восточный";
        const bIsVost = b === "Восточный";

        if (aIsVlad && !bIsVlad) return -1;
        if (!aIsVlad && bIsVlad) return 1;

        if (aIsVost && !bIsVost) return -1; // Comes after Vladivostok
        if (!aIsVost && bIsVost) return 1;

        return a.localeCompare(b);
    });


    if (JSON.stringify(localAvailableDestinationPorts) !== JSON.stringify(newAvailableArray)) {
      setLocalAvailableDestinationPorts(newAvailableArray);
    }
    if (hasRestoredFromCache) {
      const currentFormDestinationPort = getValues("destinationPort");
      // If the selected port (potentially a variant like "Восточный (ВСК)") is now consolidated
      // to its base form ("Восточный") and that base form is in the new list,
      // update the form value to the canonical base form.
      if (currentOriginPort && currentFormDestinationPort) {
        const normalizedCurrentFormDest = normalizeCityName(currentFormDestinationPort);
        let canonicalFormForCurrentSelection: string | undefined = undefined;

        if (normalizedCurrentFormDest === "восточный") canonicalFormForCurrentSelection = "Восточный";
        else if (normalizedCurrentFormDest === "владивосток") canonicalFormForCurrentSelection = "Владивосток";
        
        if (canonicalFormForCurrentSelection && newAvailableArray.includes(canonicalFormForCurrentSelection) && currentFormDestinationPort !== canonicalFormForCurrentSelection) {
          setValue("destinationPort", canonicalFormForCurrentSelection, { shouldValidate: true });
        } else if (!newAvailableArray.includes(currentFormDestinationPort) && getValues("destinationPort") !== "") {
          // If the exact selection is no longer valid and it wasn't a variant that got consolidated
           setValue("destinationPort", "", { shouldValidate: true });
        }
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

    const normalizedWatchedDestPort = normalizeCityName(watchedDestinationPort);

    currentDataset.forEach(route => {
      const routeOrigins = route[originFieldKey as keyof ExcelRoute | keyof ExcelSOCRoute] as string[] | undefined;
      const isOriginMatch = Array.isArray(routeOrigins) && routeOrigins.includes(watchedOriginPort);
      
      const isDestinationMatch = Array.isArray(route.destinationPorts) && route.destinationPorts.some(dp => {
        const normalizedRouteDestPort = normalizeCityName(dp);
        // Direct match or if user selected "Восточный" and route has "Восточный (ВСК)" (or vice versa after normalization)
        return normalizedRouteDestPort === normalizedWatchedDestPort;
      });

      if (isOriginMatch && isDestinationMatch) {
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
  watchedOriginPort: string | undefined, 
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
    watchedOriginPort, 
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
    const selectedSeaPort = getValues("destinationPort"); // User's selection for sea port (e.g., "Восточный")

    if (isSeaRailExcelDataLoaded && selectedRussianCity && selectedSeaPort &&
        (VLADIVOSTOK_VARIANTS.map(v => normalizeCityName(v)).includes(normalizeCityName(selectedSeaPort)) || 
         VOSTOCHNIY_VARIANTS.map(v => normalizeCityName(v)).includes(normalizeCityName(selectedSeaPort))) &&
        excelRailData.length > 0) {
      const stationsForCity = new Set<string>();
      
      excelRailData.forEach(railEntry => {
        if (normalizeCityName(railEntry.cityOfArrival) === normalizeCityName(selectedRussianCity)) {
          const isDepartureStationCompatible = railEntry.departureStations.some(depStation => {
            // depStation is like "ст. Восточный порт эксп"
            // selectedSeaPort is like "Восточный" or "Восточный (ВСК)"
            // Normalize both for robust comparison
            const normSelectedSeaPort = normalizeCityName(selectedSeaPort);
            const normDepStation = normalizeCityName(depStation);

            if (normSelectedSeaPort === "восточный" && normDepStation.includes("восточный")) return true;
            if (normSelectedSeaPort === "владивосток" && normDepStation.includes("владивосток")) return true;
            
            // Fallback for more direct substring checks if simple hub match fails
            if (normDepStation.includes(normSelectedSeaPort)) return true;

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
        // If origin is set but destination becomes empty, reset sea line
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
    watchedOriginPort, watchedContainerType, 
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

