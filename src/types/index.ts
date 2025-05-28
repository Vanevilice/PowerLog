
export type ContainerType = "20GP" | "40GP" | "40HC";

export interface FreightModeInput {
  containerType: ContainerType;
  cargoWeight: number; // in kg
  origin: string;
  destination: string;
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
}

// This is a partial representation of what might come from Excel/rate sheets
export interface RateData {
  seaRates: Record<ContainerType, { base: number; perKg?: number }>;
  railRates: Record<ContainerType, { base: number; perKg?: number }>;
  miscCharges: {
    insuranceFactor: number; // e.g., 0.001 of cargo value (cargo value not in form, simplify for now)
    customsFixed: number;
    thcSea: number;
    thcRail: number;
  };
}
