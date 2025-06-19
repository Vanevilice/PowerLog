
"use client";

import type { BestPriceRoute, Translations } from '@/types';
import { formatDisplayCost } from '@/lib/pricing/ui-helpers';
import { VLADIVOSTOK_VARIANTS, VOSTOCHNIY_VARIANTS } from '@/lib/pricing/constants';
import { normalizeCityName } from '@/lib/pricing/utils';

export function generateCopyRateText(
  route: BestPriceRoute,
  index: number, // Index is kept if needed for any part of the text, though not used in current reduced version
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string
): string {
  let textToCopy = "";

  if (route.mode === 'sea_plus_rail') {
    textToCopy += "FOB " + (route.containerType || 'N/A');
    textToCopy += " " + (route.originPort || 'N/A');
    textToCopy += " - " + (route.seaDestinationPort || 'N/A');

    const normalizedSeaDestPortCopy = normalizeCityName(route.seaDestinationPort || "");
    const normalizedRussianDestCityCopy = normalizeCityName(route.russianDestinationCity || "");
    const isSeaDestHubCopy = VLADIVOSTOK_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPortCopy) ||
                           VOSTOCHNIY_VARIANTS.some(v => normalizeCityName(v) === normalizedSeaDestPortCopy);
    const isFurtherRailForCopy = route.russianDestinationCity && route.russianDestinationCity !== 'N/A' &&
                              isSeaDestHubCopy &&
                              normalizedRussianDestCityCopy !== normalizedSeaDestPortCopy;

    if (isFurtherRailForCopy) {
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

    textToCopy += translate('bestPrices_CostBreakdown_SeaFreightCost') + " " + formatDisplayCost(totalFreightCostUSD > 0 ? totalFreightCostUSD : null, 'USD') + "\n";

    let jdLine = "";
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

            if (route.shipmentType === "COC" && route.railGuardCost20DC_RUB && route.railGuardCost20DC_RUB > 0) {
              const guardCostFormatted = formatDisplayCost(route.railGuardCost20DC_RUB, 'RUB');
              jdLine += " + " + translate('bestPrices_CostBreakdown_Rail_GuardPrefix') + guardCostFormatted;
              jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
            }
        } else if (route.containerType === "40HC") {
            if (route.railCost40HC_RUB !== null) {
              jdLine += formatDisplayCost(route.railCost40HC_RUB, 'RUB');
              if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) { 
                  const guardCostFormatted = formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB');
                  jdLine += " + " + translate('bestPrices_CostBreakdown_Rail_GuardPrefix') + guardCostFormatted;
                  jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
              }
            } else if (route.shipmentType === "COC" && route.railGuardCost40HC_RUB && route.railGuardCost40HC_RUB > 0) {
              jdLine += `${translate('bestPrices_CostBreakdown_Rail_GuardPrefix')}${formatDisplayCost(route.railGuardCost40HC_RUB, 'RUB')}`;
              jdLine += " " + translate('bestPrices_CostBreakdown_Rail_GuardSuffixIfCodeProtected');
            } else {
              jdLine += translate('common_NA');
            }
        }
    }
    if (jdLine && jdLine !== translate('bestPrices_CostBreakdown_RailComponent') + " " && jdLine !== translate('bestPrices_CostBreakdown_RailComponent') + translate('common_NA')) {
        textToCopy += jdLine + "\n";
    }
    textToCopy += "Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n";

  } else if (route.mode === 'direct_rail') {
    textToCopy += translate('bestPrices_RouteCard_Desc_DirectRail_Route', { originPort: route.originPort || translate('common_NA'), destPort: route.seaDestinationPort || translate('common_NA') }) + "\n";
    textToCopy += `${translate('bestPrices_RouteCard_AgentLabel')} ${route.directRailAgentName || translate('common_NA')}\n`;
    textToCopy += `${translate('bestPrices_RouteDetails_DepCityLabel_DR')} ${route.originPort || translate('common_NA')}\n`; 
    textToCopy += `${translate('bestPrices_RouteDetails_DestCityLabel_DR')} ${route.seaDestinationPort || translate('common_NA')}\n`; 
    textToCopy += `${translate('bestPrices_RouteDetails_BorderLabel_DR')} ${route.directRailBorder || translate('common_NA')}\n`;
    textToCopy += `${translate('bestPrices_RouteDetails_IncotermsLabel_DR')} ${route.directRailIncoterms || translate('common_NA')}\n`;
    textToCopy += `${translate('bestPrices_CostBreakdown_DirectRailCost')} ${route.directRailPriceRUB !== null ? formatDisplayCost(route.directRailPriceRUB, route.directRailPriceRUB < 100000 ? 'USD' : 'RUB') : translate('common_NA')}\n`;
    textToCopy += `${translate('bestPrices_CostBreakdown_ETD')} ${route.directRailETD || translate('common_NA')}\n`;
  }
  return textToCopy.trim();
}
