
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues, PricingDataContextType, ShipmentType,
  ExcelRoute, ExcelSOCRoute, RailDataEntry, CalculationMode,
  SmartPricingOutput, // Using the consolidated type
} from '@/types'; // All types from src/types
import { DEFAULT_DIRECT_RAIL_FORM_VALUES, DEFAULT_SEA_RAIL_FORM_VALUES, NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';

interface UsePricingFormEffectsProps {
  form: UseFormReturn<RouteFormValues>; // Use consolidated RouteFormValues
  context: PricingDataContextType;
  hasRestoredFromCache: boolean;
  setLocalAvailableDestinationPorts: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableDestinationPorts: string[]; // Pass this for comparison to avoid unnecessary updates
  setLocalAvailableSeaLines: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableSeaLines: string[]; // Pass for comparison
  setLocalAvailableRussianDestinationCities: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableRussianDestinationCities: string[]; // Pass for comparison
  setLocalAvailableArrivalStations: React.Dispatch<React.SetStateAction<string[]>>;
  localAvailableArrivalStations: string[]; // Pass for comparison
  setShippingInfoState: React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>;
  setLastSuccessfulCalculationState: React.Dispatch<React.SetStateAction<any | null>>; // Adjust 'any' if a specific type exists
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
  const watchedContainerType = watch("containerType"); // Watch containerType

  // Effect for resetting form parts on calculationMode change
  React.useEffect(() => {
    if (hasRestoredFromCache) { // Only reset if not initial load or cache restoration is done
      const currentFormValues = getValues();
      if (calculationMode === "sea_plus_rail") {
        reset({
          ...currentFormValues, // Preserve common fields like margins
          ...DEFAULT_DIRECT_RAIL_FORM_VALUES, // Clear direct rail fields
          // Explicitly set sea_plus_rail fields, falling back to defaults if not present in currentFormValues
          shipmentType: currentFormValues.shipmentType || DEFAULT_SEA_RAIL_FORM_VALUES.shipmentType,
          originPort: currentFormValues.originPort || DEFAULT_SEA_RAIL_FORM_VALUES.originPort,
          destinationPort: currentFormValues.destinationPort || DEFAULT_SEA_RAIL_FORM_VALUES.destinationPort,
          seaLineCompany: currentFormValues.seaLineCompany || DEFAULT_SEA_RAIL_FORM_VALUES.seaLineCompany,
          containerType: currentFormValues.containerType || DEFAULT_SEA_RAIL_FORM_VALUES.containerType,
          russianDestinationCity: currentFormValues.russianDestinationCity || DEFAULT_SEA_RAIL_FORM_VALUES.russianDestinationCity,
          arrivalStationSelection: currentFormValues.arrivalStationSelection || DEFAULT_SEA_RAIL_FORM_VALUES.arrivalStationSelection,
          calculationModeToggle: "sea_plus_rail", // Sync toggle
        });
      } else { // direct_rail mode
        reset({
          ...currentFormValues, // Preserve common fields
          ...DEFAULT_SEA_RAIL_FORM_VALUES, // Clear sea+rail fields
          // Explicitly set direct_rail fields
          directRailAgentName: currentFormValues.directRailAgentName || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailAgentName,
          directRailCityOfDeparture: currentFormValues.directRailCityOfDeparture || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailCityOfDeparture,
          directRailDestinationCityDR: currentFormValues.directRailDestinationCityDR || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailDestinationCityDR,
          directRailIncoterms: currentFormValues.directRailIncoterms || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailIncoterms,
          directRailBorder: currentFormValues.directRailBorder || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailBorder,
          calculationModeToggle: "direct_rail", // Sync toggle
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
      const routeOrigins = route[originFieldKey as keyof route] as string[] | undefined;
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

  // Effect for populating/filtering Russian Destination Cities (Rail Destinations)
  React.useEffect(() => {
    const newAvailableRussianCitiesSet = new Set<string>();
    const selectedSeaPort = getValues("destinationPort");
    const selectedContainerType = getValues("containerType");

    if (isSeaRailExcelDataLoaded &&
        excelRussianDestinationCitiesMasterList.length > 0 &&
        selectedSeaPort &&
        VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0])) && // Sea port must be a Vladivostok variant
        selectedContainerType && excelRailData.length > 0) {

      const seaPortLower = selectedSeaPort.toLowerCase();
      const seaPortBaseName = selectedSeaPort.split(" ")[0].toLowerCase();
      const specificSeaHubKeywordMatch = selectedSeaPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split('/').map(s => s.trim()) : [];

      excelRussianDestinationCitiesMasterList.forEach(candidateCity => {
        let hasValidRailRouteForCity = false;
        for (const railEntry of excelRailData) {
          if (railEntry.cityOfArrival.toLowerCase() === candidateCity.toLowerCase()) {
            let hasPriceForContainerInEntry = false;
            if (selectedContainerType === "20DC") {
              if (railEntry.price20DC_24t !== null || railEntry.price20DC_28t !== null) {
                hasPriceForContainerInEntry = true;
              }
            } else if (selectedContainerType === "40HC") {
              if (railEntry.price40HC !== null) {
                hasPriceForContainerInEntry = true;
              }
            }

            if (!hasPriceForContainerInEntry) continue;

            const isCompatibleDepartureStation = railEntry.departureStations.some(depStation => {
              const pStationLower = depStation.toLowerCase().trim();
              if (seaPortLower.includes("пл") && pStationLower.includes("пасифик лоджистик")) return true;
              if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
              if (pStationLower.includes(seaPortBaseName)) return true;
              // Consider if seaPortLower.includes(pStationLower) is needed or too broad
              return false;
            });

            if (isCompatibleDepartureStation) {
              hasValidRailRouteForCity = true;
              break; 
            }
          }
        }
        if (hasValidRailRouteForCity) {
          newAvailableRussianCitiesSet.add(candidateCity);
        }
      });
    }

    const newAvailableArray = Array.from(newAvailableRussianCitiesSet).sort();
    if (JSON.stringify(localAvailableRussianDestinationCities) !== JSON.stringify(newAvailableArray)) {
      setLocalAvailableRussianDestinationCities(newAvailableArray);
    }

    if (hasRestoredFromCache) {
      const currentRussianDestCity = getValues("russianDestinationCity");
      // If the sea port is not a Vladivostok variant, or if no valid rail routes exist, clear Russian Dest City
      if (selectedSeaPort && !VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0]))) {
         if (currentRussianDestCity !== "" && getValues("russianDestinationCity") !== "") {
            setValue("russianDestinationCity", "", { shouldValidate: true });
            if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
        }
      } else if (currentRussianDestCity && !newAvailableArray.includes(currentRussianDestCity) && getValues("russianDestinationCity") !== "") {
         setValue("russianDestinationCity", "", { shouldValidate: true });
         // arrivalStationSelection will be cleared by its own effect if russianDestinationCity is cleared
      }
    }
  }, [
    watchedDestinationPort, 
    watchedContainerType, // Added dependency
    isSeaRailExcelDataLoaded, 
    excelRussianDestinationCitiesMasterList, 
    excelRailData, // Added dependency
    setValue, 
    getValues, 
    hasRestoredFromCache, 
    localAvailableRussianDestinationCities, 
    setLocalAvailableRussianDestinationCities
  ]);

  // Effect for populating Arrival Stations
  React.useEffect(() => {
    let newAvailableStationsArray: string[] = [];
    const selectedRussianCity = getValues("russianDestinationCity");
    const selectedSeaPort = getValues("destinationPort"); // Sea Destination Port
    // Ensure selectedRussianCity is not empty and sea port is a Vladivostok variant for rail journey
    if (isSeaRailExcelDataLoaded && selectedRussianCity && 
        selectedSeaPort && VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0])) &&
        excelRailData.length > 0) {
          
      const stationsForCity = new Set<string>();
      const seaPortLower = selectedSeaPort.toLowerCase();
      const seaPortBaseName = selectedSeaPort.split(" ")[0].toLowerCase();
      const specificSeaHubKeywordMatch = selectedSeaPort.match(/\(([^)]+)\)/);
      const specificSeaHubKeywords = specificSeaHubKeywordMatch ? specificSeaHubKeywordMatch[1].toLowerCase().split('/').map(s => s.trim()) : [];

      excelRailData.forEach(railEntry => {
        if (railEntry.cityOfArrival.toLowerCase() === selectedRussianCity.toLowerCase()) {
          const isDepartureStationCompatible = railEntry.departureStations.some(depStation => {
            const pStationLower = depStation.toLowerCase().trim();
            if (seaPortLower.includes("пл") && pStationLower.includes("пасифик лоджистик")) return true;
            if (specificSeaHubKeywords.length > 0 && specificSeaHubKeywords.some(kw => pStationLower.includes(kw))) return true;
            if (pStationLower.includes(seaPortBaseName)) return true;
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
          (!selectedRussianCity && currentArrivalStationSelection)) {
        if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", { shouldValidate: true });
      }
    }
  }, [watchedRussianDestinationCity, watchedDestinationPort, isSeaRailExcelDataLoaded, excelRailData, setValue, getValues, hasRestoredFromCache, localAvailableArrivalStations, setLocalAvailableArrivalStations]);

  // Effect for auto-clearing dependent fields on higher-level changes (Shipment Type, Origin, Sea Dest)
  React.useEffect(() => {
    if (hasRestoredFromCache) { 
      const currentOrigin = getValues("originPort");
      const currentSeaDest = getValues("destinationPort");
      const currentSeaLine = getValues("seaLineCompany");
      
      if (!currentOrigin) {
        if (currentSeaDest !== "") setValue("destinationPort", "", { shouldValidate: true });
      }
      
      if (!currentOrigin || !currentSeaDest) {
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
      }
      
      if (!currentSeaDest || (currentSeaDest && !VLADIVOSTOK_VARIANTS.some(variant => currentSeaDest.startsWith(variant.split(" ")[0])))) {
          if (getValues("russianDestinationCity") !== "") setValue("russianDestinationCity", "", { shouldValidate: true });
          // arrivalStationSelection will be cleared by its own effect if russianDestinationCity is cleared
      }
    }
  }, [watchedShipmentType, watchedOriginPort, watchedDestinationPort, setValue, getValues, hasRestoredFromCache]);


  // Effect for caching form values (stringified to avoid deep comparison issues)
  const currentFormValues = watch();
  const watchedFormValuesString = React.useMemo(() => JSON.stringify(currentFormValues), [currentFormValues]);
  React.useEffect(() => {
    if (isSeaRailExcelDataLoaded || context.isDirectRailExcelDataLoaded) { 
      setCachedFormValues(JSON.parse(watchedFormValuesString));
    }
  }, [watchedFormValuesString, setCachedFormValues, isSeaRailExcelDataLoaded, context.isDirectRailExcelDataLoaded]);
}

    
