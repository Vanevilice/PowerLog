
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { RouteFormValues, PricingDataContextType } from '@/types';

interface UseDirectRailDropdownLogicProps {
  form: UseFormReturn<RouteFormValues>;
  context: PricingDataContextType;
  hasRestoredFromCache: boolean;
}

export function useDirectRailDropdownLogic({
  form,
  context,
  hasRestoredFromCache,
}: UseDirectRailDropdownLogicProps) {
  const { watch, setValue, getValues } = form;
  const {
    excelDirectRailData, isDirectRailExcelDataLoaded,
    setLocalAvailableDirectRailAgents,
    setLocalAvailableDirectRailIncoterms,
    setLocalAvailableDirectRailBorders,
  } = context;

  const watchedDirectRailCityOfDeparture = watch("directRailCityOfDeparture");
  const watchedDirectRailDestinationCityDR = watch("directRailDestinationCityDR");
  const watchedDirectRailAgentName = watch("directRailAgentName");
  const watchedDirectRailIncoterms = watch("directRailIncoterms");

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
      setValue("directRailBorder", "", { shouldValidate: true }); // Agent change can affect border
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
    // No setLocalAvailableDirectRailBorders here, managed by its own effect
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
      setValue("directRailBorder", "", { shouldValidate: true }); // Incoterms change can affect border
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
    // No setLocalAvailableDirectRailBorders here
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
}
