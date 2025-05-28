
// src/contexts/PricingDataContext.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type {
  SmartPricingOutput, // Now importing the consolidated, extended version
  PricingCommentaryOutput,
  ExcelRoute,
  ExcelSOCRoute,
  RailDataEntry,
  DropOffEntry,
  DirectRailEntry,
  ShipmentType,
  ContainerType,
  CalculationMode,
  RouteFormValues,
  CalculationDetailsForInstructions,
  BestPriceRoute,
  PricingDataContextType, // Import the context type definition
} from '@/types'; // All types now come from src/types

const PricingDataContext = createContext<PricingDataContextType | undefined>(undefined);

export const PricingDataProvider = ({ children }: { children: ReactNode }) => {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("sea_plus_rail");

  const [excelRouteData, setExcelRouteData] = useState<ExcelRoute[]>([]);
  const [excelSOCRouteData, setExcelSOCRouteData] = useState<ExcelSOCRoute[]>([]);
  const [excelRailData, setExcelRailData] = useState<RailDataEntry[]>([]);
  const [excelDropOffData, setExcelDropOffData] = useState<DropOffEntry[]>([]);
  const [excelDirectRailData, setExcelDirectRailData] = useState<DirectRailEntry[]>([]);

  const [isSeaRailExcelDataLoaded, setIsSeaRailExcelDataLoaded] = useState(false);
  const [isDirectRailExcelDataLoaded, setIsDirectRailExcelDataLoaded] = useState(false);

  const [excelOriginPorts, setExcelOriginPorts] = useState<string[]>([]);
  const [excelDestinationPorts, setExcelDestinationPorts] = useState<string[]>([]);
  const [excelRussianDestinationCitiesMasterList, setExcelRussianDestinationCitiesMasterList] = useState<string[]>([]);

  const [directRailAgents, setDirectRailAgents] = useState<string[]>([]);
  const [directRailDepartureCities, setDirectRailDepartureCities] = useState<string[]>([]);
  const [directRailDestinationCitiesDR, setDirectRailDestinationCitiesDR] = useState<string[]>([]);
  const [directRailIncotermsList, setDirectRailIncotermsList] = useState<string[]>([]);
  const [directRailBordersList, setDirectRailBordersList] = useState<string[]>([]);

  const [cachedFormValues, setCachedFormValues] = useState<Partial<RouteFormValues> | null>(null);
  const [cachedShippingInfo, setCachedShippingInfo] = useState<SmartPricingOutput | PricingCommentaryOutput | null>(null);
  const [cachedLastSuccessfulCalculation, setCachedLastSuccessfulCalculation] = useState<CalculationDetailsForInstructions | null>(null);
  const [bestPriceResults, setBestPriceResults] = useState<BestPriceRoute[] | null>(null);

  return (
    <PricingDataContext.Provider value={{
      calculationMode, setCalculationMode,
      excelRouteData, setExcelRouteData,
      excelSOCRouteData, setExcelSOCRouteData,
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
      cachedFormValues, setCachedFormValues,
      cachedShippingInfo, setCachedShippingInfo,
      cachedLastSuccessfulCalculation, setCachedLastSuccessfulCalculation,
      bestPriceResults, setBestPriceResults,
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

    