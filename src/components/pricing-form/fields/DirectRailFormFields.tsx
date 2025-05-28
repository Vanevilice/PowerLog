
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
  directRailDepartureCities: string[];
  directRailDestinationCitiesDR: string[];
  directRailAgents: string[];
  directRailIncotermsList: string[];
  directRailBordersList: string[];
}

export const DirectRailFormFields: React.FC<DirectRailFormFieldsProps> = ({
  form,
  isParsingDirectRailFile,
  isDirectRailExcelDataLoaded,
  directRailDepartureCities,
  directRailDestinationCitiesDR,
  directRailAgents,
  directRailIncotermsList,
  directRailBordersList,
}) => {
  const { control } = form;

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
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailAgents.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingDirectRailFile ? "Processing..." : (isDirectRailExcelDataLoaded && directRailAgents.length > 0 ? "Select agent" : "Upload Прямое ЖД Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailAgents.map(agent => <SelectItem key={'dr-agent-' + agent} value={agent}>{agent}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_agent_disabled" disabled>Upload Прямое ЖД Excel</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailAgents.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_agents_loaded" disabled>No agents in Excel</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_agent_disabled" disabled>Loading agents...</SelectItem>)}
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
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailIncotermsList.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingDirectRailFile ? "Processing..." : (isDirectRailExcelDataLoaded && directRailIncotermsList.length > 0 ? "Select incoterms" : "Upload Прямое ЖД Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailIncotermsList.map(term => <SelectItem key={'dr-inco-' + term} value={term}>{term}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_inco_disabled" disabled>Upload Прямое ЖД Excel</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailIncotermsList.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_inco_loaded" disabled>No incoterms in Excel</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_inco_disabled" disabled>Loading incoterms...</SelectItem>)}
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
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!isDirectRailExcelDataLoaded || directRailBordersList.length === 0 || isParsingDirectRailFile}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingDirectRailFile ? "Processing..." : (isDirectRailExcelDataLoaded && directRailBordersList.length > 0 ? "Select border" : "Upload Прямое ЖД Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {directRailBordersList.map(border => <SelectItem key={'dr-border-' + border} value={border}>{border}</SelectItem>)}
                {(!isDirectRailExcelDataLoaded && !isParsingDirectRailFile) && (<SelectItem value="placeholder_dr_border_disabled" disabled>Upload Прямое ЖД Excel</SelectItem>)}
                {isDirectRailExcelDataLoaded && directRailBordersList.length === 0 && !isParsingDirectRailFile && (<SelectItem value="no_dr_borders_loaded" disabled>No borders in Excel</SelectItem>)}
                {isParsingDirectRailFile && (<SelectItem value="parsing_dr_border_disabled" disabled>Loading borders...</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

    