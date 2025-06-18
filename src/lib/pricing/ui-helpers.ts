
import type { UseFormReturn } from 'react-hook-form';
// import type { NextRouter } from 'next/router'; // Or 'next/navigation' for App Router
import { useToast } from '@/hooks/use-toast';
import type {
  RouteFormValues,
  SmartPricingOutput,
  CalculationDetailsForInstructions,
  ShipmentType,
  ContainerType,
  DashboardServiceDataRow, 
  RailwayLegData,         
  Translations // Import Translations type
} from '@/types';
import { NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from './constants';

export function formatDisplayCost(cost: number | null | undefined, currency: 'USD' | 'RUB' = 'USD'): string {
  if (cost === null || cost === undefined) return 'N/A';
  const numCost = Number(cost);
  if (isNaN(numCost)) return 'N/A';

  const formatted = numCost.toLocaleString('fr-FR', { // French locale uses space as thousands separator
    minimumFractionDigits: (numCost % 1 === 0) ? 0 : 2,
    maximumFractionDigits: (numCost % 1 === 0) ? 0 : 2,
  });
  return formatted + " " + currency;
}

// Placeholder Getters
interface PlaceholderGetterArgs {
  isParsingSeaRailFile: boolean;
  isSeaRailExcelDataLoaded: boolean;
  formGetValues: UseFormReturn<RouteFormValues>['getValues'];
  localAvailableSeaLines?: string[];
  excelRussianDestinationCitiesMasterList?: string[];
  localAvailableRussianDestinationCities?: string[];
  localAvailableArrivalStations?: string[];
}

export function getSeaLinePlaceholder(args: PlaceholderGetterArgs): keyof Translations {
  const { isParsingSeaRailFile, isSeaRailExcelDataLoaded, formGetValues, localAvailableSeaLines = [] } = args;
  const watchedOriginPort = formGetValues("originPort");
  const watchedDestinationPort = formGetValues("destinationPort");

  if (isParsingSeaRailFile) return "seaLineCompanyPlaceholder_Loading";
  if (!isSeaRailExcelDataLoaded) return "seaLineCompanyPlaceholder_NoData";
  if (!watchedOriginPort || !watchedDestinationPort) return "seaLineCompanyPlaceholder_SelectOD";
  if (localAvailableSeaLines.length > 0) return "seaLineCompanyPlaceholder_Select";
  return "seaLineCompanyPlaceholder_NoLinesForOD";
}

export function getRussianCityPlaceholder(args: PlaceholderGetterArgs): keyof Translations {
  const { 
    isParsingSeaRailFile, 
    isSeaRailExcelDataLoaded, 
    formGetValues, 
    excelRussianDestinationCitiesMasterList = [], 
    localAvailableRussianDestinationCities = [] 
  } = args;
  
  const watchedOriginPort = formGetValues("originPort");
  const watchedContainerType = formGetValues("containerType");
  const watchedDestinationPort = formGetValues("destinationPort"); // Sea Port

  if (isParsingSeaRailFile) return "destinationCityRailPlaceholder_Loading";
  if (!isSeaRailExcelDataLoaded) return "destinationCityRailPlaceholder_NoData";
  if (excelRussianDestinationCitiesMasterList.length === 0) return "destinationCityRailPlaceholder_NoRailDestLoaded";
  
  if (!watchedOriginPort && !watchedContainerType) return "destinationCityRailPlaceholder_SelectOriginContainer";
  if (!watchedOriginPort) return "destinationCityRailPlaceholder_SelectOrigin";
  if (!watchedContainerType) return "destinationCityRailPlaceholder_SelectContainer";

  // If sea destination port is selected and it's NOT a hub like Vladivostok,
  // then selecting a Russian city for further rail doesn't make sense with current model.
  // This check needs careful placement as localAvailableRussianDestinationCities is filtered by container/origin
  if (watchedDestinationPort && 
      !VLADIVOSTOK_VARIANTS.some(vladVariant => watchedDestinationPort!.startsWith(vladVariant.split(" ")[0])) &&
      localAvailableRussianDestinationCities.length > 0) { // Check if any rail cities are *possible* for current O/Container combo
      return "rusCity_Placeholder_NoRailHubsForSeaDest";
  }
  
  if (localAvailableRussianDestinationCities.length > 0) return "destinationCityRailPlaceholder_Select";
  
  return "destinationCityRailPlaceholder_NoHubsForSelection";
}

export function getArrivalStationPlaceholder(args: PlaceholderGetterArgs): keyof Translations {
  const { isParsingSeaRailFile, isSeaRailExcelDataLoaded, formGetValues, localAvailableArrivalStations = [] } = args;
  const watchedRussianDestinationCity = formGetValues("russianDestinationCity");

  if (isParsingSeaRailFile) return "stationRailPlaceholder_Loading";
  if (!isSeaRailExcelDataLoaded) return "stationRailPlaceholder_NoData";
  if (!watchedRussianDestinationCity) return "stationRailPlaceholder_SelectDestCity";
  if (localAvailableArrivalStations.length > 0) return "stationRailPlaceholder_Select";
  return "stationRailPlaceholder_NoStationsForCity";
}

// Copy and Navigation
interface ActionHandlerArgs {
  isSeaRailExcelDataLoaded: boolean;
  shippingInfo: SmartPricingOutput | null;
  lastSuccessfulCalculation: CalculationDetailsForInstructions | null;
  formGetValues: UseFormReturn<RouteFormValues>['getValues'];
  toast: ReturnType<typeof useToast>['toast'];
  router: any; // Using 'any' for router type to avoid NextRouter/AppRouter specific import for now
}

export async function handleCopyOutput(args: ActionHandlerArgs) {
  const { isSeaRailExcelDataLoaded, shippingInfo, lastSuccessfulCalculation, formGetValues, toast } = args;

  if (!isSeaRailExcelDataLoaded && (!shippingInfo || (!('seaCost' in shippingInfo) && !('commentary' in shippingInfo)))) {
    toast({ title: "Nothing to copy", description: "Calculate a price or load data first." });
    return;
  }

  let textToCopy = "";
  const formVals = formGetValues();
  const { shipmentType, originPort, destinationPort, containerType, russianDestinationCity } = formVals;
  const actualSeaLine = formVals.seaLineCompany === NONE_SEALINE_VALUE ? undefined : formVals.seaLineCompany;
  const isPandaLine = actualSeaLine?.toLowerCase().includes('panda express line');

  const isFurtherRailJourneyCopy = russianDestinationCity && destinationPort &&
                                 VLADIVOSTOK_VARIANTS.some(vladVariant => destinationPort.startsWith(vladVariant.split(" ")[0])) &&
                                 !VLADIVOSTOK_VARIANTS.some(vladVariant => vladVariant === russianDestinationCity && destinationPort.startsWith(vladVariant.split(" ")[0]));

  const seaCostUSDToUse = lastSuccessfulCalculation?.seaCostFinal ?? (shippingInfo && 'seaCost' in shippingInfo ? shippingInfo.seaCost : null);
  const railArrivalStationToUse = lastSuccessfulCalculation?.railArrivalStation ?? (shippingInfo && 'railArrivalStation' in shippingInfo ? shippingInfo.railArrivalStation : null);

  textToCopy += "FOB " + (containerType || 'N/A') + " " + (originPort || 'N/A');
  textToCopy += " - " + (destinationPort || 'N/A');
  if (isFurtherRailJourneyCopy && russianDestinationCity) {
    textToCopy += " - " + russianDestinationCity;
    if (railArrivalStationToUse) textToCopy += " (прибытие: " + railArrivalStationToUse + ")";
  }
  textToCopy += "\n";

  let totalFreightCostUSD = seaCostUSDToUse ?? 0;

  if (shipmentType === "COC") {
    const dropOffCostUSDToUse = lastSuccessfulCalculation?.dropOffCost ?? (shippingInfo && 'dropOffCost' in shippingInfo && shippingInfo.dropOffCost ? shippingInfo.dropOffCost : null);
    if (actualSeaLine && !isPandaLine && dropOffCostUSDToUse) {
      totalFreightCostUSD += dropOffCostUSDToUse;
    }
  } else if (shipmentType === "SOC") {
    const socDropOffCostUSD = lastSuccessfulCalculation?.socDropOffCost ?? (shippingInfo && 'socDropOffCost' in shippingInfo ? shippingInfo.socDropOffCost : null);
    if (socDropOffCostUSD) {
      totalFreightCostUSD += socDropOffCostUSD;
    }
  }
  
  textToCopy += "Фрахт: " + formatDisplayCost(totalFreightCostUSD > 0 ? totalFreightCostUSD : null, 'USD') + "\n";

  let jdLine = "";
  if (isFurtherRailJourneyCopy) {
    jdLine = "Ж/Д Составляющая: ";
    if (containerType === "20DC") {
      const railCost24t = lastSuccessfulCalculation?.railCostFinal24t ?? (shippingInfo && 'railCost20DC_24t' in shippingInfo ? shippingInfo.railCost20DC_24t : null);
      const railCost28t = lastSuccessfulCalculation?.railCostFinal28t ?? (shippingInfo && 'railCost20DC_28t' in shippingInfo ? shippingInfo.railCost20DC_28t : null);
      const guardCost20DC = lastSuccessfulCalculation?.railGuardCost20DC ?? (shippingInfo && 'railGuardCost20DC' in shippingInfo ? shippingInfo.railGuardCost20DC : null);
      let costsParts = [];
      if (railCost24t !== null) costsParts.push(formatDisplayCost(railCost24t, 'RUB') + " (<24t)");
      if (railCost28t !== null) costsParts.push(formatDisplayCost(railCost28t, 'RUB') + " (<28t)");
      jdLine += costsParts.join(' / ') || "N/A";
      const guardCostFormatted = formatDisplayCost(guardCost20DC, 'RUB');
      if (guardCostFormatted && guardCostFormatted !== 'N/A') {
        jdLine += " + Охрана " + guardCostFormatted;
        if (guardCost20DC && guardCost20DC > 0) jdLine += " (Если код подохранный)";
      } else if (costsParts.length > 0 && guardCostFormatted === 'N/A') {
        jdLine += " + Охрана N/A";
      }
    } else if (containerType === "40HC") {
      const railCost40HC = lastSuccessfulCalculation?.railCostFinal40HC ?? (shippingInfo && 'railCost40HC' in shippingInfo ? shippingInfo.railCost40HC : null);
      const guardCost40HC = lastSuccessfulCalculation?.railGuardCost40HC ?? (shippingInfo && 'railGuardCost40HC' in shippingInfo ? shippingInfo.railGuardCost40HC : null);
      jdLine += formatDisplayCost(railCost40HC, 'RUB') || "N/A";
      const guardCostFormatted = formatDisplayCost(guardCost40HC, 'RUB');
      if (guardCostFormatted && guardCostFormatted !== 'N/A') {
        jdLine += " + Охрана " + guardCostFormatted;
        if (guardCost40HC && guardCost40HC > 0) jdLine += " (Если код подохранный)";
      } else if (railCost40HC !== null && guardCostFormatted === 'N/A') {
         jdLine += " + Охрана N/A";
      }
    }
  }
  if (jdLine && jdLine !== "Ж/Д Составляющая: ") textToCopy += jdLine + "\n";
  textToCopy += "Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n";

  // Removed the block that appended Sea Route Comment and Drop Off Comment for COC shipments.

  try {
    await navigator.clipboard.writeText(textToCopy.trim());
    toast({ title: "Success!", description: "Output copied to clipboard." });
  } catch (err) {
    toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard." });
  }
}

export function handleCreateInstructionsNavigation(args: ActionHandlerArgs) {
  const { lastSuccessfulCalculation, toast, router } = args;
  if (!lastSuccessfulCalculation) {
    toast({ title: "No calculation data", description: "Please calculate a price first." });
    return;
  }
  const {
    shipmentType, originPort, destinationPort, seaLineCompany, containerType, russianDestinationCity,
    railArrivalStation, railDepartureStation,
    seaCostBase, seaComment, socComment,
    railCostBase24t, railCostBase28t, railGuardCost20DC, railCostBase40HC, railGuardCost40HC,
    seaMarginApplied, railMarginApplied, seaCostFinal,
    railCostFinal24t, railCostFinal28t, railCostFinal40HC,
    dropOffCost, dropOffComment, socDropOffCost, socDropOffComment
  } = lastSuccessfulCalculation;

  const queryParams = new URLSearchParams();
  if (shipmentType) queryParams.set('shipmentType', shipmentType);
  if (originPort) queryParams.set('originPort', originPort);
  if (destinationPort) queryParams.set('destinationPort', destinationPort);
  if (seaLineCompany) queryParams.set('seaLineCompany', seaLineCompany);
  if (containerType) queryParams.set('containerType', containerType);
  if (seaComment && shipmentType === "COC") queryParams.set('seaComment', seaComment);
  if (socComment && shipmentType === "SOC") queryParams.set('socComment', socComment); 
  if (railDepartureStation) queryParams.set('railDepartureStation', railDepartureStation);


  const isFurtherRailJourneyInstructions = russianDestinationCity && destinationPort &&
                                         VLADIVOSTOK_VARIANTS.some(vladVariant => destinationPort.startsWith(vladVariant.split(" ")[0])) &&
                                         !VLADIVOSTOK_VARIANTS.some(vladVariant => vladVariant === russianDestinationCity && destinationPort.startsWith(vladVariant.split(" ")[0]));

  if (isFurtherRailJourneyInstructions && russianDestinationCity) queryParams.set('russianDestinationCity', russianDestinationCity);
  if (railArrivalStation) queryParams.set('railArrivalStation', railArrivalStation);
  if (seaCostBase !== null && seaCostBase !== undefined) queryParams.set('seaCostBase', seaCostBase.toString());

  if (containerType === "20DC") {
    if (railCostBase24t !== null) queryParams.set('railCostBase24t', railCostBase24t.toString());
    if (railCostBase28t !== null) queryParams.set('railCostBase28t', railCostBase28t.toString());
    if (railGuardCost20DC !== null) queryParams.set('railGuardCost20DC', railGuardCost20DC.toString());
    if (railCostFinal24t !== null) queryParams.set('railCostFinal24t', railCostFinal24t.toString());
    if (railCostFinal28t !== null) queryParams.set('railCostFinal28t', railCostFinal28t.toString());
  } else if (containerType === "40HC") {
    if (railCostBase40HC !== null) queryParams.set('railCostBase40HC', railCostBase40HC.toString());
    if (railGuardCost40HC !== null) queryParams.set('railGuardCost40HC', railGuardCost40HC.toString());
    if (railCostFinal40HC !== null) queryParams.set('railCostFinal40HC', railCostFinal40HC.toString());
  }

  if (seaMarginApplied !== undefined) queryParams.set('seaMarginApplied', seaMarginApplied.toString());
  if (railMarginApplied !== undefined) queryParams.set('railMarginApplied', railMarginApplied.toString());
  if (seaCostFinal !== null) queryParams.set('seaCostFinal', seaCostFinal.toString());

  const isPandaLine = seaLineCompany?.toLowerCase().includes('panda express line');
  if (dropOffCost !== null && shipmentType === "COC" && !isPandaLine) {
    queryParams.set('dropOffCost', dropOffCost.toString());
  }
  if (dropOffComment && shipmentType === "COC") queryParams.set('dropOffComment', dropOffComment);
  
  // For instructions, SOC drop-off cost is still passed as USD
  if (socDropOffCost !== null && shipmentType === "SOC") {
    queryParams.set('socDropOffCost', socDropOffCost.toString()); // This remains USD
  }
  if (socDropOffComment && shipmentType === "SOC") {
    queryParams.set('socDropOffComment', socDropOffComment);
  }


  router.push("/instructions?" + queryParams.toString());
}

export function handleDirectRailCopy(shippingInfo: SmartPricingOutput | null, toast: ReturnType<typeof useToast>['toast']) {
  if (!shippingInfo || !('directRailCost' in shippingInfo)) {
    toast({ title: "No Direct Rail data", description: "Calculate a Direct Rail price first." });
    return;
  }
  let text = "Direct Rail Information:\n";
  if (shippingInfo.directRailAgentName) text += "Agent: " + shippingInfo.directRailAgentName + "\n";
  if (shippingInfo.directRailCityOfDeparture) text += "City of Departure: " + shippingInfo.directRailCityOfDeparture + "\n";
  if (shippingInfo.directRailDepartureStation) text += "Departure Station: " + shippingInfo.directRailDepartureStation + "\n";
  if (shippingInfo.directRailDestinationCity) text += "Destination City: " + shippingInfo.directRailDestinationCity + "\n";
  if (shippingInfo.directRailBorder) text += "Border: " + shippingInfo.directRailBorder + "\n";
  if (shippingInfo.directRailIncoterms) text += "Incoterms: " + shippingInfo.directRailIncoterms + "\n";
  
  if (shippingInfo.directRailCost !== null && shippingInfo.directRailCost !== undefined) {
    const currency = shippingInfo.directRailCost < 100000 ? 'USD' : 'RUB';
    text += "Railway Cost: " + formatDisplayCost(shippingInfo.directRailCost, currency) + "\n";
  }

  if (shippingInfo.directRailETD) text += "ETD: " + shippingInfo.directRailETD + "\n";
  if (shippingInfo.directRailCommentary) text += "Commentary: " + shippingInfo.directRailCommentary + "\n";

  navigator.clipboard.writeText(text.trim())
    .then(() => toast({ title: "Success!", description: "Direct Rail Info copied." }))
    .catch(() => toast({ variant: "destructive", title: "Copy Failed" }));
}

export function generateDashboardCopyText(
  row: DashboardServiceDataRow,
  selectedLeg: RailwayLegData | null,
  originPart: string, 
  forPartDisplay: string 
): string {
  let textToCopy = "";

  textToCopy += `FOB ${row.containerInfo || 'N/A'} ${originPart} - Владивосток - FOR ${forPartDisplay} :\n`;
  textToCopy += `Фрахт: ${row.rate || 'N/A'}\n`;

  if (selectedLeg && selectedLeg.cost && selectedLeg.cost !== 'N/A') {
    textToCopy += `Ж/Д Составляющая: ${selectedLeg.cost}\n`;
    // Optionally add container info and comment from the selected leg if needed.
    // if (selectedLeg.containerInfo && selectedLeg.containerInfo !== 'N/A') textToCopy += `  Контейнер (Ж/Д): ${selectedLeg.containerInfo}\n`;
    // if (selectedLeg.comment && selectedLeg.comment !== '-') textToCopy += `  Комментарий (Ж/Д): ${selectedLeg.comment}\n`;
  }
  // Add other details from the main row if needed
  // if (row.additionalComment && row.additionalComment !== '-') textToCopy += `Комментарий (Море): ${row.additionalComment}\n`;

  return textToCopy.trim();
}

