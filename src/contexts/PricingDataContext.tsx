
// src/contexts/PricingDataContext.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type {
  CombinedAiOutput, // Using the consolidated type from types/index.ts
  ExcelRoute,
  ExcelSOCRoute,
  RailDataEntry,
  DropOffEntry, // COC Drop-off
  ExcelSOCDropOffEntry, // SOC Drop-off
  DirectRailEntry,
  ShipmentType,
  ContainerType,
  CalculationMode,
  RouteFormValues,
  CalculationDetailsForInstructions,
  BestPriceRoute,
  DashboardServiceSection,
  PricingDataContextType,
} from '@/types';

const PricingDataContext = createContext<PricingDataContextType | undefined>(undefined);

export const PricingDataProvider = ({ children }: { children: ReactNode }) => {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("sea_plus_rail");

  const [excelRouteData, setExcelRouteData] = useState<ExcelRoute[]>([]); // For COC
  const [excelSOCRouteData, setExcelSOCRouteData] = useState<ExcelSOCRoute[]>([]);
  const [excelRailData, setExcelRailData] = useState<RailDataEntry[]>([]);
  const [excelDropOffData, setExcelDropOffData] = useState<DropOffEntry[]>([]); // For COC Drop-off
  const [excelSOCDropOffData, setExcelSOCDropOffData] = useState<ExcelSOCDropOffEntry[]>([]); // For SOC Drop-off
  const [excelDirectRailData, setExcelDirectRailData] = useState<DirectRailEntry[]>([]);

  const [isSeaRailExcelDataLoaded, setIsSeaRailExcelDataLoaded] = useState(false);
  const [isDirectRailExcelDataLoaded, setIsDirectRailExcelDataLoaded] = useState(false);
  const [isSOCDropOffExcelDataLoaded, setIsSOCDropOffExcelDataLoaded] = useState(false); // Flag for new file

  const [excelOriginPorts, setExcelOriginPorts] = useState<string[]>([]);
  const [excelDestinationPorts, setExcelDestinationPorts] = useState<string[]>([]);
  const [excelRussianDestinationCitiesMasterList, setExcelRussianDestinationCitiesMasterList] = useState<string[]>([]);

  // Master lists for Direct Rail (from Excel parsing)
  const [directRailAgents, setDirectRailAgents] = useState<string[]>([]);
  const [directRailDepartureCities, setDirectRailDepartureCities] = useState<string[]>([]);
  const [directRailDestinationCitiesDR, setDirectRailDestinationCitiesDR] = useState<string[]>([]);
  const [directRailIncotermsList, setDirectRailIncotermsList] = useState<string[]>([]);
  const [directRailBordersList, setDirectRailBordersList] = useState<string[]>([]);

  // Filtered (local available) lists for Direct Rail dropdowns
  const [localAvailableDirectRailAgents, setLocalAvailableDirectRailAgents] = useState<string[]>([]);
  const [localAvailableDirectRailIncoterms, setLocalAvailableDirectRailIncoterms] = useState<string[]>([]);
  const [localAvailableDirectRailBorders, setLocalAvailableDirectRailBorders] = useState<string[]>([]);

  const [cachedFormValues, setCachedFormValues] = useState<Partial<RouteFormValues> | null>(null);
  const [cachedShippingInfo, setCachedShippingInfo] = useState<CombinedAiOutput | null>(null);
  const [cachedLastSuccessfulCalculation, setCachedLastSuccessfulCalculation] = useState<CalculationDetailsForInstructions | null>(null);
  const [bestPriceResults, setBestPriceResults] = useState<BestPriceRoute[] | null>(null);
  const [dashboardServiceSections, setDashboardServiceSections] = useState<DashboardServiceSection[]>([]);


  return (
    <PricingDataContext.Provider value={{
      calculationMode, setCalculationMode,
      excelRouteData, setExcelRouteData,
      excelSOCRouteData, setExcelSOCRouteData,
      excelRailData, setExcelRailData,
      excelDropOffData, setExcelDropOffData,
      excelSOCDropOffData, setExcelSOCDropOffData, // Provide SOC Drop-off data and setter
      excelDirectRailData, setExcelDirectRailData,
      isSeaRailExcelDataLoaded, setIsSeaRailExcelDataLoaded,
      isDirectRailExcelDataLoaded, setIsDirectRailExcelDataLoaded,
      isSOCDropOffExcelDataLoaded, setIsSOCDropOffExcelDataLoaded, // Provide flag and setter
      
      excelOriginPorts, setExcelOriginPorts,
      excelDestinationPorts, setExcelDestinationPorts,
      excelRussianDestinationCitiesMasterList, setExcelRussianDestinationCitiesMasterList,
      
      directRailAgents, setDirectRailAgents,
      directRailDepartureCities, setDirectRailDepartureCities,
      directRailDestinationCitiesDR, setDirectRailDestinationCitiesDR,
      directRailIncotermsList, setDirectRailIncotermsList,
      directRailBordersList, setDirectRailBordersList,

      localAvailableDirectRailAgents, setLocalAvailableDirectRailAgents,
      localAvailableDirectRailIncoterms, setLocalAvailableDirectRailIncoterms,
      localAvailableDirectRailBorders, setLocalAvailableDirectRailBorders,

      cachedFormValues, setCachedFormValues,
      cachedShippingInfo, setCachedShippingInfo,
      cachedLastSuccessfulCalculation, setCachedLastSuccessfulCalculation,
      bestPriceResults, setBestPriceResults,
      dashboardServiceSections, setDashboardServiceSections,
    }}>
      {children}
    </PricingDataContext.Provider>
  );
};

export const usePricingData = (): PricingDataContextType => {
  const context = useContext(PricingDataContext);
  if (context === undefined) {
    throw new Error('usePricingData must be used within a PricingDataProvider');
  }
  return context;
};
