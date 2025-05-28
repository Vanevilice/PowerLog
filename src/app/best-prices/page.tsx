
"use client";

import * as React from 'react';
import Link from 'next/link';
import { usePricingData } from '@/contexts/PricingDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Anchor, Ship, Train, RussianRuble, DollarSign, Info } from 'lucide-react';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers'; // Assuming this helper exists

export default function BestPricesPage() {
  const { bestPriceResults, cachedFormValues } = usePricingData();

  if (!bestPriceResults || bestPriceResults.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-4">No Best Price Results Found</h1>
        <p className="text-muted-foreground mb-6">
          Either no calculation was performed, or no routes matched your criteria.
        </p>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Best Price Options</h1>
          <p className="text-muted-foreground">
            Displaying top routes based on your selection:
          </p>
          {cachedFormValues && (
            <div className="text-sm mt-2 space-y-1">
              <p><strong>Origin:</strong> {cachedFormValues.originPort || 'N/A'}</p>
              <p><strong>Container:</strong> {cachedFormValues.containerType || 'N/A'}</p>
              <p><strong>Shipment Type:</strong> {cachedFormValues.shipmentType || 'N/A'}</p>
              {cachedFormValues.russianDestinationCity && (
                <p><strong>Final Destination City:</strong> {cachedFormValues.russianDestinationCity}</p>
              )}
            </div>
          )}
        </div>
        <Button asChild variant="outline" className="mt-4 sm:mt-0">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestPriceResults.map((route) => (
          <Card key={route.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-xl flex items-center justify-between">
                <span>Route to {route.seaDestinationPort}</span>
                <span className="text-lg font-semibold text-accent">
                  {formatDisplayCost(route.totalComparisonCostRUB, 'RUB')}
                </span>
              </CardTitle>
              <CardDescription>
                via {route.seaLineCompany || 'Any Sea Line'}
                {route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && route.russianDestinationCity !== route.seaDestinationPort && (
                    <span> to {route.russianDestinationCity}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 text-sm">
              <div className="space-y-1">
                <p className="flex justify-between items-center">
                  <span className="flex items-center text-muted-foreground"><Ship className="mr-2 h-4 w-4" /> Sea Cost:</span>
                  <span className="font-medium">{formatDisplayCost(route.seaCostUSD, 'USD')}</span>
                </p>
                {route.seaComment && <p className="text-xs text-muted-foreground/80 pl-1">Sea Comment: {route.seaComment}</p>}
                {route.socComment && <p className="text-xs text-muted-foreground/80 pl-1">SOC Comment: {route.socComment}</p>}
              </div>

              {(route.railCost20DC_24t_RUB !== null || route.railCost20DC_28t_RUB !== null || route.railCost40HC_RUB !== null) && (
                <div className="pt-2 mt-2 border-t border-border/50">
                  <p className="font-medium text-primary mb-1 flex items-center"><Train className="mr-2 h-4 w-4" /> Rail Details (if applicable):</p>
                  <div className="space-y-1 pl-2 text-xs">
                    {route.railDepartureStation && <p><strong>Dep. Station:</strong> {route.railDepartureStation}</p>}
                    {route.railArrivalStation && <p><strong>Arr. Station:</strong> {route.railArrivalStation}</p>}
                    {route.containerType === "20DC" && (
                      <>
                        {route.railCost20DC_24t_RUB !== null && <p>20DC (&lt;24t): {formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')}</p>}
                        {route.railCost20DC_28t_RUB !== null && <p>20DC (&lt;28t): {formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')}</p>}
                        {route.railGuardCost20DC_RUB !== null && <p>Guard (20DC): {formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB')}</p>}
                      </>
                    )}
                    {route.containerType === "40HC" && (
                      <>
                        {route.railCost40HC_RUB !== null && <p>40HC: {formatDisplayCost(route.railCost40HC_RUB, 'RUB')}</p>}
                        {route.railGuardCost40HC_RUB !== null && <p>Guard (40HC): {formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}</p>}
                      </>
                    )}
                  </div>
                </div>
              )}

              {route.dropOffCostUSD !== null && (
                <div className="pt-2 mt-2 border-t border-border/50">
                   <p className="font-medium text-primary mb-1 flex items-center"><Anchor className="mr-2 h-4 w-4" /> Drop-off:</p>
                  <p className="flex justify-between items-center pl-2">
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-medium">{formatDisplayCost(route.dropOffCostUSD, 'USD')}</span>
                  </p>
                  {route.dropOffComment && <p className="text-xs text-muted-foreground/80 pl-3">Comment: {route.dropOffComment}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
