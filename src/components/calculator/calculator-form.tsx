"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { calculationFormSchema, type CalculationFormValues } from "@/lib/schemas";
import { performCalculation } from "@/actions/calculate";
import FreightModeFormSection from "./freight-mode-form-section";
import type { CalculationResults } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface CalculatorFormProps {
  onCalculateStart: () => void;
  onCalculateSuccess: (results: CalculationResults) => void;
  onCalculateError: (error: string) => void;
}

const defaultValues: CalculationFormValues = {
  seaFreight: {
    containerType: "20GP",
    cargoWeight: 10000,
    origin: "Shanghai",
    destination: "Rotterdam",
    insurance: true,
    customsClearance: true,
  },
  railFreight: {
    containerType: "40GP",
    cargoWeight: 15000,
    origin: "Chengdu",
    destination: "Duisburg",
    insurance: true,
    customsClearance: true,
  },
};

export default function CalculatorForm({
  onCalculateStart,
  onCalculateSuccess,
  onCalculateError,
}: CalculatorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<CalculationFormValues>({
    resolver: zodResolver(calculationFormSchema),
    defaultValues,
  });

  async function onSubmit(data: CalculationFormValues) {
    setIsSubmitting(true);
    onCalculateStart();
    try {
      const response = await performCalculation(data);
      if (response.success && response.results) {
        onCalculateSuccess(response.results);
        toast({
          title: "Calculation Successful",
          description: "Results updated.",
        });
      } else {
        let errorMessage = "Calculation failed. Please try again.";
        if (typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.error) { // ZodError
          // Simplified error message, could be more detailed
          errorMessage = "Invalid input. Please check the form fields.";
           Object.values(response.error.fieldErrors).forEach(fieldErrors => {
            if (fieldErrors && fieldErrors.length > 0) {
              toast({
                title: "Validation Error",
                description: fieldErrors[0],
                variant: "destructive",
              });
            }
          });
        }
        onCalculateError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      onCalculateError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FreightModeFormSection
          control={form.control}
          mode="seaFreight"
          title="Sea Freight Details"
        />
        <Separator className="my-6" />
        <FreightModeFormSection
          control={form.control}
          mode="railFreight"
          title="Direct Rail Details"
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            "Calculate Logistics Costs"
          )}
        </Button>
      </form>
    </Form>
  );
}
