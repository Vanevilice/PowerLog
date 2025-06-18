
// src/lib/guide-content.ts
import type { Translations } from '@/contexts/LocalizationContext';

export interface GuideChapter {
  id: string;
  titleKey: keyof Translations;
  contentKey: keyof Translations;
}

export const guideChapters: GuideChapter[] = [
  {
    id: 'introduction',
    titleKey: 'faq_chapter_introduction_title',
    contentKey: 'faq_chapter_introduction_content',
  },
  {
    id: 'getting-started',
    titleKey: 'faq_chapter_gettingStarted_title',
    contentKey: 'faq_chapter_gettingStarted_content',
  },
  {
    id: 'calculator-page',
    titleKey: 'faq_chapter_calculatorPage_title',
    contentKey: 'faq_chapter_calculatorPage_content',
  },
  {
    id: 'dashboard-page',
    titleKey: 'faq_chapter_dashboardPage_title',
    contentKey: 'faq_chapter_dashboardPage_content',
  },
  {
    id: 'best-prices-page',
    titleKey: 'faq_chapter_bestPricesPage_title',
    contentKey: 'faq_chapter_bestPricesPage_content',
  },
  {
    id: 'instructions-page',
    titleKey: 'faq_chapter_instructionsPage_title',
    contentKey: 'faq_chapter_instructionsPage_content',
  },
  {
    id: 'language-settings',
    titleKey: 'faq_chapter_languageSettings_title',
    contentKey: 'faq_chapter_languageSettings_content',
  },
  {
    id: 'troubleshooting',
    titleKey: 'faq_chapter_troubleshooting_title',
    contentKey: 'faq_chapter_troubleshooting_content',
  },
];
