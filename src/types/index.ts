
export type ContainerType = "20GP" | "40GP" | "40HC";
export type CalculationMode = "sea_rail" | "direct_rail";
export type ShipmentType = "coc" | "soc";

// For the new PowerLogForm
export interface PowerLogFormInput {
  calculationMode: CalculationMode;
  usdRubRate?: string;
  seaMargin?: number;
  railMargin?: number;
  shipmentType: ShipmentType;
  originPort?: string;
  destinationPortSea?: string;
  seaLineCompany?: string;
  containerType: ContainerType;
  cargoWeight: number;
  destinationCity: string;
  station?: string;
}

// Existing types - some might be reusable or need merging
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
  currency?: string; // Added currency here
}

export interface CalculationResultItem {
  mode: "Sea Freight" | "Direct Rail";
  costBreakdown: CostBreakdown;
  transitTime?: string; // e.g., "25-30 days"
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
  currency?: string; // Overall currency for results
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

// Exporting new form values type from schema
export type { PowerLogFormValues } from '@/lib/schemas';
