// src/contexts/PricingDataContext.tsx
'use client';

import type { SmartPricingOutput as SmartPricingOutputBase } from '@/ai/flows/smart-pricing';
import type { PricingCommentaryOutput } from '@/ai/flows/pricing-commentary';
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Extend SmartPricingOutput to include potential drop-off fields
export interface SmartPricingOutput extends SmartPricingOutputBase {
  dropOffCost?: number | null;
  dropOffComment?: string | null;
  socComment?: string | null;
  seaComment?: string | null;
  railArrivalStation?: string | null; // For single calc

  railCost20DC_24t?: number | null; // For single calc
  railCost20DC_28t?: number | null; // For single calc
  railGuardCost20DC?: number | null; // For single calc
  railCost40HC?: number | null; // For single calc
  railGuardCost40HC?: number | null; // For single calc

  // Direct Rail specific fields for display
  directRailCityOfDeparture?: string;
  directRailDepartureStation?: string;
  directRailDestinationCity?: string;
  directRailBorder?: string;
  directRailCost?: number | null;
  directRailETD?: string;
  directRailCommentary?: string;
  directRailAgentName?: string;
  directRailIncoterms?: string;
}

export interface ExcelRoute { // COC Data from 3rd Sheet
  originPorts: string[];
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | null;
  price40HC: number | null;
  seaComment?: string;
}

export interface ExcelSOCRoute { // SOC Data from 2nd Sheet
  departurePorts: string[];
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | null;
  price40HC: number | null;
  socComment?: string;
}

export interface RailDataEntry {
  departureStations: string[];
  arrivalStations: string[];
  cityOfArrival: string;
  price20DC_24t: number | null;
  guardCost20DC: number | null;
  price20DC_28t: number | null;
  price40HC: number | null;
  guardCost40HC: number | null;
}

export interface DropOffEntry {
  seaLine: string;
  cities: string[];
  price20DC: number | null;
  price40HC: number | null;
  comment?: string;
}

export interface DirectRailEntry {
  agentName: string; // col 1
  cityOfDeparture: string; // col 2
  departureStation: string; // col 3
  border: string; // col 4
  destinationCity: string; // col 5
  incoterms: string; // col 6
  price: number | null; // col 7
  etd: string; // col 8
  commentary: string; // col 9
}

export type ShipmentType = "COC" | "SOC";
export type ContainerType = "20DC" | "40HC";
export type CalculationMode = "sea_plus_rail" | "direct_rail";


export interface RouteFormValues {
  // Sea + Rail mode
  shipmentType: ShipmentType;
  originPort: string;
  destinationPort?: string;
  seaLineCompany?: string;
  containerType?: ContainerType;
  russianDestinationCity?: string; // Renamed to Destination City in UI
  arrivalStationSelection?: string;
  seaMargin?: string;
  railMargin?: string;

  // Direct Rail mode
  directRailAgentName?: string;
  directRailCityOfDeparture?: string;
  directRailDestinationCityDR?: string; // Suffix DR to avoid clash if used generally
  directRailIncoterms?: string;
  directRailBorder?: string;
}

export interface CalculationDetailsForInstructions {
  shipmentType?: ShipmentType;
  originPort?: string;
  destinationPort?: string;
  seaLineCompany?: string;
  containerType?: ContainerType;
  russianDestinationCity?: string;
  railArrivalStation?: string;

  seaCostBase?: number | null;
  seaMarginApplied?: number;
  seaCostFinal?: number | null;
  seaComment?: string | null;

  railCostBase24t?: number | null;
  railCostBase28t?: number | null;
  railGuardCost20DC?: number | null;
  railCostBase40HC?: number | null;
  railGuardCost40HC?: number | null;

  railMarginApplied?: number;

  railCostFinal24t?: number | null;
  railCostFinal28t?: number | null;
  railCostFinal40HC?: number | null;

  dropOffCost?: number | null;
  dropOffComment?: string | null;
  socComment?: string | null;
}

export interface BestPriceRoute {
  id: string;
  shipmentType: ShipmentType;
  originPort: string;
  seaDestinationPort: string;
  seaLineCompany?: string;
  containerType: ContainerType;
  russianDestinationCity: string;
  railDepartureStation?: string;
  railArrivalStation?: string;
  seaCostUSD: number | null;
  seaComment?: string | null;

  railCost20DC_24t_RUB?: number | null;
  railCost20DC_28t_RUB?: number | null;
  railGuardCost20DC_RUB?: number | null;
  railCost40HC_RUB?: number | null;
  railGuardCost40HC_RUB?: number | null;

  dropOffCostUSD?: number | null;
  dropOffComment?: string | null;
  socComment?: string | null;
  totalComparisonCostRUB: number;
}


interface PricingDataContextType {
  calculationMode: CalculationMode;
  setCalculationMode: React.Dispatch<React.SetStateAction<CalculationMode>>;

  excelRouteData: ExcelRoute[]; // COC
  setExcelRouteData: React.Dispatch<React.SetStateAction<ExcelRoute[]>>;
  excelSOCRouteData: ExcelSOCRoute[]; // SOC
  setExcelSOCRouteData: React.Dispatch<React.SetStateAction<ExcelSOCRoute[]>>;
  excelRailData: RailDataEntry[]; // Common Rail
  setExcelRailData: React.Dispatch<React.SetStateAction<RailDataEntry[]>>;
  excelDropOffData: DropOffEntry[];
  setExcelDropOffData: React.Dispatch<React.SetStateAction<DropOffEntry[]>>;
  excelDirectRailData: DirectRailEntry[];
  setExcelDirectRailData: React.Dispatch<React.SetStateAction<DirectRailEntry[]>>;

  isSeaRailExcelDataLoaded: boolean; // For "Море + Ж/Д" file
  setIsSeaRailExcelDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  isDirectRailExcelDataLoaded: boolean; // For "Прямое ЖД" file
  setIsDirectRailExcelDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;


  // Dropdown options for Sea + Rail
  excelOriginPorts: string[];
  setExcelOriginPorts: React.Dispatch<React.SetStateAction<string[]>>;
  excelDestinationPorts: string[];
  setExcelDestinationPorts: React.Dispatch<React.SetStateAction<string[]>>;
  excelRussianDestinationCitiesMasterList: string[];
  setExcelRussianDestinationCitiesMasterList: React.Dispatch<React.SetStateAction<string[]>>;

  // Dropdown options for Direct Rail
  directRailAgents: string[];
  setDirectRailAgents: React.Dispatch<React.SetStateAction<string[]>>;
  directRailDepartureCities: string[];
  setDirectRailDepartureCities: React.Dispatch<React.SetStateAction<string[]>>;
  directRailDestinationCitiesDR: string[];
  setDirectRailDestinationCitiesDR: React.Dispatch<React.SetStateAction<string[]>>;
  directRailIncotermsList: string[];
  setDirectRailIncotermsList: React.Dispatch<React.SetStateAction<string[]>>;
  directRailBordersList: string[];
  setDirectRailBordersList: React.Dispatch<React.SetStateAction<string[]>>;


  cachedFormValues: Partial<RouteFormValues> | null;
  setCachedFormValues: React.Dispatch<React.SetStateAction<Partial<RouteFormValues> | null>>;
  cachedShippingInfo: SmartPricingOutput | PricingCommentaryOutput | null; // This might need to be more generic or split if direct rail result is very different
  setCachedShippingInfo: React.Dispatch<React.SetStateAction<SmartPricingOutput | PricingCommentaryOutput | null>>;
  cachedLastSuccessfulCalculation: CalculationDetailsForInstructions | null;
  setCachedLastSuccessfulCalculation: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>;

  bestPriceResults: BestPriceRoute[] | null;
  setBestPriceResults: React.Dispatch<React.SetStateAction<BestPriceRoute[] | null>>;
}

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

export const usePricingData = () => {
  const context = useContext(PricingDataContext);
  if (context === undefined) {
    throw new Error('usePricingData must be used within a PricingDataProvider');
  }
  return context;
};
