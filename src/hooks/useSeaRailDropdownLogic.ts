
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues, PricingDataContextType, ShipmentType,
  ExcelRoute, ExcelSOCRoute, RailDataEntry,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';

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
  const { watch, setValue, getValues } = form;
  const {
    excelRouteData, excelSOCRouteData, excelRailData,
    isSeaRailExcelDataLoaded, excelRussianDestinationCitiesMasterList,
  } = context;

  const watchedShipmentType = watch("shipmentType") as ShipmentType; // Ensure type
  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort");
  const watchedRussianDestinationCity = watch("russianDestinationCity");

  // Effect for populating/filtering Destination Ports (Sea+Rail)
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
    } else { // If no origin port selected, show all possible destination ports for the chosen shipment type
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
      } else if (!currentOriginPort && getValues("destinationPort") !== "") {
        // Do not clear destination port if origin is not selected, to allow independent selection for Best Price
        // setValue("destinationPort", "", { shouldValidate: true });
      }
    }
  }, [watchedOriginPort, watchedShipmentType, isSeaRailExcelDataLoaded, excelRouteData, excelSOCRouteData, setValue, getValues, hasRestoredFromCache, localAvailableDestinationPorts, setLocalAvailableDestinationPorts]);

  // Effect for populating Sea Lines (Sea+Rail)
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

  // Effect for populating Russian Destination Cities (Sea+Rail)
  React.useEffect(() => {
    if (isSeaRailExcelDataLoaded && excelRussianDestinationCitiesMasterList.length > 0) {
      const sortedMasterList = [...excelRussianDestinationCitiesMasterList].sort();
      if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify(sortedMasterList)) {
        setLocalAvailableRussianDestinationCities(sortedMasterList);
      }
    } else {
      if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify([])) {
        setLocalAvailableRussianDestinationCities([]);
      }
    }
     // Do not auto-clear russianDestinationCity if originPort is not set for Best Price scenario
    // if (hasRestoredFromCache && !getValues("originPort") && getValues("russianDestinationCity") !== "") {
    //     setValue("russianDestinationCity", "", { shouldValidate: true });
    // }
  }, [
    isSeaRailExcelDataLoaded,
    excelRussianDestinationCitiesMasterList,
    setLocalAvailableRussianDestinationCities,
    localAvailableRussianDestinationCities,
    getValues,
    setValue,
    hasRestoredFromCache
  ]);

  // Effect for populating Arrival Stations (Sea+Rail)
  React.useEffect(() => {
    let newAvailableStationsArray: string[] = [];
    const selectedRussianCity = getValues("russianDestinationCity");
    const selectedSeaPort = getValues("destinationPort"); // Sea destination port

    if (isSeaRailExcelDataLoaded && selectedRussianCity && selectedSeaPort &&
        VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0])) && // Rail leg implies from Vladivostok-like sea port
        excelRailData.length > 0) {
      const stationsForCity = new Set<string>();
      const seaPortLower = selectedSeaPort.toLowerCase();
      const seaPortBaseName = selectedSeaPort.split(" ")[0].toLowerCase();
      const specificSeaHubKeywordMatch = selectedSeaPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split(/[/\s-]+/).map(s => s.trim()).filter(Boolean) : [];

      excelRailData.forEach(railEntry => {
        if (railEntry.cityOfArrival.toLowerCase() === selectedRussianCity.toLowerCase()) {
          const isDepartureStationCompatible = railEntry.departureStations.some(depStation => {
            const pStationLower = depStation.toLowerCase().trim();
            if (seaPortLower.includes("пл") && pStationLower.includes("пасифик лоджистик")) return true;
            if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
            return pStationLower.includes(seaPortBaseName) || seaPortLower.includes(pStationLower);
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
          (!selectedSeaPort && currentArrivalStationSelection) // Also clear if sea port is cleared
          ) {
        if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
    }
  }, [
    watchedRussianDestinationCity,
    watchedDestinationPort, // Re-evaluate when sea destination port changes
    isSeaRailExcelDataLoaded,
    excelRailData,
    setValue,
    getValues,
    hasRestoredFromCache,
    localAvailableArrivalStations,
    setLocalAvailableArrivalStations
  ]);

  // Effect for auto-clearing dependent Sea+Rail fields
  React.useEffect(() => {
    if (hasRestoredFromCache) {
      const currentOrigin = getValues("originPort");
      const currentSeaDest = getValues("destinationPort");
      const currentSeaLine = getValues("seaLineCompany");

      if (!currentOrigin) {
        // Don't clear sea dest or russian city if origin is cleared, for Best Price flexibility
        // if (currentSeaDest !== "") setValue("destinationPort", "", { shouldValidate: true });
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
        // if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", {shouldValidate: true});
      } else if (currentOrigin && !currentSeaDest) {
        // If origin is selected but sea dest is not, clear sea line. Arrival station is handled by its own effect.
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
    }
  }, [watchedOriginPort, watchedDestinationPort, setValue, getValues, hasRestoredFromCache]);
}
