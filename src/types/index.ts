
import type { CONTAINER_TYPES_CONST, SHIPMENT_TYPES_CONST, CALCULATION_MODES_CONST } from "@/lib/pricing/constants";

export type ContainerType = typeof CONTAINER_TYPES_CONST[number];
export type ShipmentType = typeof SHIPMENT_TYPES_CONST[number];
export type CalculationMode = typeof CALCULATION_MODES_CONST[number];


// For the new PowerLogForm - old name, keeping for now.
export interface PowerLogFormInput {
  calculationMode: CalculationMode;
  usdRubRate?: string;
  seaMargin?: number;
  railMargin?: number;
  shipmentType: ShipmentType;
  originPort?: string;
  destinationPortSea?: string; // Specific for sea destination
  seaLineCompany?: string;
  containerType: ContainerType;
  cargoWeight: number; // Assuming cargo weight is still relevant for some calculations
  destinationCity: string; // General destination city, could be Russian for rail or final for direct
  station?: string; // Rail station
}


export interface FreightModeInput {
  containerType: ContainerType;
  cargoWeight: number; // in kg
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
  thc?: number; // Terminal Handling Charges
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

// Types for the PortPriceFinderForm and its data structures
export interface ExcelRoute {
  originPorts: string[];
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | null;
  price40HC: number | null;
  seaComment?: string | null;
}

export interface ExcelSOCRoute {
  departurePorts: string[]; // For SOC, it's "Порт Отправления"
  destinationPorts: string[];
  seaLines: string[];
  price20DC: number | null;
  price40HC: number | null;
  socComment?: string | null;
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
  comment?: string | null;
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
  commentary?: string | null;
}

// Extended RouteFormValues to include fields that might be set by useEffects or specific modes
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

  // This field is for the UI toggle, not part of the submitted data for calculation in this specific way.
  // The actual 'calculationMode' is determined by context or UI state.
  calculationModeToggle?: CalculationMode;
}


// Output from AI flows, might need to be adjusted based on actual flow definitions
export interface SmartPricingOutput {
  shipmentType?: ShipmentType;
  originCity?: string;
  destinationCity?: string; // This could be sea destination or final Russian city
  seaLineCompany?: string;
  containerType?: ContainerType;
  seaCost?: number | null;
  seaComment?: string | null;
  socComment?: string | null; // Specific for SOC

  // Rail specific (for sea+rail)
  railCost20DC_24t?: number | null;
  railCost20DC_28t?: number | null;
  railGuardCost20DC?: number | null;
  railCost40HC?: number | null;
  railGuardCost40HC?: number | null;
  russianDestinationCity?: string; // The final Russian city if rail is involved
  railArrivalStation?: string;

  // Drop off specific (for COC sea+rail)
  dropOffCost?: number | null;
  dropOffComment?: string | null;

  // Direct Rail specific
  directRailCityOfDeparture?: string;
  directRailDepartureStation?: string;
  directRailDestinationCity?: string; // This is the final destination for Direct Rail
  directRailBorder?: string;
  directRailCost?: number | null;
  directRailETD?: string;
  directRailCommentary?: string | null; // Original Excel comment
  directRailAgentName?: string;
  directRailIncoterms?: string;

  // General commentary from AI
  commentary?: string;
  totalFreightCostUSD?: number | null; // For display if calculated by AI
  totalRailCostRUB?: number | null; // For display if calculated by AI
}


export interface CalculationDetailsForInstructions {
  shipmentType?: ShipmentType;
  originPort?: string;
  destinationPort?: string;
  seaLineCompany?: string;
  containerType?: ContainerType;
  russianDestinationCity?: string;
  railArrivalStation?: string;
  railDepartureStation?: string; // Added
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
  seaDestinationPort: string; // Vladivostok variant
  seaLineCompany?: string;
  containerType: ContainerType;
  russianDestinationCity?: string; // Final if rail, or same as seaDest if no rail
  
  seaCostUSD: number;
  seaComment?: string | null;
  socComment?: string | null;

  railCost20DC_24t_RUB?: number | null;
  railCost20DC_28t_RUB?: number | null;
  railGuardCost20DC_RUB?: number | null;
  railCost40HC_RUB?: number | null;
  railGuardCost40HC_RUB?: number | null;
  railDepartureStation?: string;
  railArrivalStation?: string;

  dropOffCostUSD?: number | null;
  dropOffComment?: string | null;
  
  totalComparisonCostRUB: number; // For sorting
}
