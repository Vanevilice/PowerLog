
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues, PricingDataContextType, SmartPricingOutput, CalculationDetailsForInstructions,
} from '@/types';
import { DEFAULT_DIRECT_RAIL_FORM_VALUES, DEFAULT_SEA_RAIL_FORM_VALUES } from '@/lib/pricing/constants';
import { useSeaRailDropdownLogic } from './useSeaRailDropdownLogic';
import { useDirectRailDropdownLogic } from './useDirectRailDropdownLogic';

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
  // setShippingInfoState and setLastSuccessfulCalculationState are removed as they are managed by usePricingFormManager
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
}: UsePricingFormEffectsProps) {
  const { reset, getValues } = form; // Removed watch as it's not directly used for caching here anymore
  const {
    calculationMode,
    // isSeaRailExcelDataLoaded, // Not directly used for caching here anymore
    // isDirectRailExcelDataLoaded, // Not directly used for caching here anymore
    // setCachedFormValues, // Removed, handled by usePricingFormManager
    // setCachedShippingInfo, // Removed, handled by usePricingFormManager
    // setCachedLastSuccessfulCalculation, // Removed, handled by usePricingFormManager
    setLocalAvailableDirectRailAgents,
    setLocalAvailableDirectRailIncoterms,
    setLocalAvailableDirectRailBorders,
  } = context;

  // Use the specialized hooks for dropdown logic
  useSeaRailDropdownLogic({
    form, context, hasRestoredFromCache,
    setLocalAvailableDestinationPorts, localAvailableDestinationPorts,
    setLocalAvailableSeaLines, localAvailableSeaLines,
    setLocalAvailableRussianDestinationCities, localAvailableRussianDestinationCities,
    setLocalAvailableArrivalStations, localAvailableArrivalStations,
  });

  useDirectRailDropdownLogic({
    form, context, hasRestoredFromCache,
  });

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
          calculationModeToggle: "sea_plus_rail",
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
          calculationModeToggle: "direct_rail",
        });
      }
      // Clearing of shippingInfo, lastSuccessfulCalculation and their cached versions
      // is now handled by usePricingFormManager when it initiates onSubmitHandler
      // or by file handlers when a new file is loaded.
      
      // Reset local available lists for Direct Rail as well
      setLocalAvailableDirectRailAgents([]);
      setLocalAvailableDirectRailIncoterms([]);
      setLocalAvailableDirectRailBorders([]);
    }
  }, [
      calculationMode, 
      hasRestoredFromCache, 
      reset, 
      getValues, 
      setLocalAvailableDirectRailAgents, 
      setLocalAvailableDirectRailIncoterms, 
      setLocalAvailableDirectRailBorders
    ]);

  // Effect for caching form values has been removed, as this is now handled by usePricingFormManager.
}
