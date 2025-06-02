
import React from 'react';
import { Control, UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ship, Anchor, Package, Train, MapPinned, Home } from 'lucide-react';
import type { RouteFormValues, ShipmentType } from '@/types'; // Using consolidated types
import { CONTAINER_TYPES_CONST, NONE_SEALINE_VALUE } from '@/lib/pricing/constants';
import { getSeaLinePlaceholder, getArrivalStationPlaceholder } from '@/lib/pricing/ui-helpers'; // Removed getRussianCityPlaceholder

interface SeaRailFormFieldsProps {
  form: UseFormReturn<RouteFormValues>; // Use consolidated RouteFormValues
  isParsingSeaRailFile: boolean;
  isSeaRailExcelDataLoaded: boolean;
  excelOriginPorts: string[];
  localAvailableDestinationPorts: string[];
  localAvailableSeaLines: string[];
  excelRussianDestinationCitiesMasterList: string[]; // Still needed for check
  localAvailableRussianDestinationCities: string[]; // This will be populated more directly
  localAvailableArrivalStations: string[];
  hasRestoredFromCache: boolean;
}

export const SeaRailFormFields: React.FC<SeaRailFormFieldsProps> = ({
  form,
  isParsingSeaRailFile,
  isSeaRailExcelDataLoaded,
  excelOriginPorts,
  localAvailableDestinationPorts,
  localAvailableSeaLines,
  excelRussianDestinationCitiesMasterList, // Keep for condition checks
  localAvailableRussianDestinationCities, // Will be more directly populated
  localAvailableArrivalStations,
  hasRestoredFromCache,
}) => {
  const { control, watch, setValue, getValues } = form;
  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort"); // Sea port
  const watchedRussianDestinationCity = watch("russianDestinationCity"); // Rail destination

  const placeholderGetterArgsForSeaLine = {
    isParsingSeaRailFile,
    isSeaRailExcelDataLoaded,
    formGetValues: getValues,
    localAvailableSeaLines,
  };

  const placeholderGetterArgsForArrivalStation = {
    isParsingSeaRailFile,
    isSeaRailExcelDataLoaded,
    formGetValues: getValues,
    localAvailableArrivalStations,
  };

  const destinationPortPlaceholder = isParsingSeaRailFile
    ? "Processing..."
    : !isSeaRailExcelDataLoaded
    ? "Upload Море + Ж/Д Excel"
    : !watchedOriginPort
    ? "Select Origin Port First"
    : localAvailableDestinationPorts.length > 0
    ? "Владивосток"
    : "No destinations for origin";

  const getRussianCityPlaceholderDynamic = (): string => {
    if (isParsingSeaRailFile) return "Processing...";
    if (!isSeaRailExcelDataLoaded) return "Upload Море + Ж/Д Excel";
    // If origin port is not selected, it implies the user might not be ready or targeting a general best price
    if (!watchedOriginPort && excelRussianDestinationCitiesMasterList.length > 0) return "Select Origin Port first or proceed";
    if (localAvailableRussianDestinationCities.length > 0) return "Select city";
    if (excelRussianDestinationCitiesMasterList.length > 0 && localAvailableRussianDestinationCities.length === 0) return "No rail hubs for current Sea Port (if selected)";
    return "No rail destinations loaded";
  };


  return (
    <>
      <FormField
        control={control}
        name="shipmentType"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-primary" /> Shipment Type</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(value) => {
                  field.onChange(value as ShipmentType);
                  if (hasRestoredFromCache) {
                    setValue("destinationPort", "", { shouldValidate: true });
                    setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
                  }
                }}
                defaultValue={field.value}
                value={field.value}
                className="flex flex-row space-x-4"
              >
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value="COC" /></FormControl>
                  <FormLabel className="font-normal">COC</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value="SOC" /></FormControl>
                  <FormLabel className="font-normal">SOC</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="originPort"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-primary" /> Origin Port</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  if (hasRestoredFromCache) {
                    setValue("destinationPort", "", { shouldValidate: true });
                    setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
                    // setValue("russianDestinationCity", "", { shouldValidate: true }); // Don't clear Russian city here
                    setValue("arrivalStationSelection", "", { shouldValidate: true });
                  }
                }}
                value={field.value || ""}
                disabled={!isSeaRailExcelDataLoaded || excelOriginPorts.length === 0 || isParsingSeaRailFile}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isParsingSeaRailFile ? "Processing..." : (isSeaRailExcelDataLoaded && excelOriginPorts.length > 0 ? "Select origin port" : "Upload Море + Ж/Д Excel")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isSeaRailExcelDataLoaded && excelOriginPorts.map((port) => (<SelectItem key={"origin-" + port} value={port}>{port}</SelectItem>))}
                  {(!isSeaRailExcelDataLoaded && !isParsingSeaRailFile) && (<SelectItem value="placeholder_origin_disabled" disabled>Upload Море + Ж/Д Excel</SelectItem>)}
                  {isSeaRailExcelDataLoaded && excelOriginPorts.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_origin_ports_loaded" disabled>No origin ports in Excel</SelectItem>)}
                  {isParsingSeaRailFile && (<SelectItem value="parsing_origin_disabled" disabled>Loading ports...</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="destinationPort"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-primary" /> Destination Port (Sea)</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  if (hasRestoredFromCache) {
                    setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
                    // Do NOT clear russianDestinationCity here, it's independent for Best Price
                    // setValue("russianDestinationCity", "", { shouldValidate: true });
                    setValue("arrivalStationSelection", "", { shouldValidate: true });
                  }
                }}
                value={field.value || ""}
                disabled={!isSeaRailExcelDataLoaded || localAvailableDestinationPorts.length === 0 || isParsingSeaRailFile || !watchedOriginPort}
              >
                <FormControl>
                  <SelectTrigger>
                     <SelectValue placeholder={destinationPortPlaceholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {localAvailableDestinationPorts.map((port) => (<SelectItem key={"dest-" + port} value={port}>{port}</SelectItem>))}
                  {(!isSeaRailExcelDataLoaded && !isParsingSeaRailFile) && (<SelectItem value="placeholder_dest_disabled" disabled>Upload Excel</SelectItem>)}
                  {isParsingSeaRailFile && (<SelectItem value="parsing_dest_disabled" disabled>Loading ports...</SelectItem>)}
                  {isSeaRailExcelDataLoaded && !watchedOriginPort && !isParsingSeaRailFile && (<SelectItem value="select_origin_first_disabled" disabled>Select Origin Port First</SelectItem>)}
                  {isSeaRailExcelDataLoaded && watchedOriginPort && localAvailableDestinationPorts.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_dest_for_origin_disabled" disabled>No destinations for origin</SelectItem>)}
                </SelectContent>
              </Select>
              {/* <FormMessage /> Removed to prevent error message for this field */}
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="seaLineCompany"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Anchor className="mr-2 h-4 w-4 text-primary" /> Sea Line Company</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || NONE_SEALINE_VALUE}
              disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded || (!watchedOriginPort || !watchedDestinationPort) || (localAvailableSeaLines.length === 0 && isSeaRailExcelDataLoaded && !!watchedOriginPort && !!watchedDestinationPort)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getSeaLinePlaceholder(placeholderGetterArgsForSeaLine)} /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_SEALINE_VALUE}>None (Get General Commentary)</SelectItem>
                {localAvailableSeaLines.map((line) => (<SelectItem key={"line-" + line} value={line}>{line}</SelectItem>))}
                {isParsingSeaRailFile && (<SelectItem value="parsing_sealine_disabled" disabled>Loading...</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_sealine_disabled" disabled>Upload Море + Ж/Д Excel</SelectItem>)}
                {!isParsingSeaRailFile && isSeaRailExcelDataLoaded && (!watchedOriginPort || !watchedDestinationPort) && (<SelectItem value="select_od_sealine_disabled" disabled>Select Origin &amp; Dest</SelectItem>)}
                {!isParsingSeaRailFile && isSeaRailExcelDataLoaded && watchedOriginPort && watchedDestinationPort && localAvailableSeaLines.length === 0 && (<SelectItem value="no_sea_lines_disabled" disabled>No lines for this O/D</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="containerType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-primary" /> Container Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""} disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded}>
              <FormControl><SelectTrigger><SelectValue placeholder={isParsingSeaRailFile ? "Processing..." : (isSeaRailExcelDataLoaded ? "Select container type" : "Upload Море + Ж/Д Excel")} /></SelectTrigger></FormControl>
              <SelectContent>
                {CONTAINER_TYPES_CONST.map((type) => (<SelectItem key={"container-" + type} value={type}>{type}</SelectItem>))}
                {isParsingSeaRailFile && (<SelectItem value="parsing_container_disabled" disabled>Loading...</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_container_disabled" disabled>Upload Море + Ж/Д Excel</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="russianDestinationCity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Train className="mr-2 h-4 w-4 text-primary" /> Destination City</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                if (hasRestoredFromCache) setValue("arrivalStationSelection", "", { shouldValidate: true });
              }}
              value={field.value || ""}
              disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded || localAvailableRussianDestinationCities.length === 0 }
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getRussianCityPlaceholderDynamic()} /></SelectTrigger></FormControl>
              <SelectContent>
                {isParsingSeaRailFile && (<SelectItem value="parsing_rus_dest_disabled" disabled>Loading cities...</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_rus_dest_disabled" disabled>Upload Море + Ж/Д Excel</SelectItem>)}
                {isSeaRailExcelDataLoaded && localAvailableRussianDestinationCities.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_rail_cities_master_disabled" disabled>No rail cities in Excel</SelectItem>)}
                {isSeaRailExcelDataLoaded && localAvailableRussianDestinationCities.map((city) => (<SelectItem key={"rus-city-" + city} value={city}>{city}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="arrivalStationSelection"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><MapPinned className="mr-2 h-4 w-4 text-primary" /> Station</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || ""}
              disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded || !watchedRussianDestinationCity || localAvailableArrivalStations.length === 0}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={getArrivalStationPlaceholder(placeholderGetterArgsForArrivalStation)} /></SelectTrigger></FormControl>
              <SelectContent>
                {isParsingSeaRailFile && (<SelectItem value="parsing_arrival_station_disabled" disabled>Loading...</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_arrival_disabled" disabled>Upload Море + Ж/Д Excel</SelectItem>)}
                {isSeaRailExcelDataLoaded && !watchedRussianDestinationCity && !isParsingSeaRailFile && (<SelectItem value="select_city_first_disabled" disabled>Select Destination City</SelectItem>)}
                {isSeaRailExcelDataLoaded && watchedRussianDestinationCity && localAvailableArrivalStations.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_stations_for_city_disabled" disabled>No stations for this city</SelectItem>)}
                {localAvailableArrivalStations.map((station) => (<SelectItem key={"arrival-station-" + station} value={station}>{station}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
