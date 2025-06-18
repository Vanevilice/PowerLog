
"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocalization } from '@/contexts/LocalizationContext';
import { guideChapters } from '@/lib/guide-content'; // We will create this file
import { HelpCircle } from 'lucide-react';

export default function FAQPage() {
  const { translate } = useLocalization();

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <Card className="w-full max-w-4xl mx-auto shadow-xl rounded-xl bg-card border border-border">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-3">
                <HelpCircle className="h-12 w-12 text-primary" />
            </div>
          <CardTitle className="text-3xl font-bold text-primary">
            {translate('faq_PageTitle')}
          </CardTitle>
          <CardDescription>{translate('faq_PageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {guideChapters.map((chapter, index) => (
              <AccordionItem value={`item-${index}`} key={chapter.id}>
                <AccordionTrigger className="text-lg hover:no-underline">
                  {translate(chapter.titleKey)}
                </AccordionTrigger>
                <AccordionContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground pl-2 pr-2 pt-2 pb-4">
                  <p>{translate(chapter.contentKey)}</p>
                  {/* For actual content, we might render HTML or markdown */}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
