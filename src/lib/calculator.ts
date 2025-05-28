import type { FreightModeInput, CostBreakdown, RateData, CalculationResultItem, ContainerType } from '@/types';

// Mock rate data - in a real app, this would come from Excel parsing or a database
const mockRateData: RateData = {
  seaRates: {
    "20GP": { base: 1500 },
    "40GP": { base: 2500 },
    "40HC": { base: 2800 },
  },
  railRates: {
    "20GP": { base: 2000 },
    "40GP": { base: 3500 },
    "40HC": { base: 3800 },
  },
  miscCharges: {
    insuranceFactor: 50, // Simplified fixed insurance cost
    customsFixed: 200,
    thcSea: 300,
    thcRail: 250,
  },
};

const calculateCost = (
  params: FreightModeInput,
  rates: Record<ContainerType, { base: number; perKg?: number }>,
  thc: number,
  rateData: RateData
): CostBreakdown => {
  let totalCost = rates[params.containerType].base;
  
  const costBreakdown: CostBreakdown = {
    baseFreight: rates[params.containerType].base,
    thc,
    totalCost: 0, // Will be calculated
    currency: "USD"
  };

  totalCost += thc;

  if (params.insurance) {
    costBreakdown.insuranceCost = rateData.miscCharges.insuranceFactor;
    totalCost += rateData.miscCharges.insuranceFactor;
  }
  if (params.customsClearance) {
    costBreakdown.customsCost = rateData.miscCharges.customsFixed;
    totalCost += rateData.miscCharges.customsFixed;
  }
  
  // Example: Weight-based charge if defined
  if (rates[params.containerType].perKg && params.cargoWeight) {
    const weightCharge = params.cargoWeight * (rates[params.containerType].perKg || 0);
    // Add to otherCharges or a specific field if needed
    costBreakdown.otherCharges = (costBreakdown.otherCharges || 0) + weightCharge;
    totalCost += weightCharge;
  }

  costBreakdown.totalCost = totalCost;
  return costBreakdown;
};

export function calculateSeaFreight(params: FreightModeInput, rateData: RateData = mockRateData): CalculationResultItem {
  const costBreakdown = calculateCost(params, rateData.seaRates, rateData.miscCharges.thcSea, rateData);
  return {
    mode: "Sea Freight",
    costBreakdown,
    transitTime: params.containerType === "20GP" ? "30-35 days" : "25-30 days", // Example
    currency: "USD",
  };
}

export function calculateRailFreight(params: FreightModeInput, rateData: RateData = mockRateData): CalculationResultItem {
  const costBreakdown = calculateCost(params, rateData.railRates, rateData.miscCharges.thcRail, rateData);
  return {
    mode: "Direct Rail",
    costBreakdown,
    transitTime: params.containerType === "20GP" ? "15-18 days" : "12-16 days", // Example
    currency: "USD",
  };
}
