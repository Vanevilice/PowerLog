import { z } from 'zod';
import type { ContainerType } from '@/types';

const containerTypes: [ContainerType, ...ContainerType[]] = ["20GP", "40GP", "40HC"];

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
