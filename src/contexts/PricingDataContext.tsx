
// src/contexts/PricingDataContext.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type {
  CombinedAiOutput, // Using the consolidated type from types/index.ts
  ExcelRoute,
  ExcelSOCRoute, // Added ExcelSOCRoute
  RailDataEntry,
  DropOffEntry,
  DirectRailEntry,
  ShipmentType,
  ContainerType,
  CalculationMode,
  RouteFormValues,
  CalculationDetailsForInstructions,
  BestPriceRoute,
  DashboardServiceSection, // Import new dashboard type
  PricingDataContextType, // Import the context type definition
} from '@/types'; // All types now come from src/types

const PricingDataContext = createContext<PricingDataContextType | undefined>(undefined);

export const PricingDataProvider = ({ children }: { children: ReactNode }) => {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("sea_plus_rail");

  const [excelRouteData, setExcelRouteData] = useState<ExcelRoute[]>([]); // For COC
  const [excelSOCRouteData, setExcelSOCRouteData] = useState<ExcelSOCRoute[]>([]); // Added for SOC
  const [excelRailData, setExcelRailData] = useState<RailDataEntry[]>([]);
  const [excelDropOffData, setExcelDropOffData] = useState<DropOffEntry[]>([]); // For COC Drop-off
  const [excelDirectRailData, setExcelDirectRailData] = useState<DirectRailEntry[]>([]);

  const [isSeaRailExcelDataLoaded, setIsSeaRailExcelDataLoaded] = useState(false);
  const [isDirectRailExcelDataLoaded, setIsDirectRailExcelDataLoaded] = useState(false);

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
  const [dashboardServiceSections, setDashboardServiceSections] = useState<DashboardServiceSection[]>([]); // New state for dashboard


  return (
    <PricingDataContext.Provider value={{
      calculationMode, setCalculationMode,
      excelRouteData, setExcelRouteData,
      excelSOCRouteData, setExcelSOCRouteData, // Provide SOC data and setter
      excelRailData, setExcelRailData,
      excelDropOffData, setExcelDropOffData,
      excelDirectRailData, setExcelDirectRailData,
      isSeaRailExcelDataLoaded, setIsSeaRailExcelDataLoaded,
      isDirectRailExcelDataLoaded, setIsDirectRailExcelDataLoaded,
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
      dashboardServiceSections, setDashboardServiceSections, // Provide dashboard state and setter
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
    

    