
"use server";

import { z } from 'zod';
// Using the old calculationFormSchema for adapting, but ideally, this action is rewritten for powerLogFormSchema
import { calculationFormSchema, powerLogFormSchema } from '@/lib/schemas';
import { calculateSeaFreight, calculateRailFreight } from '@/lib/calculator';
import type { CalculationParams, CalculationResults, PowerLogFormValues } from '@/types';

// The performCalculation function needs to be significantly refactored
// to work with the new PowerLogFormValues and the selected calculationMode.
// For now, we'll make minimal changes to accept the old structure for compatibility
// if PowerLogForm adapts its output, or we'll simulate a response.

export async function performCalculation(
  // data: PowerLogFormValues // Ideal new signature
  data: CalculationParams // Current signature, PowerLogForm will need to adapt its output or this action needs full rewrite
): Promise<{ success: boolean; results?: CalculationResults; error?: string | z.ZodError<any> }> {
  try {
    // If 'data' is PowerLogFormValues, validation and processing would be different.
    // For now, assuming 'data' conforms to CalculationParams (seaFreight & railFreight objects)
    // This means PowerLogForm.tsx's onSubmit needs to correctly structure this.
    // The current PowerLogForm.tsx's adapter is a hack.

    // Let's validate against the OLD schema to make the existing logic run
    // This is a temporary measure. The action should ideally use powerLogFormSchema
    const validatedData = calculationFormSchema.parse(data);

    const seaResult = calculateSeaFreight(validatedData.seaFreight);
    const railResult = calculateRailFreight(validatedData.railFreight);

    const results: CalculationResults = {
      seaFreightResult: seaResult,
      railFreightResult: railResult,
      currency: "USD"
    };

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
       results.recommendedMode = "None";
    }

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
