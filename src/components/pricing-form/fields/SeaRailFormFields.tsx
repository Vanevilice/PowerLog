
import React from 'react';
import { Control, UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ship, Anchor, Package, Train, MapPinned, Home } from 'lucide-react';
import type { RouteFormValues, ShipmentType } from '@/types'; // Using consolidated types
import { CONTAINER_TYPES_CONST, NONE_SEALINE_VALUE, VLADIVOSTOK_VARIANTS } from '@/lib/pricing/constants';
import { getSeaLinePlaceholder, getArrivalStationPlaceholder, getRussianCityPlaceholder } from '@/lib/pricing/ui-helpers';
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization

interface SeaRailFormFieldsProps {
  form: UseFormReturn<RouteFormValues>;
  isParsingSeaRailFile: boolean;
  isSeaRailExcelDataLoaded: boolean;
  excelOriginPorts: string[];
  localAvailableDestinationPorts: string[];
  localAvailableSeaLines: string[];
  excelRussianDestinationCitiesMasterList: string[];
  localAvailableRussianDestinationCities: string[];
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
  excelRussianDestinationCitiesMasterList,
  localAvailableRussianDestinationCities,
  localAvailableArrivalStations,
  hasRestoredFromCache,
}) => {
  const { control, watch, setValue, getValues } = form;
  const { translate } = useLocalization(); // Get translate function

  const watchedOriginPort = watch("originPort");
  const watchedDestinationPort = watch("destinationPort"); // Sea port
  const watchedContainerType = watch("containerType");
  const watchedRussianDestinationCity = watch("russianDestinationCity");

  const placeholderGetterArgsForSeaLine = {
    isParsingSeaRailFile,
    isSeaRailExcelDataLoaded,
    formGetValues: getValues,
    localAvailableSeaLines,
  };

  const placeholderGetterArgsForRussianCity = {
    isParsingSeaRailFile,
    isSeaRailExcelDataLoaded,
    formGetValues: getValues,
    excelRussianDestinationCitiesMasterList,
    localAvailableRussianDestinationCities,
  };

  const placeholderGetterArgsForArrivalStation = {
    isParsingSeaRailFile,
    isSeaRailExcelDataLoaded,
    formGetValues: getValues,
    localAvailableArrivalStations,
  };

  const getOriginPortPlaceholderKey = (): keyof import('@/contexts/LocalizationContext').Translations => {
    if (isParsingSeaRailFile) return "originPortPlaceholder_Loading";
    if (!isSeaRailExcelDataLoaded) return "originPortPlaceholder_NoData";
    if (excelOriginPorts.length > 0) return "originPortPlaceholder_Select";
    return "originPort_NoOriginPortsInExcel";
  };
  
  const getDestinationPortPlaceholderKey = (): keyof import('@/contexts/LocalizationContext').Translations => {
    if (isParsingSeaRailFile) return "destinationPortSeaPlaceholder_Loading";
    if (!isSeaRailExcelDataLoaded) return "destinationPortSeaPlaceholder_NoData";
    if (!watchedOriginPort) return "destinationPortSeaPlaceholder_SelectOrigin";
    if (localAvailableDestinationPorts.length > 0) {
      return localAvailableDestinationPorts.find(p => VLADIVOSTOK_VARIANTS.some(v => p.startsWith(v.split(" ")[0]))) ? "destPort_Placeholder_Vladivostok" : "destinationPortSeaPlaceholder_Select";
    }
    return "destinationPortSeaPlaceholder_NoDestForOrigin";
  };

  const getContainerTypePlaceholderKey = (): keyof import('@/contexts/LocalizationContext').Translations => {
    if (isParsingSeaRailFile) return "containerTypePlaceholder_Loading";
    if (!isSeaRailExcelDataLoaded) return "containerTypePlaceholder_NoData";
    return "containerTypePlaceholder_Select";
  };


  return (
    <>
      <FormField
        control={control}
        name="shipmentType"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-primary" /> {translate('shipmentType')}</FormLabel>
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
                  <FormLabel className="font-normal">{translate('shipmentType_COC')}</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value="SOC" /></FormControl>
                  <FormLabel className="font-normal">{translate('shipmentType_SOC')}</FormLabel>
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
              <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-primary" /> {translate('originPort')}</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  if (hasRestoredFromCache) {
                    setValue("destinationPort", "", { shouldValidate: true });
                    setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
                    setValue("russianDestinationCity", "", { shouldValidate: true });
                    setValue("arrivalStationSelection", "", { shouldValidate: true });
                  }
                }}
                value={field.value || ""}
                disabled={!isSeaRailExcelDataLoaded || excelOriginPorts.length === 0 || isParsingSeaRailFile}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={translate(getOriginPortPlaceholderKey())} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isSeaRailExcelDataLoaded && excelOriginPorts.map((port) => (<SelectItem key={"origin-" + port} value={port}>{port}</SelectItem>))}
                  {(!isSeaRailExcelDataLoaded && !isParsingSeaRailFile) && (<SelectItem value="placeholder_origin_disabled" disabled>{translate("originPortPlaceholder_NoData")}</SelectItem>)}
                  {isSeaRailExcelDataLoaded && excelOriginPorts.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_origin_ports_loaded" disabled>{translate("originPort_NoOriginPortsInExcel")}</SelectItem>)}
                  {isParsingSeaRailFile && (<SelectItem value="parsing_origin_disabled" disabled>{translate("originPortPlaceholder_Loading")}</SelectItem>)}
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
              <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-primary" /> {translate('destinationPortSea')}</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  if (hasRestoredFromCache) {
                    setValue("seaLineCompany", NONE_SEALINE_VALUE, { shouldValidate: true });
                    setValue("russianDestinationCity", "", { shouldValidate: true });
                    setValue("arrivalStationSelection", "", { shouldValidate: true });
                  }
                }}
                value={field.value || ""}
                disabled={!isSeaRailExcelDataLoaded || localAvailableDestinationPorts.length === 0 || isParsingSeaRailFile || !watchedOriginPort}
              >
                <FormControl>
                  <SelectTrigger>
                     <SelectValue placeholder={translate(getDestinationPortPlaceholderKey())} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {localAvailableDestinationPorts.map((port) => (<SelectItem key={"dest-" + port} value={port}>{port}</SelectItem>))}
                  {(!isSeaRailExcelDataLoaded && !isParsingSeaRailFile) && (<SelectItem value="placeholder_dest_disabled" disabled>{translate("destinationPortSeaPlaceholder_NoData")}</SelectItem>)}
                  {isParsingSeaRailFile && (<SelectItem value="parsing_dest_disabled" disabled>{translate("destinationPortSeaPlaceholder_Loading")}</SelectItem>)}
                  {isSeaRailExcelDataLoaded && !watchedOriginPort && !isParsingSeaRailFile && (<SelectItem value="select_origin_first_disabled" disabled>{translate("destinationPortSea_SelectOriginFirst")}</SelectItem>)}
                  {isSeaRailExcelDataLoaded && watchedOriginPort && localAvailableDestinationPorts.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_dest_for_origin_disabled" disabled>{translate("destinationPortSea_NoDestForOrigin")}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* <FormMessage /> Removed to prevent error message for this field */}
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="containerType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-primary" /> {translate('containerType')}</FormLabel>
            <Select 
             onValueChange={(value) => {
                field.onChange(value);
                if (hasRestoredFromCache) {
                  setValue("russianDestinationCity", "", { shouldValidate: true });
                  setValue("arrivalStationSelection", "", { shouldValidate: true });
                }
              }}
            value={field.value || ""} 
            disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getContainerTypePlaceholderKey())} /></SelectTrigger></FormControl>
              <SelectContent>
                {CONTAINER_TYPES_CONST.map((type) => (<SelectItem key={"container-" + type} value={type}>{type}</SelectItem>))}
                {isParsingSeaRailFile && (<SelectItem value="parsing_container_disabled" disabled>{translate("containerTypePlaceholder_Loading")}</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_container_disabled" disabled>{translate("containerTypePlaceholder_NoData")}</SelectItem>)}
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
            <FormLabel className="flex items-center"><Train className="mr-2 h-4 w-4 text-primary" /> {translate('destinationCityRail')}</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                if (hasRestoredFromCache) setValue("arrivalStationSelection", "", { shouldValidate: true });
              }}
              value={field.value || ""}
              disabled={
                isParsingSeaRailFile || 
                !isSeaRailExcelDataLoaded || 
                excelRussianDestinationCitiesMasterList.length === 0 || 
                !watchedOriginPort || 
                !watchedContainerType ||
                (watchedOriginPort && watchedContainerType && localAvailableRussianDestinationCities.length === 0)
              }
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getRussianCityPlaceholder(placeholderGetterArgsForRussianCity))} /></SelectTrigger></FormControl>
              <SelectContent>
                {isParsingSeaRailFile && (<SelectItem value="parsing_rus_dest_disabled" disabled>{translate("destinationCityRailPlaceholder_Loading")}</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_rus_dest_disabled" disabled>{translate("destinationCityRailPlaceholder_NoData")}</SelectItem>)}
                {isSeaRailExcelDataLoaded && excelRussianDestinationCitiesMasterList.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_rail_cities_master_disabled" disabled>{translate("destinationCityRail_NoRailCitiesMaster")}</SelectItem>)}
                
                {isSeaRailExcelDataLoaded && excelRussianDestinationCitiesMasterList.length > 0 && !watchedOriginPort && !isParsingSeaRailFile && (<SelectItem value="select_origin_first_for_rus_dest_disabled" disabled>{translate(getRussianCityPlaceholder(placeholderGetterArgsForRussianCity))}</SelectItem>)}
                {isSeaRailExcelDataLoaded && excelRussianDestinationCitiesMasterList.length > 0 && watchedOriginPort && !watchedContainerType && !isParsingSeaRailFile && (<SelectItem value="select_container_first_for_rus_dest_disabled" disabled>{translate(getRussianCityPlaceholder(placeholderGetterArgsForRussianCity))}</SelectItem>)}
                                
                {isSeaRailExcelDataLoaded && watchedOriginPort && watchedContainerType && localAvailableRussianDestinationCities.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_rail_cities_for_selection_disabled" disabled>{translate(getRussianCityPlaceholder(placeholderGetterArgsForRussianCity))}</SelectItem>)}
                
                {isSeaRailExcelDataLoaded && localAvailableRussianDestinationCities.map((city) => (<SelectItem key={"rus-city-" + city} value={city}>{city}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="seaLineCompany"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Anchor className="mr-2 h-4 w-4 text-primary" /> {translate('seaLineCompany')}</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || NONE_SEALINE_VALUE}
              disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded || (!watchedOriginPort || !watchedDestinationPort) || (localAvailableSeaLines.length === 0 && isSeaRailExcelDataLoaded && !!watchedOriginPort && !!watchedDestinationPort)}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getSeaLinePlaceholder(placeholderGetterArgsForSeaLine))} /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_SEALINE_VALUE}>{translate("seaLineCompany_NoneOption")}</SelectItem>
                {localAvailableSeaLines.map((line) => (<SelectItem key={"line-" + line} value={line}>{line}</SelectItem>))}
                {isParsingSeaRailFile && (<SelectItem value="parsing_sealine_disabled" disabled>{translate("seaLineCompanyPlaceholder_Loading")}</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_sealine_disabled" disabled>{translate("seaLineCompanyPlaceholder_NoData")}</SelectItem>)}
                {!isParsingSeaRailFile && isSeaRailExcelDataLoaded && (!watchedOriginPort || !watchedDestinationPort) && (<SelectItem value="select_od_sealine_disabled" disabled>{translate("seaLineCompany_SelectODFirst")}</SelectItem>)}
                {!isParsingSeaRailFile && isSeaRailExcelDataLoaded && watchedOriginPort && watchedDestinationPort && localAvailableSeaLines.length === 0 && (<SelectItem value="no_sea_lines_disabled" disabled>{translate("seaLineCompanyPlaceholder_NoLinesForOD")}</SelectItem>)}
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
            <FormLabel className="flex items-center"><MapPinned className="mr-2 h-4 w-4 text-primary" /> {translate('stationRail')}</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || ""}
              disabled={isParsingSeaRailFile || !isSeaRailExcelDataLoaded || !watchedRussianDestinationCity || localAvailableArrivalStations.length === 0}
            >
              <FormControl><SelectTrigger><SelectValue placeholder={translate(getArrivalStationPlaceholder(placeholderGetterArgsForArrivalStation))} /></SelectTrigger></FormControl>
              <SelectContent>
                {isParsingSeaRailFile && (<SelectItem value="parsing_arrival_station_disabled" disabled>{translate("stationRailPlaceholder_Loading")}</SelectItem>)}
                {!isSeaRailExcelDataLoaded && !isParsingSeaRailFile && (<SelectItem value="upload_excel_arrival_disabled" disabled>{translate("stationRailPlaceholder_NoData")}</SelectItem>)}
                {isSeaRailExcelDataLoaded && !watchedRussianDestinationCity && !isParsingSeaRailFile && (<SelectItem value="select_city_first_disabled" disabled>{translate("stationRail_SelectDestCityFirst")}</SelectItem>)}
                {isSeaRailExcelDataLoaded && watchedRussianDestinationCity && localAvailableArrivalStations.length === 0 && !isParsingSeaRailFile && (<SelectItem value="no_stations_for_city_disabled" disabled>{translate("stationRailPlaceholder_NoStationsForCity")}</SelectItem>)}
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

