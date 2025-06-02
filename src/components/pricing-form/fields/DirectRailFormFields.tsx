
import React from 'react';
import { Control, UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, MapPin, Users, FileText, Globe } from 'lucide-react';
import type { RouteFormValues } from '@/types'; // Using consolidated types

interface DirectRailFormFieldsProps {
  form: UseFormReturn<RouteFormValues>; // Use consolidated RouteFormValues
  isParsingDirectRailFile: boolean;
  isDirectRailExcelDataLoaded: boolean;
  // Master lists from context (for initial checks or if filtered list is empty)
  directRailDepartureCities: string[]; 
  directRailDestinationCitiesDR: string[];
  masterAgentList: string[];
  masterIncotermsList: string[];
  masterBorderList: string[];
  // Filtered lists from context (for dropdown options)
  localAvailableDirectRailAgents: string[];
  localAvailableDirectRailIncoterms: string[];
  localAvailableDirectRailBorders: string[];
}

export const DirectRailFormFields: React.FC<DirectRailFormFieldsProps> = ({
  form,
  isParsingDirectRailFile,
  isDirectRailExcelDataLoaded,
  directRailDepartureCities, // Master list
  directRailDestinationCitiesDR, // Master list
  masterAgentList, // Master list
  masterIncotermsList, // Master list
  masterBorderList, // Master list
  localAvailableDirectRailAgents, // Filtered list
  localAvailableDirectRailIncoterms, // Filtered list
  localAvailableDirectRailBorders, // Filtered list
}) => {
  const { control, watch } = form;
  const watchedDepCity = watch("directRailCityOfDeparture");
  const watchedDestCity = watch("directRailDestinationCityDR");
  const watchedAgent = watch("directRailAgentName");
  const watchedIncoterms = watch("directRailIncoterms");

  const getAgentPlaceholder = () => {
    if (isParsingDirectRailFile) return "Processing...";
    if (!isDirectRailExcelDataLoaded) return "Upload Прямое ЖД Excel";
    if (!watchedDepCity || !watchedDestCity) return "Select Departure & Destination Cities";
    if (localAvailableDirectRailAgents.length > 0) return "Select agent";
    return masterAgentList.length > 0 ? "No agents for selected cities" : "No agents in Excel";
  };

  const getIncotermsPlaceholder = () => {
    if (isParsingDirectRailFile) return "Processing...";
    if (!isDirectRailExcelDataLoaded) return "Upload Прямое ЖД Excel";
    if (!watchedDepCity || !watchedDestCity || !watchedAgent) return "Select Cities & Agent";
    if (localAvailableDirectRailIncoterms.length > 0) return "Select incoterms";
    return masterIncotermsList.length > 0 ? "No incoterms for selection" : "No incoterms in Excel";
  };

  const getBorderPlaceholder = () => {
    if (isParsingDirectRailFile) return "Processing...";
    if (!isDirectRailExcelDataLoaded) return "Upload Прямое ЖД Excel";
    if (!watchedDepCity || !watchedDestCity || !watchedAgent || !watchedIncoterms) return "Select Cities, Agent & Incoterms";
    if (localAvailableDirectRailBorders.length > 0) return "Select border";
    return masterBorderList.length > 0 ? "No borders for selection" : "No borders in Excel";
  };


  return (
    <>
      <FormField
        control={control}
        name="directRailCityOfDeparture"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Route className="mr-2 h-4 w-4 text-primary" /> City of Departure</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailDepartureCities.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingDirectRailFile ? "Processing..." : (isDirectRailExcelDataLoaded && directRailDepartureCities.length > 0 ? "Select departure city" : "Upload Прямое ЖД Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailDepartureCities.map(city => <SelectItem key={'dr-dep-' + city} value={city}>{city}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_dep_disabled" disabled>Upload Прямое ЖД Excel</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailDepartureCities.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_dep_ports_loaded" disabled>No departure cities in Excel</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_dep_disabled" disabled>Loading cities...</SelectItem>)}
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
            <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Destination City</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailDestinationCitiesDR.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingDirectRailFile ? "Processing..." : (isDirectRailExcelDataLoaded && directRailDestinationCitiesDR.length > 0 ? "Select destination city" : "Upload Прямое ЖД Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailDestinationCitiesDR.map(city => <SelectItem key={'dr-dest-' + city} value={city}>{city}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_dest_disabled" disabled>Upload Прямое ЖД Excel</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailDestinationCitiesDR.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_dest_cities_loaded" disabled>No destination cities in Excel</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_dest_disabled" disabled>Loading cities...</SelectItem>)}
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
            <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-primary" /> Agent name</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedDepCity || !watchedDestCity || (localAvailableDirectRailAgents.length === 0 && masterAgentList.length === 0)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getAgentPlaceholder()} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailAgents.map(agent => <SelectItem key={'dr-agent-' + agent} value={agent}>{agent}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_agents" disabled>Loading agents...</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_agents" disabled>Upload Прямое ЖД Excel</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && (!watchedDepCity || !watchedDestCity) && <SelectItem value="select_cities_agents" disabled>Select Departure & Destination Cities</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedDepCity && watchedDestCity && localAvailableDirectRailAgents.length === 0 && masterAgentList.length > 0 && <SelectItem value="no_agents_for_cities" disabled>No agents for selected cities</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterAgentList.length === 0 && <SelectItem value="no_agents_in_excel" disabled>No agents in Excel</SelectItem>}
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
            <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary" /> Incoterms</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedAgent || (localAvailableDirectRailIncoterms.length === 0 && masterIncotermsList.length === 0)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getIncotermsPlaceholder()} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailIncoterms.map(term => <SelectItem key={'dr-inco-' + term} value={term}>{term}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_incoterms" disabled>Loading incoterms...</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_incoterms" disabled>Upload Прямое ЖД Excel</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && !watchedAgent && <SelectItem value="select_agent_incoterms" disabled>Select Agent first</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedAgent && localAvailableDirectRailIncoterms.length === 0 && masterIncotermsList.length > 0 && <SelectItem value="no_incoterms_for_selection" disabled>No incoterms for selection</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterIncotermsList.length === 0 && <SelectItem value="no_incoterms_in_excel" disabled>No incoterms in Excel</SelectItem>}
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
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" /> Border</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""} 
              disabled={isParsingDirectRailFile || !isDirectRailExcelDataLoaded || !watchedIncoterms || (localAvailableDirectRailBorders.length === 0 && masterBorderList.length === 0)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getBorderPlaceholder()} /></SelectTrigger></FormControl>
              <SelectContent>
                {localAvailableDirectRailBorders.map(border => <SelectItem key={'dr-border-' + border} value={border}>{border}</SelectItem>)}
                {isParsingDirectRailFile && <SelectItem value="parsing_borders" disabled>Loading borders...</SelectItem>}
                {!isParsingDirectRailFile && !isDirectRailExcelDataLoaded && <SelectItem value="upload_excel_borders" disabled>Upload Прямое ЖД Excel</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && !watchedIncoterms && <SelectItem value="select_incoterms_borders" disabled>Select Incoterms first</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && watchedIncoterms && localAvailableDirectRailBorders.length === 0 && masterBorderList.length > 0 && <SelectItem value="no_borders_for_selection" disabled>No borders for selection</SelectItem>}
                {!isParsingDirectRailFile && isDirectRailExcelDataLoaded && masterBorderList.length === 0 && <SelectItem value="no_borders_in_excel" disabled>No borders in Excel</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

    