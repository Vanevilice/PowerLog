
"use client";

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  RouteFormValues,
  CombinedAiOutput,
  CalculationMode,
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';

interface ShippingInfoDisplayProps {
  shippingInfo: CombinedAiOutput | null; // Allow null
  calculationMode: CalculationMode;
  getFormValues: UseFormReturn<RouteFormValues>['getValues'];
}

export function ShippingInfoDisplay({ shippingInfo, calculationMode, getFormValues }: ShippingInfoDisplayProps) {
  const currentFormValues = getFormValues();

  if (!shippingInfo) return null;

  // Determine which drop-off value to display
  const dropOffToDisplay = shippingInfo.dropOffDisplayValue || (shippingInfo.dropOffCost !== null && shippingInfo.dropOffCost !== undefined ? formatDisplayCost(shippingInfo.dropOffCost, 'USD') : null);


  return (
    <div className="mt-6 p-6 border rounded-lg bg-background shadow-md animate-in fade-in-50 duration-500">
      <h3 className="text-xl font-semibold mb-3 text-primary border-b pb-2">Shipping Information</h3>
      <div className="space-y-2 text-sm">
        {calculationMode === "sea_plus_rail" && (
          <>
            <p className="flex justify-between"><strong>Shipment Type:</strong><span className="text-right text-primary">{currentFormValues.shipmentType}</span></p>
            <p className="flex justify-between"><strong>Origin:</strong><span className="text-right text-primary">{currentFormValues.originPort}</span></p>
            <p className="flex justify-between"><strong>Destination (Sea):</strong><span className="text-right text-primary">{currentFormValues.destinationPort}</span></p>
            {currentFormValues.seaLineCompany && currentFormValues.seaLineCompany !== NONE_SEALINE_VALUE && (
              <p className="flex justify-between"><strong>Sea Line:</strong><span className="text-right text-primary">{currentFormValues.seaLineCompany}</span></p>
            )}
            {currentFormValues.containerType && (
              <p className="flex justify-between"><strong>Container:</strong><span className="text-right text-primary">{currentFormValues.containerType}</span></p>
            )}
            {'seaComment' in shippingInfo && shippingInfo.seaComment && (
              <p className="flex justify-between items-start">
                <strong>Sea Route Comment:</strong>
                <span className={`text-xs text-right ml-2 ${currentFormValues.shipmentType === "COC" ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {shippingInfo.seaComment}
                </span>
              </p>
            )}
            {'seaCost' in shippingInfo && shippingInfo.seaCost !== null && shippingInfo.seaCost !== undefined ? (
              <p className="flex justify-between">
                <strong>Sea Freight Cost:</strong>
                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.seaCost, 'USD')}</span>
              </p>
            ) : null}
            {'socComment' in shippingInfo && shippingInfo.socComment && currentFormValues.shipmentType === "SOC" ? (
              <p className="flex justify-between items-start">
                <strong>SOC Comment:</strong>
                <span className="text-xs text-muted-foreground text-right ml-2">{shippingInfo.socComment}</span>
              </p>
            ) : null}
            {currentFormValues.russianDestinationCity && currentFormValues.destinationPort && VLADIVOSTOK_VARIANTS.some(variant => String(currentFormValues.destinationPort).startsWith(variant.split(" ")[0])) && !VLADIVOSTOK_VARIANTS.some(v => v === currentFormValues.russianDestinationCity && String(currentFormValues.destinationPort).startsWith(v.split(" ")[0])) && (
              <p className="flex justify-between"><strong>Destination City:</strong><span className="text-right text-primary">{currentFormValues.russianDestinationCity}</span></p>
            )}
            {('railDepartureStation' in shippingInfo && shippingInfo.railDepartureStation && currentFormValues.russianDestinationCity) && (
              <p className="flex justify-between">
                <strong>Rail Dep. Station:</strong>
                <span className="text-right text-primary">
                  {shippingInfo.railDepartureStation || "N/A"}
                </span>
              </p>
            )}
            {'railArrivalStation' in shippingInfo && shippingInfo.railArrivalStation && currentFormValues.russianDestinationCity && (
              <p className="flex justify-between"><strong>Rail Arr. Station:</strong><span className="text-right text-primary">{shippingInfo.railArrivalStation}</span></p>
            )}
            {currentFormValues.containerType === "20DC" && (
              <>
                {'railCost20DC_24t' in shippingInfo && shippingInfo.railCost20DC_24t !== null && shippingInfo.railCost20DC_24t !== undefined ? (
                  <p className="flex justify-between">
                    <strong>Rail Freight Cost (&lt;24t):</strong>
                    <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost20DC_24t, 'RUB')}</span>
                  </p>
                ) : null}
                {'railCost20DC_28t' in shippingInfo && shippingInfo.railCost20DC_28t !== null && shippingInfo.railCost20DC_28t !== undefined ? (
                  <p className="flex justify-between">
                    <strong>Rail Freight Cost (20DC &lt;28t):</strong>
                    <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost20DC_28t, 'RUB')}</span>
                  </p>
                ) : null}
                {'railGuardCost20DC' in shippingInfo && shippingInfo.railGuardCost20DC !== null && shippingInfo.railGuardCost20DC !== undefined ? (
                  <p className="flex justify-between">
                    <strong>Rail Guard Cost (20DC):</strong>
                    <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railGuardCost20DC, 'RUB')}</span>
                  </p>
                ) : null}
              </>
            )}
            {currentFormValues.containerType === "40HC" && (
              <>
                {'railCost40HC' in shippingInfo && shippingInfo.railCost40HC !== null && shippingInfo.railCost40HC !== undefined ? (
                  <p className="flex justify-between">
                    <strong>Rail Freight Cost (40HC):</strong>
                    <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railCost40HC, 'RUB')}</span>
                  </p>
                ) : null}
                {'railGuardCost40HC' in shippingInfo && shippingInfo.railGuardCost40HC !== null && shippingInfo.railGuardCost40HC !== undefined ? (
                  <p className="flex justify-between">
                    <strong>Rail Guard Cost (40HC):</strong>
                    <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.railGuardCost40HC, 'RUB')}</span>
                  </p>
                ) : null}
              </>
            )}
            {dropOffToDisplay && currentFormValues.shipmentType === "COC" && !currentFormValues.seaLineCompany?.toLowerCase().includes('panda express line') ? (
              <p className="flex justify-between">
                <strong>Drop Off Cost:</strong>
                <span className="font-bold text-lg text-primary">{dropOffToDisplay}</span>
              </p>
            ) : null}
            {'dropOffComment' in shippingInfo && shippingInfo.dropOffComment && currentFormValues.shipmentType === "COC" ? (
              <p className="flex justify-between items-start">
                <strong>Drop Off Comment:</strong>
                <span className="text-xs text-destructive text-right ml-2">{shippingInfo.dropOffComment}</span>
              </p>
            ) : null}
            {'commentary' in shippingInfo && shippingInfo.commentary && (
              <p className="mt-4 pt-2 border-t text-xs text-muted-foreground">
                <strong>AI Commentary:</strong> {shippingInfo.commentary}
              </p>
            )}
          </>
        )}
        {calculationMode === "direct_rail" && 'directRailCost' in shippingInfo && (
          <>
            <p className="flex justify-between"><strong>Agent:</strong><span className="text-right text-primary">{shippingInfo.directRailAgentName || 'N/A'}</span></p>
            <p className="flex justify-between"><strong>City of Departure:</strong><span className="text-right text-primary">{shippingInfo.directRailCityOfDeparture || 'N/A'}</span></p>
            <p className="flex justify-between"><strong>Departure Station:</strong><span className="text-right text-primary">{shippingInfo.directRailDepartureStation || 'N/A'}</span></p>
            <p className="flex justify-between"><strong>Destination City:</strong><span className="text-right text-primary">{shippingInfo.directRailDestinationCity || 'N/A'}</span></p>
            <p className="flex justify-between"><strong>Border:</strong><span className="text-right text-primary">{shippingInfo.directRailBorder || 'N/A'}</span></p>
            <p className="flex justify-between"><strong>Incoterms:</strong><span className="text-right text-primary">{shippingInfo.directRailIncoterms || 'N/A'}</span></p>
            {shippingInfo.directRailCost !== null && shippingInfo.directRailCost !== undefined && (
              <p className="flex justify-between">
                <strong>Railway Cost:</strong>
                <span className="font-bold text-lg text-primary">{formatDisplayCost(shippingInfo.directRailCost, 'RUB')}</span>
              </p>
            )}
            <p className="flex justify-between"><strong>ETD:</strong><span className="text-right text-primary">{shippingInfo.directRailETD || 'N/A'}</span></p>
            {'directRailCommentary' in shippingInfo && shippingInfo.directRailCommentary && (
              <p className="flex justify-between items-start">
                <strong>Excel Commentary:</strong>
                <span className="text-xs text-muted-foreground text-right ml-2">{shippingInfo.directRailCommentary}</span>
              </p>
            )}
            {'commentary' in shippingInfo && shippingInfo.commentary && (
              <p className="mt-4 pt-2 border-t text-xs text-muted-foreground">
                <strong>AI Commentary:</strong> {shippingInfo.commentary}
              </p>
            )}
          </>
        )}
        {/* Fallback for general commentary when specific pricing fields aren't present */}
        {!('seaCost' in shippingInfo) && !('directRailCost' in shippingInfo) && 'commentary' in shippingInfo && shippingInfo.commentary && (
             <p className="mt-4 pt-2 border-t text-xs text-muted-foreground">
                <strong>AI Commentary:</strong> {shippingInfo.commentary}
              </p>
        )}
      </div>
    </div>
  );
}

    