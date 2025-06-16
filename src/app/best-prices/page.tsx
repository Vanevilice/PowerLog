
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
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization

export default function BestPricesPage() {
  const router = useRouter();
  const { bestPriceResults, cachedFormValues } = usePricingData();
  const { toast } = useToast();
  const { translate } = useLocalization(); // Use the hook

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
        totalFreightCostUSD += route.socDropOffCostUSD; // SOC Drop-off cost is USD
      }

      textToCopy += "Фрахт: " + formatDisplayCost(totalFreightCostUSD > 0 ? totalFreightCostUSD : null, 'USD') + "\n";

      let jdLine = "";
      const isFurtherRailForCopy = route.russianDestinationCity && route.russianDestinationCity !== 'N/A' &&
                                  route.seaDestinationPort && VLADIVOSTOK_VARIANTS.some(v => route.seaDestinationPort!.startsWith(v.split(" ")[0])) &&
                                  !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity!.startsWith(v.split(" ")[0]));

      if (isFurtherRailForCopy) {
          jdLine = translate('bestPrices_CostBreakdown_RailComponent') + " ";
          if (route.containerType === "20DC") {
              let costsParts = [];
              if (route.railCost20DC_24t_RUB !== null) costsParts.push(formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB') + " " + translate('bestPrices_CostBreakdown_Rail_lt24t'));
              if (route.railCost20DC_28t_RUB !== null) costsParts.push(formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB') + " " + translate('bestPrices_CostBreakdown_Rail_lt28t'));
              
              if (costsParts.length > 0) {
                jdLine += costsParts.join(' / ');
              } else {
                jdLine += translate('common_NA');
              }

              if (route.shipmentType === "COC") { // Guard cost only for COC
                const guardCostFormatted = formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB');
                if (route.railGuardCost20DC_RUB !== null) {
                    jdLine += " + " + translate('bestPrices_CostBreakdown_Rail_GuardPrefix') + guardCostFormatted;
                    if (route.railGuardCost20DC_RUB > 0) {
                        jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
                    }
                } else if (costsParts.length > 0 || (jdLine !== translate('common_NA') && jdLine !== translate('bestPrices_CostBreakdown_RailComponent') + translate('common_NA'))) { 
                    jdLine += translate('bestPrices_CostBreakdown_Rail_GuardNA');
                }
              }
          } else if (route.containerType === "40HC") {
              if (route.railCost40HC_RUB !== null) {
                jdLine += formatDisplayCost(route.railCost40HC_RUB, 'RUB');
                if (route.shipmentType === "COC") { // Guard cost only for COC
                    const guardCostFormatted = formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB');
                    if (route.railGuardCost40HC_RUB !== null) {
                        jdLine += " + " + translate('bestPrices_CostBreakdown_Rail_GuardPrefix') + guardCostFormatted;
                        if (route.railGuardCost40HC_RUB > 0) {
                            jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
                        }
                    } else { 
                        jdLine += translate('bestPrices_CostBreakdown_Rail_GuardNA');
                    }
                }
              } else if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null) { // Base is null but guard exists for COC
                jdLine += `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                if (route.railGuardCost40HC_RUB > 0) jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
              } else {
                jdLine += translate('common_NA');
              }
          }
      }
      if (jdLine && jdLine !== translate('bestPrices_CostBreakdown_RailComponent') + " " && jdLine !== translate('bestPrices_CostBreakdown_RailComponent') + translate('common_NA')) {
          textToCopy += jdLine + "\n";
      }
      textToCopy += "Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n";

      if (route.shipmentType === "COC") {
        if (route.seaComment) textToCopy += `${translate('bestPrices_CostBreakdown_SeaRouteComment')} ${route.seaComment}\n`;
        if (route.dropOffComment) textToCopy += `${translate('bestPrices_CostBreakdown_DropOffComment')} ${route.dropOffComment}\n`;
      }
      // Removed SOC Comment and SOC Drop-off Comment from copy text

    } else if (route.mode === 'direct_rail') {
      textToCopy += translate('bestPrices_RouteCard_Desc_DirectRail_Route', { originPort: route.originPort || translate('common_NA'), destPort: route.seaDestinationPort || translate('common_NA') }) + "\n";
      textToCopy += `${translate('bestPrices_RouteCard_AgentLabel')} ${route.directRailAgentName || translate('common_NA')}\n`;
      textToCopy += `${translate('bestPrices_RouteDetails_DepCityLabel_DR')} ${route.originPort || translate('common_NA')}\n`; 
      textToCopy += `${translate('bestPrices_RouteDetails_DestCityLabel_DR')} ${route.seaDestinationPort || translate('common_NA')}\n`; 
      textToCopy += `${translate('bestPrices_RouteDetails_BorderLabel_DR')} ${route.directRailBorder || translate('common_NA')}\n`;
      textToCopy += `${translate('bestPrices_RouteDetails_IncotermsLabel_DR')} ${route.directRailIncoterms || translate('common_NA')}\n`;
      textToCopy += `${translate('bestPrices_CostBreakdown_DirectRailCost')} ${formatDisplayCost(route.directRailPriceRUB, 'RUB')}\n`;
      textToCopy += `${translate('bestPrices_CostBreakdown_ETD')} ${route.directRailETD || translate('common_NA')}\n`;
      if (route.directRailExcelCommentary) {
        textToCopy += `${translate('bestPrices_CostBreakdown_ExcelCommentary')} ${route.directRailExcelCommentary}\n`;
      }
    }

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: translate('toast_Success_Title'), description: translate('toast_BestPrices_RateCopied', { optionNumber: index + 1 }) });
    } catch (err) {
      toast({ variant: "destructive", title: translate('toast_CopyFailed_Title'), description: translate('toast_CopyFailed_Description') });
    }
  };

  const handleCreateInstructions = (route: BestPriceRoute) => {
    if (route.mode === 'direct_rail') {
        toast({ title: translate('toast_BestPrices_NotAvailable_Title'), description: translate('toast_BestPrices_NotAvailable_DirectRailInstructions') });
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

    if (route.containerType === "20DC") { // Applies to COC and potentially SOC if rail costs are populated
        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostBase24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostBase28t', route.railCost20DC_28t_RUB.toString());
        if (route.shipmentType === "COC" && route.railGuardCost20DC_RUB !== null) queryParams.set('railGuardCost20DC', route.railGuardCost20DC_RUB.toString());

        if (route.railCost20DC_24t_RUB !== null) queryParams.set('railCostFinal24t', route.railCost20DC_24t_RUB.toString());
        if (route.railCost20DC_28t_RUB !== null) queryParams.set('railCostFinal28t', route.railCost20DC_28t_RUB.toString());
    } else if (route.containerType === "40HC") { // Applies to COC and potentially SOC
        if (route.railCost40HC_RUB !== null) queryParams.set('railCostBase40HC', route.railCost40HC_RUB.toString());
        if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null) queryParams.set('railGuardCost40HC', route.railGuardCost40HC_RUB.toString());

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
        if (route.socDropOffCostUSD !== null && route.socDropOffCostUSD !== undefined) queryParams.set('socDropOffCost', route.socDropOffCostUSD.toString()); // This is USD
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
            <CardTitle className="text-2xl font-semibold text-primary">{translate('bestPrices_NoResults_Title')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {translate('bestPrices_NoResults_Description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDirectRailMode = bestPriceResults.some(r => r.mode === 'direct_rail');
  const formModeText = isDirectRailMode ? translate('calculationMode_DirectRail') : translate('calculationMode_SeaRail');

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <ListOrdered className="mr-3 h-8 w-8 text-accent" />
            {translate('bestPrices_Header_Title', { count: bestPriceResults.length, mode: formModeText })}
          </h1>
          {cachedFormValues && (
             <p className="text-muted-foreground mt-1" dangerouslySetInnerHTML={{
                __html: isDirectRailMode ?
                  translate('bestPrices_Header_BasedOn_DirectRail', {
                    departureCity: cachedFormValues.directRailCityOfDeparture || translate('common_NA'),
                    destinationCity: cachedFormValues.directRailDestinationCityDR || translate('common_NA'),
                    incoterms: cachedFormValues.directRailIncoterms || translate('common_NA'),
                  }) :
                  translate('bestPrices_Header_BasedOn_SeaRail_Base', {
                    originPort: cachedFormValues.originPort || translate('common_NA'),
                    containerType: cachedFormValues.containerType || translate('common_NA'),
                    shipmentType: cachedFormValues.shipmentType || translate('common_NA'),
                  }) +
                  (cachedFormValues.russianDestinationCity ? translate('bestPrices_Header_BasedOn_SeaRail_FinalDest', { finalDestCity: cachedFormValues.russianDestinationCity }) : '')
             }} />
          )}
        </div>
        <Button asChild variant="outline" className="mt-4 sm:mt-0">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bestPriceResults.map((route, index) => {
            const dropOffToDisplay = route.dropOffDisplayValue || (route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined ? formatDisplayCost(route.dropOffCostUSD, 'USD') : null);
            const agentOrSeaLineLabel = route.mode === 'direct_rail' ? translate('bestPrices_RouteCard_AgentLabel') : translate('bestPrices_RouteCard_SeaLineLabel');
            const agentOrSeaLineValue = route.mode === 'direct_rail' ? route.directRailAgentName : route.seaLineCompany;
            
            const hasRailComponentToShow = 
              route.mode === 'sea_plus_rail' &&
              route.seaDestinationPort &&
              VLADIVOSTOK_VARIANTS.some(v => route.seaDestinationPort!.startsWith(v.split(" ")[0])) &&
              route.russianDestinationCity &&
              !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity!.startsWith(v.split(" ")[0])) &&
              (
                (route.containerType === "20DC" && (route.railCost20DC_24t_RUB !== null || route.railCost20DC_28t_RUB !== null || (route.shipmentType === "COC" && route.railGuardCost20DC_RUB !== null) )) ||
                (route.containerType === "40HC" && (route.railCost40HC_RUB !== null || (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null) ))
              );

            return (
          <Card key={route.id} className="shadow-xl rounded-xl overflow-hidden flex flex-col bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="pb-4 bg-muted/30 border-b">
              <CardTitle className="text-xl font-semibold text-primary">
                {translate('bestPrices_RouteCard_OptionTitle', { optionNumber: index + 1 })}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {route.mode === 'sea_plus_rail' ? (
                    <>
                    {translate('bestPrices_RouteCard_Desc_SeaRail_RouteBase', { originPort: route.originPort || '', seaDestPort: route.seaDestinationPort || '' })}
                    {route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0])) && 
                      translate('bestPrices_RouteCard_Desc_SeaRail_FurtherRail', { 
                        russianDestCity: route.russianDestinationCity, 
                        arrivalStation: route.railArrivalStation ? `(${route.railArrivalStation})` : '' 
                      })
                    }
                    </>
                ) : ( // Direct Rail
                    <>
                    {translate('bestPrices_RouteCard_Desc_DirectRail_Route', { originPort: route.originPort || '', destPort: route.seaDestinationPort || '' })}
                    </>
                )}
                 {agentOrSeaLineValue && <span className="block mt-1">{agentOrSeaLineLabel} <span className="font-medium">{agentOrSeaLineValue}</span></span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm flex-grow flex flex-col justify-between">
              <div>
                {/* Route Details Section */}
                <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 mb-3">
                  <p className="font-medium text-muted-foreground">{route.mode === 'direct_rail' ? translate('bestPrices_RouteDetails_DepCityLabel_DR') : translate('bestPrices_RouteDetails_OriginPortLabel_SR')}</p><p className="text-right">{route.originPort || translate('common_NA')}</p>
                  <p className="font-medium text-muted-foreground">{route.mode === 'direct_rail' ? translate('bestPrices_RouteDetails_DestCityLabel_DR') : translate('bestPrices_RouteDetails_SeaDestLabel_SR')}</p><p className="text-right">{route.seaDestinationPort || translate('common_NA')}</p>

                  {agentOrSeaLineValue && (
                    <>
                      <p className="font-medium text-muted-foreground">{agentOrSeaLineLabel}</p><p className="text-right">{agentOrSeaLineValue}</p>
                    </>
                  )}
                  <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_ContainerTypeLabel')}</p><p className="text-right">{route.containerType && route.containerType !== 'N/A' ? route.containerType : '40HC'}</p>
                  <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_ShipmentTypeLabel')}</p><p className="text-right">{route.shipmentType || translate('common_NA')}</p>


                  {route.mode === 'direct_rail' && (
                    <>
                      {route.directRailBorder && <><p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_BorderLabel_DR')}</p><p className="text-right">{route.directRailBorder}</p></>}
                      {route.directRailIncoterms && <><p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_IncotermsLabel_DR')}</p><p className="text-right">{route.directRailIncoterms}</p></>}
                    </>
                  )}

                  {route.mode === 'sea_plus_rail' && route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && !VLADIVOSTOK_VARIANTS.some(v => route.russianDestinationCity.startsWith(v.split(" ")[0])) && (
                    <>
                      <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_FinalDestCityLabel_SR')}</p><p className="text-right">{route.russianDestinationCity}</p>
                    </>
                  )}
                  {route.mode === 'sea_plus_rail' && route.railDepartureStation && (
                    <>
                      <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_RailDepStationLabel_SR')}</p><p className="text-right">{route.railDepartureStation}</p>
                    </>
                  )}
                  {route.mode === 'sea_plus_rail' && route.railArrivalStation && (
                     <>
                      <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_RailArrStationLabel_SR')}</p><p className="text-right">{route.railArrivalStation}</p>
                    </>
                  )}
                </div>

                {/* Cost Breakdown Section */}
                <div className="pt-3 border-t border-border/50">
                  <h4 className="font-semibold text-md mb-2 text-primary">
                    {translate('bestPrices_CostBreakdown_Title')}
                  </h4>
                  <div className="space-y-1">
                    {route.mode === 'sea_plus_rail' ? (
                        <>
                            {route.seaCostUSD !== null && (
                            <p className="flex justify-between">
                                <span>{translate('bestPrices_CostBreakdown_SeaFreightCost')}</span>
                                <span className="font-semibold text-primary">{formatDisplayCost(route.seaCostUSD, 'USD')}</span>
                            </p>
                            )}
                            {route.seaComment && route.shipmentType === "COC" && (
                            <p className="flex justify-between items-start">
                                <span>{translate('bestPrices_CostBreakdown_SeaRouteComment')}</span>
                                <span className="text-xs text-destructive text-right ml-2">{route.seaComment}</span>
                            </p>
                            )}
                            {route.socComment && route.shipmentType === "SOC" && (
                                <p className="flex justify-between items-start">
                                    <span>{translate('bestPrices_CostBreakdown_SOCComment')}</span>
                                    <span className="text-xs text-destructive text-right ml-2">{route.socComment}</span>
                                </p>
                            )}

                            {/* Combined Railway Leg Cost Display */}
                            {hasRailComponentToShow && (
                              <p className="flex justify-between">
                                <span>{translate('bestPrices_CostBreakdown_RailComponent')}</span>
                                <span className="font-semibold text-primary text-right">
                                  {(() => {
                                    let railLegStr = "";
                                    let guardNeededComment = false;

                                    if (route.containerType === "20DC") {
                                      const costsParts = [];
                                      if (route.railCost20DC_24t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')} ${translate('bestPrices_CostBreakdown_Rail_lt24t')}`);
                                      if (route.railCost20DC_28t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')} ${translate('bestPrices_CostBreakdown_Rail_lt28t')}`);
                                      
                                      if (costsParts.length > 0) {
                                        railLegStr = costsParts.join(' / ');
                                      }

                                      if (route.shipmentType === "COC" && route.railGuardCost20DC_RUB !== null) {
                                        const guardStr = `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB')}`;
                                        if (railLegStr) { 
                                            railLegStr += ` + ${guardStr}`;
                                        } else { 
                                            railLegStr = guardStr;
                                        }
                                        if (route.railGuardCost20DC_RUB > 0) guardNeededComment = true;
                                      } else if (route.shipmentType === "COC" && railLegStr) { 
                                          railLegStr += translate('bestPrices_CostBreakdown_Rail_GuardNA');
                                      }
                                      if (!railLegStr) railLegStr = translate('common_NA'); 

                                    } else if (route.containerType === "40HC") {
                                      if (route.railCost40HC_RUB !== null) {
                                        railLegStr = formatDisplayCost(route.railCost40HC_RUB, 'RUB');
                                        if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null) {
                                          railLegStr += ` + ${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                          if (route.railGuardCost40HC_RUB > 0) guardNeededComment = true;
                                        } else if (route.shipmentType === "COC") {
                                          railLegStr += translate('bestPrices_CostBreakdown_Rail_GuardNA');
                                        }
                                      } else if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB !== null) { 
                                        railLegStr = `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                        if (route.railGuardCost40HC_RUB > 0) guardNeededComment = true;
                                      } else {
                                        railLegStr = translate('common_NA');
                                      }
                                    }
                                    if (route.shipmentType === "COC" && guardNeededComment) {
                                      railLegStr += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
                                    }
                                    return railLegStr;
                                  })()}
                                </span>
                              </p>
                            )}
                            {/* End Combined Railway Leg Cost Display */}


                            {dropOffToDisplay && route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line') && (
                                <p className="flex justify-between">
                                    <span>{translate('bestPrices_CostBreakdown_DropOffCost')}</span>
                                    <span className="font-semibold text-primary">{dropOffToDisplay}</span>
                                </p>
                            )}
                            {route.dropOffComment && route.shipmentType === "COC" && (
                            <p className="flex justify-between items-start">
                                <span>{translate('bestPrices_CostBreakdown_DropOffComment')}</span>
                                <span className="text-xs text-destructive text-right ml-2">{route.dropOffComment}</span>
                            </p>
                            )}
                            {/* Display SOC Drop Off Cost only if rail component is NOT shown for SOC */}
                            {!hasRailComponentToShow && route.shipmentType === "SOC" && route.socDropOffCostUSD !== null && (
                              <p className="flex justify-between">
                                <span>{translate('bestPrices_CostBreakdown_SOCDropOffCost', { containerType: route.containerType || '' })}</span>
                                <span className="font-semibold text-primary">
                                  {formatDisplayCost(route.socDropOffCostUSD, 'USD')}
                                </span>
                              </p>
                            )}
                            {route.shipmentType === "SOC" && route.socDropOffComment && (
                              <p className="flex justify-between items-start">
                                <span>{translate('bestPrices_CostBreakdown_SOCDropOffComment')}</span>
                                <span className="text-xs text-muted-foreground text-right ml-2">{route.socDropOffComment}</span>
                              </p>
                            )}
                        </>
                    ) : ( 
                        <>
                            {route.directRailPriceRUB !== null && (
                            <p className="flex justify-between">
                                <span>{translate('bestPrices_CostBreakdown_DirectRailCost')}</span>
                                <span className="font-semibold text-primary">{formatDisplayCost(route.directRailPriceRUB, 'RUB')}</span>
                            </p>
                            )}
                             {route.directRailETD && (
                            <p className="flex justify-between">
                                <span>{translate('bestPrices_CostBreakdown_ETD')}</span>
                                <span className="text-primary">{route.directRailETD}</span>
                            </p>
                            )}
                            {route.directRailExcelCommentary && (
                            <p className="flex justify-between items-start">
                                <span>{translate('bestPrices_CostBreakdown_ExcelCommentary')}</span>
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
                  <Copy className="mr-2 h-4 w-4" /> {translate('bestPrices_RouteCard_Button_CopyRate')}
                </Button>
                <Button
                  onClick={() => handleCreateInstructions(route)}
                  variant="default"
                  className="w-full flex-1"
                  size="sm"
                  disabled={route.mode === 'direct_rail'}
                >
                  <Edit3 className="mr-2 h-4 w-4" /> {translate('bestPrices_RouteCard_Button_CreateInstructions')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )})}
      </div>
       <div className="text-center mt-6">
        <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
            </Link>
        </Button>
      </div>
    </div>
  );
}

    

      