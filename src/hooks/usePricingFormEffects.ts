
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
    calculationMode, excelRouteData, excelSOCRouteData, excelRailData, excelDirectRailData,
    isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded, excelRussianDestinationCitiesMasterList,
    setCachedFormValues, setCachedShippingInfo, setCachedLastSuccessfulCalculation,
    setLocalAvailableDirectRailAgents, setLocalAvailableDirectRailIncoterms, setLocalAvailableDirectRailBorders,
  } = context;

  const watchedShipmentType = watch("shipmentType");
  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort");
  const watchedRussianDestinationCity = watch("russianDestinationCity");
  const watchedContainerType = watch("containerType");

  // Direct Rail watched fields
  const watchedDirectRailCityOfDeparture = watch("directRailCityOfDeparture");
  const watchedDirectRailDestinationCityDR = watch("directRailDestinationCityDR");
  const watchedDirectRailAgentName = watch("directRailAgentName");
  const watchedDirectRailIncoterms = watch("directRailIncoterms");


  // Effect for resetting form parts on calculationMode change
  React.useEffect(() => {
    if (hasRestoredFromCache) { // Only reset if not initial load or cache restoration is done
      const currentFormValues = getValues();
      if (calculationMode === "sea_plus_rail") {
        reset({
          ...currentFormValues, // Preserve common fields like margins
          ...DEFAULT_DIRECT_RAIL_FORM_VALUES, // Clear direct rail fields
          shipmentType: currentFormValues.shipmentType || DEFAULT_SEA_RAIL_FORM_VALUES.shipmentType,
          originPort: currentFormValues.originPort || DEFAULT_SEA_RAIL_FORM_VALUES.originPort,
          destinationPort: currentFormValues.destinationPort || DEFAULT_SEA_RAIL_FORM_VALUES.destinationPort,
          seaLineCompany: currentFormValues.seaLineCompany || DEFAULT_SEA_RAIL_FORM_VALUES.seaLineCompany,
          containerType: currentFormValues.containerType || DEFAULT_SEA_RAIL_FORM_VALUES.containerType,
          russianDestinationCity: currentFormValues.russianDestinationCity || DEFAULT_SEA_RAIL_FORM_VALUES.russianDestinationCity,
          arrivalStationSelection: currentFormValues.arrivalStationSelection || DEFAULT_SEA_RAIL_FORM_VALUES.arrivalStationSelection,
          calculationModeToggle: "sea_plus_rail",
        });
      } else { // direct_rail mode
        reset({
          ...currentFormValues, // Preserve common fields
          ...DEFAULT_SEA_RAIL_FORM_VALUES, // Clear sea+rail fields
          directRailAgentName: currentFormValues.directRailAgentName || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailAgentName,
          directRailCityOfDeparture: currentFormValues.directRailCityOfDeparture || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailCityOfDeparture,
          directRailDestinationCityDR: currentFormValues.directRailDestinationCityDR || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailDestinationCityDR,
          directRailIncoterms: currentFormValues.directRailIncoterms || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailIncoterms,
          directRailBorder: currentFormValues.directRailBorder || DEFAULT_DIRECT_RAIL_FORM_VALUES.directRailBorder,
          calculationModeToggle: "direct_rail",
        });
      }
      setShippingInfoState(null);
      setLastSuccessfulCalculationState(null);
      setCachedShippingInfo(null);
      setCachedLastSuccessfulCalculation(null);
      // Reset local available lists for Direct Rail as well
      setLocalAvailableDirectRailAgents([]);
      setLocalAvailableDirectRailIncoterms([]);
      setLocalAvailableDirectRailBorders([]);
    }
  }, [calculationMode, hasRestoredFromCache, reset, getValues, setShippingInfoState, setLastSuccessfulCalculationState, setCachedShippingInfo, setCachedLastSuccessfulCalculation, setLocalAvailableDirectRailAgents, setLocalAvailableDirectRailIncoterms, setLocalAvailableDirectRailBorders]);

  // Effect for populating/filtering Destination Ports (Sea+Rail)
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
    // Auto-clearing logic for russianDestinationCity if originPort is cleared (critical dependency for Sea+Rail)
    if (hasRestoredFromCache && !getValues("originPort") && getValues("russianDestinationCity") !== "") {
        setValue("russianDestinationCity", "", { shouldValidate: true });
    }

  }, [
    isSeaRailExcelDataLoaded,
    excelRussianDestinationCitiesMasterList,
    setLocalAvailableRussianDestinationCities,
    localAvailableRussianDestinationCities, // Added to dependencies
    getValues, // Added
    setValue, // Added
    hasRestoredFromCache // Added
  ]);


  // Effect for populating Arrival Stations (Sea+Rail)
  // This still depends on watchedRussianDestinationCity and watchedDestinationPort (sea port) for filtering
  React.useEffect(() => {
    let newAvailableStationsArray: string[] = [];
    const selectedRussianCity = getValues("russianDestinationCity");
    const selectedSeaPort = getValues("destinationPort"); // Sea port (e.g. Vladivostok)

    if (isSeaRailExcelDataLoaded && selectedRussianCity && selectedSeaPort &&
        VLADIVOSTOK_VARIANTS.some(v => selectedSeaPort.startsWith(v.split(" ")[0])) &&
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
  }, [
    watchedRussianDestinationCity, // Correct dependency
    watchedDestinationPort, // Correct dependency: Sea Port (Vladivostok)
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
      const currentSeaDest = getValues("destinationPort"); // Sea destination
      const currentSeaLine = getValues("seaLineCompany");

      if (!currentOrigin) {
        // If origin is cleared, clear dependent sea-related fields
        if (currentSeaDest !== "") setValue("destinationPort", "", { shouldValidate: true });
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
        // russianDestinationCity clearing is handled by its own effect watching originPort
        if (getValues("arrivalStationSelection") !== "") setValue("arrivalStationSelection", "", {shouldValidate: true});
      } else if (currentOrigin && !currentSeaDest) {
         // If origin is set but sea destination is not, clear sea line
        if (currentSeaLine !== NONE_SEALINE_VALUE) setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
        // Keep russianDestinationCity if user wants to select it for Best Price
        // Keep arrivalStationSelection, it will be cleared if russianDestinationCity is cleared or changes.
      }
    }
  }, [watchedOriginPort, watchedDestinationPort, setValue, getValues, hasRestoredFromCache]);


  // --- Direct Rail Cascading Dropdowns ---

  // Effect to filter Direct Rail Agents
  React.useEffect(() => {
    if (!isDirectRailExcelDataLoaded || !watchedDirectRailCityOfDeparture || !watchedDirectRailDestinationCityDR) {
      setLocalAvailableDirectRailAgents([]);
      if (hasRestoredFromCache && getValues("directRailAgentName")) {
        setValue("directRailAgentName", "", { shouldValidate: true });
      }
      return;
    }

    let filteredByCities = excelDirectRailData.filter(entry =>
      entry.cityOfDeparture === watchedDirectRailCityOfDeparture &&
      entry.destinationCity === watchedDirectRailDestinationCityDR
    );

    if (watchedDirectRailIncoterms) {
      filteredByCities = filteredByCities.filter(entry => entry.incoterms === watchedDirectRailIncoterms);
    }

    const availableAgents = new Set(filteredByCities.map(entry => entry.agentName));
    const sortedAgents = Array.from(availableAgents).sort();
    setLocalAvailableDirectRailAgents(sortedAgents);

    if (hasRestoredFromCache && getValues("directRailAgentName") && !sortedAgents.includes(getValues("directRailAgentName")!)) {
      setValue("directRailAgentName", "", { shouldValidate: true });
      setValue("directRailBorder", "", { shouldValidate: true });
    }
  }, [
    watchedDirectRailCityOfDeparture,
    watchedDirectRailDestinationCityDR,
    watchedDirectRailIncoterms,
    excelDirectRailData,
    isDirectRailExcelDataLoaded,
    setLocalAvailableDirectRailAgents,
    setValue,
    getValues,
    hasRestoredFromCache,
    setLocalAvailableDirectRailBorders
  ]);

  // Effect to filter Direct Rail Incoterms
  React.useEffect(() => {
    if (!isDirectRailExcelDataLoaded || !watchedDirectRailCityOfDeparture || !watchedDirectRailDestinationCityDR) {
      setLocalAvailableDirectRailIncoterms([]);
      if (hasRestoredFromCache && getValues("directRailIncoterms")) {
        setValue("directRailIncoterms", "", { shouldValidate: true });
      }
      return;
    }

    let filteredByCities = excelDirectRailData.filter(entry =>
      entry.cityOfDeparture === watchedDirectRailCityOfDeparture &&
      entry.destinationCity === watchedDirectRailDestinationCityDR
    );

    if (watchedDirectRailAgentName) {
      filteredByCities = filteredByCities.filter(entry => entry.agentName === watchedDirectRailAgentName);
    }

    const availableIncoterms = new Set(filteredByCities.map(entry => entry.incoterms));
    const sortedIncoterms = Array.from(availableIncoterms).sort();
    setLocalAvailableDirectRailIncoterms(sortedIncoterms);

    if (hasRestoredFromCache && getValues("directRailIncoterms") && !sortedIncoterms.includes(getValues("directRailIncoterms")!)) {
      setValue("directRailIncoterms", "", { shouldValidate: true });
      setValue("directRailBorder", "", { shouldValidate: true });
    }
  }, [
    watchedDirectRailCityOfDeparture,
    watchedDirectRailDestinationCityDR,
    watchedDirectRailAgentName,
    excelDirectRailData,
    isDirectRailExcelDataLoaded,
    setLocalAvailableDirectRailIncoterms,
    setValue,
    getValues,
    hasRestoredFromCache,
    setLocalAvailableDirectRailBorders
  ]);


  // Effect to filter Direct Rail Borders
  React.useEffect(() => {
    if (!isDirectRailExcelDataLoaded || !watchedDirectRailCityOfDeparture || !watchedDirectRailDestinationCityDR || !watchedDirectRailIncoterms) {
      setLocalAvailableDirectRailBorders([]);
      if (hasRestoredFromCache && getValues("directRailBorder")) setValue("directRailBorder", "", { shouldValidate: true });
      return;
    }
    let filteredEntries = excelDirectRailData.filter(entry =>
      entry.cityOfDeparture === watchedDirectRailCityOfDeparture &&
      entry.destinationCity === watchedDirectRailDestinationCityDR &&
      entry.incoterms === watchedDirectRailIncoterms
    );

    if (watchedDirectRailAgentName) {
        filteredEntries = filteredEntries.filter(entry => entry.agentName === watchedDirectRailAgentName);
    }

    const availableBorders = new Set(filteredEntries.map(entry => entry.border));
    const sortedBorders = Array.from(availableBorders).sort();
    setLocalAvailableDirectRailBorders(sortedBorders);

    if (hasRestoredFromCache && getValues("directRailBorder") && !sortedBorders.includes(getValues("directRailBorder")!)) {
      setValue("directRailBorder", "", { shouldValidate: true });
    }
  }, [
      watchedDirectRailCityOfDeparture,
      watchedDirectRailDestinationCityDR,
      watchedDirectRailAgentName,
      watchedDirectRailIncoterms,
      excelDirectRailData,
      isDirectRailExcelDataLoaded,
      setLocalAvailableDirectRailBorders,
      setValue,
      getValues,
      hasRestoredFromCache
    ]);


  // Effect for caching form values
  const currentFormValues = watch();
  const watchedFormValuesString = React.useMemo(() => JSON.stringify(currentFormValues), [currentFormValues]);
  React.useEffect(() => {
    if (isSeaRailExcelDataLoaded || context.isDirectRailExcelDataLoaded) {
      setCachedFormValues(JSON.parse(watchedFormValuesString));
    }
  }, [watchedFormValuesString, setCachedFormValues, isSeaRailExcelDataLoaded, context.isDirectRailExcelDataLoaded]);
}
