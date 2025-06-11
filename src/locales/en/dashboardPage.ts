// src/locales/en/dashboardPage.ts
import type { Translations } from '@/contexts/LocalizationContext';

export const dashboardPageEnTranslations: Partial<Translations> = {
  // Card: Dashboard Data Not Loaded
  dashboard_DataNotLoaded_Title: "Dashboard Data Not Loaded",
  dashboard_DataNotLoaded_Description: "Please upload the \"Море + Ж/Д\" Excel file on the Calculator page to view dashboard data.",
  dashboard_DataNotLoaded_Button: "Go to Calculator to Upload File",

  // Card: No Dashboard Data Found
  dashboard_NoDataFound_Title: "No Dashboard Data Found",
  dashboard_NoDataFound_Description: "The \"Море + Ж/Д\" Excel file was loaded, but no dashboard sections were found or parsed from its first sheet. Please check the file format.",
  dashboard_BackToCalculator_Button: "Back to Calculator",

  // Main Header
  dashboard_MainTitle: "Sea + Rail Services Dashboard",
  dashboard_MainDescription: "Displaying data from the first sheet of the uploaded \"Море + Ж/Д\" Excel file.",

  // Service Section Card
  dashboard_ServiceSection_FallbackTitle: "Service Section {{sectionNumber}}",

  // Main Table Headers
  dashboard_TableHead_Route: "Route (Origin - Destination)",
  dashboard_TableHead_SeaRate: "Sea Rate",
  dashboard_TableHead_ContainerInfo: "Container Info",
  dashboard_TableHead_CommentsDetails: "Comments / Details",
  dashboard_TableHead_Actions: "Actions",

  // Buttons in Table
  dashboard_CopyRate_Button: "Copy Rate",

  // Railway Legs Section
  dashboard_RailwayLegs_Title: "Available Railway Legs for this Section",

  // Railway Legs Table Headers
  dashboard_RailwayLegs_OriginInfo: "Origin Info",
  dashboard_RailwayLegs_Cost: "Cost",
  dashboard_RailwayLegs_Container: "Container",
  dashboard_RailwayLegs_Comment: "Comment",

  // Card: No Services Found
  dashboard_NoServicesFound_Title: "No Services Found",
  dashboard_NoServicesFound_Description: "The first sheet of your Excel file does not seem to contain data in the expected format for the dashboard.",

  // Toasts (dashboard specific)
  toast_Dashboard_RateCopied: "Rate copied to clipboard.",

  // Fallback Text
  dashboard_NoDataRowsForService: "No data rows found for this service.",
};
