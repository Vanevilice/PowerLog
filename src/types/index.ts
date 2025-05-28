
import type { SmartPricingOutput as SmartPricingOutputBase } from '@/ai/flows/smart-pricing';
import type { PricingCommentaryOutput as PricingCommentaryOutputBase } from '@/ai/flows/pricing-commentary';
import type { CONTAINER_TYPES_CONST, SHIPMENT_TYPES_CONST, CALCULATION_MODES_CONST } from "@/lib/pricing/constants";

// Core Enum-like Types from Constants
export type ContainerType = typeof CONTAINER_TYPES_CONST[number];
export type ShipmentType = typeof SHIPMENT_TYPES_CONST[number];
export type CalculationMode = typeof CALCULATION_MODES_CONST[number];

// Excel Data Structures
export interface ExcelRoute { // COC Data from 3rd Sheet
  originPorts: string[];
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | string | null;
  price40HC: number | string | null;
  seaComment?: string;
}

export interface ExcelSOCRoute { // SOC Data from 2nd Sheet
  departurePorts: string[];
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | string | null;
  price40HC: number | string | null;
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
  price20DC: number | string | null;
  price40HC: number | string | null;
  comment?: string;
}

export interface DirectRailEntry {
  agentName: string;
  cityOfDeparture: string;
  departureStation: string;
  border: string;
  destinationCity: string;
  incoterms: string;
  price: number | null;
  etd: string;
  commentary: string;
}

// Dashboard Data Structure
export interface DashboardServiceDataRow {
  route: string;
  rate: string;
  containerInfo: string;
  additionalComment: string;
  railwayCost?: string; // New: For "CY" row data
  railwayContainerInfo?: string; // New
  railwayComment?: string; // New
}

export interface DashboardServiceSection {
  serviceName: string;
  dataRows: DashboardServiceDataRow[];
}


// Form Values
export interface RouteFormValues {
  shipmentType: ShipmentType;
  originPort?: string;
  destinationPort?: string;
  seaLineCompany?: string;
  containerType?: ContainerType;
  russianDestinationCity?: string;
  arrivalStationSelection?: string;
  seaMargin?: string;
  railMargin?: string;
  directRailAgentName?: string;
  directRailCityOfDeparture?: string;
  directRailDestinationCityDR?: string;
  directRailIncoterms?: string;
  directRailBorder?: string;
  calculationModeToggle?: CalculationMode;
}


// AI Flow Output Extension and Calculation Details
// Combined SmartPricingOutput (for general AI results) and PricingCommentaryOutput (for commentary only)
export interface CombinedAiOutput extends SmartPricingOutputBase, PricingCommentaryOutputBase {
  shipmentType?: ShipmentType;
  originCity?: string;
  destinationCity?: string; // Final destination or sea destination
  seaLineCompany?: string;
  containerType?: ContainerType;
  seaCost?: number | null;
  seaComment?: string | null;
  socComment?: string | null;

  railCost20DC_24t?: number | null;
  railCost20DC_28t?: number | null;
  railGuardCost20DC?: number | null;
  railCost40HC?: number | null;
  railGuardCost40HC?: number | null;
  russianDestinationCity?: string; // Specifically the Russian final city if rail is involved
  railArrivalStation?: string | null;
  railDepartureStation?: string | null;

  dropOffCost?: number | null; // Numeric value if parseable
  dropOffComment?: string | null;
  dropOffDisplayValue?: string | null; // For special string formats like "$ X / $ Y"

  directRailCityOfDeparture?: string;
  directRailDepartureStation?: string;
  directRailBorder?: string;
  directRailCost?: number | null;
  directRailETD?: string;
  directRailCommentary?: string | null; // Original Excel commentary for Direct Rail
  directRailAgentName?: string;
  directRailIncoterms?: string;
}


export interface CalculationDetailsForInstructions {
  shipmentType?: ShipmentType;
  originPort?: string;
  destinationPort?: string; // Sea destination
  seaLineCompany?: string;
  containerType?: ContainerType;
  russianDestinationCity?: string; // Final Russian city for rail
  railArrivalStation?: string;
  railDepartureStation?: string;
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
  dropOffCost?: number | null; // Numeric part
  dropOffComment?: string | null;
  dropOffDisplayValue?: string | null; // String for display, like "$ X / $ Y"
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
  socComment?: string | null;

  railCost20DC_24t_RUB?: number | null;
  railCost20DC_28t_RUB?: number | null;
  railGuardCost20DC_RUB?: number | null;
  railCost40HC_RUB?: number | null;
  railGuardCost40HC_RUB?: number | null;

  dropOffCostUSD?: number | null; // Numeric part for summation
  dropOffComment?: string | null;
  dropOffDisplayValue?: string | null; // For displaying strings like "$ X / $ Y"

  totalComparisonCostRUB: number;
}


// For PricingDataContext provider
export interface PricingDataContextType {
  calculationMode: CalculationMode;
  setCalculationMode: React.Dispatch<React.SetStateAction<CalculationMode>>;

  excelRouteData: ExcelRoute[];
  setExcelRouteData: React.Dispatch<React.SetStateAction<ExcelRoute[]>>;
  excelSOCRouteData: ExcelSOCRoute[];
  setExcelSOCRouteData: React.Dispatch<React.SetStateAction<ExcelSOCRoute[]>>;
  excelRailData: RailDataEntry[];
  setExcelRailData: React.Dispatch<React.SetStateAction<RailDataEntry[]>>;
  excelDropOffData: DropOffEntry[];
  setExcelDropOffData: React.Dispatch<React.SetStateAction<DropOffEntry[]>>;
  excelDirectRailData: DirectRailEntry[];
  setExcelDirectRailData: React.Dispatch<React.SetStateAction<DirectRailEntry[]>>;

  isSeaRailExcelDataLoaded: boolean;
  setIsSeaRailExcelDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  isDirectRailExcelDataLoaded: boolean;
  setIsDirectRailExcelDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;

  excelOriginPorts: string[];
  setExcelOriginPorts: React.Dispatch<React.SetStateAction<string[]>>;
  excelDestinationPorts: string[];
  setExcelDestinationPorts: React.Dispatch<React.SetStateAction<string[]>>;
  excelRussianDestinationCitiesMasterList: string[];
  setExcelRussianDestinationCitiesMasterList: React.Dispatch<React.SetStateAction<string[]>>;

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
  cachedShippingInfo: CombinedAiOutput | null;
  setCachedShippingInfo: React.Dispatch<React.SetStateAction<CombinedAiOutput | null>>;
  cachedLastSuccessfulCalculation: CalculationDetailsForInstructions | null;
  setCachedLastSuccessfulCalculation: React.Dispatch<React.SetStateAction<CalculationDetailsForInstructions | null>>;

  bestPriceResults: BestPriceRoute[] | null;
  setBestPriceResults: React.Dispatch<React.SetStateAction<BestPriceRoute[] | null>>;

  dashboardServiceSections: DashboardServiceSection[]; // State for dashboard data
  setDashboardServiceSections: React.Dispatch<React.SetStateAction<DashboardServiceSection[]>>; // Setter for dashboard data
}

// Old types from original PowerLogForm / calculator, keep if still used by calculator page, or remove if fully deprecated
export interface PowerLogFormInput {
  calculationMode: CalculationMode; // Re-using CalculationMode type
  usdRubRate?: string;
  seaMargin?: number;
  railMargin?: number;
  shipmentType: ShipmentType; // Re-using ShipmentType
  originPort?: string;
  destinationPortSea?: string;
  seaLineCompany?: string;
  containerType: ContainerType; // Re-using ContainerType
  cargoWeight: number;
  destinationCity: string;
  station?: string;
}

export interface FreightModeInput {
  containerType: ContainerType;
  cargoWeight: number;
  origin: string;
  destination:string;
  insurance: boolean;
  customsClearance: boolean;
}

export interface CalculationParams {
  seaFreight: FreightModeInput;
  railFreight: FreightModeInput;
}

export interface CostBreakdown {
  baseFreight: number;
  fuelSurcharge?: number;
  thc?: number;
  insuranceCost?: number;
  customsCost?: number;
  otherCharges?: number;
  totalCost: number;
  currency?: string;
}

export interface CalculationResultItem {
  mode: "Sea Freight" | "Direct Rail";
  costBreakdown: CostBreakdown;
  transitTime?: string;
  currency: string;
}

export interface CalculationResults {
  seaFreightResult: CalculationResultItem;
  railFreightResult: CalculationResultItem;
  recommendedMode?: "Sea Freight" | "Direct Rail" | "None";
  savings?: {
    amount: number;
    currency: string;
    cheaperMode: "Sea Freight" | "Direct Rail";
  };
  currency?: string;
}

export interface RateData {
  seaRates: Record<ContainerType, { base: number; perKg?: number }>;
  railRates: Record<ContainerType, { base: number; perKg?: number }>;
  miscCharges: {
    insuranceFactor: number;
    customsFixed: number;
    thcSea: number;
    thcRail: number;
  };
}
