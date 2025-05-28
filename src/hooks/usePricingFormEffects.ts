
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues,
  PricingDataContextType,
  ShipmentType,
  ExcelRoute,
  ExcelSOCRoute,
  RailDataEntry,
  CalculationMode,
} from '@/types';
import { DEFAULT_DIRECT_RAIL_FORM_VALUES, DEFAULT_SEA_RAIL_FORM_VALUES, NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';

interface UsePricingFormEffectsProps {
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
  setShippingInfoState: React.Dispatch<React.SetStateAction<any | null>>; // Adjust 'any'
  setLastSuccessfulCalculationState: React.Dispatch<React.SetStateAction<any | null>>; // Adjust 'any'
}

export function usePricingFormEffects({
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
  setShippingInfoState,
  setLastSuccessfulCalculationState,
}: UsePricingFormEffectsProps) {
  const { watch, setValue, getValues, reset } = form;
  const {
    calculationMode, excelRouteData, excelSOCRouteData, excelRailData,
    isSeaRailExcelDataLoaded, excelRussianDestinationCitiesMasterList,
    setCachedFormValues, setCachedShippingInfo, setCachedLastSuccessfulCalculation
  } = context;

  const watchedShipmentType = watch("shipmentType");
  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort");
  const watchedRussianDestinationCity = watch("russianDestinationCity");

  // Effect for resetting form parts on calculationMode change
  React.useEffect(() => {
    if (hasRestoredFromCache) {
      const currentFormValues = getValues();
      if (calculationMode === "sea_plus_rail") {
        reset({
          ...currentFormValues,
          ...DEFAULT_DIRECT_RAIL_FORM_VALUES,
          shipmentType: currentFormValues.shipmentType || DEFAULT_SEA_RAIL_FORM_VALUES.shipmentType,
          originPort: currentFormValues.originPort || DEFAULT_SEA_RAIL_FORM_VALUES.originPort,
          destinationPort: currentFormValues.destinationPort || DEFAULT_SEA_RAIL_FORM_VALUES.destinationPort,
          seaLineCompany: currentFormValues.seaLineCompany || DEFAULT_SEA_RAIL_FORM_VALUES.seaLineCompany,
          containerType: currentFormValues.containerType || DEFAULT_SEA_RAIL_FORM_VALUES.containerType,
          russianDestinationCity: currentFormValues.russianDestinationCity || DEFAULT_SEA_RAIL_FORM_VALUES.russianDestinationCity,
          arrivalStationSelection: currentFormValues.arrivalStationSelection || DEFAULT_SEA_RAIL_FORM_VALUES.arrivalStationSelection,
        });
      } else { // direct_rail mode
        reset({
          ...currentFormValues,
          ...DEFAULT_SEA_RAIL_FORM_VALUES,
          directRailAgentName: currentFormValues.directRailAgentName || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailAgentName,
          directRailCityOfDeparture: currentFormValues.directRailCityOfDeparture || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailCityOfDeparture,
          directRailDestinationCityDR: currentFormValues.directRailDestinationCityDR || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailDestinationCityDR,
          directRailIncoterms: currentFormValues.directRailIncoterms || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailIncoterms,
          directRailBorder: currentFormValues.directRailBorder || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailBorder,
        });
      }
      setShippingInfoState(null);
      setLastSuccessfulCalculationState(null);
      setCachedShippingInfo(null);
      setCachedLastSuccessfulCalculation(null);
    }
  }, [calculationMode, hasRestoredFromCache, reset, getValues, setShippingInfoState, setLastSuccessfulCalculationState, setCachedShippingInfo, setCachedLastSuccessfulCalculation]);

  // Effect for populating/filtering Destination Ports
  React.useEffect(() => {
    if (!isSeaRailExcelDataLoaded) {
      if (JSON.stringify(localAvailableDestinationPorts) !== JSON.stringify([])) setLocalAvailableDestinationPorts([]);
      return;
    }
    const currentShipmentTypeValue = getValues("shipmentType") as ShipmentType;
    const currentOriginPort = getValues("originPort");
    const dataset = currentShipmentTypeValue === "COC" ? excelRouteData : excelSOCRouteData;
    const originFieldKey = currentShipmentTypeValue === "COC" ? "originPorts" : "departurePorts";
    let newAvailableDestinations = new Set<string>();

    if (currentOriginPort) {
      dataset.forEach(route => {
        const routeOrigins = route[originFieldKey as keyof typeof route] as string[] | undefined;
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
      } else if (!currentOriginPort && getValues("destinationPort") !== "") {
        setValue("destinationPort", "", { shouldValidate: true });
      }
    }
  }, [watchedOriginPort, watchedShipmentType, isSeaRailExcelDataLoaded, excelRouteData, excelSOCRouteData, setValue, getValues, hasRestoredFromCache, localAvailableDestinationPorts, setLocalAvailableDestinationPorts]);

  // Effect for populating Sea Lines
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
      const routeOrigins = route[originFieldKey as keyof typeof route] as string[] | undefined;
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

  // Effect for populating/filtering Russian Destination Cities
  React.useEffect(() => {
    let newAvailableRussianCitiesSet = new Set<string>();
    const currentSeaDest = getValues("destinationPort");
    if (isSeaRailExcelDataLoaded && excelRussianDestinationCitiesMasterList.length > 0) {
      if (!currentSeaDest || currentSeaDest === "" || VLADIVOSTOK_VARIANTS.some(v => currentSeaDest.startsWith(v.split(" ")[0]))) {
        excelRussianDestinationCitiesMasterList.forEach(city => newAvailableRussianCitiesSet.add(city));
      }
    }
    const newAvailableArray = Array.from(newAvailableRussianCitiesSet).sort();
    if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify(newAvailableArray)) {
      setLocalAvailableRussianDestinationCities(newAvailableArray);
    }
    if (hasRestoredFromCache) {
      const currentRussianDestCity = getValues("russianDestinationCity");
      if (currentSeaDest && !VLADIVOSTOK_VARIANTS.some(variant => currentSeaDest.startsWith(variant.split(" ")[0]))) {
        if (currentRussianDestCity !== "" && getValues("russianDestinationCity") !== "") {
          setValue("russianDestinationCity", "", { shouldValidate: true });
          if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
        }
      } else if (currentRussianDestCity && !newAvailableArray.includes(currentRussianDestCity) && getValues("russianDestinationCity") !== "") {
        setValue("russianDestinationCity", "", { shouldValidate: true });
      }
    }
  }, [watchedDestinationPort, isSeaRailExcelDataLoaded, excelRussianDestinationCitiesMasterList, setValue, getValues, hasRestoredFromCache, localAvailableRussianDestinationCities, setLocalAvailableRussianDestinationCities]);

  // Effect for populating Arrival Stations
  React.useEffect(() => {
    let newAvailableStationsArray: string[] = [];
    const selectedRussianCity = getValues("russianDestinationCity");
    const selectedSeaPort = getValues("destinationPort");
    if (isSeaRailExcelDataLoaded && selectedRussianCity && excelRailData.length > 0) {
      const stationsForCity = new Set<string>();
      const baseSeaHubNameForRail = selectedSeaPort ? selectedSeaPort.split(" ")[0].toLowerCase() : "";
      const specificSeaHubKeywordMatch = selectedSeaPort ? selectedSeaPort.match(/\(([^)]+)\)/) : null;
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split('/').map(s => s.trim()) : [];

      excelRailData.forEach(railEntry => {
        if (railEntry.cityOfArrival.toLowerCase() === selectedRussianCity.toLowerCase()) {
          const isDepartureStationCompatible = railEntry.departureStations.some(depStation => {
            const pStationLower = depStation.toLowerCase().trim();
            if (selectedSeaPort && selectedSeaPort.toLowerCase().includes("пл")) return pStationLower.includes("пасифик лоджистик");
            if (!selectedSeaPort || VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0]))) {
              if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
              if (baseSeaHubNameForRail && pStationLower.includes(baseSeaHubNameForRail)) return true;
              if (selectedSeaPort && String(selectedSeaPort).toLowerCase().includes(pStationLower)) return true;
              if (!selectedSeaPort) return true;
              return VLADIVOSTOK_VARIANTS.some(v => pStationLower.includes(v.split(" ")[0].toLowerCase()));
            }
            return false;
          });
          if (isDepartureStationCompatible) railEntry.arrivalStations.forEach(arrStation => stationsForCity.add(arrStation));
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
          (!selectedRussianCity && currentArrivalStationSelection)) {
        if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
    }
  }, [watchedRussianDestinationCity, watchedDestinationPort, isSeaRailExcelDataLoaded, excelRailData, setValue, getValues, hasRestoredFromCache, localAvailableArrivalStations, setLocalAvailableArrivalStations]);

  // Effect for auto-clearing dependent fields on higher-level changes
  React.useEffect(() => {
    if (hasRestoredFromCache) {
      const currentOrigin = getValues("originPort");
      const currentSeaDest = getValues("destinationPort");
      const currentSeaLine = getValues("seaLineCompany");
      if (!currentOrigin && currentSeaDest !== "" && getValues("destinationPort") !== "") setValue("destinationPort", "", { shouldValidate: true });
      if ((!currentOrigin || !currentSeaDest) && currentSeaLine !== NONE_SEALINE_VALUE && getValues("seaLineCompany") !== NONE_SEALINE_VALUE) {
        setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
    }
  }, [watchedShipmentType, watchedOriginPort, watchedDestinationPort, setValue, getValues, hasRestoredFromCache]);

  // Effect for caching form values
  const currentFormValues = watch();
  const watchedFormValuesString = React.useMemo(() => JSON.stringify(currentFormValues), [currentFormValues]);
  React.useEffect(() => {
    if (isSeaRailExcelDataLoaded || context.isDirectRailExcelDataLoaded) {
      setCachedFormValues(JSON.parse(watchedFormValuesString));
    }
  }, [watchedFormValuesString, setCachedFormValues, isSeaRailExcelDataLoaded, context.isDirectRailExcelDataLoaded]);
}
