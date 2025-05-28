
import { z } from 'zod';
import type { ContainerType } from '@/types';

const containerTypes: [ContainerType, ...ContainerType[]] = ["20GP", "40GP", "40HC"];
const calculationModes = ["sea_rail", "direct_rail"] as const;
const shipmentTypes = ["coc", "soc"] as const;

export const powerLogFormSchema = z.object({
  calculationMode: z.enum(calculationModes, {
    required_error: "Calculation mode is required.",
  }),
  usdRubRate: z.string().optional(), // Display only, or could be a number if used in calcs
  seaMargin: z.coerce.number().min(0, "Sea margin cannot be negative.").optional(),
  railMargin: z.coerce.number().min(0, "Rail margin cannot be negative.").optional(),
  shipmentType: z.enum(shipmentTypes, {
    required_error: "Shipment type is required.",
  }),
  originPort: z.string().min(2, { message: "Origin port must be at least 2 characters." }).optional(), // Optional as it might not apply to direct rail
  destinationPortSea: z.string().min(2, { message: "Destination port must be at least 2 characters." }).optional(), // Optional
  seaLineCompany: z.string().optional(),
  containerType: z.enum(containerTypes, {
    required_error: "Container type is required.",
  }),
  cargoWeight: z.coerce.number().positive({ message: "Cargo weight must be positive." }),
  destinationCity: z.string().min(2, { message: "Destination city must be at least 2 characters." }),
  station: z.string().min(2, { message: "Station must be at least 2 characters." }).optional(), // Optional
});

export type PowerLogFormValues = z.infer<typeof powerLogFormSchema>;


// Keep old schema for reference or potential future use, but it's not used by PowerLogForm
export const freightModeSchema = z.object({
  containerType: z.enum(containerTypes, {
    required_error: "Container type is required.",
  }),
  cargoWeight: z.coerce.number().positive({ message: "Cargo weight must be positive." }),
  origin: z.string().min(2, { message: "Origin must be at least 2 characters." }),
  destination: z.string().min(2, { message: "Destination must be at least 2 characters." }),
  insurance: z.boolean().default(false),
  customsClearance: z.boolean().default(false),
});

export const calculationFormSchema = z.object({
  seaFreight: freightModeSchema,
  railFreight: freightModeSchema,
});

export type CalculationFormValues = z.infer<typeof calculationFormSchema>;
