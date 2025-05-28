
import { z } from 'zod';
import type { ContainerType, ShipmentType, CalculationMode, RouteFormValues as RouteFormValuesType } from '@/types';
import { CONTAINER_TYPES_CONST, SHIPMENT_TYPES_CONST, CALCULATION_MODES_CONST } from '@/lib/pricing/constants';

// Schema for the PortPriceFinderForm
// This schema should align with the RouteFormValuesType interface in src/types/index.ts
export const RouteSchema = z.object({
  shipmentType: z.enum(SHIPMENT_TYPES_CONST, {
    required_error: "Shipment type (COC/SOC) is required.",
    invalid_type_error: "Invalid shipment type.",
  }),
  originPort: z.string().optional(), // Optional at schema level, required by logic/UI conditionally
  destinationPort: z.string().optional(), // Made optional at schema level for sea_plus_rail as well
  seaLineCompany: z.string().optional(),
  containerType: z.enum(CONTAINER_TYPES_CONST).optional(),
  russianDestinationCity: z.string().optional(),
  arrivalStationSelection: z.string().optional(),
  seaMargin: z.string().refine(val => !val || /^\d*\.?\d*$/.test(val), { message: "Margin must be a valid number." }).optional(),
  railMargin: z.string().refine(val => !val || /^\d*\.?\d*$/.test(val), { message: "Margin must be a valid number." }).optional(),

  directRailAgentName: z.string().optional(),
  directRailCityOfDeparture: z.string().optional(),
  directRailDestinationCityDR: z.string().optional(),
  directRailIncoterms: z.string().optional(),
  directRailBorder: z.string().optional(),

  calculationModeToggle: z.enum(CALCULATION_MODES_CONST).optional(), // For UI radio button state
}).refine(data => {
  // Conditional validation: if sea_plus_rail mode is implied
  if (data.calculationModeToggle === 'sea_plus_rail' || (!data.calculationModeToggle && data.originPort)) {
    if (!data.originPort) return false;
    // destinationPort is now handled by specific function logic, not a schema requirement here
    // if (!data.destinationPort) return false; 
    if (data.originPort && data.destinationPort && data.originPort === data.destinationPort) return false;
    if (!data.containerType) return false;
  }
  return true;
}, (data) => {
    if (data.calculationModeToggle === 'sea_plus_rail' || (!data.calculationModeToggle && data.originPort)) {
        if (!data.originPort) return { message: "Origin port is required for Sea+Rail.", path: ["originPort"]};
        // No longer providing schema error for missing destinationPort
        // if (!data.destinationPort) return { message: "Destination port (Sea) is required for Sea+Rail.", path: ["destinationPort"]}; 
        if (data.originPort && data.destinationPort && data.originPort === data.destinationPort) return { message: "Origin and Destination ports must be different.", path: ["destinationPort"]};
        if (!data.containerType) return { message: "Container type is required for Sea+Rail.", path: ["containerType"]};
    }
    return { message: "Invalid configuration." }; // Generic, should not be hit if paths are correct
}).refine(data => {
    if (data.calculationModeToggle === 'direct_rail') {
        if(!data.directRailCityOfDeparture) return false;
        if(!data.directRailDestinationCityDR) return false;
        if(!data.directRailAgentName) return false;
        if(!data.directRailIncoterms) return false;
        if(!data.directRailBorder) return false;
    }
    return true;
}, (data) => {
    if (data.calculationModeToggle === 'direct_rail') {
        if(!data.directRailCityOfDeparture) return {message: "City of Departure is required for Direct Rail.", path: ["directRailCityOfDeparture"]};
        if(!data.directRailDestinationCityDR) return {message: "Destination City is required for Direct Rail.", path: ["directRailDestinationCityDR"]};
        if(!data.directRailAgentName) return {message: "Agent Name is required for Direct Rail.", path: ["directRailAgentName"]};
        if(!data.directRailIncoterms) return {message: "Incoterms are required for Direct Rail.", path: ["directRailIncoterms"]};
        if(!data.directRailBorder) return {message: "Border is required for Direct Rail.", path: ["directRailBorder"]};
    }
    return { message: "Invalid configuration for Direct Rail." };
});


export type RouteFormValidationValues = z.infer<typeof RouteSchema>;

// Keep old schema for reference or potential future use, but it's not used by PowerLogForm
// If PowerLogForm specific to the other calculator page is still needed, its schema should be here.
// For now, assuming it's deprecated or will use a different schema.
export const powerLogFormSchema = z.object({
  calculationMode: z.enum(CALCULATION_MODES_CONST as [string, ...string[]]),
  usdRubRate: z.string().optional(),
  seaMargin: z.coerce.number().optional(),
  railMargin: z.coerce.number().optional(),
  shipmentType: z.enum(SHIPMENT_TYPES_CONST as [string, ...string[]]),
  originPort: z.string().optional(), // Optional as it depends on mode
  destinationPortSea: z.string().optional(), // Optional as it depends on mode
  seaLineCompany: z.string().optional(),
  containerType: z.enum(CONTAINER_TYPES_CONST as [string, ...string[]]),
  cargoWeight: z.coerce.number().positive("Cargo weight must be positive."),
  destinationCity: z.string().min(1, "Destination city is required."),
  station: z.string().optional(),
});
export type PowerLogFormValues = z.infer<typeof powerLogFormSchema>;


// Old calculationFormSchema, likely deprecated after PowerLogForm changes
export const freightModeSchema = z.object({
  containerType: z.enum(CONTAINER_TYPES_CONST as [string, ...string[]]),
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
