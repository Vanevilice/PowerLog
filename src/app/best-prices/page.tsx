
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePricingData, type BestPriceRoute } from '@/contexts/PricingDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Ship, Train, DollarSign, ListOrdered, Copy, Edit3, Info, Anchor, RussianRuble } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';

export default function BestPricesPage() {
  const router = useRouter();
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { toast } = useToast();

  const handleCopyRate = async (route: BestPriceRoute, index: number) => {
    let textToCopy = "";

    textToCopy += `FOB ${route.containerType || 'N/A'}`;
    textToCopy += ` ${route.originPort || 'N/A'}`;
    textToCopy += ` - ${route.seaDestinationPort || 'N/A'}`;
    if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
      textToCopy += ` - ${route.russianDestinationCity}`;
       if (route.railArrivalStation) {
        textToCopy += ` (прибытие: ${route.railArrivalStation})`;
      }
    }
    textToCopy += `\n`;

    const seaCostBaseForSum = route.seaCostUSD ?? 0;
    let dropOffCostForSum = 0;
    if (route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line')) {
        dropOffCostForSum = route.dropOffCostUSD ?? 0;
    }
    const totalFreightCost = seaCostBaseForSum + dropOffCostForSum;

    textToCopy += `Фрахт: ${formatDisplayCost(totalFreightCost > 0 ? totalFreightCost : null, 'USD')}\n`;

    let jdLine = "";
    if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
        jdLine = "Ж/Д Составляющая: ";
        if (route.containerType === "20DC") {
            let costsParts = [];
            if (route.railCost20DC_24t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')} (<24t)`);
            if (route.railCost20DC_28t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')} (<28t)`);
            jdLine += costsParts.join(' / ') || "N/A";

            const guardCostFormatted = formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB');
            if (guardCostFormatted && guardCostFormatted !== 'N/A') {
                jdLine += ` + Охрана ${guardCostFormatted}`;
                if (route.railGuardCost20DC_RUB && route.railGuardCost20DC_RUB > 0) {
                     jdLine += ` (Если код подохранный)`;
                }
            } else if (costsParts.length > 0) {
                jdLine += ` + Охрана N/A`;
            }
        } else if (route.containerType === "40HC") {
            jdLine += formatDisplayCost(route.railCost40HC_RUB, 'RUB') || "N/A";
            const guardCostFormatted = formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB');
            if (guardCostFormatted && guardCostFormatted !== 'N/A') {
                jdLine += ` + Охрана ${guardCostFormatted}`;
                if (route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) {
                    jdLine += ` (Если код подохранный)`;
                }
            } else if (route.railCost40HC_RUB !== null) {
                jdLine += ` + Охрана N/A`;
            }
        }
    }

    if (jdLine && jdLine !== "Ж/Д Составляющая: ") {
        textToCopy += jdLine + `\n`;
    }

    textToCopy += `Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n`;

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: "Success!", description: `Rate for Option ${index + 1} copied.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard." });
    }
  };

  const handleCreateInstructions = (route: BestPriceRoute) => {
    const queryParams = new URLSearchParams();
    if (route.originPort) queryParams.set('originPort', route.originPort);
    if (route.seaDestinationPort) queryParams.set('destinationPort', route.seaDestinationPort);
    if (route.seaLineCompany) queryParams.set('seaLineCompany', route.seaLineCompany);
    if (route.containerType) queryParams.set('containerType', route.containerType);
    if (route.seaComment) queryParams.set('seaComment', route.seaComment);

    if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
        queryParams.set('russianDestinationCity', route.russianDestinationCity);
        if (route.railArrivalStation) queryParams.set('railArrivalStation', route.railArrivalStation);
        if (route.railDepartureStation) queryParams.set('railDepartureStation', route.railDepartureStation);
    }

    if (route.seaCostUSD !== null && route.seaCostUSD !== undefined) {
      queryParams.set('seaCostBase', route.seaCostUSD.toString());
      queryParams.set('seaCostFinal', route.seaCostUSD.toString()); 
    }

    queryParams.set('seaMarginApplied', '0'); // For best price, margins are not applied from form
    queryParams.set('railMarginApplied', '0'); // For best price, margins are not applied from form

    if (route.containerType === "20DC") {
        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostBase24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostBase28t', route.railCost20DC_28t_RUB.toString());
        if (route.railGuardCost20DC_RUB !== null) queryParams.set('railGuardCost20DC', route.railGuardCost20DC_RUB.toString());

        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostFinal24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostFinal28t', route.railCost20DC_28t_RUB.toString());
    } else if (route.containerType === "40HC") {
        if (route.railCost40HC_RUB !== null) queryParams.set('railCostBase40HC', route.railCost40HC_RUB.toString());
        if (route.railGuardCost40HC_RUB !== null) queryParams.set('railGuardCost40HC', route.railGuardCost40HC_RUB.toString());

        if (route.railCost40HC_RUB !== null) queryParams.set('railCostFinal40HC', route.railCost40HC_RUB.toString());
    }

    if (route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined && route.shipmentType === "COC") {
        if (!route.seaLineCompany?.toLowerCase().includes('panda express line')) {
             queryParams.set('dropOffCost', route.dropOffCostUSD.toString());
        }
    }
    if (route.dropOffComment && route.shipmentType === "COC") {
      queryParams.set('dropOffComment', route.dropOffComment);
    }
    if (route.shipmentType) queryParams.set('shipmentType', route.shipmentType);
    if (route.socComment) queryParams.set('socComment', route.socComment);

    router.push(`/instructions?${queryParams.toString()}`);
  };

  if (!bestPriceResults || bestPriceResults.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="w-full max-w-lg mx-auto shadow-lg rounded-xl bg-card border border-border">
          <CardHeader>
            <div className="flex justify-center items-center mb-3">
              <Info className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold text-primary">No Best Price Results Found</CardTitle>
            <CardDescription className="text-muted-foreground">
              Either no calculation was performed, or no routes matched your criteria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <ListOrdered className="mr-3 h-8 w-8 text-accent" />
            Best {bestPriceResults.length} Shipping Options
          </h1>
          {cachedFormValues && (
             <p className="text-muted-foreground mt-1">
              Based on: Origin <strong>{cachedFormValues.originPort || 'N/A'}</strong>,
              Container <strong>{cachedFormValues.containerType || 'N/A'}</strong>,
              Shipment <strong>{cachedFormValues.shipmentType || 'N/A'}</strong>
              {cachedFormValues.russianDestinationCity && (
                <>, Final Dest. City <strong>{cachedFormValues.russianDestinationCity}</strong></>
              )}
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="mt-4 sm:mt-0">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestPriceResults.map((route, index) => (
          <Card key={route.id} className="shadow-xl rounded-xl overflow-hidden flex flex-col bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="pb-4 bg-muted/30 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold text-primary">
                  Option {index + 1}
                </CardTitle>
                <div className="text-lg font-bold text-accent flex items-center">
                  <RussianRuble className="inline h-5 w-5 mr-1"/>
                  {formatDisplayCost(route.totalComparisonCostRUB, 'RUB').replace(' RUB','')}
                </div>
              </div>
              <CardDescription className="text-xs mt-1">
                {route.originPort} <Ship className="inline h-3 w-3 mx-0.5 text-muted-foreground" /> {route.seaDestinationPort}
                {route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0])) && <> <Train className="inline h-3 w-3 mx-0.5 text-muted-foreground" /> {route.russianDestinationCity} {route.railArrivalStation ? `(${route.railArrivalStation})` : ''} </>}
                 {route.seaLineCompany && <span className="block mt-1">via <span className="font-medium">{route.seaLineCompany}</span></span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm flex-grow flex flex-col justify-between">
              <div>
                <div className="space-y-1">
                   {route.seaCostUSD !== null && (
                      <p className="flex justify-between items-center">
                        <span className="flex items-center text-muted-foreground"><Ship className="mr-1.5 h-4 w-4" /> Sea Cost:</span>
                        <span className="font-medium">{formatDisplayCost(route.seaCostUSD, 'USD')}</span>
                      </p>
                   )}
                  {route.seaComment && <p className="text-xs text-muted-foreground/80 pl-1">{route.seaComment}</p>}
                  {route.socComment && <p className="text-xs text-muted-foreground/80 pl-1">SOC: {route.socComment}</p>}
                </div>

                {(route.railCost20DC_24t_RUB !== null || route.railCost20DC_28t_RUB !== null || route.railCost40HC_RUB !== null) && (
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <p className="font-medium text-primary mb-1 flex items-center"><Train className="mr-1.5 h-4 w-4" /> Rail Details:</p>
                    <div className="space-y-1 pl-2 text-xs">
                      {route.railDepartureStation && <p><strong>Dep. Station:</strong> {route.railDepartureStation}</p>}
                      {route.railArrivalStation && <p><strong>Arr. Station:</strong> {route.railArrivalStation}</p>}
                      {route.containerType === "20DC" && (
                        <>
                          {route.railCost20DC_24t_RUB !== null && <p className="flex justify-between"><span>20DC (&lt;24t):</span> <span className="font-medium">{formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')}</span></p>}
                          {route.railCost20DC_28t_RUB !== null && <p className="flex justify-between"><span>20DC (&lt;28t):</span> <span className="font-medium">{formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')}</span></p>}
                          {route.railGuardCost20DC_RUB !== null && <p className="flex justify-between"><span>Guard (20DC):</span> <span className="font-medium">{formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB')}</span></p>}
                        </>
                      )}
                      {route.containerType === "40HC" && (
                        <>
                          {route.railCost40HC_RUB !== null && <p className="flex justify-between"><span>40HC:</span> <span className="font-medium">{formatDisplayCost(route.railCost40HC_RUB, 'RUB')}</span></p>}
                          {route.railGuardCost40HC_RUB !== null && <p className="flex justify-between"><span>Guard (40HC):</span> <span className="font-medium">{formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}</span></p>}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {route.dropOffCostUSD !== null && route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line') && (
                  <div className="pt-2 mt-2 border-t border-border/50">
                     <p className="font-medium text-primary mb-1 flex items-center"><Anchor className="mr-1.5 h-4 w-4" /> Drop-off:</p>
                    <p className="flex justify-between items-center pl-2">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">{formatDisplayCost(route.dropOffCostUSD, 'USD')}</span>
                    </p>
                    {route.dropOffComment && <p className="text-xs text-muted-foreground/80 pl-3">{route.dropOffComment}</p>}
                  </div>
                )}
              </div>
              <div className="mt-auto pt-3 border-t flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleCopyRate(route, index)}
                  variant="outline"
                  className="w-full flex-1 border-primary text-primary hover:bg-primary/10"
                  size="sm"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy Rate
                </Button>
                <Button
                  onClick={() => handleCreateInstructions(route)}
                  variant="default"
                  className="w-full flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                  size="sm"
                >
                  <Edit3 className="mr-2 h-4 w-4" /> Instructions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="text-center mt-6">
        <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
            </Link>
        </Button>
      </div>
    </div>
  );
}

