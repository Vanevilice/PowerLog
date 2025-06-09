
import React from 'react';
import { Control, UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, MapPin, Users, FileText, Globe } from 'lucide-react';
import type { RouteFormValues, Translations } from '@/types'; // Using consolidated types
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization

interface DirectRailFormFieldsProps {
  form: UseFormReturn<RouteFormValues>; // Use consolidated RouteFormValues
  isParsingDirectRailFile: boolean;
  isDirectRailExcelDataLoaded: boolean;
  // Master lists from context (for initial checks or if filtered list is empty)
  directRailDepartureCities: string[]; 
  directRailDestinationCitiesDR: string[];
  masterAgentList: string[]; // Master list of all agents from Excel
  masterIncotermsList: string[]; // Master list of all incoterms from Excel
  masterBorderList: string[]; // Master list of all borders from Excel
  // Filtered lists from context (for dropdown options)
  localAvailableDirectRailAgents: string[];
  localAvailableDirectRailIncoterms: string[];
  localAvailableDirectRailBorders: string[];
}

export const DirectRailFormFields: React.FC<DirectRailFormFieldsProps> = ({
  form,
  isParsingDirectRailFile,
  isDirectRailExcelDataLoaded,
  directRailDepartureCities, 
  directRailDestinationCitiesDR, 
  masterAgentList, 
  masterIncotermsList,
  masterBorderList,
  localAvailableDirectRailAgents, 
  localAvailableDirectRailIncoterms, 
  localAvailableDirectRailBorders, 
}) => {
  const { control, watch } = form;
  const { translate } = useLocalization(); // Get translate function

  const watchedDepCity = watch("directRailCityOfDeparture");
  const watchedDestCity = watch("directRailDestinationCityDR");
  const watchedAgent = watch("directRailAgentName");
  const watchedIncoterms = watch("directRailIncoterms");

  const getDepCityPlaceholderKey = (): keyof Translations => {
    if (isParsingDirectRailFile) return "directRail_Placeholder_DepCity_Loading";
    if (!isDirectRailExcelDataLoaded) return "directRail_Placeholder_DepCity_NoData";
    if (directRailDepartureCities.length > 0) return "directRail_Placeholder_DepCity_Select";
    return "directRail_Placeholder_DepCity_NoCitiesInExcel";
  };

  const getDestCityPlaceholderKey = (): keyof Translations => {
    if (isParsingDirectRailFile) return "directRail_Placeholder_DestCity_Loading";
    if (!isDirectRailExcelDataLoaded) return "directRail_Placeholder_DestCity_NoData";
    if (directRailDestinationCitiesDR.length > 0) return "directRail_Placeholder_DestCity_Select";
    return "directRail_Placeholder_DestCity_NoCitiesInExcel";
  };

  const getAgentPlaceholderKey = (): keyof Translations => {
    if (isParsingDirectRailFile) return "directRail_Placeholder_Agent_Loading";
    if (!isDirectRailExcelDataLoaded) return "directRail_Placeholder_Agent_NoData";
    if (!watchedDepCity || !watchedDestCity) return "directRail_Placeholder_Agent_SelectCities";
    if (localAvailableDirectRailAgents.length > 0) return "directRail_Placeholder_Agent_Select";
    return masterAgentList.length > 0 ? "directRail_Placeholder_Agent_NoAgentsForSelection" : "directRail_Placeholder_Agent_NoAgentsInExcel";
  };

  const getIncotermsPlaceholderKey = (): keyof Translations => {
    if (isParsingDirectRailFile) return "directRail_Placeholder_Incoterms_Loading";
    if (!isDirectRailExcelDataLoaded) return "directRail_Placeholder_Incoterms_NoData";
    if (!watchedDepCity || !watchedDestCity) return "directRail_Placeholder_Incoterms_SelectCities";
    if (localAvailableDirectRailIncoterms.length > 0) return "directRail_Placeholder_Incoterms_Select";
    return masterIncotermsList.length > 0 ? "directRail_Placeholder_Incoterms_NoIncotermsForSelection" : "directRail_Placeholder_Incoterms_NoIncotermsInExcel";
  };

  const getBorderPlaceholderKey = (): keyof Translations => {
    if (isParsingDirectRailFile) return "directRail_Placeholder_Border_Loading";
    if (!isDirectRailExcelDataLoaded) return "directRail_Placeholder_Border_NoData";
    if (!watchedDepCity || !watchedDestCity || !watchedIncoterms ) return "directRail_Placeholder_Border_SelectIncoterms";
    if (localAvailableDirectRailBorders.length > 0) return "directRail_Placeholder_Border_Select";
    return masterBorderList.length > 0 ? "directRail_Placeholder_Border_NoBordersForSelection" : "directRail_Placeholder_Border_NoBordersInExcel";
  };


  return (
    <>
      <FormField
        control={control}
        name="directRailCityOfDeparture"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Route className="mr-2 h-4 w-4 text-primary" /> {translate('directRail_CityOfDeparture')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailDepartureCities.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getDepCityPlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailDepartureCities.map(city => <SelectItem key={'dr-dep-' + city} value={city}>{city}</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_dep_disabled" disabled>{translate("directRail_Placeholder_DepCity_Loading")}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_dep_disabled" disabled>{translate("directRail_Placeholder_DepCity_NoData")}</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailDepartureCities.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_dep_ports_loaded" disabled>{translate("directRail_Placeholder_DepCity_NoCitiesInExcel")}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="directRailDestinationCityDR"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> {translate('directRail_DestCity')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailDestinationCitiesDR.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getDestCityPlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailDestinationCitiesDR.map(city => <SelectItem key={'dr-dest-' + city} value={city}>{city}</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_dest_disabled" disabled>{translate("directRail_Placeholder_DestCity_Loading")}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_dest_disabled" disabled>{translate("directRail_Placeholder_DestCity_NoData")}</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailDestinationCitiesDR.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_dest_cities_loaded" disabled>{translate("directRail_Placeholder_DestCity_NoCitiesInExcel")}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="directRailAgentName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-primary" /> {translate('directRail_AgentName')}</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedDepCity || !watchedDestCity || (localAvailableDirectRailAgents.length === 0 && masterAgentList.length === 0 && !watchedIncoterms)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getAgentPlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailAgents.map(agent => <SelectItem key={'dr-agent-' + agent} value={agent}>{agent}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_agents" disabled>{translate("directRail_Placeholder_Agent_Loading")}</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_agents" disabled>{translate("directRail_Placeholder_Agent_NoData")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && (!watchedDepCity || !watchedDestCity) && <SelectItem value="select_cities_agents" disabled>{translate("directRail_Placeholder_Agent_SelectCities")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedDepCity && watchedDestCity && localAvailableDirectRailAgents.length === 0 && masterAgentList.length > 0 && <SelectItem value="no_agents_for_cities_or_incoterm" disabled>{translate("directRail_Placeholder_Agent_NoAgentsForSelection")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterAgentList.length === 0 && <SelectItem value="no_agents_in_excel" disabled>{translate("directRail_Placeholder_Agent_NoAgentsInExcel")}</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="directRailIncoterms"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary" /> {translate('directRail_Incoterms')}</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedDepCity || !watchedDestCity || (localAvailableDirectRailIncoterms.length === 0 && masterIncotermsList.length === 0 && !watchedAgent)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getIncotermsPlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailIncoterms.map(term => <SelectItem key={'dr-inco-' + term} value={term}>{term}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_incoterms" disabled>{translate("directRail_Placeholder_Incoterms_Loading")}</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_incoterms" disabled>{translate("directRail_Placeholder_Incoterms_NoData")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && (!watchedDepCity || !watchedDestCity) && <SelectItem value="select_cities_incoterms" disabled>{translate("directRail_Placeholder_Incoterms_SelectCities")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedDepCity && watchedDestCity && localAvailableDirectRailIncoterms.length === 0 && masterIncotermsList.length > 0 && <SelectItem value="no_incoterms_for_selection" disabled>{translate("directRail_Placeholder_Incoterms_NoIncotermsForSelection")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterIncotermsList.length === 0 && <SelectItem value="no_incoterms_in_excel" disabled>{translate("directRail_Placeholder_Incoterms_NoIncotermsInExcel")}</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="directRailBorder"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" /> {translate('directRail_Border')}</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedIncoterms || (localAvailableDirectRailBorders.length === 0 && masterBorderList.length === 0)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getBorderPlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailBorders.map(border => <SelectItem key={'dr-border-' + border} value={border}>{border}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_borders" disabled>{translate("directRail_Placeholder_Border_Loading")}</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_borders" disabled>{translate("directRail_Placeholder_Border_NoData")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && !watchedIncoterms && <SelectItem value="select_incoterms_borders" disabled>{translate("directRail_Placeholder_Border_SelectIncoterms")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedIncoterms && localAvailableDirectRailBorders.length === 0 && masterBorderList.length > 0 && <SelectItem value="no_borders_for_selection" disabled>{translate("directRail_Placeholder_Border_NoBordersForSelection")}</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterBorderList.length === 0 && <SelectItem value="no_borders_in_excel" disabled>{translate("directRail_Placeholder_Border_NoBordersInExcel")}</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
