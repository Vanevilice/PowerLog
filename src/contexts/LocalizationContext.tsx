
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Define available languages
export type Language = 'en' | 'ru';

// Define the shape of the translations object
export interface Translations {
  // Common
  settings: string;
  english: string;
  russian: string;

  // PortPriceFinderForm specific
  powerLogTitle: string;
  powerLogDescription: string;
  powerLogDescription_RU_ONLY_REMOVED?: string; // Special key for RU

  uploadSeaRailExcel: string;
  uploadDirectRailExcel: string;
  uploadSOCDropOffExcel: string;
  processingFile: string; // For file parsing status

  calculationMode: string;
  calculationMode_SeaRail: string;
  calculationMode_DirectRail: string;

  seaMargin: string;
  railMargin: string;

  shipmentType: string;
  shipmentType_COC: string;
  shipmentType_SOC: string;

  originPort: string;
  originPortPlaceholder_Loading: string;
  originPortPlaceholder_NoData: string;
  originPortPlaceholder_Select: string;

  destinationPortSea: string;
  destinationPortSeaPlaceholder_Loading: string;
  destinationPortSeaPlaceholder_NoData: string;
  destinationPortSeaPlaceholder_SelectOrigin: string;
  destinationPortSeaPlaceholder_NoDestForOrigin: string;
  destinationPortSeaPlaceholder_Select: string;
  destPort_Placeholder_Vladivostok: string;


  seaLineCompany: string;
  seaLineCompanyPlaceholder_Loading: string;
  seaLineCompanyPlaceholder_NoData: string;
  seaLineCompanyPlaceholder_SelectOD: string;
  seaLineCompanyPlaceholder_NoLinesForOD: string;
  seaLineCompanyPlaceholder_Select: string;
  seaLineCompany_NoneOption: string;


  containerType: string;
  containerTypePlaceholder_Loading: string;
  containerTypePlaceholder_NoData: string;
  containerTypePlaceholder_Select: string;


  destinationCityRail: string;
  destinationCityRailPlaceholder_Loading: string;
  destinationCityRailPlaceholder_NoData: string;
  destinationCityRailPlaceholder_NoRailDestLoaded: string;
  destinationCityRailPlaceholder_SelectOriginContainer: string;
  destinationCityRailPlaceholder_SelectContainer: string;
  destinationCityRailPlaceholder_SelectOrigin: string;
  destinationCityRailPlaceholder_NoHubsForSelection: string;
  destinationCityRailPlaceholder_Select: string;
  rusCity_Placeholder_NoRailHubsForSeaDest: string;


  stationRail: string;
  stationRailPlaceholder_Loading: string;
  stationRailPlaceholder_NoData: string;
  stationRailPlaceholder_SelectDestCity: string;
  stationRailPlaceholder_NoStationsForCity: string;
  stationRailPlaceholder_Select: string;

  getPriceAndCommentary: string;
  calculateBestPrice: string;
  calculating: string; 
  processingButton: string; 

  placeholder_UploadSeaRailExcel: string;
  placeholder_UploadDirectRailExcel: string;

  // DirectRailFormFields placeholders
  directRail_CityOfDeparture: string;
  directRail_DestCity: string;
  directRail_AgentName: string;
  directRail_Incoterms: string;
  directRail_Border: string;
  
  directRail_Placeholder_DepCity_Loading: string;
  directRail_Placeholder_DepCity_NoData: string;
  directRail_Placeholder_DepCity_Select: string;

  directRail_Placeholder_DestCity_Loading: string;
  directRail_Placeholder_DestCity_NoData: string;
  directRail_Placeholder_DestCity_Select: string;
  
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

  // SelectItem disabled states (can be functions if they need dynamic parts)
  select_disabled_UploadExcel: string;
  select_disabled_LoadingOptions: string;
  select_disabled_NoOptionsLoaded: string;
  select_disabled_SelectDependencyFirst: (fieldName: string) => string; // Example
  select_disabled_NoOptionsForSelection: string;
  select_disabled_NoOptionsInExcel: string;


  // NavLinks
  nav_Dashboard: string;
  nav_Calculator: string;
  nav_Settings: string;
}

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: Translations;
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

// Default English translations to ensure all keys are present.
const defaultEnTranslations: Translations = {
  settings: "Settings",
  english: "English",
  russian: "Russian",
  powerLogTitle: "PowerLog",
  powerLogDescription: "Calculate shipping costs and get insights for PowerLog.",
  uploadSeaRailExcel: "Upload Sea+Rail Excel",
  uploadDirectRailExcel: "Upload Direct Rail Excel",
  uploadSOCDropOffExcel: "Upload SOC Drop-off Excel",
  processingFile: "Processing...",
  calculationMode: "Calculation Mode",
  calculationMode_SeaRail: "Sea + Rail",
  calculationMode_DirectRail: "Direct Rail",
  seaMargin: "Sea Margin",
  railMargin: "Rail Margin",
  shipmentType: "Shipment Type",
  shipmentType_COC: "COC",
  shipmentType_SOC: "SOC",
  originPort: "Origin Port",
  originPortPlaceholder_Loading: "Loading ports...",
  originPortPlaceholder_NoData: "Upload Sea+Rail Excel",
  originPortPlaceholder_Select: "Select origin port",
  destinationPortSea: "Destination Port (Sea)",
  destinationPortSeaPlaceholder_Loading: "Loading ports...",
  destinationPortSeaPlaceholder_NoData: "Upload Excel",
  destinationPortSeaPlaceholder_SelectOrigin: "Select Origin Port First",
  destinationPortSeaPlaceholder_NoDestForOrigin: "No destinations for origin",
  destinationPortSeaPlaceholder_Select: "Select sea destination port",
  destPort_Placeholder_Vladivostok: "Владивосток",
  seaLineCompany: "Sea Line Company",
  seaLineCompanyPlaceholder_Loading: "Loading...",
  seaLineCompanyPlaceholder_NoData: "Upload Sea+Rail Excel",
  seaLineCompanyPlaceholder_SelectOD: "Select Origin & Dest",
  seaLineCompanyPlaceholder_NoLinesForOD: "No lines for this O/D",
  seaLineCompanyPlaceholder_Select: "Select sea line (or None)",
  seaLineCompany_NoneOption: "None (Get General Commentary)",
  containerType: "Container Type",
  containerTypePlaceholder_Loading: "Loading...",
  containerTypePlaceholder_NoData: "Upload Sea+Rail Excel",
  containerTypePlaceholder_Select: "Select container type",
  destinationCityRail: "Destination City (Rail)",
  destinationCityRailPlaceholder_Loading: "Loading cities...",
  destinationCityRailPlaceholder_NoData: "Upload Sea+Rail Excel",
  destinationCityRailPlaceholder_NoRailDestLoaded: "No rail destinations loaded",
  destinationCityRailPlaceholder_SelectOriginContainer: "Select Origin & Container",
  destinationCityRailPlaceholder_SelectContainer: "Select Container Type first",
  destinationCityRailPlaceholder_SelectOrigin: "Select Origin Port first",
  destinationCityRailPlaceholder_NoHubsForSelection: "No rail hubs for current selection",
  destinationCityRailPlaceholder_Select: "Select city",
  rusCity_Placeholder_NoRailHubsForSeaDest: "No rail hubs for Sea Dest.",
  stationRail: "Station (Rail)",
  stationRailPlaceholder_Loading: "Loading...",
  stationRailPlaceholder_NoData: "Upload Sea+Rail Excel",
  stationRailPlaceholder_SelectDestCity: "Select Destination City (Rail) first",
  stationRailPlaceholder_NoStationsForCity: "No stations for this city",
  stationRailPlaceholder_Select: "Select station (optional)",
  getPriceAndCommentary: "Get Price & Commentary",
  calculateBestPrice: "Calculate Best Price",
  calculating: "Calculating...",
  processingButton: "Processing...",
  placeholder_UploadSeaRailExcel: "Upload Sea+Rail Excel",
  placeholder_UploadDirectRailExcel: "Upload Direct Rail Excel",
  directRail_CityOfDeparture: "City of Departure",
  directRail_DestCity: "Destination City",
  directRail_AgentName: "Agent name (optional)",
  directRail_Incoterms: "Incoterms",
  directRail_Border: "Border",
  directRail_Placeholder_DepCity_Loading: "Loading cities...",
  directRail_Placeholder_DepCity_NoData: "Upload Direct Rail Excel",
  directRail_Placeholder_DepCity_Select: "Select departure city",
  directRail_Placeholder_DestCity_Loading: "Loading cities...",
  directRail_Placeholder_DestCity_NoData: "Upload Direct Rail Excel",
  directRail_Placeholder_DestCity_Select: "Select destination city",
  directRail_Placeholder_Agent_Loading: "Loading agents...",
  directRail_Placeholder_Agent_NoData: "Upload Direct Rail Excel",
  directRail_Placeholder_Agent_SelectCities: "Select Departure & Destination Cities",
  directRail_Placeholder_Agent_Select: "Select agent (optional)",
  directRail_Placeholder_Agent_NoAgentsForSelection: "No agents for current selection",
  directRail_Placeholder_Agent_NoAgentsInExcel: "No agents in Excel",
  directRail_Placeholder_Incoterms_Loading: "Loading incoterms...",
  directRail_Placeholder_Incoterms_NoData: "Upload Direct Rail Excel",
  directRail_Placeholder_Incoterms_SelectCities: "Select Departure & Destination Cities",
  directRail_Placeholder_Incoterms_Select: "Select incoterms",
  directRail_Placeholder_Incoterms_NoIncotermsForSelection: "No incoterms for current selection",
  directRail_Placeholder_Incoterms_NoIncotermsInExcel: "No incoterms in Excel",
  directRail_Placeholder_Border_Loading: "Loading borders...",
  directRail_Placeholder_Border_NoData: "Upload Direct Rail Excel",
  directRail_Placeholder_Border_SelectIncoterms: "Select Incoterms first",
  directRail_Placeholder_Border_Select: "Select border",
  directRail_Placeholder_Border_NoBordersForSelection: "No borders for current selection",
  directRail_Placeholder_Border_NoBordersInExcel: "No borders in Excel",
  select_disabled_UploadExcel: "Upload Excel",
  select_disabled_LoadingOptions: "Loading options...",
  select_disabled_NoOptionsLoaded: "No options loaded",
  select_disabled_SelectDependencyFirst: (fieldName: string) => `Select ${fieldName} first`,
  select_disabled_NoOptionsForSelection: "No options for current selection",
  select_disabled_NoOptionsInExcel: "No options in Excel",
  nav_Dashboard: "Dashboard",
  nav_Calculator: "Calculator",
  nav_Settings: "Settings",
};

const translationsData: Record<Language, Partial<Translations>> = {
  en: {
    ...defaultEnTranslations, // Start with all English keys
  },
  ru: {
    // Common
    settings: "Настройки",
    english: "Английский",
    russian: "Русский",

    // PortPriceFinderForm specific
    powerLogTitle: "PowerLog",
    powerLogDescription_RU_ONLY_REMOVED: " ", // For RU, this description is removed
    
    uploadSeaRailExcel: "Загрузите Море + Ж/Д файл",
    uploadDirectRailExcel: "Загрузите Прямое ЖД файл",
    uploadSOCDropOffExcel: "Загрузите SOC Drop-off файл",
    processingFile: "Обработка...",

    calculationMode: "Тип просчета",
    calculationMode_SeaRail: "Море + ЖД",
    calculationMode_DirectRail: "Прямое ЖД",
    
    seaMargin: "Море маржа",
    railMargin: "Ж/Д маржа",
    
    shipmentType: "Собственность контейнера",
    shipmentType_COC: "COC",
    shipmentType_SOC: "SOC",

    originPort: "Порт отправки",
    originPortPlaceholder_Loading: "Загрузка портов...",
    originPortPlaceholder_NoData: "Загрузите Море + Ж/Д файл",
    originPortPlaceholder_Select: "Выберите порт отправки",
    
    destinationPortSea: "Порт назначения",
    destinationPortSeaPlaceholder_Loading: "Загрузка портов...",
    destinationPortSeaPlaceholder_NoData: "Загрузите файл",
    destinationPortSeaPlaceholder_SelectOrigin: "Сначала выберите порт отправки",
    destinationPortSeaPlaceholder_NoDestForOrigin: "Нет назначений для этого порта",
    destinationPortSeaPlaceholder_Select: "Выберите морской порт назначения",
    destPort_Placeholder_Vladivostok: "Владивосток",


    seaLineCompany: "Название Морской Линии",
    seaLineCompanyPlaceholder_Loading: "Загрузка...",
    seaLineCompanyPlaceholder_NoData: "Загрузите Море + Ж/Д файл",
    seaLineCompanyPlaceholder_SelectOD: "Выберите Отправку и Назначение",
    seaLineCompanyPlaceholder_NoLinesForOD: "Нет линий для этого О/Н",
    seaLineCompanyPlaceholder_Select: "Выберите линию (или Пусто)",
    seaLineCompany_NoneOption: "Пусто",

    containerType: "Тип Контейнера",
    containerTypePlaceholder_Loading: "Загрузка...",
    containerTypePlaceholder_NoData: "Загрузите Море + Ж/Д файл",
    containerTypePlaceholder_Select: "Выберите тип контейнера",

    destinationCityRail: "Город назначения",
    destinationCityRailPlaceholder_Loading: "Загрузка городов...",
    destinationCityRailPlaceholder_NoData: "Загрузите Море + Ж/Д файл",
    destinationCityRailPlaceholder_NoRailDestLoaded: "Ж/Д назначения не загружены",
    destinationCityRailPlaceholder_SelectOriginContainer: "Выберите Порт Отправки и Контейнер",
    destinationCityRailPlaceholder_SelectContainer: "Сначала выберите тип контейнера",
    destinationCityRailPlaceholder_SelectOrigin: "Сначала выберите порт отправки",
    destinationCityRailPlaceholder_NoHubsForSelection: "Нет Ж/Д хабов для текущего выбора",
    destinationCityRailPlaceholder_Select: "Выберите город",
    rusCity_Placeholder_NoRailHubsForSeaDest: "Нет Ж/Д хабов для морского порта",


    stationRail: "Станция",
    stationRailPlaceholder_Loading: "Загрузка...",
    stationRailPlaceholder_NoData: "Загрузите Море + Ж/Д файл",
    stationRailPlaceholder_SelectDestCity: "Сначала выберите город назначения (Ж/Д)",
    stationRailPlaceholder_NoStationsForCity: "Нет станций для этого города",
    stationRailPlaceholder_Select: "Выберите станцию (необязательно)",

    getPriceAndCommentary: "Посчитать ставку",
    calculateBestPrice: "Лучшие ставки",
    calculating: "Расчет...",
    processingButton: "Обработка...",

    placeholder_UploadSeaRailExcel: "Загрузите Море + Ж/Д файл", // Already specific
    placeholder_UploadDirectRailExcel: "Загрузите Прямое ЖД файл",  // Already specific

    // DirectRailFormFields placeholders
    directRail_CityOfDeparture: "Город отправления",
    directRail_DestCity: "Город назначения",
    directRail_AgentName: "Агент (необязательно)",
    directRail_Incoterms: "Инкотермс",
    directRail_Border: "Граница",

    directRail_Placeholder_DepCity_Loading: "Загрузка городов...",
    directRail_Placeholder_DepCity_NoData: "Загрузите Прямое ЖД файл",
    directRail_Placeholder_DepCity_Select: "Выберите город отправления",

    directRail_Placeholder_DestCity_Loading: "Загрузка городов...",
    directRail_Placeholder_DestCity_NoData: "Загрузите Прямое ЖД файл",
    directRail_Placeholder_DestCity_Select: "Выберите город назначения",
    
    directRail_Placeholder_Agent_Loading: "Загрузка агентов...",
    directRail_Placeholder_Agent_NoData: "Загрузите Прямое ЖД файл",
    directRail_Placeholder_Agent_SelectCities: "Выберите города Отправки и Назначения",
    directRail_Placeholder_Agent_Select: "Выберите агента (необязательно)",
    directRail_Placeholder_Agent_NoAgentsForSelection: "Нет агентов для текущего выбора",
    directRail_Placeholder_Agent_NoAgentsInExcel: "Нет агентов в файле Excel",

    directRail_Placeholder_Incoterms_Loading: "Загрузка инкотермс...",
    directRail_Placeholder_Incoterms_NoData: "Загрузите Прямое ЖД файл",
    directRail_Placeholder_Incoterms_SelectCities: "Выберите города Отправки и Назначения",
    directRail_Placeholder_Incoterms_Select: "Выберите инкотермс",
    directRail_Placeholder_Incoterms_NoIncotermsForSelection: "Нет инкотермс для текущего выбора",
    directRail_Placeholder_Incoterms_NoIncotermsInExcel: "Нет инкотермс в файле Excel",
    
    directRail_Placeholder_Border_Loading: "Загрузка границ...",
    directRail_Placeholder_Border_NoData: "Загрузите Прямое ЖД файл",
    directRail_Placeholder_Border_SelectIncoterms: "Сначала выберите Инкотермс",
    directRail_Placeholder_Border_Select: "Выберите границу",
    directRail_Placeholder_Border_NoBordersForSelection: "Нет границ для текущего выбора",
    directRail_Placeholder_Border_NoBordersInExcel: "Нет границ в файле Excel",

    select_disabled_UploadExcel: "Загрузите Excel",
    select_disabled_LoadingOptions: "Загрузка опций...",
    select_disabled_NoOptionsLoaded: "Опции не загружены",
    select_disabled_SelectDependencyFirst: (fieldName: string) => `Сначала выберите ${fieldName}`,
    select_disabled_NoOptionsForSelection: "Нет опций для текущего выбора",
    select_disabled_NoOptionsInExcel: "Нет опций в Excel",
    
    // NavLinks
    nav_Dashboard: "Дашборд",
    nav_Calculator: "Калькулятор",
    nav_Settings: "Настройки",
  },
};

export const LocalizationProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('ru'); // Default to Russian

  const currentTranslations = React.useMemo(() => {
    return { ...defaultEnTranslations, ...translationsData[language] } as Translations;
  }, [language]);

  const translate = useCallback((key: keyof Translations, replacements?: Record<string, string | number>) => {
    let translationValue = currentTranslations[key] || key; 
    if (typeof translationValue === 'function') {
        const depKey = replacements && Object.keys(replacements)[0];
        const depValue = depKey && replacements ? String(replacements[depKey]) : '';
        // Ensure the function is called with a string argument.
        // This is a simplification; more robust argument handling might be needed if functions expect specific types.
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

