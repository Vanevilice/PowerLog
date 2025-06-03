
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePricingData, type BestPriceRoute } from '@/contexts/PricingDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Ship, Train, Copy, Edit3, Info, ListOrdered, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';

export default function BestPricesPage() {
  const router = useRouter();
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { toast } = useToast();

  const handleCopyRate = async (route: BestPriceRoute, index: number) => {
    let textToCopy = "";

    if (route.mode === 'sea_plus_rail') {
      textToCopy += "FOB " + (route.containerType || 'N/A');
      textToCopy += " " + (route.originPort || 'N/A');
      textToCopy += " - " + (route.seaDestinationPort || 'N/A');
      if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
        textToCopy += " - " + route.russianDestinationCity;
         if (route.railArrivalStation) {
          textToCopy += " (прибытие: " + route.railArrivalStation + ")";
        }
      }
      textToCopy += "\n";

      const seaCostBaseForSum = route.seaCostUSD ?? 0;
      let dropOffCostForSum = 0;
      if (route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line')) {
          dropOffCostForSum = route.dropOffCostUSD ?? 0;
      }
      
      let totalFreightCostUSD = seaCostBaseForSum;
      if (route.shipmentType === "COC") {
        totalFreightCostUSD += dropOffCostForSum;
      } else if (route.shipmentType === "SOC" && route.socDropOffCostUSD !== null) {
        totalFreightCostUSD += route.socDropOffCostUSD;
      }

      textToCopy += "Фрахт: " + formatDisplayCost(totalFreightCostUSD > 0 ? totalFreightCostUSD : null, 'USD') + "\n";

      let jdLine = "";
      if (route.shipmentType === "COC" && route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
          jdLine = "Ж/Д Составляющая: ";
          if (route.containerType === "20DC") {
              let costsParts = [];
              if (route.railCost20DC_24t_RUB !== null) costsParts.push(formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB') + " (<24t)");
              if (route.railCost20DC_28t_RUB !== null) costsParts.push(formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB') + " (<28t)");
              
              if (costsParts.length > 0) {
                jdLine += costsParts.join(' / ');
              } else {
                jdLine += "N/A";
              }

              const guardCostFormatted = formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB');
              if (route.railGuardCost20DC_RUB !== null) {
                  jdLine += " + Охрана " + guardCostFormatted;
                  if (route.railGuardCost20DC_RUB > 0) {
                       jdLine += " (Если код подохранный)";
                  }
              } else if (costsParts.length > 0 || (jdLine !== "N/A" && jdLine !== "Ж/Д Составляющая: N/A")) { // Guard is null but base exists
                  jdLine += " + Охрана N/A";
              }
          } else if (route.containerType === "40HC") {
              if (route.railCost40HC_RUB !== null) {
                jdLine += formatDisplayCost(route.railCost40HC_RUB, 'RUB');
                const guardCostFormatted = formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB');
                if (route.railGuardCost40HC_RUB !== null) {
                    jdLine += " + Охрана " + guardCostFormatted;
                    if (route.railGuardCost40HC_RUB > 0) {
                        jdLine += " (Если код подохранный)";
                    }
                } else { // Guard is null but base exists
                    jdLine += " + Охрана N/A";
                }
              } else if (route.railGuardCost40HC_RUB !== null) { // Base is null but guard exists
                jdLine += `Охрана ${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                if (route.railGuardCost40HC_RUB > 0) jdLine += " (Если код подохранный)";
              } else {
                jdLine += "N/A";
              }
          }
      }
      if (jdLine && jdLine !== "Ж/Д Составляющая: " && jdLine !== "Ж/Д Составляющая: N/A") {
          textToCopy += jdLine + "\n";
      }
      textToCopy += "Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n";

      if (route.shipmentType === "COC") {
        if (route.seaComment) textToCopy += `Sea Route Comment: ${route.seaComment}\n`;
        if (route.dropOffComment) textToCopy += `Drop Off Comment: ${route.dropOffComment}\n`;
      }


    } else if (route.mode === 'direct_rail') {
      textToCopy += "Direct Rail Option:\n";
      textToCopy += `Agent: ${route.directRailAgentName || 'N/A'}\n`;
      textToCopy += `Departure: ${route.originPort || 'N/A'}\n`; 
      textToCopy += `Destination: ${route.seaDestinationPort || 'N/A'}\n`; 
      textToCopy += `Border: ${route.directRailBorder || 'N/A'}\n`;
      textToCopy += `Incoterms: ${route.directRailIncoterms || 'N/A'}\n`;
      textToCopy += `Cost: ${formatDisplayCost(route.directRailPriceRUB, 'RUB')}\n`;
      textToCopy += `ETD: ${route.directRailETD || 'N/A'}\n`;
      if (route.directRailExcelCommentary) {
        textToCopy += `Commentary: ${route.directRailExcelCommentary}\n`;
      }
    }

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: "Success!", description: "Rate for Option " + (index + 1) + " copied." });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard." });
    }
  };

  const handleCreateInstructions = (route: BestPriceRoute) => {
    if (route.mode === 'direct_rail') {
        toast({ title: "Not Available", description: "Instructions creation is not available for Direct Rail routes yet." });
        return;
    }
    const queryParams = new URLSearchParams();
    if (route.originPort) queryParams.set('originPort', route.originPort);
    if (route.seaDestinationPort) queryParams.set('destinationPort', route.seaDestinationPort);
    if (route.seaLineCompany) queryParams.set('seaLineCompany', route.seaLineCompany);
    if (route.containerType && route.containerType !== 'N/A') queryParams.set('containerType', route.containerType);
    
    if (route.shipmentType === "COC" && route.seaComment) queryParams.set('seaComment', route.seaComment);
    if (route.shipmentType === "SOC" && route.socComment) queryParams.set('socComment', route.socComment);


    if (route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0]))) {
        queryParams.set('russianDestinationCity', route.russianDestinationCity);
        if (route.railArrivalStation) queryParams.set('railArrivalStation', route.railArrivalStation);
        if (route.railDepartureStation) queryParams.set('railDepartureStation', route.railDepartureStation);
    }

    if (route.seaCostUSD !== null && route.seaCostUSD !== undefined) {
      queryParams.set('seaCostBase', route.seaCostUSD.toString());
      queryParams.set('seaCostFinal', route.seaCostUSD.toString());
    }

    queryParams.set('seaMarginApplied', '0');
    queryParams.set('railMarginApplied', '0');

    if (route.containerType === "20DC" && route.shipmentType === "COC") {
        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostBase24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostBase28t', route.railCost20DC_28t_RUB.toString());
        if (route.railGuardCost20DC_RUB !== null) queryParams.set('railGuardCost20DC', route.railGuardCost20DC_RUB.toString());

        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostFinal24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostFinal28t', route.railCost20DC_28t_RUB.toString());
    } else if (route.containerType === "40HC" && route.shipmentType === "COC") {
        if (route.railCost40HC_RUB !== null) queryParams.set('railCostBase40HC', route.railCost40HC_RUB.toString());
        if (route.railGuardCost40HC_RUB !== null) queryParams.set('railGuardCost40HC', route.railGuardCost40HC_RUB.toString());

        if (route.railCost40HC_RUB !== null) queryParams.set('railCostFinal40HC', route.railCost40HC_RUB.toString());
    }

    if (route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line')) {
        if (route.dropOffDisplayValue) {
             queryParams.set('dropOffCost', route.dropOffDisplayValue);
        } else if (route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined) {
            queryParams.set('dropOffCost', route.dropOffCostUSD.toString());
        }
        if (route.dropOffComment) queryParams.set('dropOffComment', route.dropOffComment);
    }
    
    if (route.shipmentType === "SOC") {
        if (route.socDropOffCostUSD !== null && route.socDropOffCostUSD !== undefined) queryParams.set('socDropOffCost', route.socDropOffCostUSD.toString());
        if (route.socDropOffComment) queryParams.set('socDropOffComment', route.socDropOffComment);
    }


    if (route.shipmentType && route.shipmentType !== 'N/A') queryParams.set('shipmentType', route.shipmentType);


    router.push("/instructions?" + queryParams.toString());
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

  const isDirectRailMode = bestPriceResults.some(r => r.mode === 'direct_rail');
  const formModeText = isDirectRailMode ? "Direct Rail" : "Sea+Rail";

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <ListOrdered className="mr-3 h-8 w-8 text-accent" />
            Best {bestPriceResults.length} {formModeText} Options
          </h1>
          {cachedFormValues && (
             <p className="text-muted-foreground mt-1">
              Based on: {isDirectRailMode ? (
                <>
                 Departure <strong>{cachedFormValues.directRailCityOfDeparture || 'N/A'}</strong>,
                 Destination <strong>{cachedFormValues.directRailDestinationCityDR || 'N/A'}</strong>,
                 Incoterms <strong>{cachedFormValues.directRailIncoterms || 'N/A'}</strong>
                </>
              ) : (
                <>
                  Origin <strong>{cachedFormValues.originPort || 'N/A'}</strong>,
                  Container <strong>{cachedFormValues.containerType || 'N/A'}</strong>,
                  Shipment <strong>{cachedFormValues.shipmentType || 'N/A'}</strong>
                  {cachedFormValues.russianDestinationCity && (
                    <>, Final Dest. City <strong>{cachedFormValues.russianDestinationCity}</strong></>
                  )}
                </>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bestPriceResults.map((route, index) => {
            const dropOffToDisplay = route.dropOffDisplayValue || (route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined ? formatDisplayCost(route.dropOffCostUSD, 'USD') : null);
            const agentOrSeaLineLabel = route.mode === 'direct_rail' ? 'Agent:' : 'Sea Line:';
            const agentOrSeaLineValue = route.mode === 'direct_rail' ? route.directRailAgentName : route.seaLineCompany;

            return (
          <Card key={route.id} className="shadow-xl rounded-xl overflow-hidden flex flex-col bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="pb-4 bg-muted/30 border-b">
              <CardTitle className="text-xl font-semibold text-primary">
                Option {index + 1}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {route.mode === 'sea_plus_rail' ? (
                    <>
                    Route: {route.originPort} <Ship className="inline h-3 w-3 mx-0.5 text-muted-foreground" /> {route.seaDestinationPort}
                    {route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0])) && <> <Train className="inline h-3 w-3 mx-0.5 text-muted-foreground" /> {route.russianDestinationCity} {route.railArrivalStation ? ("(" + route.railArrivalStation + ")") : ''} </>}
                    </>
                ) : ( // Direct Rail
                    <>
                    Route: {route.originPort} <Train className="inline h-3 w-3 mx-0.5 text-muted-foreground" /> {route.seaDestinationPort}
                    </>
                )}
                 {agentOrSeaLineValue && <span className="block mt-1">{agentOrSeaLineLabel} <span className="font-medium">{agentOrSeaLineValue}</span></span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm flex-grow flex flex-col justify-between">
              <div>
                {/* Route Details Section */}
                <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 mb-3">
                  <p className="font-medium text-muted-foreground">{route.mode === 'direct_rail' ? 'Departure City:' : 'Origin Port:'}</p><p className="text-right">{route.originPort || 'N/A'}</p>
                  <p className="font-medium text-muted-foreground">{route.mode === 'direct_rail' ? 'Destination City:' : 'Sea Destination:'}</p><p className="text-right">{route.seaDestinationPort || 'N/A'}</p>

                  {agentOrSeaLineValue && (
                    <>
                      <p className="font-medium text-muted-foreground">{agentOrSeaLineLabel}</p><p className="text-right">{agentOrSeaLineValue}</p>
                    </>
                  )}
                  <p className="font-medium text-muted-foreground">Container Type:</p><p className="text-right">{route.containerType && route.containerType !== 'N/A' ? route.containerType : '40HC'}</p>
                  <p className="font-medium text-muted-foreground">Shipment Type:</p><p className="text-right">{route.shipmentType || 'N/A'}</p>


                  {route.mode === 'direct_rail' && (
                    <>
                      {route.directRailBorder && <><p className="font-medium text-muted-foreground">Border:</p><p className="text-right">{route.directRailBorder}</p></>}
                      {route.directRailIncoterms && <><p className="font-medium text-muted-foreground">Incoterms:</p><p className="text-right">{route.directRailIncoterms}</p></>}
                    </>
                  )}

                  {route.mode === 'sea_plus_rail' && route.shipmentType === "COC" && route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0])) && (
                    <>
                      <p className="font-medium text-muted-foreground">Destination City (Rail):</p><p className="text-right">{route.russianDestinationCity}</p>
                    </>
                  )}
                   {route.mode === 'sea_plus_rail' && route.shipmentType === "SOC" && route.russianDestinationCity && (
                    <>
                      <p className="font-medium text-muted-foreground">Final Destination City:</p><p className="text-right">{route.russianDestinationCity}</p>
                    </>
                  )}
                  {route.mode === 'sea_plus_rail' && route.shipmentType === "COC" && route.railDepartureStation && (
                    <>
                      <p className="font-medium text-muted-foreground">Rail Dep. Station:</p><p className="text-right">{route.railDepartureStation}</p>
                    </>
                  )}
                  {route.mode === 'sea_plus_rail' && route.shipmentType === "COC" && route.railArrivalStation && (
                     <>
                      <p className="font-medium text-muted-foreground">Rail Arr. Station:</p><p className="text-right">{route.railArrivalStation}</p>
                    </>
                  )}
                </div>

                {/* Cost Breakdown Section */}
                <div className="pt-3 border-t border-border/50">
                  <h4 className="font-semibold text-md mb-2 text-primary">
                    Cost Breakdown
                  </h4>
                  <div className="space-y-1">
                    {route.mode === 'sea_plus_rail' ? (
                        <>
                            {route.seaCostUSD !== null && (
                            <p className="flex justify-between">
                                <span>Sea Freight Cost:</span>
                                <span className="font-semibold text-primary">{formatDisplayCost(route.seaCostUSD, 'USD')}</span>
                            </p>
                            )}
                            {route.seaComment && route.shipmentType === "COC" && (
                            <p className="flex justify-between items-start">
                                <span>Sea Route Comment:</span>
                                <span className="text-xs text-destructive text-right ml-2">{route.seaComment}</span>
                            </p>
                            )}
                            {route.socComment && route.shipmentType === "SOC" && (
                                <p className="flex justify-between items-start">
                                    <span>SOC Comment:</span>
                                    <span className="text-xs text-destructive text-right ml-2">{route.socComment}</span>
                                </p>
                            )}

                            {/* Combined Railway Leg Cost Display */}
                            {route.shipmentType === "COC" &&
                              route.seaDestinationPort &&
                              VLADIVOSTOK_VARIANTS.some(v => route.seaDestinationPort!.startsWith(v.split(" ")[0])) &&
                              route.russianDestinationCity &&
                              !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity!.startsWith(v.split(" ")[0])) &&
                              (
                                (route.containerType === "20DC" && (route.railCost20DC_24t_RUB !== null || route.railCost20DC_28t_RUB !== null || route.railGuardCost20DC_RUB !== null)) ||
                                (route.containerType === "40HC" && (route.railCost40HC_RUB !== null || route.railGuardCost40HC_RUB !== null))
                              ) && (
                              <p className="flex justify-between">
                                <span>Ж/Д Составляющая:</span>
                                <span className="font-semibold text-primary text-right">
                                  {(() => {
                                    let railLegStr = "";
                                    let guardNeededComment = false;

                                    if (route.containerType === "20DC") {
                                      const costsParts = [];
                                      if (route.railCost20DC_24t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')} (<24t)`);
                                      if (route.railCost20DC_28t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')} (<28t)`);
                                      
                                      if (costsParts.length > 0) {
                                        railLegStr = costsParts.join(' / ');
                                      } else {
                                        // railLegStr remains empty if no base costs
                                      }

                                      if (route.railGuardCost20DC_RUB !== null) {
                                        const guardStr = `Охрана ${formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB')}`;
                                        if (railLegStr) { // If base cost exists
                                            railLegStr += ` + ${guardStr}`;
                                        } else { // Only guard cost exists
                                            railLegStr = guardStr;
                                        }
                                        if (route.railGuardCost20DC_RUB > 0) guardNeededComment = true;
                                      } else if (railLegStr) { // Guard cost is null, but base cost exists
                                          railLegStr += ` + Охрана N/A`;
                                      }
                                      if (!railLegStr) railLegStr = "N/A"; // If still empty, means no base and no guard

                                    } else if (route.containerType === "40HC") {
                                      if (route.railCost40HC_RUB !== null) {
                                        railLegStr = formatDisplayCost(route.railCost40HC_RUB, 'RUB');
                                        if (route.railGuardCost40HC_RUB !== null) {
                                          railLegStr += ` + Охрана ${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                          if (route.railGuardCost40HC_RUB > 0) guardNeededComment = true;
                                        } else {
                                          railLegStr += ` + Охрана N/A`;
                                        }
                                      } else if (route.railGuardCost40HC_RUB !== null) { // Only guard cost available
                                        railLegStr = `Охрана ${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                        if (route.railGuardCost40HC_RUB > 0) guardNeededComment = true;
                                      } else {
                                        railLegStr = "N/A";
                                      }
                                    }
                                    if (guardNeededComment) {
                                      railLegStr += " (Если код подохранный)";
                                    }
                                    return railLegStr;
                                  })()}
                                </span>
                              </p>
                            )}
                            {/* End Combined Railway Leg Cost Display */}


                            {dropOffToDisplay && route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line') && (
                                <p className="flex justify-between">
                                    <span>Drop Off Cost:</span>
                                    <span className="font-semibold text-primary">{dropOffToDisplay}</span>
                                </p>
                            )}
                            {route.dropOffComment && route.shipmentType === "COC" && (
                            <p className="flex justify-between items-start">
                                <span>Drop Off Comment:</span>
                                <span className="text-xs text-destructive text-right ml-2">{route.dropOffComment}</span>
                            </p>
                            )}
                            {route.shipmentType === "SOC" && route.socDropOffCostUSD !== null && (
                              <p className="flex justify-between">
                                <span>SOC Drop Off Cost ({route.containerType}):</span>
                                <span className="font-semibold text-primary">
                                  {formatDisplayCost(route.socDropOffCostUSD, 'USD')}
                                </span>
                              </p>
                            )}
                            {route.shipmentType === "SOC" && route.socDropOffComment && (
                              <p className="flex justify-between items-start">
                                <span>SOC Drop Off Comment:</span>
                                <span className="text-xs text-muted-foreground text-right ml-2">{route.socDropOffComment}</span>
                              </p>
                            )}
                        </>
                    ) : ( 
                        <>
                            {route.directRailPriceRUB !== null && (
                            <p className="flex justify-between">
                                <span>Direct Rail Cost:</span>
                                <span className="font-semibold text-primary">{formatDisplayCost(route.directRailPriceRUB, 'RUB')}</span>
                            </p>
                            )}
                             {route.directRailETD && (
                            <p className="flex justify-between">
                                <span>ETD:</span>
                                <span className="text-primary">{route.directRailETD}</span>
                            </p>
                            )}
                            {route.directRailExcelCommentary && (
                            <p className="flex justify-between items-start">
                                <span>Excel Commentary:</span>
                                <span className="text-xs text-destructive text-right ml-2">{route.directRailExcelCommentary}</span>
                            </p>
                            )}
                        </>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t flex flex-col sm:flex-row gap-2">
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
                  className="w-full flex-1"
                  size="sm"
                  disabled={route.mode === 'direct_rail'}
                >
                  <Edit3 className="mr-2 h-4 w-4" /> Create Instructions
                </Button>
              </div>
            </CardContent>
          </Card>
        )})}
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

    