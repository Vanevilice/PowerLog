
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { partialEnTranslations } from '@/locales/en'; // Import partial English translations
import { partialRuTranslations } from '@/locales/ru'; // Import partial Russian translations

// Define available languages
export type Language = 'en' | 'ru';

// Define the shape of the translations object
export interface Translations {
  // Common
  settings: string;
  english: string;
  russian: string;
  common_NA: string;
  common_Dash: string;

  // PortPriceFinderForm specific (already moved to partials, but keys remain for type safety)
  powerLogTitle: string;
  powerLogDescription: string;
  uploadSeaRailExcel: string;
  uploadDirectRailExcel: string;
  uploadSOCDropOffExcel: string;
  processingFile: string;
  calculationMode: string;
  calculationMode_SeaRail: string;
  calculationMode_DirectRail: string;
  seaMargin: string;
  railMargin: string;
  shipmentType: string;
  shipmentType_COC: string;
  shipmentType_SOC: string;
  originPort: string;
  destinationPortSea: string;
  seaLineCompany: string;
  containerType: string;
  destinationCityRail: string;
  stationRail: string;
  originPortPlaceholder_Loading: string;
  originPortPlaceholder_NoData: string;
  originPortPlaceholder_Select: string;
  originPort_NoOriginPortsInExcel: string;
  destinationPortSeaPlaceholder_Loading: string;
  destinationPortSeaPlaceholder_NoData: string;
  destinationPortSeaPlaceholder_SelectOrigin: string;
  destinationPortSeaPlaceholder_Select: string;
  destinationPortSeaPlaceholder_NoDestForOrigin: string;
  destPort_Placeholder_Vladivostok: string;
  destinationPortSea_SelectOriginFirst: string;
  destinationPortSea_NoDestForOrigin: string;
  seaLineCompanyPlaceholder_Loading: string;
  seaLineCompanyPlaceholder_NoData: string;
  seaLineCompanyPlaceholder_SelectOD: string;
  seaLineCompanyPlaceholder_Select: string;
  seaLineCompanyPlaceholder_NoLinesForOD: string;
  seaLineCompany_NoneOption: string;
  seaLineCompany_SelectODFirst: string;
  containerTypePlaceholder_Loading: string;
  containerTypePlaceholder_NoData: string;
  containerTypePlaceholder_Select: string;
  destinationCityRailPlaceholder_Loading: string;
  destinationCityRailPlaceholder_NoData: string;
  destinationCityRailPlaceholder_NoRailDestLoaded: string;
  destinationCityRailPlaceholder_SelectOrigin: string;
  destinationCityRailPlaceholder_SelectContainer: string;
  destinationCityRailPlaceholder_SelectOriginContainer: string;
  destinationCityRailPlaceholder_Select: string;
  destinationCityRailPlaceholder_NoHubsForSelection: string;
  rusCity_Placeholder_NoRailHubsForSeaDest: string;
  destinationCityRail_NoRailCitiesMaster: string;
  stationRailPlaceholder_Loading: string;
  stationRailPlaceholder_NoData: string;
  stationRailPlaceholder_SelectDestCity: string;
  stationRailPlaceholder_Select: string;
  stationRailPlaceholder_NoStationsForCity: string;
  stationRail_SelectDestCityFirst: string;
  getPriceAndCommentary: string;
  calculateBestPrice: string;
  calculating: string;
  processingButton: string;
  loading_CalculatingBestPrices: string;
  loading_ProcessingFile: string;
  loading_GettingInfo: string;
  loading_MayTakeMoment: string;
  placeholder_UploadSeaRailExcel: string;
  placeholder_UploadDirectRailExcel: string;
  directRail_CityOfDeparture: string;
  directRail_DestCity: string;
  directRail_AgentName: string;
  directRail_Incoterms: string;
  directRail_Border: string;
  directRail_Placeholder_DepCity_Loading: string;
  directRail_Placeholder_DepCity_NoData: string;
  directRail_Placeholder_DepCity_Select: string;
  directRail_Placeholder_DepCity_NoCitiesInExcel: string;
  directRail_Placeholder_DestCity_Loading: string;
  directRail_Placeholder_DestCity_NoData: string;
  directRail_Placeholder_DestCity_Select: string;
  directRail_Placeholder_DestCity_NoCitiesInExcel: string;
  directRail_Placeholder_Agent_Loading: string;
  directRail_Placeholder_Agent_NoData: string;
  directRail_Placeholder_Agent_SelectCities: string;
  directRail_Placeholder_Agent_Select: string;
  directRail_Placeholder_Agent_NoAgentsForSelection: string;
  directRail_Placeholder_Agent_NoAgentsInExcel: string;
  directRail_Placeholder_Incoterms_Loading: string;
  directRail_Placeholder_Incoterms_NoData: string;
  directRail_Placeholder_Incoterms_SelectCities: string;
  directRail_Placeholder_Incoterms_Select: string;
  directRail_Placeholder_Incoterms_NoIncotermsForSelection: string;
  directRail_Placeholder_Incoterms_NoIncotermsInExcel: string;
  directRail_Placeholder_Border_Loading: string;
  directRail_Placeholder_Border_NoData: string;
  directRail_Placeholder_Border_SelectIncoterms: string;
  directRail_Placeholder_Border_Select: string;
  directRail_Placeholder_Border_NoBordersForSelection: string;
  directRail_Placeholder_Border_NoBordersInExcel: string;
  select_disabled_UploadExcel: string;
  select_disabled_LoadingOptions: string;
  select_disabled_NoOptionsLoaded: string;
  select_disabled_SelectDependencyFirst: (fieldName: string) => string,
  select_disabled_NoOptionsForSelection: string;
  select_disabled_NoOptionsInExcel: string;

  // NavLinks
  nav_Dashboard: string;
  nav_Calculator: string;
  nav_Settings: string;

  // Dashboard Page Translations
  dashboard_DataNotLoaded_Title: string;
  dashboard_DataNotLoaded_Description: string;
  dashboard_DataNotLoaded_Button: string;
  dashboard_NoDataFound_Title: string;
  dashboard_NoDataFound_Description: string;
  dashboard_BackToCalculator_Button: string;
  dashboard_MainTitle: string;
  dashboard_MainDescription: string;
  dashboard_ServiceSection_FallbackTitle: string; // Expects {{sectionNumber}}
  dashboard_TableHead_Route: string;
  dashboard_TableHead_SeaRate: string;
  dashboard_TableHead_ContainerInfo: string;
  dashboard_TableHead_CommentsDetails: string;
  dashboard_TableHead_Actions: string;
  dashboard_CopyRate_Button: string;
  dashboard_RailwayLegs_Title: string;
  dashboard_RailwayLegs_OriginInfo: string;
  dashboard_RailwayLegs_Cost: string;
  dashboard_RailwayLegs_Container: string;
  dashboard_RailwayLegs_Comment: string;
  dashboard_NoServicesFound_Title: string;
  dashboard_NoServicesFound_Description: string;
  dashboard_NoDataRowsForService: string;

  // Toast Messages (some might be reusable later)
  toast_Success_Title: string;
  toast_Dashboard_RateCopied: string;
  toast_CopyFailed_Title: string;
  toast_CopyFailed_Description: string;
}

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: Translations;
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

// Default English translations - now only common keys and the function.
const defaultEnTranslations: Partial<Translations> = {
  settings: "Settings",
  english: "English",
  russian: "Russian",
  common_NA: "N/A",
  common_Dash: "-",
  select_disabled_SelectDependencyFirst: (fieldName: string) => `Select ${fieldName} first`,
  nav_Dashboard: "Dashboard",
  nav_Calculator: "Calculator",
  nav_Settings: "Settings",
  toast_Success_Title: "Success!",
  toast_CopyFailed_Title: "Copy Failed",
  toast_CopyFailed_Description: "Could not copy to clipboard.",
};

const translationsData: Record<Language, Partial<Translations>> = {
  en: {
    // Form-specific keys come from partialEnTranslations
    // Dashboard specific keys also come from partialEnTranslations via src/locales/en/index.ts
  },
  ru: {
    // Common Russian translations remain
    settings: "Настройки",
    english: "Английский",
    russian: "Русский",
    common_NA: "Н/Д",
    common_Dash: "-",
    select_disabled_SelectDependencyFirst: (fieldName: string) => `Сначала выберите ${fieldName}`,
    nav_Dashboard: "Дашборд",
    nav_Calculator: "Калькулятор",
    nav_Settings: "Настройки",
    toast_Success_Title: "Успех!",
    toast_CopyFailed_Title: "Ошибка копирования",
    toast_CopyFailed_Description: "Не удалось скопировать в буфер обмена.",
  },
};

export const LocalizationProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('ru'); // Default to Russian

  const currentTranslations = React.useMemo(() => {
    let mergedTranslations: Partial<Translations>;
    if (language === 'en') {
      mergedTranslations = {
        ...defaultEnTranslations,     // Common EN keys and the function
        ...partialEnTranslations,   // PortPriceFinderForm specific EN keys & Dashboard EN Keys
      };
    } else { // language === 'ru'
      mergedTranslations = {
        ...defaultEnTranslations,     // Base: Common EN keys and the function
        ...translationsData.ru,     // Override common keys with RU versions
        ...partialRuTranslations,   // PortPriceFinderForm specific RU keys & Dashboard RU Keys
      };
    }
    return mergedTranslations as Translations; // Assume all keys are covered by the merge
  }, [language]);

  const translate = useCallback((key: keyof Translations, replacements?: Record<string, string | number>) => {
    let translationValue = currentTranslations[key] || key;
    if (typeof translationValue === 'function') {
        const depKey = replacements && Object.keys(replacements)[0];
        const depValue = depKey && replacements ? String(replacements[depKey]) : '';
        return (translationValue as (dep: string) => string)(depValue || 'field');
    }
    let translationString = String(translationValue);
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translationString = translationString.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(replacements[placeholder]));
      });
    }
    return translationString;
  }, [currentTranslations]);


  return (
    <LocalizationContext.Provider value={{ language, setLanguage, translations: currentTranslations, translate }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

    