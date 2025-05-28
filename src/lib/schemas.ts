
import { z } from 'zod';
import type { ContainerType as AppContainerType } from '@/types'; // Use AppContainerType to avoid conflict if any local ContainerType is defined
import { CONTAINER_TYPES_CONST, SHIPMENT_TYPES_CONST, CALCULATION_MODES_CONST } from '@/lib/pricing/constants';


// Keep old schema for reference or potential future use, but it's not used by PowerLogForm
export const freightModeSchema = z.object({
  containerType: z.enum(CONTAINER_TYPES_CONST as [string, ...string[]], { // Cast for Zod enum
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


// Schema for the PortPriceFinderForm
export const RouteSchema = z.object({
  // Common fields (though some are specific to calculationMode, handled by UI)
  calculationModeToggle: z.enum(CALCULATION_MODES_CONST).optional(), // Not directly submitted, but for UI control
  seaMargin: z.string().optional(),
  railMargin: z.string().optional(),

  // Sea + Rail mode
  shipmentType: z.enum(SHIPMENT_TYPES_CONST, {
    errorMap: () => ({ message: "Shipment type (COC/SOC) is required." }),
  }),
  originPort: z.string().optional(),
  destinationPort: z.string().optional(),
  seaLineCompany: z.string().optional(),
  containerType: z.enum(CONTAINER_TYPES_CONST as [string, ...string[]]).optional(), // Cast for Zod enum
  russianDestinationCity: z.string().optional(),
  arrivalStationSelection: z.string().optional(),

  // Direct Rail mode
  directRailAgentName: z.string().optional(),
  directRailCityOfDeparture: z.string().optional(),
  directRailDestinationCityDR: z.string().optional(), // DR for Direct Rail
  directRailIncoterms: z.string().optional(),
  directRailBorder: z.string().optional(),
}).refine(data => {
  // Example conditional validation: if sea_plus_rail mode is implied by presence of originPort
  if (data.originPort && data.destinationPort) {
    return data.originPort !== data.destinationPort;
  }
  return true;
}, {
  message: "Origin and destination ports must be different for sea routes.",
  path: ["destinationPort"], // Path for error message if refinement fails
});

export type RouteFormValues = z.infer<typeof RouteSchema>;
