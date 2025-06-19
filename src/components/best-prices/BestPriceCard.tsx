
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Edit3, Star } from 'lucide-react';
import type { BestPriceRoute } from '@/contexts/PricingDataContext';
import type { Translations } from '@/contexts/LocalizationContext';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { normalizeCityName } from '@/lib/pricing/utils';
import { VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS } from '@/lib/pricing/constants';

interface BestPriceCardProps {
  route: BestPriceRoute;
  index: number;
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
  onCopyRate: (route: BestPriceRoute, index: number) => Promise<void>;
  onCreateInstructions: (route: BestPriceRoute) => void;
}

export default function BestPriceCard({ route, index, translate, onCopyRate, onCreateInstructions }: BestPriceCardProps) {
  let dropOffCostForCard: string | null = null;
  if (route.shipmentType === "COC" && route.dropOffDisplayValue) {
      const isNumeric = /^\d+(\.\d+)?$/.test(route.dropOffDisplayValue);
      const hasCurrency = /\s(USD|RUB)$/i.test(route.dropOffDisplayValue);
      if (isNumeric && !hasCurrency) {
          dropOffCostForCard = formatDisplayCost(parseFloat(route.dropOffDisplayValue), 'USD');
      } else {
          dropOffCostForCard = route.dropOffDisplayValue;
      }
  } else if (route.shipmentType === "COC" && route.dropOffCostUSD !== null && route.dropOffCostUSD !== undefined) {
      dropOffCostForCard = formatDisplayCost(route.dropOffCostUSD, 'USD');
  } else if (route.shipmentType === "SOC" && route.socDropOffCostUSD !== null && route.socDropOffCostUSD !== undefined) {
      dropOffCostForCard = formatDisplayCost(route.socDropOffCostUSD, 'USD');
  }

  const agentOrSeaLineLabel = route.mode === 'direct_rail' ? translate('bestPrices_RouteCard_AgentLabel') : translate('bestPrices_RouteCard_SeaLineLabel');
  const agentOrSeaLineValue = route.mode === 'direct_rail' ? route.directRailAgentName : route.seaLineCompany;
  
  const normalizedSeaDestPort = normalizeCityName(route.seaDestinationPort || "");
  const normalizedRussianDestCity = normalizeCityName(route.russianDestinationCity || "");

  const isSeaDestHub = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPort) ||
                       VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPort);

  const hasFurtherRailLegData = route.russianDestinationCity && route.russianDestinationCity !== 'N/A' && isSeaDestHub && normalizedRussianDestCity !== normalizedSeaDestPort;

  const hasRailCostDataToShow = (
      (route.containerType === "20DC" && (route.railCost20DC_24t_RUB !== null || route.railCost20DC_28t_RUB !== null || (route.shipmentType === "COC" && route.railGuardCost20DC_RUB && route.railGuardCost20DC_RUB > 0) )) ||
      (route.containerType === "40HC" && (route.railCost40HC_RUB !== null || (route.shipmentType === "COC" && route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) ))
  );
  
  const hasRailComponentToShow = route.mode === 'sea_plus_rail' && hasFurtherRailLegData && hasRailCostDataToShow;

  const isDashboardRec = route.isDashboardRecommendation;
  const cardClasses = `shadow-xl rounded-xl overflow-hidden flex flex-col bg-card border border-border hover:shadow-2xl transition-shadow duration-300`;
  
  const headerStyle = isDashboardRec ? { backgroundColor: 'hsl(var(--chart-2))', borderColor: 'hsl(var(--chart-2))' } : {};
  const headerTextStyle = isDashboardRec ? 'text-primary-foreground' : 'text-primary';
  const headerDescriptionStyle = isDashboardRec ? 'text-primary-foreground/80' : '';
  const badgeStyle = isDashboardRec ? { borderColor: 'hsl(var(--primary-foreground))', color: 'hsl(var(--primary-foreground))', backgroundColor: 'hsla(var(--chart-2), 0.1)'} : {};

  return (
    <Card className={cardClasses}>
      <CardHeader 
        className={`pb-4 border-b ${isDashboardRec ? '' : 'bg-muted/30'}`}
        style={headerStyle}
      >
        <div className="flex justify-between items-start">
          <CardTitle className={`text-xl font-semibold ${headerTextStyle}`}>
            {isDashboardRec && route.dashboardSourceService 
              ? route.dashboardSourceService 
              : translate('bestPrices_RouteCard_OptionTitle', { optionNumber: index + 1 })}
          </CardTitle>
          {isDashboardRec && (
              <Badge variant="outline" 
                     className="font-semibold ml-2 flex items-center"
                     style={badgeStyle}
              >
                  <Star className="mr-1.5 h-3.5 w-3.5 text-yellow-500" fill="currentColor"/> 
                  {translate('bestPrices_DashboardRecommendationLabel')}
              </Badge>
          )}
        </div>
        <CardDescription className={`text-xs mt-1 ${headerDescriptionStyle}`}>
          {route.mode === 'sea_plus_rail' ? (
              <>
              {translate('bestPrices_RouteCard_Desc_SeaRail_RouteBase', { originPort: route.originPort || '', seaDestPort: route.seaDestinationPort || '' })}
              {hasFurtherRailLegData && 
                translate('bestPrices_RouteCard_Desc_SeaRail_FurtherRail', { 
                  russianDestCity: route.russianDestinationCity, 
                  arrivalStation: route.railArrivalStation ? `(${translate('common_NA')})` : '' 
                })
              }
              </>
          ) : ( 
              <>
              {translate('bestPrices_RouteCard_Desc_DirectRail_Route', { originPort: route.originPort || '', destPort: route.seaDestinationPort || '' })}
              </>
          )}
           {agentOrSeaLineValue && <span className="block mt-1">{agentOrSeaLineLabel} <span className="font-medium">{agentOrSeaLineValue}</span></span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-3 text-sm flex-grow flex flex-col justify-between">
        <div>
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

            {route.mode === 'sea_plus_rail' && hasFurtherRailLegData && (
              <>
                <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_FinalDestCityLabel_SR')}</p><p className="text-right">{route.russianDestinationCity}</p>
              </>
            )}
            {route.mode === 'sea_plus_rail' && hasFurtherRailLegData && route.railDepartureStation && (
              <>
                <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_RailDepStationLabel_SR')}</p><p className="text-right">{route.railDepartureStation}</p>
              </>
            )}
            {route.mode === 'sea_plus_rail' && hasFurtherRailLegData && route.railArrivalStation && (
               <>
                <p className="font-medium text-muted-foreground">{translate('bestPrices_RouteDetails_RailArrStationLabel_SR')}</p><p className="text-right">{route.railArrivalStation}</p>
              </>
            )}
          </div>

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

                      {hasRailComponentToShow && (
                        <p className="flex justify-between">
                          <span>{translate('bestPrices_CostBreakdown_RailComponent')}</span>
                          <span className="font-semibold text-primary text-right">
                            {(() => {
                              let railLegStr = "";
                              let guardNeededAndPriced = false;

                              if (route.containerType === "20DC") {
                                const costsParts = [];
                                if (route.railCost20DC_24t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_24t_RUB, 'RUB')} ${translate('bestPrices_CostBreakdown_Rail_lt24t')}`);
                                if (route.railCost20DC_28t_RUB !== null) costsParts.push(`${formatDisplayCost(route.railCost20DC_28t_RUB, 'RUB')} ${translate('bestPrices_CostBreakdown_Rail_lt28t')}`);
                                
                                if (costsParts.length > 0) {
                                  railLegStr = costsParts.join(' / ');
                                }

                                if (route.shipmentType === "COC" && route.railGuardCost20DC_RUB && route.railGuardCost20DC_RUB > 0) {
                                  const guardStr = `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB')}`;
                                  if (railLegStr) { 
                                      railLegStr += ` + ${guardStr}`;
                                  } else { 
                                      railLegStr = guardStr;
                                  }
                                  guardNeededAndPriced = true;
                                }
                                if (!railLegStr) railLegStr = translate('common_NA'); 

                              } else if (route.containerType === "40HC") {
                                if (route.railCost40HC_RUB !== null) {
                                  railLegStr = formatDisplayCost(route.railCost40HC_RUB, 'RUB');
                                  if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) {
                                    railLegStr += ` + ${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                    guardNeededAndPriced = true;
                                  }
                                } else if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) { 
                                  railLegStr = `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
                                  guardNeededAndPriced = true;
                                } else {
                                  railLegStr = translate('common_NA');
                                }
                              }
                              if (route.shipmentType === "COC" && guardNeededAndPriced) {
                                railLegStr += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
                              }
                              return railLegStr;
                            })()}
                          </span>
                        </p>
                      )}

                      {dropOffCostForCard && route.shipmentType === "COC" && !route.seaLineCompany?.toLowerCase().includes('panda express line') && (
                          <p className="flex justify-between">
                              <span>{translate('bestPrices_CostBreakdown_DropOffCost')}</span>
                              <span className="font-semibold text-primary">{dropOffCostForCard}</span>
                          </p>
                      )}
                      {route.dropOffComment && route.shipmentType === "COC" && (
                      <p className="flex justify-between items-start">
                          <span>{translate('bestPrices_CostBreakdown_DropOffComment')}</span>
                          <span className="text-xs text-destructive text-right ml-2">{route.dropOffComment}</span>
                      </p>
                      )}
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
              ) : ( // Direct Rail Mode
                  <>
                      {route.directRailPriceRUB !== null && (
                      <p className="flex justify-between">
                          <span>{translate('bestPrices_CostBreakdown_DirectRailCost')}</span>
                          <span className="font-semibold text-primary">{formatDisplayCost(route.directRailPriceRUB, route.directRailPriceRUB < 100000 ? 'USD' : 'RUB')}</span>
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
            onClick={() => onCopyRate(route, index)}
            variant="outline"
            className="w-full flex-1 border-primary text-primary hover:bg-primary/10"
            size="sm"
          >
            <Copy className="mr-2 h-4 w-4" /> {translate('bestPrices_RouteCard_Button_CopyRate')}
          </Button>
          <Button
            onClick={() => onCreateInstructions(route)}
            variant="default"
            className="w-full flex-1"
            size="sm"
            disabled={route.mode === 'direct_rail' || route.isDashboardRecommendation}
          >
            <Edit3 className="mr-2 h-4 w-4" /> {translate('bestPrices_RouteCard_Button_CreateInstructions')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
