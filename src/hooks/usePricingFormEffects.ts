
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
  setShippingInfoState: React.Dispatch<React.SetStateAction<SmartPricingOutput | null>>;
  setLastSuccessfulCalculationState: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>;
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
  const { watch, reset, getValues } = form;
  const {
    calculationMode,
    isSeaRailExcelDataLoaded,
    isDirectRailExcelDataLoaded,
    setCachedFormValues,
    setCachedShippingInfo,
    setCachedLastSuccessfulCalculation,
    setLocalAvailableDirectRailAgents, // Pass these setters to the Direct Rail hook if needed
    setLocalAvailableDirectRailIncoterms,
    setLocalAvailableDirectRailBorders,
  } = context;

  // Use the specialized hooks
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


  // Effect for caching form values
  const currentFormValues = watch();
  const watchedFormValuesString = React.useMemo(() => JSON.stringify(currentFormValues), [currentFormValues]);

  React.useEffect(() => {
    if (isSeaRailExcelDataLoaded || isDirectRailExcelDataLoaded) {
      setCachedFormValues(JSON.parse(watchedFormValuesString));
    }
  }, [watchedFormValuesString, setCachedFormValues, isSeaRailExcelDataLoaded, isDirectRailExcelDataLoaded]);
}
