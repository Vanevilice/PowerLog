// src/locales/ru/dashboardPage.ts
import type { Translations } from '@/contexts/LocalizationContext';

export const dashboardPageRuTranslations: Partial<Translations> = {
  // Card: Dashboard Data Not Loaded
  dashboard_DataNotLoaded_Title: "Данные дашборда не загружены",
  dashboard_DataNotLoaded_Description: "Пожалуйста, загрузите Excel-файл \"Море + Ж/Д\" на странице Калькулятора для просмотра данных дашборда.",
  dashboard_DataNotLoaded_Button: "Перейти к Калькулятору для загрузки файла",

  // Card: No Dashboard Data Found
  dashboard_NoDataFound_Title: "Данные для дашборда не найдены",
  dashboard_NoDataFound_Description: "Excel-файл \"Море + Ж/Д\" был загружен, но секции для дашборда не были найдены или обработаны с первого листа. Пожалуйста, проверьте формат файла.",
  dashboard_BackToCalculator_Button: "Вернуться к Калькулятору",

  // Main Header
  dashboard_MainTitle: "Дашборд Море + Ж/Д Услуг",
  dashboard_MainDescription: "Отображение данных с первого листа загруженного Excel-файла \"Море + Ж/Д\".",

  // Service Section Card
  dashboard_ServiceSection_FallbackTitle: "Секция услуг {{sectionNumber}}",

  // Main Table Headers
  dashboard_TableHead_Route: "Маршрут (Отправление - Назначение)",
  dashboard_TableHead_SeaRate: "Морская ставка",
  dashboard_TableHead_ContainerInfo: "Инфо о контейнере",
  dashboard_TableHead_CommentsDetails: "Комментарии / Детали",
};
