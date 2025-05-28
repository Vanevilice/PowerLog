"use server";

import { z } from 'zod';
import { calculationFormSchema } from '@/lib/schemas';
import { calculateSeaFreight, calculateRailFreight } from '@/lib/calculator';
import type { CalculationParams, CalculationResults, CalculationResultItem } from '@/types';

export async function performCalculation(
  data: CalculationParams
): Promise<{ success: boolean; results?: CalculationResults; error?: string | z.ZodError<CalculationParams> }> {
  try {
    const validatedData = calculationFormSchema.parse(data);

    const seaResult = calculateSeaFreight(validatedData.seaFreight);
    const railResult = calculateRailFreight(validatedData.railFreight);

    const results: CalculationResults = {
      seaFreightResult: seaResult,
      railFreightResult: railResult,
      currency: "USD" // Assuming USD for now
    };

    // Determine recommended mode and savings
    if (seaResult.costBreakdown.totalCost < railResult.costBreakdown.totalCost) {
      results.recommendedMode = "Sea Freight";
      results.savings = {
        amount: railResult.costBreakdown.totalCost - seaResult.costBreakdown.totalCost,
        currency: "USD",
        cheaperMode: "Sea Freight",
      };
    } else if (railResult.costBreakdown.totalCost < seaResult.costBreakdown.totalCost) {
      results.recommendedMode = "Direct Rail";
      results.savings = {
        amount: seaResult.costBreakdown.totalCost - railResult.costBreakdown.totalCost,
        currency: "USD",
        cheaperMode: "Direct Rail",
      };
    } else {
       results.recommendedMode = "None"; // Costs are equal or logic needs refinement
    }


    // Simulate network delay for loading state demonstration
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, results };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation Error:", error.flatten());
      return { success: false, error: error.flatten() };
    }
    console.error("Calculation Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}
